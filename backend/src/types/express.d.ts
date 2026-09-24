import type { User } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Request {
      /** Populated by requireAuth middleware after verifying the Supabase JWT. */
      user?: User;
    }
  }
}

export {};
