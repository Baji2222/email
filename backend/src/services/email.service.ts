import fs from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailProvider {
  sendEmail(message: EmailMessage): Promise<void>;
}

/*
|--------------------------------------------------------------------------
| Gmail Email Provider
|--------------------------------------------------------------------------
| Sends real emails through the Gmail API using the OAuth credentials
| authorized for bajivali400@gmail.com.
|--------------------------------------------------------------------------
*/

class GmailEmailProvider implements EmailProvider {
  private async getGmailClient() {
    const credentialsPath = path.join(
      process.cwd(),
      'credentials.json'
    );

    const tokenPath = path.join(
      process.cwd(),
      'token.json'
    );

    const credentialsFile = JSON.parse(
      await fs.readFile(credentialsPath, 'utf8')
    );

    const tokenFile = JSON.parse(
      await fs.readFile(tokenPath, 'utf8')
    );

    const installed = credentialsFile.installed;

    if (!installed) {
      throw new Error(
        'Invalid Google OAuth credentials.json: installed credentials not found.'
      );
    }

    if (!tokenFile.refresh_token) {
      throw new Error(
        'Invalid token.json: refresh_token not found.'
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      installed.client_id,
      installed.client_secret,
      installed.redirect_uris?.[0] || 'http://localhost'
    );

    oauth2Client.setCredentials({
      access_token: tokenFile.access_token,
      refresh_token: tokenFile.refresh_token,
      scope: tokenFile.scope,
      token_type: tokenFile.token_type,
      expiry_date: tokenFile.expiry_date,
    });

    return google.gmail({
      version: 'v1',
      auth: oauth2Client,
    });
  }

  private createRawMessage(message: EmailMessage): string {
    const boundary = `----=_NetworkSwitchSupport_${Date.now()}`;

    const escapeHeader = (value: string): string => {
      return value
        .replace(/\r/g, '')
        .replace(/\n/g, '');
    };

    const to = escapeHeader(message.to);
    const subject = escapeHeader(message.subject);

    const from = 'bajivali400@gmail.com';

    let mimeMessage = '';

    mimeMessage += `From: ${from}\r\n`;
    mimeMessage += `To: ${to}\r\n`;
    mimeMessage += `Subject: ${subject}\r\n`;
    mimeMessage += `MIME-Version: 1.0\r\n`;

    if (message.html) {
      mimeMessage += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
      mimeMessage += `\r\n`;

      mimeMessage += `--${boundary}\r\n`;
      mimeMessage += `Content-Type: text/plain; charset="UTF-8"\r\n`;
      mimeMessage += `Content-Transfer-Encoding: 8bit\r\n`;
      mimeMessage += `\r\n`;
      mimeMessage += `${message.text}\r\n`;

      mimeMessage += `--${boundary}\r\n`;
      mimeMessage += `Content-Type: text/html; charset="UTF-8"\r\n`;
      mimeMessage += `Content-Transfer-Encoding: 8bit\r\n`;
      mimeMessage += `\r\n`;
      mimeMessage += `${message.html}\r\n`;

      mimeMessage += `--${boundary}--\r\n`;
    } else {
      mimeMessage += `Content-Type: text/plain; charset="UTF-8"\r\n`;
      mimeMessage += `Content-Transfer-Encoding: 8bit\r\n`;
      mimeMessage += `\r\n`;
      mimeMessage += message.text;
    }

    return Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    const gmail = await this.getGmailClient();

    const raw = this.createRawMessage(message);

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
      },
    });

    if (!result.data.id) {
      throw new Error(
        'Gmail API did not return a message ID.'
      );
    }

    console.log('');
    console.log('========================================');
    console.log('          GMAIL EMAIL SENT');
    console.log('========================================');
    console.log(`From    : bajivali400@gmail.com`);
    console.log(`To      : ${message.to}`);
    console.log(`Subject : ${message.subject}`);
    console.log(`Message : ${result.data.id}`);
    console.log('========================================');
    console.log('');
  }
}

/*
|--------------------------------------------------------------------------
| Email Service
|--------------------------------------------------------------------------
*/

class EmailService {
  private provider: EmailProvider;

  constructor() {
    this.provider = new GmailEmailProvider();
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    if (!message.to) {
      throw new Error(
        'Recipient email address is required.'
      );
    }

    if (!message.subject) {
      throw new Error(
        'Email subject is required.'
      );
    }

    if (!message.text) {
      throw new Error(
        'Email message is required.'
      );
    }

    await this.provider.sendEmail(message);
  }

  async sendTicketResolutionEmail(params: {
    customerEmail: string;
    customerName: string;
    ticketNumber: string;
    issueDescription: string;
    resolution: string;
    solvedAt: string;
    macId?: string | null;
    referenceNumber?: string | null;
  }): Promise<void> {
    const {
      customerEmail,
      customerName,
      ticketNumber,
      issueDescription,
      resolution,
      solvedAt,
      macId,
      referenceNumber,
    } = params;

    const subject =
      `Ticket ${ticketNumber} - Resolution Confirmation`;

    const text = `
Dear ${customerName},

This is to inform you that your support ticket has been resolved.

Ticket Number : ${ticketNumber}
Reference     : ${referenceNumber || '-'}
MAC ID        : ${macId || '-'}
Issue         : ${issueDescription}

Resolution:
${resolution}

Resolved At:
${solvedAt}

If you continue to experience the issue or require any further assistance, please reply to this email and mention ticket number ${ticketNumber}.

Regards,
Support Team
`;

    const escapeHtml = (value: string): string => {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const safeCustomerName =
      escapeHtml(customerName);

    const safeTicketNumber =
      escapeHtml(ticketNumber);

    const safeReference =
      escapeHtml(referenceNumber || '-');

    const safeMacId =
      escapeHtml(macId || '-');

    const safeIssue =
      escapeHtml(issueDescription);

    const safeResolution =
      escapeHtml(resolution);

    const safeSolvedAt =
      escapeHtml(solvedAt);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket Resolution</title>
</head>

<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

  <h2>Ticket Resolution Confirmation</h2>

  <p>
    Dear ${safeCustomerName},
  </p>

  <p>
    This is to inform you that your support ticket has been resolved.
  </p>

  <table
    cellpadding="8"
    cellspacing="0"
    border="1"
    style="border-collapse: collapse;"
  >
    <tr>
      <td><strong>Ticket Number</strong></td>
      <td>${safeTicketNumber}</td>
    </tr>

    <tr>
      <td><strong>Reference</strong></td>
      <td>${safeReference}</td>
    </tr>

    <tr>
      <td><strong>MAC ID</strong></td>
      <td>${safeMacId}</td>
    </tr>

    <tr>
      <td><strong>Issue</strong></td>
      <td>${safeIssue}</td>
    </tr>

    <tr>
      <td><strong>Resolved At</strong></td>
      <td>${safeSolvedAt}</td>
    </tr>
  </table>

  <h3>Resolution</h3>

  <p>
    ${safeResolution}
  </p>

  <p>
    If you continue to experience the issue or require further assistance,
    please reply to this email and mention ticket number
    <strong>${safeTicketNumber}</strong>.
  </p>

  <p>
    Regards,<br>
    <strong>Support Team</strong>
  </p>

</body>
</html>
`;

    await this.sendEmail({
      to: customerEmail,
      subject,
      text,
      html,
    });
  }
}

export const emailService =
  new EmailService();