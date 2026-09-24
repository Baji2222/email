import { supabaseAdmin } from '../config/supabase';
import { parseSupportEmail } from '../email-parser';
import { findMatchingActiveTicket } from './inbound-ticket.service';
import { findOrCreateCustomer } from './inbound-customer.service';
import { createInboundTicket } from './inbound-ticket-create.service';
import { addInboundCustomerMessage } from './inbound-history.service';

type ProcessInboundEmailInput = {
  emailMessageId: string;
  providerMessageId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
};

export async function processInboundEmail(
  input: ProcessInboundEmailInput
) {
  // --------------------------------------------------
  // 0. Duplicate protection
  // --------------------------------------------------

  const { data: existingEmail, error: existingEmailError } =
    await supabaseAdmin
      .from('email_messages')
      .select('id, ticket_id')
      .eq('provider', 'gmail')
      .eq('provider_message_id', input.providerMessageId)
      .maybeSingle();

  if (existingEmailError) {
    throw new Error(
      `Failed to check for duplicate email: ${existingEmailError.message}`
    );
  }

  if (
    existingEmail &&
    existingEmail.id !== input.emailMessageId
  ) {
    return {
      action: 'DUPLICATE',
      emailMessageId: existingEmail.id,
      ticketId: existingEmail.ticket_id,
    };
  }

  if (
    existingEmail &&
    existingEmail.id === input.emailMessageId &&
    existingEmail.ticket_id
  ) {
    return {
      action: 'ALREADY_PROCESSED',
      emailMessageId: existingEmail.id,
      ticketId: existingEmail.ticket_id,
    };
  }

  // --------------------------------------------------
  // 1. Parse email
  // --------------------------------------------------

  // Include subject as well as body so ticket numbers
  // such as SW-000001 can be detected from either place.
  const parsed = parseSupportEmail(
    `${input.subject}\n\n${input.body}`
  );

  // --------------------------------------------------
  // 2. Find or create customer
  // --------------------------------------------------

  // IMPORTANT:
  // The actual Gmail From address is authoritative.
  // Customer Email written inside the email body is
  // informational only.
  const customer = await findOrCreateCustomer(
    input.senderEmail,
    parsed.customerName
  );

  // --------------------------------------------------
  // 3. Find matching active ticket
  // --------------------------------------------------

  const match = await findMatchingActiveTicket(
    parsed.ticketNumber,
    parsed.macId
  );

  // --------------------------------------------------
  // 4. Existing ticket found
  // --------------------------------------------------

  if (match.type === 'MATCH') {
    const ticket = match.ticket;

    // Link the inbound email to the existing ticket.
    const { error: emailUpdateError } = await supabaseAdmin
      .from('email_messages')
      .update({
        ticket_id: ticket.id,
      })
      .eq('id', input.emailMessageId);

    if (emailUpdateError) {
      throw new Error(
        `Failed to link email to existing ticket: ${emailUpdateError.message}`
      );
    }

    // Record the customer message in ticket history.
    await addInboundCustomerMessage({
      ticketId: ticket.id,
      senderEmail: input.senderEmail,
      recipientEmail: input.recipientEmail,
      message: input.body,
    });

    // Update ticket activity timestamp.
    const { error: ticketUpdateError } = await supabaseAdmin
      .from('tickets')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    if (ticketUpdateError) {
      throw new Error(
        `Failed to update ticket activity: ${ticketUpdateError.message}`
      );
    }

    return {
      action: 'ATTACHED',
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      customerId: customer.customerId,
    };
  }

  // --------------------------------------------------
  // 5. Multiple active matches
  // --------------------------------------------------

  if (match.type === 'NEEDS_REVIEW') {
    /*
     * Multiple active tickets have the same MAC.
     *
     * IMPORTANT:
     * We do NOT attach the email to any existing ticket.
     *
     * Instead, create a completely new ticket with
     * status NEEDS REVIEW.
     */

    const issueDescription =
      parsed.issueDescription?.trim() ||
      `Inbound email requires manual review.\n\nSubject: ${input.subject}`;

    const { data: ticketNumber, error: ticketNumberError } =
      await supabaseAdmin.rpc('next_ticket_number');

    if (ticketNumberError) {
      throw new Error(
        `Failed to generate review ticket number: ${ticketNumberError.message}`
      );
    }

    if (!ticketNumber) {
      throw new Error(
        'Review ticket number generation returned an empty value.'
      );
    }

    const { data: reviewTicket, error: reviewTicketError } =
      await supabaseAdmin
        .from('tickets')
        .insert({
          ticket_number: ticketNumber,
          customer_id: customer.customerId,
          mac_id: parsed.macId,
          reference_number: parsed.referenceNumber,
          location: parsed.location,
          office: parsed.office,
          issue_description: issueDescription,
          priority: 'MEDIUM',
          status: 'NEEDS REVIEW',
        })
        .select('*')
        .single();

    if (reviewTicketError) {
      throw new Error(
        `Failed to create NEEDS REVIEW ticket: ${reviewTicketError.message}`
      );
    }

    // Link the inbound email to the newly created review ticket.
    const { error: emailUpdateError } = await supabaseAdmin
      .from('email_messages')
      .update({
        ticket_id: reviewTicket.id,
      })
      .eq('id', input.emailMessageId);

    if (emailUpdateError) {
      throw new Error(
        `Failed to link email to review ticket: ${emailUpdateError.message}`
      );
    }

    // Record ticket creation.
    const { error: historyCreateError } =
      await supabaseAdmin
        .from('ticket_history')
        .insert({
          ticket_id: reviewTicket.id,
          event_type: 'TICKET_CREATED',
          sender: input.senderEmail,
          recipient: input.recipientEmail,
          message:
            'Ticket created from inbound email because multiple active tickets matched the MAC address.',
          old_status: null,
          new_status: 'NEEDS REVIEW',
          created_by: null,
        });

    if (historyCreateError) {
      throw new Error(
        `Failed to create review ticket history: ${historyCreateError.message}`
      );
    }

    // Record the actual customer email.
    await addInboundCustomerMessage({
      ticketId: reviewTicket.id,
      senderEmail: input.senderEmail,
      recipientEmail: input.recipientEmail,
      message: input.body,
    });

    return {
      action: 'CREATED_NEEDS_REVIEW',
      ticketId: reviewTicket.id,
      ticketNumber: reviewTicket.ticket_number,
      customerId: customer.customerId,
      matchedTicketIds: match.tickets.map(
        (ticket) => ticket.id
      ),
    };
  }

  // --------------------------------------------------
  // 6. No active ticket found
  // --------------------------------------------------

  const issueDescription =
    parsed.issueDescription?.trim() ||
    `Inbound support email.\n\nSubject: ${input.subject}`;

  const newTicket = await createInboundTicket({
    customerId: customer.customerId,
    macId: parsed.macId,
    referenceNumber: parsed.referenceNumber,
    location: parsed.location,
    office: parsed.office,
    issueDescription,
  });

  // Link the inbound email to the newly created ticket.
  const { error: emailUpdateError } = await supabaseAdmin
    .from('email_messages')
    .update({
      ticket_id: newTicket.id,
    })
    .eq('id', input.emailMessageId);

  if (emailUpdateError) {
    throw new Error(
      `Failed to link email to new ticket: ${emailUpdateError.message}`
    );
  }

  // Record ticket creation.
  const { error: historyCreateError } =
    await supabaseAdmin
      .from('ticket_history')
      .insert({
        ticket_id: newTicket.id,
        event_type: 'TICKET_CREATED',
        sender: input.senderEmail,
        recipient: input.recipientEmail,
        message: 'Ticket created from inbound customer email.',
        old_status: null,
        new_status: 'NEW',
        created_by: null,
      });

  if (historyCreateError) {
    throw new Error(
      `Failed to create ticket history: ${historyCreateError.message}`
    );
  }

  // Record the actual customer email.
  await addInboundCustomerMessage({
    ticketId: newTicket.id,
    senderEmail: input.senderEmail,
    recipientEmail: input.recipientEmail,
    message: input.body,
  });

  return {
    action: 'CREATED',
    ticketId: newTicket.id,
    ticketNumber: newTicket.ticket_number,
    customerId: customer.customerId,
  };
}