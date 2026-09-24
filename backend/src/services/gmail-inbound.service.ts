import { google } from 'googleapis';
import { env } from '../config/env';

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

/**
 * Extract only the email address from a Gmail header.
 *
 * Example:
 * "Dudekula Bajivali <bajivali2222@gmail.com>"
 * becomes:
 * "bajivali2222@gmail.com"
 */
function extractEmailAddress(
  headerValue: string
): string {
  const match = headerValue.match(
    /<\s*([^<>@\s]+@[^<>@\s]+)\s*>/
  );

  if (match) {
    return match[1].trim().toLowerCase();
  }

  return headerValue
    .trim()
    .toLowerCase();
}

/**
 * Check whether this email looks like a
 * Network Switch Support email.
 *
 * This prevents unrelated inbox emails such as:
 * - LinkedIn
 * - Google security alerts
 * - Job alerts
 * - Other personal emails
 *
 * from becoming support tickets.
 */
function isSupportEmail(
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string
): boolean {
  const supportMailbox =
    env.EMAIL_FROM
      .trim()
      .toLowerCase();

  const normalizedFromEmail =
    fromEmail.trim().toLowerCase();

  const normalizedToEmail =
    toEmail.trim().toLowerCase();

  // Ignore emails sent by our own support mailbox.
  if (
    supportMailbox &&
    normalizedFromEmail === supportMailbox
  ) {
    return false;
  }

  // Email must be addressed to our support mailbox.
  if (
    supportMailbox &&
    normalizedToEmail !== supportMailbox
  ) {
    return false;
  }

  const combinedText =
    `${subject}\n${body}`;

  // Recognizable support-ticket fields.
  const hasMacId =
    /(?:MAC\s*ID|MAC\s*ADDRESS|MAC)\s*:/i.test(
      combinedText
    );

  const hasIssueDescription =
    /(?:Issue\s*Description|Issue|Problem|Problem\s*Description)\s*:/i.test(
      combinedText
    );

  const hasReferenceNumber =
    /(?:Reference\s*Number|Reference\s*No|Reference|Ref\s*Number|Ref\s*No)\s*:/i.test(
      combinedText
    );

  return (
    hasMacId ||
    hasIssueDescription ||
    hasReferenceNumber
  );
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
    return decodeBase64Url(
      payload.body.data
    );
  }

  // Multipart email
  if (Array.isArray(payload.parts)) {
    // Prefer text/plain
    for (const part of payload.parts) {
      if (
        part.mimeType === 'text/plain' &&
        part.body?.data
      ) {
        return decodeBase64Url(
          part.body.data
        );
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
    return decodeBase64Url(
      payload.body.data
    );
  }

  return '';
}

/**
 * Create the Gmail API client using
 * production environment variables.
 *
 * This works both locally and on Vercel.
 *
 * No credentials.json or token.json
 * files are required.
 */
async function getGmailClient() {
  if (
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.GOOGLE_REFRESH_TOKEN
  ) {
    throw new Error(
      'Google Gmail OAuth environment variables are not configured.'
    );
  }

  const oauth2Client =
    new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET
    );

  oauth2Client.setCredentials({
    refresh_token:
      env.GOOGLE_REFRESH_TOKEN,
  });

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
  const gmail =
    await getGmailClient();

  const listResponse =
    await gmail.users.messages.list({
      userId: 'me',

      // Read only inbox messages.
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

    const message =
      messageResponse.data;

    if (!message.id) {
      continue;
    }

    const headers =
      (message.payload?.headers || []) as GmailHeader[];

    const rawFromEmail =
      getHeader(
        headers,
        'From'
      );

    const rawToEmail =
      getHeader(
        headers,
        'To'
      );

    const fromEmail =
      extractEmailAddress(
        rawFromEmail
      );

    const toEmail =
      extractEmailAddress(
        rawToEmail
      );

    const cc =
      getHeader(
        headers,
        'Cc'
      );

    const subject =
      getHeader(
        headers,
        'Subject'
      );

    const body =
      extractBody(
        message.payload
      );

    // Ignore unrelated emails.
    if (
      !isSupportEmail(
        fromEmail,
        toEmail,
        subject,
        body
      )
    ) {
      console.log(
        `FILTERED: ${message.id} - ${subject}`
      );

      continue;
    }

    console.log(
      `ACCEPTED: ${message.id} - ${subject}`
    );

    results.push({
      id: message.id,
      threadId:
        message.threadId || null,
      providerMessageId:
        message.id,
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