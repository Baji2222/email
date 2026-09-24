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

function findBody(part: any): string {
  if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data);

    if (part.mimeType === 'text/plain') {
      return decoded;
    }
  }

  if (part.parts && Array.isArray(part.parts)) {
    for (const child of part.parts) {
      const body = findBody(child);

      if (body) {
        return body;
      }
    }
  }

  return '';
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
  console.log('Searching for test customer email...');
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

  console.log(`Found message: ${messageId}`);
  console.log('');

  const details = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers =
    details.data.payload?.headers || [];

  const getHeader = (name: string) =>
    headers.find(
      (header) =>
        header.name?.toLowerCase() ===
        name.toLowerCase()
    )?.value || '';

  const body = findBody(
    details.data.payload || {}
  );

  console.log('========================================');
  console.log('EMAIL INFORMATION');
  console.log('========================================');
  console.log(`From    : ${getHeader('From')}`);
  console.log(`To      : ${getHeader('To')}`);
  console.log(`Subject : ${getHeader('Subject')}`);
  console.log('');

  console.log('========================================');
  console.log('RAW EMAIL BODY');
  console.log('========================================');
  console.log(body);
  console.log('');

  const parsed = parseSupportEmail(body);

  console.log('========================================');
  console.log('PARSED SUPPORT TICKET DATA');
  console.log('========================================');

  console.log(
    `Ticket Number    : ${parsed.ticketNumber ?? '[NOT FOUND]'}`
  );

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
  console.log('Email parser test completed.');
}

main().catch((error) => {
  console.error('');
  console.error('Email parser test failed:');
  console.error(error);
  process.exit(1);
});