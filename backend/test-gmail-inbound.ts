import { supabaseAdmin } from './src/config/supabase';
import { fetchInboundGmailMessages } from './src/services/gmail-inbound.service';
import { processInboundEmail } from './src/services/inbound-email.service';

async function main() {
  console.log('');
  console.log('========================================');
  console.log('GMAIL CONTROLLED TICKET TEST');
  console.log('========================================');
  console.log('');

  const messages = await fetchInboundGmailMessages();

  console.log(`Messages found: ${messages.length}`);
  console.log('');

  // Only process our controlled test email.
  const testMessage = messages.find(
    (message) =>
      message.providerMessageId === '1a0d4a53761cd889'
  );

  if (!testMessage) {
    console.error('Controlled test email was not found.');
    console.error('');
    console.error('Expected Gmail ID: 1a0d4a53761cd889');
    console.error('Expected subject: Poe switch dead');
    console.error('');

    process.exit(1);
  }

  console.log('Controlled test email found.');
  console.log('');
  console.log(`Gmail ID : ${testMessage.providerMessageId}`);
  console.log(`From     : ${testMessage.fromEmail}`);
  console.log(`To       : ${testMessage.toEmail}`);
  console.log(`Subject  : ${testMessage.subject}`);
  console.log(`Date     : ${testMessage.internalDate}`);
  console.log('');

  console.log('--------------- EMAIL BODY ---------------');
  console.log(testMessage.body);
  console.log('-------------------------------------------');
  console.log('');

  // Check whether this Gmail message is already stored.
  const { data: existingEmail, error: existingEmailError } =
    await supabaseAdmin
      .from('email_messages')
      .select('id, ticket_id')
      .eq('provider', 'gmail')
      .eq(
        'provider_message_id',
        testMessage.providerMessageId
      )
      .maybeSingle();

  if (existingEmailError) {
    throw new Error(
      `Failed to check existing email: ${existingEmailError.message}`
    );
  }

  // If already linked to a ticket, do not create another ticket.
  if (existingEmail?.ticket_id) {
    console.log(
      `This email is already linked to ticket ID: ${existingEmail.ticket_id}`
    );
    console.log('');
    console.log('No duplicate ticket will be created.');
    console.log('');

    return;
  }

  let emailMessageId = existingEmail?.id;

  // Store the inbound email if it is not already stored.
  if (!emailMessageId) {
    const { data: insertedEmail, error: insertError } =
      await supabaseAdmin
        .from('email_messages')
        .insert({
          ticket_id: null,
          direction: 'INBOUND',
          provider: 'gmail',
          provider_message_id:
            testMessage.providerMessageId,
          from_email: testMessage.fromEmail,
          to_email: testMessage.toEmail,
          cc: testMessage.cc || null,
          bcc: null,
          subject: testMessage.subject,
          body: testMessage.body,
          sent_at: testMessage.internalDate
            ? new Date(
                Number(testMessage.internalDate)
              ).toISOString()
            : null,
          delivery_status: 'PENDING',
          error_message: null,
        })
        .select('id')
        .single();

    if (insertError) {
      throw new Error(
        `Failed to save inbound email: ${insertError.message}`
      );
    }

    emailMessageId = insertedEmail.id;

    console.log(
      `Inbound email saved with database ID: ${emailMessageId}`
    );
    console.log('');
  } else {
    console.log(
      `Inbound email already exists with database ID: ${emailMessageId}`
    );
    console.log('');
  }

  console.log('Processing inbound email...');
  console.log('');

  const result = await processInboundEmail({
    emailMessageId,
    providerMessageId:
      testMessage.providerMessageId,
    senderEmail: testMessage.fromEmail,
    recipientEmail: testMessage.toEmail,
    subject: testMessage.subject,
    body: testMessage.body,
  });

  console.log('');
  console.log('========================================');
  console.log('TICKET PROCESSING RESULT');
  console.log('========================================');
  console.log(JSON.stringify(result, null, 2));
  console.log('');
  console.log('Gmail controlled ticket test completed.');
  console.log('');
}

main().catch((error) => {
  console.error('');
  console.error('Gmail controlled ticket test failed:');
  console.error(error);
  process.exit(1);
});