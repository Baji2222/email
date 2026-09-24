import { google } from 'googleapis';
import { env } from '../config/env';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailProvider {
  sendEmail(message: EmailMessage): Promise<void>;
}

class GmailEmailProvider implements EmailProvider {
  private async getGmailClient() {
    if (
      !env.GOOGLE_CLIENT_ID ||
      !env.GOOGLE_CLIENT_SECRET ||
      !env.GOOGLE_REFRESH_TOKEN
    ) {
      throw new Error(
        'Google Gmail OAuth environment variables are not configured.'
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
    });

    return google.gmail({
      version: 'v1',
      auth: oauth2Client,
    });
  }

  private createRawMessage(
    message: EmailMessage
  ): string {
    const boundary =
      `----=_NetworkSwitchSupport_${Date.now()}`;

    const escapeHeader = (
      value: string
    ): string => {
      return value
        .replace(/\r/g, '')
        .replace(/\n/g, '');
    };

    const to = escapeHeader(message.to);
    const subject = escapeHeader(message.subject);
    const from = escapeHeader(env.EMAIL_FROM);

    let rawMessage = '';

    if (message.html) {
      rawMessage = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 8bit',
        '',
        message.text,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: 8bit',
        '',
        message.html,
        '',
        `--${boundary}--`,
      ].join('\r\n');
    } else {
      rawMessage = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 8bit',
        '',
        message.text,
      ].join('\r\n');
    }

    return Buffer.from(
      rawMessage,
      'utf8'
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async sendEmail(
    message: EmailMessage
  ): Promise<void> {
    const gmail =
      await this.getGmailClient();

    const raw =
      this.createRawMessage(message);

    const result =
      await gmail.users.messages.send({
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

    console.log(
      `EMAIL_SENT: ${result.data.id} From ${env.EMAIL_FROM}`
    );
  }
}

class MockEmailProvider
  implements EmailProvider {
  async sendEmail(
    message: EmailMessage
  ): Promise<void> {
    console.log(
      'MOCK_EMAIL:',
      JSON.stringify(message, null, 2)
    );
  }
}

class EmailService {
  private provider: EmailProvider;

  constructor() {
    this.provider =
      env.EMAIL_PROVIDER === 'gmail'
        ? new GmailEmailProvider()
        : new MockEmailProvider();
  }

  async sendEmail(
    message: EmailMessage
  ): Promise<void> {
    if (!message.to?.trim()) {
      throw new Error(
        'Email recipient is required.'
      );
    }

    if (!message.subject?.trim()) {
      throw new Error(
        'Email subject is required.'
      );
    }

    if (!message.text?.trim()) {
      throw new Error(
        'Email text is required.'
      );
    }

    await this.provider.sendEmail(
      message
    );
  }

  async sendTicketResolutionEmail(
    params: {
      customerEmail: string;
      customerName?: string | null;
      ticketNumber: string;
      issueDescription?: string | null;
      resolution?: string | null;
      solvedAt?: string | null;
      macId?: string | null;
      referenceNumber?: string | null;
    }
  ): Promise<void> {
    const customerName =
      params.customerName?.trim() ||
      'Customer';

    const issueDescription =
      params.issueDescription?.trim() ||
      'Not provided';

    const resolution =
      params.resolution?.trim() ||
      'The reported issue has been resolved.';

    const solvedAt =
      params.solvedAt?.trim() ||
      'Not provided';

    const macId =
      params.macId?.trim() ||
      'Not provided';

    const referenceNumber =
      params.referenceNumber?.trim() ||
      'Not provided';

    const subject =
      `Ticket ${params.ticketNumber} - Resolution Confirmation`;

    const text = [
      `Dear ${customerName},`,
      '',
      `Your support ticket ${params.ticketNumber} has been resolved.`,
      '',
      'Ticket Number:',
      params.ticketNumber,
      '',
      'Reference Number:',
      referenceNumber,
      '',
      'MAC ID:',
      macId,
      '',
      'Issue Description:',
      issueDescription,
      '',
      'Resolution:',
      resolution,
      '',
      'Solved At:',
      solvedAt,
      '',
      'If you experience the issue again, please reply to this email and mention your ticket number.',
      '',
      'Regards,',
      'Network Switch Support',
    ].join('\n');

    const html = `
      <html>
        <body>
          <p>Dear ${customerName},</p>

          <p>
            Your support ticket
            <strong>${params.ticketNumber}</strong>
            has been resolved.
          </p>

          <p>
            <strong>Ticket Number:</strong><br>
            ${params.ticketNumber}
          </p>

          <p>
            <strong>Reference Number:</strong><br>
            ${referenceNumber}
          </p>

          <p>
            <strong>MAC ID:</strong><br>
            ${macId}
          </p>

          <p>
            <strong>Issue Description:</strong><br>
            ${issueDescription}
          </p>

          <p>
            <strong>Resolution:</strong><br>
            ${resolution}
          </p>

          <p>
            <strong>Solved At:</strong><br>
            ${solvedAt}
          </p>

          <p>
            If you experience the issue again, please reply to this email
            and mention your ticket number.
          </p>

          <p>
            Regards,<br>
            Network Switch Support
          </p>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: params.customerEmail,
      subject,
      text,
      html,
    });
  }
}

export const emailService =
  new EmailService();