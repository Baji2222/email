import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Privileged Supabase client using the SERVICE ROLE key.
 *
 * This client bypasses Row Level Security and must NEVER be sent to the
 * frontend or used to directly return raw query results to untrusted input.
 * All access control must be enforced in backend services/controllers.
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * A Supabase client scoped to the ANON key, used only to verify a user's
 * access token (auth.getUser). It never performs privileged table access.
 */
export const supabaseAuthClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
