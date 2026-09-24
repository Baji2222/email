import { supabaseAdmin } from '../config/supabase';

export type TicketMatchResult =
  | {
      type: 'NO_MATCH';
    }
  | {
      type: 'MATCH';
      ticket: any;
    }
  | {
      type: 'NEEDS_REVIEW';
      tickets: any[];
    };

function normalizeMac(mac: string): string {
  return mac
    .toUpperCase()
    .replace(/[^A-F0-9]/g, '');
}

export async function findMatchingActiveTicket(
  ticketNumber: string | null,
  macId: string | null
): Promise<TicketMatchResult> {

  // --------------------------------------------------
  // 1. Ticket number matching
  // --------------------------------------------------

  if (ticketNumber) {
    const { data, error } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .not('status', 'in', '("SOLVED","CLOSED")')
      .limit(1);

    if (error) {
      throw new Error(
        `Failed to find ticket by ticket number: ${error.message}`
      );
    }

    if (data && data.length === 1) {
      return {
        type: 'MATCH',
        ticket: data[0],
      };
    }
  }

  // --------------------------------------------------
  // 2. MAC matching
  // --------------------------------------------------

  if (macId) {
    const normalizedMac = normalizeMac(macId);

    const { data, error } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .not('mac_id', 'is', null)
      .not('status', 'in', '("SOLVED","CLOSED")');

    if (error) {
      throw new Error(
        `Failed to find ticket by MAC: ${error.message}`
      );
    }

    const matchingTickets = (data || []).filter(
      (ticket) => {
        if (!ticket.mac_id) {
          return false;
        }

        return normalizeMac(ticket.mac_id) === normalizedMac;
      }
    );

    if (matchingTickets.length === 1) {
      return {
        type: 'MATCH',
        ticket: matchingTickets[0],
      };
    }

    if (matchingTickets.length > 1) {
      return {
        type: 'NEEDS_REVIEW',
        tickets: matchingTickets,
      };
    }
  }

  // --------------------------------------------------
  // 3. No active ticket found
  // --------------------------------------------------

  return {
    type: 'NO_MATCH',
  };
}