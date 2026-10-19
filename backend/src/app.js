import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import { notFound, errorHandler, ApiError } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import productsRoutes from './routes/products.routes.js';
import salesRoutes from './routes/sales.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import restockRoutes from './routes/restock.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';

const app = express();

// Behind a reverse proxy (nginx, a cloud load balancer, Render/Railway/Fly),
// every client otherwise shares one socket address, so the rate limiter would
// treat all users as one IP and lock them all out. TRUST_PROXY is the number of
// proxy hops in front of the app ("1" for a single nginx). It is opt-in because
// trusting X-Forwarded-For when nothing sets it would let a client spoof its IP
// and bypass the limiter entirely.
if (env.trustProxy !== null) {
  app.set('trust proxy', env.trustProxy);
}

app.use(helmet());
// Bounded so a single oversized request cannot exhaust memory.
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser clients (mobile, curl), which send no Origin header.
      if (!origin) return cb(null, true);

      // An empty CORS_ORIGINS means "unset", never "allow everything".
      // Reflecting an arbitrary origin with credentials would let any website
      // on the internet make authenticated calls to this API.
      if (env.corsOrigins.length === 0) return cb(null, false);

      if (env.corsOrigins.includes(origin)) return cb(null, true);

      // 403, not 500: a disallowed origin is a client-side rejection, and
      // errorHandler would otherwise log a stack trace on every attempt.
      return cb(new ApiError(403, 'Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Rate limiter for auth endpoints. Scoped per-route: login gets a tight budget
// because it is the only brute-forceable endpoint, while /me is called on app
// foreground and must never be able to lock a user out of logging in.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts, please try again later' } },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts, please try again later' } },
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Mounted per-route rather than on the whole /api/auth prefix.
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/restock', restockRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
