import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { emailService } from '../services/email.service';
export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

const ALLOWED_STATUSES = [
  'NEW',
  'IN PROGRESS',
  'WAITING FOR CUSTOMER',
  'TESTING',
  'SOLVED',
  'CLOSED',
];

const ALLOWED_PRIORITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

type HistoryEvent =
  | 'TICKET_CREATED'
  | 'CUSTOMER_MESSAGE'
  | 'ADMIN_REPLY'
  | 'EMAIL_SENT'
  | 'EMAIL_FAILED'
  | 'ENGINEER_ASSIGNED'
  | 'INTERNAL_NOTE'
  | 'RESOLUTION'
  | 'STATUS_CHANGE';

function getUserId(req: any): string | null {
  return req.user?.id || null;
}

async function addHistory(
  ticketId: string,
  eventType: HistoryEvent,
  req: any,
  options: {
    message?: string | null;
    oldStatus?: string | null;
    newStatus?: string | null;
    sender?: string | null;
    recipient?: string | null;
  } = {}
) {
  const { error } = await supabaseAdmin
    .from('ticket_history')
    .insert({
      ticket_id: ticketId,
      event_type: eventType,
      sender: options.sender || null,
      recipient: options.recipient || null,
      message: options.message || null,
      old_status: options.oldStatus || null,
      new_status: options.newStatus || null,
      created_by: getUserId(req),
    });

  if (error) {
    throw new Error(`Failed to create ticket history: ${error.message}`);
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/tickets
|--------------------------------------------------------------------------
*/
ticketsRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      100
    );

    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const priority = String(req.query.priority || '').trim();

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('tickets')
      .select(
        `
        *,
        customers (
          id,
          customer_code,
          customer_name,
          company_name,
          email
        ),
        products (
          id,
          mac_id,
          serial_number,
          model
        ),
        orders (
          id,
          order_number,
          reference_number
        ),
        admin_users (
          id,
          email,
          role
        )
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `ticket_number.ilike.%${search}%,mac_id.ilike.%${search}%,serial_number.ilike.%${search}%,reference_number.ilike.%${search}%,location.ilike.%${search}%,office.ilike.%${search}%,issue_description.ilike.%${search}%`
      );
    }

    if (status && ALLOWED_STATUSES.includes(status)) {
      query = query.eq('status', status);
    }

    if (priority && ALLOWED_PRIORITIES.includes(priority)) {
      query = query.eq('priority', priority);
    }

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    res.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/tickets/:id
|--------------------------------------------------------------------------
*/
ticketsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .select(
        `
        *,
        customers (
          id,
          customer_code,
          customer_name,
          company_name,
          email
        ),
        products (
          id,
          mac_id,
          serial_number,
          model
        ),
        orders (
          id,
          order_number,
          reference_number
        ),
        admin_users (
          id,
          email,
          role
        )
        `
      )
      .eq('id', id)
      .single();

    if (error || !ticket) {
      return res.status(404).json({
        error: 'Ticket not found.',
      });
    }

    const { data: history, error: historyError } =
      await supabaseAdmin
        .from('ticket_history')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', {
          ascending: true,
        });

    if (historyError) {
      return res.status(500).json({
        error: historyError.message,
      });
    }

    res.json({
      ticket,
      history: history || [],
    });
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/tickets
|--------------------------------------------------------------------------
*/
ticketsRouter.post('/', async (req, res, next) => {
  try {
    const {
      customer_id,
      product_id,
      order_id,
      mac_id,
      serial_number,
      reference_number,
      location,
      office,
      issue_description,
      priority,
      status,
      assigned_engineer_id,
      resolution_remarks,
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        error: 'Customer is required.',
      });
    }

    if (!issue_description?.trim()) {
      return res.status(400).json({
        error: 'Issue description is required.',
      });
    }

    const ticketPriority = priority || 'MEDIUM';

    if (!ALLOWED_PRIORITIES.includes(ticketPriority)) {
      return res.status(400).json({
        error: 'Invalid ticket priority.',
      });
    }

    const ticketStatus = status || 'NEW';

    if (!ALLOWED_STATUSES.includes(ticketStatus)) {
      return res.status(400).json({
        error: 'Invalid ticket status.',
      });
    }

    let finalMacId = mac_id?.trim() || null;
    let finalSerialNumber = serial_number?.trim() || null;

    /*
     * If a product is selected, automatically take
     * MAC ID and serial number from the product.
     */
    if (product_id) {
      const { data: product, error: productError } =
        await supabaseAdmin
          .from('products')
          .select(
            'id, mac_id, serial_number, customer_id'
          )
          .eq('id', product_id)
          .single();

      if (productError || !product) {
        return res.status(400).json({
          error: 'Selected product was not found.',
        });
      }

      if (product.customer_id !== customer_id) {
        return res.status(400).json({
          error:
            'Selected product does not belong to the selected customer.',
        });
      }

      finalMacId = product.mac_id;
      finalSerialNumber = product.serial_number;
    }

    /*
     * If an order is selected, make sure it belongs
     * to the selected customer.
     */
    if (order_id) {
      const { data: order, error: orderError } =
        await supabaseAdmin
          .from('orders')
          .select('id, customer_id, reference_number')
          .eq('id', order_id)
          .single();

      if (orderError || !order) {
        return res.status(400).json({
          error: 'Selected order was not found.',
        });
      }

      if (order.customer_id !== customer_id) {
        return res.status(400).json({
          error:
            'Selected order does not belong to the selected customer.',
        });
      }
    }

    /*
     * Generate a concurrency-safe ticket number
     * using the PostgreSQL function created below.
     */
    const { data: ticketNumber, error: numberError } =
      await supabaseAdmin.rpc('next_ticket_number');

    if (numberError || !ticketNumber) {
      return res.status(500).json({
        error:
          numberError?.message ||
          'Unable to generate ticket number.',
      });
    }

    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .insert({
        ticket_number: ticketNumber,
        customer_id,
        product_id: product_id || null,
        order_id: order_id || null,
        mac_id: finalMacId,
        serial_number: finalSerialNumber,
        reference_number:
          reference_number?.trim() || null,
        location: location?.trim() || null,
        office: office?.trim() || null,
        issue_description:
          issue_description.trim(),
        priority: ticketPriority,
        status: ticketStatus,
        assigned_engineer_id:
          assigned_engineer_id || null,
        resolution_remarks:
          resolution_remarks?.trim() || null,
        solved_at:
          ticketStatus === 'SOLVED'
            ? new Date().toISOString()
            : null,
        closed_at:
          ticketStatus === 'CLOSED'
            ? new Date().toISOString()
            : null,
      })
      .select('*')
      .single();

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    await addHistory(
      ticket.id,
      'TICKET_CREATED',
      req,
      {
        message: `Ticket ${ticket.ticket_number} created.`,
        newStatus: ticket.status,
      }
    );

    if (assigned_engineer_id) {
      await addHistory(
        ticket.id,
        'ENGINEER_ASSIGNED',
        req,
        {
          message: 'Engineer assigned to ticket.',
        }
      );
    }

    res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| PATCH /api/tickets/:id
|--------------------------------------------------------------------------
| General ticket editing.
|--------------------------------------------------------------------------
*/
ticketsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      'customer_id',
      'product_id',
      'order_id',
      'mac_id',
      'serial_number',
      'reference_number',
      'location',
      'office',
      'issue_description',
      'priority',
      'status',
      'assigned_engineer_id',
      'resolution_remarks',
    ];

    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in req.body) {
        const value = req.body[field];

        updates[field] =
          typeof value === 'string'
            ? value.trim()
            : value;
      }
    }

    if (
      updates.priority &&
      !ALLOWED_PRIORITIES.includes(
        String(updates.priority)
      )
    ) {
      return res.status(400).json({
        error: 'Invalid ticket priority.',
      });
    }

    if (
      updates.status &&
      !ALLOWED_STATUSES.includes(
        String(updates.status)
      )
    ) {
      return res.status(400).json({
        error: 'Invalid ticket status.',
      });
    }

    const { data: oldTicket, error: oldError } =
      await supabaseAdmin
        .from('tickets')
        .select('*')
        .eq('id', id)
        .single();

    if (oldError || !oldTicket) {
      return res.status(404).json({
        error: 'Ticket not found.',
      });
    }

    /*
     * Maintain solved / closed timestamps.
     */
    if (
      updates.status === 'SOLVED' &&
      oldTicket.status !== 'SOLVED'
    ) {
      updates.solved_at = new Date().toISOString();
    }

    if (
      updates.status === 'CLOSED' &&
      oldTicket.status !== 'CLOSED'
    ) {
      updates.closed_at = new Date().toISOString();
    }

    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    /*
     * Record status changes.
     */
    if (
      updates.status &&
      updates.status !== oldTicket.status
    ) {
      await addHistory(
        id,
        'STATUS_CHANGE',
        req,
        {
          oldStatus: oldTicket.status,
          newStatus: String(updates.status),
          message: `Status changed from ${oldTicket.status} to ${updates.status}.`,
        }
      );
    }

    /*
     * Record engineer assignment.
     */
    if (
      'assigned_engineer_id' in updates &&
      updates.assigned_engineer_id !==
        oldTicket.assigned_engineer_id
    ) {
      await addHistory(
        id,
        'ENGINEER_ASSIGNED',
        req,
        {
          message: updates.assigned_engineer_id
            ? 'Engineer assigned to ticket.'
            : 'Engineer assignment removed.',
        }
      );
    }

    /*
     * Record resolution.
     */
    if (
      'resolution_remarks' in updates &&
      updates.resolution_remarks &&
      updates.resolution_remarks !==
        oldTicket.resolution_remarks
    ) {
      await addHistory(
        id,
        'RESOLUTION',
        req,
        {
          message: String(updates.resolution_remarks),
        }
      );
    }

    res.json(ticket);
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/tickets/:id/status
|--------------------------------------------------------------------------
*/
ticketsRouter.post(
  '/:id/status',
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, message } = req.body;

      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
          error: 'Invalid ticket status.',
        });
      }

      const { data: oldTicket, error: oldError } =
        await supabaseAdmin
          .from('tickets')
          .select('id, status')
          .eq('id', id)
          .single();

      if (oldError || !oldTicket) {
        return res.status(404).json({
          error: 'Ticket not found.',
        });
      }

      if (oldTicket.status === status) {
        return res.json(oldTicket);
      }

      const updates: Record<string, unknown> = {
        status,
      };

      if (status === 'SOLVED') {
        updates.solved_at = new Date().toISOString();
      }

      if (status === 'CLOSED') {
        updates.closed_at = new Date().toISOString();
      }

      const { data: ticket, error } =
        await supabaseAdmin
          .from('tickets')
          .update(updates)
          .eq('id', id)
          .select('*')
          .single();

      if (error) {
        return res.status(400).json({
          error: error.message,
        });
      }

      await addHistory(
        id,
        'STATUS_CHANGE',
        req,
        {
          oldStatus: oldTicket.status,
          newStatus: status,
          message:
            message ||
            `Status changed from ${oldTicket.status} to ${status}.`,
        }
      );

      res.json(ticket);
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/tickets/:id/assign
|--------------------------------------------------------------------------
*/
ticketsRouter.post(
  '/:id/assign',
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { assigned_engineer_id } = req.body;

      if (!assigned_engineer_id) {
        return res.status(400).json({
          error: 'Engineer is required.',
        });
      }

      const { data: engineer, error: engineerError } =
        await supabaseAdmin
          .from('admin_users')
          .select('id, email, role, is_active')
          .eq('id', assigned_engineer_id)
          .single();

      if (engineerError || !engineer) {
        return res.status(400).json({
          error: 'Engineer not found.',
        });
      }

      if (engineer.is_active === false) {
        return res.status(400).json({
          error: 'Selected engineer is inactive.',
        });
      }

      const { data: ticket, error } =
        await supabaseAdmin
          .from('tickets')
          .update({
            assigned_engineer_id,
          })
          .eq('id', id)
          .select('*')
          .single();

      if (error || !ticket) {
        return res.status(404).json({
          error: error?.message || 'Ticket not found.',
        });
      }

      await addHistory(
        id,
        'ENGINEER_ASSIGNED',
        req,
        {
          message: `Engineer assigned: ${engineer.email}.`,
        }
      );

      res.json(ticket);
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/tickets/:id/note
|--------------------------------------------------------------------------
*/
ticketsRouter.post(
  '/:id/note',
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { message } = req.body;

      if (!message?.trim()) {
        return res.status(400).json({
          error: 'Internal note is required.',
        });
      }

      const { data: ticket, error } =
        await supabaseAdmin
          .from('tickets')
          .select('id')
          .eq('id', id)
          .single();

      if (error || !ticket) {
        return res.status(404).json({
          error: 'Ticket not found.',
        });
      }

      await addHistory(
        id,
        'INTERNAL_NOTE',
        req,
        {
          message: message.trim(),
        }
      );

      res.status(201).json({
        message: 'Internal note added.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/tickets/:id/resolve
|--------------------------------------------------------------------------
| Marks the ticket SOLVED, records the resolution,
| and sends a resolution email to the customer.
|--------------------------------------------------------------------------
*/
ticketsRouter.post(
  '/:id/resolve',
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { resolution_remarks } = req.body;

      if (!resolution_remarks?.trim()) {
        return res.status(400).json({
          error: 'Resolution remarks are required.',
        });
      }

      const { data: oldTicket, error: oldError } =
        await supabaseAdmin
          .from('tickets')
          .select(`
            *,
            customers (
              id,
              customer_name,
              email
            )
          `)
          .eq('id', id)
          .single();

      if (oldError || !oldTicket) {
        return res.status(404).json({
          error: 'Ticket not found.',
        });
      }

      if (oldTicket.status === 'CLOSED') {
        return res.status(400).json({
          error: 'Closed tickets cannot be resolved again.',
        });
      }

      const customerEmail = oldTicket.customers?.email;

      if (!customerEmail) {
        return res.status(400).json({
          error:
            'Customer does not have an email address. Resolution email cannot be sent.',
        });
      }

      const solvedAt = new Date().toISOString();

      const { data: ticket, error } =
        await supabaseAdmin
          .from('tickets')
          .update({
            status: 'SOLVED',
            resolution_remarks:
              resolution_remarks.trim(),
            solved_at: solvedAt,
          })
          .eq('id', id)
          .select('*')
          .single();

      if (error) {
        return res.status(400).json({
          error: error.message,
        });
      }

      if (oldTicket.status !== 'SOLVED') {
        await addHistory(
          id,
          'STATUS_CHANGE',
          req,
          {
            oldStatus: oldTicket.status,
            newStatus: 'SOLVED',
            message:
              `Status changed from ${oldTicket.status} to SOLVED.`,
          }
        );
      }

      await addHistory(
        id,
        'RESOLUTION',
        req,
        {
          message: resolution_remarks.trim(),
        }
      );

      try {
        await emailService.sendTicketResolutionEmail({
          customerEmail,
          customerName:
            oldTicket.customers?.customer_name ||
            'Customer',
          ticketNumber:
            oldTicket.ticket_number,
          issueDescription:
            oldTicket.issue_description,
          resolution:
            resolution_remarks.trim(),
          solvedAt,
          macId:
            oldTicket.mac_id,
          referenceNumber:
            oldTicket.reference_number,
        });

        await addHistory(
          id,
          'EMAIL_SENT',
          req,
          {
            recipient: customerEmail,
            message:
              `Resolution email sent to ${customerEmail}.`,
          }
        );
      } catch (emailError) {
        const emailMessage =
          emailError instanceof Error
            ? emailError.message
            : 'Unknown email error.';

        await addHistory(
          id,
          'EMAIL_FAILED',
          req,
          {
            recipient: customerEmail,
            message:
              `Resolution email failed: ${emailMessage}`,
          }
        );

        return res.status(200).json({
          ticket,
          emailSent: false,
          message:
            'Ticket was solved, but the resolution email failed.',
        });
      }

      res.json({
        ticket,
        emailSent: true,
        message:
          'Ticket solved and resolution email sent successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/tickets/:id/close
|--------------------------------------------------------------------------
*/
ticketsRouter.post(
  '/:id/close',
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const { data: oldTicket, error: oldError } =
        await supabaseAdmin
          .from('tickets')
          .select('id, status')
          .eq('id', id)
          .single();

      if (oldError || !oldTicket) {
        return res.status(404).json({
          error: 'Ticket not found.',
        });
      }

      if (oldTicket.status !== 'SOLVED') {
        return res.status(400).json({
          error:
            'Only solved tickets can be closed.',
        });
      }

      const { data: ticket, error } =
        await supabaseAdmin
          .from('tickets')
          .update({
            status: 'CLOSED',
            closed_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single();

      if (error) {
        return res.status(400).json({
          error: error.message,
        });
      }

      await addHistory(
        id,
        'STATUS_CHANGE',
        req,
        {
          oldStatus: 'SOLVED',
          newStatus: 'CLOSED',
          message:
            'Ticket closed after resolution.',
        }
      );

      res.json(ticket);
    } catch (error) {
      next(error);
    }
  }
);