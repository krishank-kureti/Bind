import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { env } from './config/env.js';
import { redis } from './config/redis.js';
import { errorHandler } from './middleware/error.middleware.js';
import { logger } from './utils/logger.js';

// Allow BigInt serialization in JSON responses
(BigInt.prototype as unknown as Record<string, unknown>).toJSON = function () {
  return (this as unknown as bigint).toString();
};

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan('dev'));

// Session store
const sessionStore = new RedisStore({ client: redis });

app.use(session({
  store: sessionStore,
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Error handler
app.use(errorHandler);

export default app;
