import fs from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';
import { supabaseAdmin } from './src/config/supabase';

function decodeBase64Url(data: string): string {
  const normalized = data
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  );

  return Buffer.from(padded, 'base64').toString('utf8');
}

function findPlainTextBody(part: any): string {
  if (
    part.mimeType === 'text/plain' &&
    part.body?.data
  ) {
    return decodeBase64Url(part.body.data);
  }

  if (part.parts && Array.isArray(part.parts)) {
    for (const child of part.parts) {
      const body = findPlainTextBody(child);

      if (body) {
        return body;
      }
    }
  }

  return '';
}

function extractEmailAddress(
  value: string
): string | null {
  const match = value.match(
    /<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>/
  );

  if (match) {
    return match[1].toLowerCase();
  }

  const simpleMatch = value.match(
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i
  );

  return simpleMatch
    ? simpleMatch[1].toLowerCase()
    : null;
}

async function main() {
  const credentialsPath = path.join(
    process.cwd(),
    'credentials.json'
  );

  const tokenPath = path.join(
    process.cwd(),
    'token.json'
  );

  const credentials = JSON.parse(
    await fs.readFile(credentialsPath, 'utf8')
  );

  const token = JSON.parse(
    await fs.readFile(tokenPath, 'utf8')
  );

  const installed = credentials.installed;

  if (!installed) {
    throw new Error(
      'Invalid credentials.json: installed credentials not found.'
    );
  }

  const auth = new google.auth.OAuth2(
    installed.client_id,
    installed.client_secret,
    installed.redirect_uris?.[0] || 'http://localhost'
  );

  auth.setCredentials(token);

  const gmail = google.gmail({
    version: 'v1',
    auth,
  });

  console.log('');
  console.log('========================================');
  console.log('INBOUND EMAIL DUPLICATE TEST');
  console.log('========================================');
  console.log('');

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:(bajivali2222@gmail.com) subject:("Network switch issue")',
    maxResults: 1,
  });

  const messages = response.data.messages || [];

  if (messages.length === 0 || !messages[0].id) {
    throw new Error(
      'Test customer email was not found.'
    );
  }

  const messageId = messages[0].id;

  console.log(`Gmail Message ID: ${messageId}`);
  console.log('');

  /*
   * FIRST: Check whether this Gmail message
   * already exists in our database.
   */
  const { data: existingMessage, error: lookupError } =
    await supabaseAdmin
      .from('email_messages')
      .select('id, ticket_id, provider, provider_message_id')
      .eq('provider', 'gmail')
      .eq('provider_message_id', messageId)
      .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Failed to check existing email: ${lookupError.message}`
    );
  }

  /*
   * If the message already exists, STOP.
   */
  if (existingMessage) {
    console.log('========================================');
    console.log('DUPLICATE EMAIL DETECTED');
    console.log('========================================');
    console.log('');
    console.log(
      'This Gmail message is already stored in the database.'
    );
    console.log('');
    console.log(`Database ID : ${existingMessage.id}`);
    console.log(
      `Ticket ID   : ${existingMessage.ticket_id ?? 'NULL'}`
    );
    console.log(
      `Provider    : ${existingMessage.provider}`
    );
    console.log(
      `Message ID  : ${existingMessage.provider_message_id}`
    );
    console.log('');
    console.log('ACTION: SKIPPED');
    console.log('');
    console.log('NO NEW ROW CREATED.');
    console.log('NO TICKET CREATED.');
    console.log('NO TICKET UPDATED.');
    console.log('');
    console.log(
      'Duplicate protection test completed successfully.'
    );

    return;
  }

  /*
   * The code below runs only when the Gmail message
   * does NOT already exist.
   */

  const details = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers =
    details.data.payload?.headers || [];

  const getHeader = (name: string): string => {
    return (
      headers.find(
        (header) =>
          header.name?.toLowerCase() ===
          name.toLowerCase()
      )?.value || ''
    );
  };

  const fromHeader = getHeader('From');
  const toHeader = getHeader('To');
  const ccHeader = getHeader('Cc');
  const bccHeader = getHeader('Bcc');
  const subject = getHeader('Subject');
  const dateHeader = getHeader('Date');

  const fromEmail =
    extractEmailAddress(fromHeader);

  const body = findPlainTextBody(
    details.data.payload || {}
  );

  if (!fromEmail) {
    throw new Error(
      'Could not extract sender email address.'
    );
  }

  if (!body) {
    throw new Error(
      'Could not extract email body.'
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from('email_messages')
      .insert({
        ticket_id: null,
        direction: 'INBOUND',
        provider: 'gmail',
        provider_message_id: messageId,
        from_email: fromEmail,
        to_email: toHeader || null,
        cc: ccHeader || null,
        bcc: bccHeader || null,
        subject: subject || null,
        body,
        sent_at: dateHeader
          ? new Date(dateHeader).toISOString()
          : null,
        delivery_status: 'PENDING',
        error_message: null,
      })
      .select('*')
      .single();

  if (error) {
    throw new Error(
      `Failed to save email_messages row: ${error.message}`
    );
  }

  console.log('========================================');
  console.log('NEW EMAIL SAVED');
  console.log('========================================');
  console.log('');
  console.log(`Database ID : ${data.id}`);
  console.log(`Ticket ID   : ${data.ticket_id ?? 'NULL'}`);
  console.log(`Direction   : ${data.direction}`);
  console.log(`Provider    : ${data.provider}`);
  console.log(
    `Message ID  : ${data.provider_message_id}`
  );
  console.log(`From        : ${data.from_email}`);
  console.log(`Subject     : ${data.subject}`);
  console.log(
    `Status      : ${data.delivery_status}`
  );
  console.log('');
  console.log('NO TICKET CREATED.');
  console.log('NO TICKET UPDATED.');
  console.log('');
  console.log(
    'Inbound email database test completed.'
  );
}

main().catch((error) => {
  console.error('');
  console.error('Inbound email database test failed:');
  console.error(error);
  process.exit(1);
});