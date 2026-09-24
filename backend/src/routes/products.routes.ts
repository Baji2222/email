import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';

export const productsRouter = Router();

productsRouter.use(requireAuth);

// ---------------------------------------------------------
// Normalize MAC address
// Example:
// AA-BB-CC-DD-EE-FF
// AABBCCDDEEFF
// aa:bb:cc:dd:ee:ff
// becomes:
// AA:BB:CC:DD:EE:FF
// ---------------------------------------------------------
function normalizeMac(mac: string): string {
  const hex = String(mac || '')
    .replace(/[^a-fA-F0-9]/g, '')
    .toUpperCase();

  if (hex.length !== 12) {
    return '';
  }

  return hex.match(/.{2}/g)?.join(':') || '';
}

// ---------------------------------------------------------
// GET /api/products
// ---------------------------------------------------------
productsRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      100
    );

    const search = String(req.query.search || '').trim();

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('products')
      .select(
        `
        *,
        customers (
          customer_code,
          customer_name,
          company_name
        ),
        orders (
          order_number,
          reference_number
        )
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `mac_id.ilike.%${search}%,serial_number.ilike.%${search}%,model.ilike.%${search}%,installation_location.ilike.%${search}%,office.ilike.%${search}%`
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

// ---------------------------------------------------------
// POST /api/products
// ---------------------------------------------------------
productsRouter.post('/', async (req, res, next) => {
  try {
    const {
      mac_id,
      serial_number,
      model,
      customer_id,
      order_id,
      installation_location,
      office,
      warranty_start,
      warranty_end,
      status,
      replaced_by_product_id,
      remarks,
    } = req.body;

    if (!mac_id?.trim()) {
      return res.status(400).json({
        error: 'MAC ID is required.',
      });
    }

    const normalizedMac = normalizeMac(mac_id);

    if (!normalizedMac) {
      return res.status(400).json({
        error:
          'Invalid MAC ID. Use 12 hexadecimal characters, for example AA:BB:CC:DD:EE:FF.',
      });
    }

    if (!customer_id) {
      return res.status(400).json({
        error: 'Customer is required.',
      });
    }

    // Check duplicate MAC
    const { data: existingProduct, error: existingError } =
      await supabaseAdmin
        .from('products')
        .select('id, mac_id')
        .eq('mac_id', normalizedMac)
        .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        error: existingError.message,
      });
    }

    if (existingProduct) {
      return res.status(409).json({
        error: `A product with MAC ID ${normalizedMac} already exists.`,
      });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        mac_id: normalizedMac,
        serial_number: serial_number?.trim() || null,
        model: model?.trim() || null,
        customer_id,
        order_id: order_id || null,
        installation_location:
          installation_location?.trim() || null,
        office: office?.trim() || null,
        warranty_start: warranty_start || null,
        warranty_end: warranty_end || null,
        status: status || 'ACTIVE',
        replaced_by_product_id:
          replaced_by_product_id || null,
        remarks: remarks?.trim() || null,
      })
      .select(
        `
        *,
        customers (
          customer_code,
          customer_name,
          company_name
        ),
        orders (
          order_number,
          reference_number
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

// ---------------------------------------------------------
// PATCH /api/products/:id
// ---------------------------------------------------------
productsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      'mac_id',
      'serial_number',
      'model',
      'customer_id',
      'order_id',
      'installation_location',
      'office',
      'warranty_start',
      'warranty_end',
      'status',
      'replaced_by_product_id',
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

    // Normalize MAC if it is being changed
    if (updates.mac_id) {
      const normalizedMac = normalizeMac(String(updates.mac_id));

      if (!normalizedMac) {
        return res.status(400).json({
          error:
            'Invalid MAC ID. Use 12 hexadecimal characters, for example AA:BB:CC:DD:EE:FF.',
        });
      }

      updates.mac_id = normalizedMac;

      // Check whether another product already uses this MAC
      const { data: duplicate } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('mac_id', normalizedMac)
        .neq('id', id)
        .maybeSingle();

      if (duplicate) {
        return res.status(409).json({
          error: `Another product already uses MAC ID ${normalizedMac}.`,
        });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .update(updates)
      .eq('id', id)
      .select(
        `
        *,
        customers (
          customer_code,
          customer_name,
          company_name
        ),
        orders (
          order_number,
          reference_number
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