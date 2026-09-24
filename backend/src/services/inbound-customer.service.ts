import { supabaseAdmin } from '../config/supabase';

export type CustomerResult = {
  customerId: string;
  created: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findOrCreateCustomer(
  senderEmail: string,
  customerName: string | null
): Promise<CustomerResult> {
  const email = normalizeEmail(senderEmail);

  // 1. Look for an existing customer
  const { data: existingCustomer, error: findError } =
    await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', email)
      .maybeSingle();

  if (findError) {
    throw new Error(
      `Failed to find customer: ${findError.message}`
    );
  }

  if (existingCustomer) {
    return {
      customerId: existingCustomer.id,
      created: false,
    };
  }

  // 2. Customer does not exist
  const finalCustomerName =
    customerName?.trim() || email;

  const { data: newCustomer, error: createError } =
    await supabaseAdmin
      .from('customers')
      .insert({
        customer_name: finalCustomerName,
        email,
      })
      .select('id')
      .single();

  if (createError) {
    throw new Error(
      `Failed to create customer: ${createError.message}`
    );
  }

  return {
    customerId: newCustomer.id,
    created: true,
  };
}