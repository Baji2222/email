import { Router } from 'express';
import { env } from '../config/env';

export const healthRouter = Router();

/**
 * Public, unauthenticated health check. Used by hosting platforms
 * (Vercel, uptime monitors) and local dev to confirm the API is up.
 */
healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'network-switch-backend',
    environment: env.NODE_ENV,
    emailProvider: env.EMAIL_PROVIDER,
    timestamp: new Date().toISOString(),
  });
});
