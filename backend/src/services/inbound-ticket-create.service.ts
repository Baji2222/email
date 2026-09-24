import { supabaseAdmin } from '../config/supabase';

type CreateInboundTicketInput = {
  customerId: string;
  macId: string | null;
  referenceNumber: string | null;
  location: string | null;
  office: string | null;
  issueDescription: string;
};

export async function createInboundTicket(
  input: CreateInboundTicketInput
) {
  const { data: ticketNumber, error: ticketNumberError } =
    await supabaseAdmin.rpc('next_ticket_number');

  if (ticketNumberError) {
    throw new Error(
      `Failed to generate ticket number: ${ticketNumberError.message}`
    );
  }

  if (!ticketNumber) {
    throw new Error(
      'Ticket number generation returned an empty value.'
    );
  }

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .insert({
      ticket_number: ticketNumber,
      customer_id: input.customerId,
      mac_id: input.macId,
      reference_number: input.referenceNumber,
      location: input.location,
      office: input.office,
      issue_description: input.issueDescription,
      priority: 'MEDIUM',
      status: 'NEW',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `Failed to create inbound ticket: ${error.message}`
    );
  }

  return data;
}