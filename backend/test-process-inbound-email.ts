import { supabaseAdmin } from './src/config/supabase';
import { processInboundEmail } from './src/services/inbound-email.service';

async function main() {
  console.log('');
  console.log('========================================');
  console.log('PROCESS INBOUND EMAIL TEST');
  console.log('========================================');
  console.log('');

  const emailId =
    '737b7f4f-d203-4cfa-ba81-17c24899efef';

  // Get the stored email from the database.
  const { data: email, error } = await supabaseAdmin
    .from('email_messages')
    .select('*')
    .eq('id', emailId)
    .single();

  if (error) {
    throw new Error(
      `Failed to load email: ${error.message}`
    );
  }

  if (!email) {
    throw new Error('Email was not found.');
  }

  console.log('Email found:');
  console.log(`From: ${email.from_email}`);
  console.log(`To: ${email.to_email}`);
  console.log(`Subject: ${email.subject}`);
  console.log('');

  const result = await processInboundEmail({
    emailMessageId: email.id,
    providerMessageId: email.provider_message_id,
    senderEmail: email.from_email,
    recipientEmail: email.to_email,
    subject: email.subject,
    body: email.body,
  });

  console.log('========================================');
  console.log('PROCESSING RESULT');
  console.log('========================================');
  console.log('');

  console.log(JSON.stringify(result, null, 2));

  console.log('');
  console.log('Inbound email processed successfully.');
  console.log('');
}

main().catch((error) => {
  console.error('');
  console.error('Inbound email processing failed:');
  console.error(error);
  process.exit(1);
});