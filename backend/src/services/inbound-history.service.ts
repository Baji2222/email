import { supabaseAdmin } from '../config/supabase';

type AddInboundHistoryInput = {
  ticketId: string;
  senderEmail: string;
  recipientEmail: string;
  message: string;
};

export async function addInboundCustomerMessage(
  input: AddInboundHistoryInput
) {
  const { data, error } = await supabaseAdmin
    .from('ticket_history')
    .insert({
      ticket_id: input.ticketId,
      event_type: 'CUSTOMER_MESSAGE',
      sender: input.senderEmail,
      recipient: input.recipientEmail,
      message: input.message,
      old_status: null,
      new_status: null,
      created_by: null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `Failed to create inbound ticket history: ${error.message}`
    );
  }

  return data;
}