import { supabaseAdmin } from '../config/supabase';
import { fetchInboundGmailMessages } from './gmail-inbound.service';
import { processInboundEmail } from './inbound-email.service';

export async function processGmailTickets() {
  console.log('');
  console.log('========================================');
  console.log('GMAIL TICKET AUTOMATION');
  console.log('========================================');
  console.log('');

  const messages = await fetchInboundGmailMessages();

  console.log(`Gmail messages found: ${messages.length}`);
  console.log('');

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      /*
       * Check whether this Gmail message already exists
       * in our database.
       */
      const { data: existingEmail, error: findError } =
        await supabaseAdmin
          .from('email_messages')
          .select('id, ticket_id')
          .eq('provider', 'gmail')
          .eq(
            'provider_message_id',
            message.providerMessageId
          )
          .maybeSingle();

      if (findError) {
        throw new Error(
          `Failed to check existing email: ${findError.message}`
        );
      }

      /*
       * Already processed:
       * the email already has a ticket.
       */
      if (existingEmail?.ticket_id) {
        console.log(
          `SKIPPED: ${message.providerMessageId} - already linked to ticket ${existingEmail.ticket_id}`
        );

        skipped++;
        continue;
      }

      /*
       * If the email does not exist in our database,
       * save it first.
       */
      let emailMessageId = existingEmail?.id;

      if (!emailMessageId) {
        const { data: insertedEmail, error: insertError } =
          await supabaseAdmin
            .from('email_messages')
            .insert({
              ticket_id: null,
              direction: 'INBOUND',
              provider: 'gmail',
              provider_message_id:
                message.providerMessageId,
              from_email: message.fromEmail,
              to_email: message.toEmail,
              cc: message.cc || null,
              bcc: null,
              subject: message.subject,
              body: message.body,
              sent_at: message.internalDate
                ? new Date(
                    Number(message.internalDate)
                  ).toISOString()
                : null,
              delivery_status: 'PENDING',
              error_message: null,
            })
            .select('id')
            .single();

        if (insertError) {
          /*
           * Another process may have inserted the same
           * Gmail message at the same time.
           *
           * Re-check the database before failing.
           */
          const { data: concurrentEmail } =
            await supabaseAdmin
              .from('email_messages')
              .select('id, ticket_id')
              .eq('provider', 'gmail')
              .eq(
                'provider_message_id',
                message.providerMessageId
              )
              .maybeSingle();

          if (concurrentEmail?.ticket_id) {
            console.log(
              `SKIPPED: ${message.providerMessageId} - processed concurrently`
            );

            skipped++;
            continue;
          }

          if (!concurrentEmail) {
            throw new Error(
              `Failed to save inbound email: ${insertError.message}`
            );
          }

          emailMessageId = concurrentEmail.id;
        } else {
          emailMessageId = insertedEmail.id;
        }
      }

      /*
       * Process the email using our existing ticket
       * matching and ticket creation logic.
       */
      const result = await processInboundEmail({
        emailMessageId,
        providerMessageId:
          message.providerMessageId,
        senderEmail: message.fromEmail,
        recipientEmail: message.toEmail,
        subject: message.subject,
        body: message.body,
      });

      console.log(
        `PROCESSED: ${message.providerMessageId}`
      );

      console.log(
        JSON.stringify(result, null, 2)
      );

      console.log('');

      processed++;
    } catch (error) {
      failed++;

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        `FAILED: ${message.providerMessageId}`
      );

      console.error(errorMessage);
      console.error('');

      /*
       * If the email was already saved, record the
       * processing failure so we can retry it later.
       */
      const { error: updateError } =
        await supabaseAdmin
          .from('email_messages')
          .update({
            delivery_status: 'FAILED',
            error_message: errorMessage,
          })
          .eq(
            'provider_message_id',
            message.providerMessageId
          )
          .eq('provider', 'gmail');

      if (updateError) {
        console.error(
          `Failed to record email processing error: ${updateError.message}`
        );
      }
    }
  }

  console.log('========================================');
  console.log('AUTOMATION SUMMARY');
  console.log('========================================');
  console.log(`Processed: ${processed}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);
  console.log('');
  console.log('Gmail ticket automation completed.');
  console.log('');

  return {
    total: messages.length,
    processed,
    skipped,
    failed,
  };
}