import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

// GET /api/orders
ordersRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const search = String(req.query.search || '').trim();

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('orders')
      .select(
        `
        *,
        customers (
          customer_code,
          customer_name,
          company_name,
          email
        )
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `order_number.ilike.%${search}%,reference_number.ilike.%${search}%,location.ilike.%${search}%,office.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    res.json({
      data: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders
ordersRouter.post('/', async (req, res, next) => {
  try {
    const {
      customer_id,
      order_date,
      reference_number,
      billing_address,
      shipping_address,
      location,
      office,
      order_status,
      remarks,
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        error: 'Customer is required.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id,
        order_date: order_date || new Date().toISOString().slice(0, 10),
        reference_number: reference_number?.trim() || null,
        billing_address: billing_address?.trim() || null,
        shipping_address: shipping_address?.trim() || null,
        location: location?.trim() || null,
        office: office?.trim() || null,
        order_status: order_status || 'NEW',
        remarks: remarks?.trim() || null,
      })
      .select(
        `
        *,
        customers (
          customer_code,
          customer_name,
          company_name,
          email
        )
        `
      )
      .single();

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/orders/:id
ordersRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      'customer_id',
      'order_date',
      'reference_number',
      'billing_address',
      'shipping_address',
      'location',
      'office',
      'order_status',
      'remarks',
    ];

    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in req.body) {
        updates[field] =
          typeof req.body[field] === 'string'
            ? req.body[field].trim()
            : req.body[field];
      }
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select(
        `
        *,
        customers (
          customer_code,
          customer_name,
          company_name,
          email
        )
        `
      )
      .single();

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});