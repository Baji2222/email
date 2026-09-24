import 'dotenv/config';
import { z } from 'zod';

/**
 * All environment variables the backend needs, validated at startup.
 * The process fails fast with a clear error instead of crashing later
 * with a confusing "cannot read property of undefined".
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  EMAIL_PROVIDER: z.enum(['mock', 'gmail']).default('mock'),
  EMAIL_FROM: z.string().email().default('bajivali916@gmail.com'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REFRESH_TOKEN: z.string().optional().default(''),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Environment validation failed. Check your .env file against .env.example.');
  }

  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
