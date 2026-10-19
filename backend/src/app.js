import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import productsRoutes from './routes/products.routes.js';
import salesRoutes from './routes/sales.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import restockRoutes from './routes/restock.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser clients (mobile, curl) and configured origins.
      if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Rate limiter for auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts, please try again later' } },
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/restock', restockRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
