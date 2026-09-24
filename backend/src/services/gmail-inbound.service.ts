import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

type GmailHeader = {
  name?: string | null;
  value?: string | null;
};

function getHeader(
  headers: GmailHeader[] | undefined,
  name: string
): string {
  const header = headers?.find(
    (item) =>
      item.name?.toLowerCase() === name.toLowerCase()
  );

  return header?.value?.trim() || '';
}

function decodeBase64Url(data: string): string {
  const normalized = data
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const padding =
    normalized.length % 4 === 0
      ? ''
      : '='.repeat(4 - (normalized.length % 4));

  return Buffer.from(
    normalized + padding,
    'base64'
  ).toString('utf-8');
}

function extractBody(payload: any): string {
  if (!payload) {
    return '';
  }

  // Plain text body
  if (
    payload.mimeType === 'text/plain' &&
    payload.body?.data
  ) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart email
  if (Array.isArray(payload.parts)) {
    // Prefer text/plain
    for (const part of payload.parts) {
      if (
        part.mimeType === 'text/plain' &&
        part.body?.data
      ) {
        return decodeBase64Url(part.body.data);
      }
    }

    // Recursively search nested parts
    for (const part of payload.parts) {
      const body = extractBody(part);

      if (body) {
        return body;
      }
    }
  }

  // Fallback to any available body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  return '';
}

async function getGmailClient() {
  const credentialsPath = path.join(
    process.cwd(),
    'credentials.json'
  );

  const tokenPath = path.join(
    process.cwd(),
    'token.json'
  );

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      'credentials.json was not found in the backend folder.'
    );
  }

  if (!fs.existsSync(tokenPath)) {
    throw new Error(
      'token.json was not found in the backend folder. Run authorize-gmail.ts first.'
    );
  }

  const credentials = JSON.parse(
    fs.readFileSync(credentialsPath, 'utf-8')
  );

  const installed =
    credentials.installed ||
    credentials.web;

  if (!installed) {
    throw new Error(
      'Invalid Google OAuth credentials.json format.'
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    installed.client_id,
    installed.client_secret,
    installed.redirect_uris?.[0]
  );

  const token = JSON.parse(
    fs.readFileSync(tokenPath, 'utf-8')
  );

  oauth2Client.setCredentials(token);

  return google.gmail({
    version: 'v1',
    auth: oauth2Client,
  });
}

export type GmailInboundMessage = {
  id: string;
  threadId: string | null;
  providerMessageId: string;
  fromEmail: string;
  toEmail: string;
  cc: string;
  subject: string;
  body: string;
  internalDate: string | null;
};

export async function fetchInboundGmailMessages(): Promise<
  GmailInboundMessage[]
> {
  const gmail = await getGmailClient();

  const listResponse =
    await gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox',
      maxResults: 20,
    });

  const messageIds =
    listResponse.data.messages || [];

  const results: GmailInboundMessage[] = [];

  for (const messageInfo of messageIds) {
    if (!messageInfo.id) {
      continue;
    }

    const messageResponse =
      await gmail.users.messages.get({
        userId: 'me',
        id: messageInfo.id,
        format: 'full',
      });

    const message = messageResponse.data;

    // Gmail API can technically return a nullable ID,
    // so explicitly verify it before using it.
    if (!message.id) {
      continue;
    }

    const headers =
      (message.payload?.headers || []) as GmailHeader[];

    const fromEmail = getHeader(
      headers,
      'From'
    );

    const toEmail = getHeader(
      headers,
      'To'
    );

    const cc = getHeader(
      headers,
      'Cc'
    );

    const subject = getHeader(
      headers,
      'Subject'
    );

    const body = extractBody(
      message.payload
    );

    results.push({
      id: message.id,
      threadId: message.threadId || null,
      providerMessageId: message.id,
      fromEmail,
      toEmail,
      cc,
      subject,
      body,
      internalDate:
        message.internalDate || null,
    });
  }

  return results;
}