import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';

export const customersRouter = Router();

customersRouter.use(requireAuth);

// GET /api/customers
customersRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const search = String(req.query.search || '').trim();

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `customer_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,office.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
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

// POST /api/customers
customersRouter.post('/', async (req, res, next) => {
  try {
    const {
      customer_name,
      company_name,
      email,
      phone,
      address,
      city,
      state,
      country,
      office,
    } = req.body;

    if (!customer_name?.trim()) {
      return res.status(400).json({
        error: 'Customer name is required.',
      });
    }

    if (!email?.trim()) {
      return res.status(400).json({
        error: 'Email is required.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert({
        customer_name: customer_name.trim(),
        company_name: company_name?.trim() || null,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        country: country?.trim() || 'India',
        office: office?.trim() || null,
      })
      .select()
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

// PATCH /api/customers/:id
customersRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      'customer_name',
      'company_name',
      'email',
      'phone',
      'address',
      'city',
      'state',
      'country',
      'office',
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

    if (updates.email) {
      updates.email = String(updates.email).toLowerCase();
    }

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
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