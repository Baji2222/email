import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Last-resort error handler. Logs full details server-side, but only ever
 * sends a safe, generic message to the client — never a stack trace.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : 'An unexpected error occurred. Please try again.';

  // eslint-disable-next-line no-console
  console.error(`[ERROR] ${req.method} ${req.originalUrl} ->`, err);

  res.status(statusCode).json({
    error: message,
    ...(env.NODE_ENV !== 'production' && !isAppError && err instanceof Error
      ? { debug: err.message }
      : {}),
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}
