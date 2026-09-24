import fs from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';
import { parseSupportEmail } from './src/email-parser';

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

function extractEmailAddress(value: string): string | null {
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
  console.log('INBOUND EMAIL TEST');
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
  const subject = getHeader('Subject');
  const date = getHeader('Date');

  const senderEmail =
    extractEmailAddress(fromHeader);

  const body = findPlainTextBody(
    details.data.payload || {}
  );

  if (!body) {
    throw new Error(
      'No plain-text email body was found.'
    );
  }

  const parsed = parseSupportEmail(body);

  console.log('--------------- EMAIL ------------------');
  console.log(`From    : ${fromHeader}`);
  console.log(`Sender  : ${senderEmail ?? '[NOT FOUND]'}`);
  console.log(`To      : ${toHeader}`);
  console.log(`Subject : ${subject}`);
  console.log(`Date    : ${date}`);
  console.log('');

  console.log('------------- PARSED DATA ---------------');

  console.log(
    `Customer Name    : ${parsed.customerName ?? '[NOT FOUND]'}`
  );

  console.log(
    `Customer Email   : ${parsed.customerEmail ?? '[NOT FOUND]'}`
  );

  console.log(
    `MAC ID           : ${parsed.macId ?? '[NOT FOUND]'}`
  );

  console.log(
    `Reference Number : ${parsed.referenceNumber ?? '[NOT FOUND]'}`
  );

  console.log(
    `Location         : ${parsed.location ?? '[NOT FOUND]'}`
  );

  console.log(
    `Office           : ${parsed.office ?? '[NOT FOUND]'}`
  );

  console.log(
    `Issue Description : ${parsed.issueDescription ?? '[NOT FOUND]'}`
  );

  console.log('');
  console.log('========================================');
  console.log('DATABASE ACTION');
  console.log('========================================');
  console.log('NO DATABASE ACTION PERFORMED.');
  console.log('NO TICKET CREATED.');
  console.log('NO TICKET UPDATED.');
  console.log('NO EMAIL SENT.');
  console.log('');

  console.log(
    'Inbound email test completed successfully.'
  );
}

main().catch((error) => {
  console.error('');
  console.error('Inbound email test failed:');
  console.error(error);
  process.exit(1);
});