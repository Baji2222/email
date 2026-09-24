import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env in /frontend and fill in your Supabase project credentials.'
  );
}

/**
 * Frontend Supabase client. Only ever uses the public ANON key — never the
 * service role key, which must stay on the backend only.
 */
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
