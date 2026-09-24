import { createApp } from './app';
import { env } from './config/env';
import { processGmailTickets } from './services/gmail-ticket-automation.service';

const app = createApp();

const GMAIL_CHECK_INTERVAL = 30 * 1000; // 30 seconds

let gmailCheckRunning = false;

async function runGmailTicketAutomation() {
  if (gmailCheckRunning) {
    console.log(
      '⏳ Gmail ticket automation is already running. Skipping this cycle.'
    );
    return;
  }

  gmailCheckRunning = true;

  try {
    console.log('');
    console.log('📧 Checking Gmail for new support emails...');

    await processGmailTickets();

    console.log('✅ Gmail check completed.');
  } catch (error) {
    console.error(
      '❌ Gmail ticket automation failed:'
    );

    console.error(error);
  } finally {
    gmailCheckRunning = false;
  }
}

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `✅ Backend API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`
  );

  // eslint-disable-next-line no-console
  console.log(
    `   Email provider: ${env.EMAIL_PROVIDER}`
  );

  console.log(
    '📧 Automatic Gmail ticket processing: ENABLED'
  );

  console.log(
    '⏱️ Gmail check interval: 30 seconds'
  );

  // Run once shortly after the server starts.
  setTimeout(() => {
    void runGmailTicketAutomation();
  }, 3000);

  // Continue checking Gmail automatically.
  setInterval(() => {
    void runGmailTicketAutomation();
  }, GMAIL_CHECK_INTERVAL);
});