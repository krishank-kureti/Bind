import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import passport from 'passport';
import connectRedis = require('connect-redis');
const RedisStore = connectRedis(session);
import { env } from './config/env.js';
import { redis } from './config/redis.js';
import { errorHandler } from './middleware/error.middleware.js';
import { logger } from './utils/logger.js';

import './config/passport.js';
import authRoutes from './routes/auth.routes.js';
import accountRoutes from './routes/accounts.routes.js';
import fileRoutes from './routes/files.routes.js';
import folderRoutes from './routes/folders.routes.js';
import searchRoutes from './routes/search.routes.js';
import storageRoutes from './routes/storage.routes.js';
import uploadRoutes from './routes/upload.routes.js';

// Allow BigInt serialization in JSON responses
(BigInt.prototype as unknown as Record<string, unknown>).toJSON = function () {
  return (this as unknown as bigint).toString();
};

const app = express();

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"],
    },
  },
}));
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

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Static files (test page)
app.use(express.static(path.resolve('public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Error handler
app.use(errorHandler);

export default app;
