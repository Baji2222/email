import { Router } from 'express';

import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { customersRouter } from './customers.routes';
import { ordersRouter } from './orders.routes';
import { productsRouter } from './products.routes';
import { ticketsRouter } from './tickets.routes';
import { gmailRouter } from './gmail.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/customers', customersRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/tickets', ticketsRouter);
apiRouter.use('/gmail', gmailRouter);

// Future modules:
// apiRouter.use('/export', exportRouter);
