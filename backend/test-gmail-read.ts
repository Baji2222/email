
import fs from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';

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

function findBody(
  part: any
): { text: string; html: string } {
  let text = '';
  let html = '';

  if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data);

    if (part.mimeType === 'text/plain') {
      text = decoded;
    }

    if (part.mimeType === 'text/html') {
      html = decoded;
    }
  }

  if (part.parts && Array.isArray(part.parts)) {
    for (const child of part.parts) {
      const childBody = findBody(child);

      if (!text && childBody.text) {
        text = childBody.text;
      }

      if (!html && childBody.html) {
        html = childBody.html;
      }
    }
  }

  return { text, html };
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
  console.log('Reading Gmail inbox...');
  console.log('');

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 10,
  });

  const messages = response.data.messages || [];

  console.log(`Found ${messages.length} message(s).`);
  console.log('');

  for (const message of messages) {
    if (!message.id) {
      continue;
    }

    const details = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
      format: 'full',
    });

    const headers =
      details.data.payload?.headers || [];

    const getHeader = (name: string) =>
      headers.find(
        (header) =>
          header.name?.toLowerCase() ===
          name.toLowerCase()
      )?.value || '-';

    const body = findBody(
      details.data.payload || {}
    );

    console.log('========================================');
    console.log(`Message ID : ${message.id}`);
    console.log(`From       : ${getHeader('From')}`);
    console.log(`To         : ${getHeader('To')}`);
    console.log(`Subject    : ${getHeader('Subject')}`);
    console.log(`Date       : ${getHeader('Date')}`);
    console.log('');
    console.log('--------------- EMAIL BODY ---------------');

    if (body.text) {
      console.log(body.text);
    } else if (body.html) {
      console.log(body.html);
    } else {
      console.log('[No readable body found]');
    }

    console.log('------------------------------------------');
    console.log('');
  }

  console.log('Gmail body read test completed.');
}

main().catch((error) => {
  console.error('');
  console.error('Gmail body read test failed:');
  console.error(error);
  process.exit(1);
});