import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));

  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev')
  );

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Vercel serverless entry point
const app = createApp();

export default app;