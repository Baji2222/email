import { fetchInboundGmailMessages } from './src/services/gmail-inbound.service';

async function main() {
  console.log('');
  console.log('========================================');
  console.log('GMAIL INBOUND READ TEST');
  console.log('========================================');
  console.log('');

  const messages = await fetchInboundGmailMessages();

  console.log(`Messages found: ${messages.length}`);
  console.log('');

  for (const message of messages) {
    console.log('----------------------------------------');
    console.log(`Gmail ID: ${message.providerMessageId}`);
    console.log(`From: ${message.fromEmail}`);
    console.log(`To: ${message.toEmail}`);
    console.log(`Subject: ${message.subject}`);
    console.log(`Date: ${message.internalDate}`);
    console.log('');
    console.log('Body:');
    console.log(message.body);
    console.log('');
  }

  console.log('========================================');
  console.log('GMAIL READ TEST COMPLETE');
  console.log('========================================');
  console.log('');
}

main().catch((error) => {
  console.error('');
  console.error('Gmail inbound read test failed:');
  console.error(error);
  process.exit(1);
});