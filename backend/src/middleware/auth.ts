import type { NextFunction, Request, Response } from 'express';
import { supabaseAuthClient } from '../config/supabase';

/**
 * Protects a route: requires a valid Supabase access token in the
 * Authorization header ("Bearer <token>"). On success, req.user is set.
 *
 * This is the single place that decides whether a request is authenticated.
 * Every route under /api (except /api/health) must go through this.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    return res.status(401).json({ error: 'Missing access token.' });
  }

  const { data, error } = await supabaseAuthClient.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  req.user = data.user;
  next();
}
