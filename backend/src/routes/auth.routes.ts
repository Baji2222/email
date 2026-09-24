import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

/**
 * Returns the currently authenticated admin's identity.
 * Frontend calls this after login to confirm the session is valid and to
 * populate the topbar/user menu. This is also the simplest possible proof
 * that end-to-end auth (frontend -> Supabase -> backend) is wired up.
 */
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user!.id,
    email: req.user!.email,
  });
});
