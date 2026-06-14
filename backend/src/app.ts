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
import duplicateRoutes from './routes/duplicates.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

// Allow BigInt serialization in JSON responses
(BigInt.prototype as unknown as Record<string, unknown>).toJSON = function () {
  return (this as unknown as bigint).toString();
};

const app = express();
app.set('trust proxy', 1);

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
const corsOrigins = env.CORS_ORIGINS.split(',').map(s => s.trim());
app.use(cors({
  origin: corsOrigins,
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
  rolling: false,
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
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
app.use('/api/duplicates', duplicateRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// --- Frontend Stub Endpoints ---

// Activity log (frontend dashboard)
app.get('/api/activities', (_req, res) => {
  res.json([]);
});

// Intelligence data (stale files + largest files — computed from analytics)
app.get('/api/intelligence-data', async (req, res, next) => {
  try {
    const userId = (req.user as Express.User | undefined)?.id;
    if (!userId) {
      res.json({ totalWastedBytes: 0, staleFilesCount: 0, staleFiles: [], largestFiles: [] });
      return;
    }
    const { prisma } = await import('./config/prisma.js');
    const allFiles = await prisma.fileIndex.findMany({
      where: { account: { userId, isActive: true } },
      select: { id: true, name: true, size: true, modifiedAtProvider: true, account: { select: { email: true } } },
      orderBy: { indexedAt: 'desc' },
    });

    const staleFiles = allFiles
      .filter((f) => f.modifiedAtProvider && f.modifiedAtProvider < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
      .slice(0, 10)
      .map((f) => ({
        id: f.id, name: f.name, sizeBytes: Number(f.size ?? 0n),
        path: '', lastModifiedYear: f.modifiedAtProvider?.getFullYear() ?? 0,
        accountEmail: f.account.email,
      }));

    const largestFiles = [...allFiles]
      .filter((f) => (f.size ?? 0n) > 0n)
      .sort((a, b) => Number((b.size ?? 0n) - (a.size ?? 0n)))
      .slice(0, 4)
      .map((f) => ({
        id: f.id, name: f.name, sizeBytes: Number(f.size ?? 0n),
        path: '', starred: false, modified: f.modifiedAtProvider?.toISOString() ?? '',
        category: 'other', accountEmail: f.account.email,
      }));

    const { scanDuplicates } = await import('./services/duplicates.service.js');
    const dupResult = await scanDuplicates(userId);
    const totalWastedBytes = Number(dupResult.wasteBytes);

    res.json({ totalWastedBytes, staleFilesCount: staleFiles.length, staleFiles, largestFiles });
  } catch (err) {
    next(err);
  }
});

// Gemini AI analysis (mock)
app.post('/api/gemini/analyze', async (req, res) => {
  const userId = (req.user as Express.User | undefined)?.id;
  if (!userId) {
    res.json({
      persona: 'Automated Optimizer Engine',
      statusSummary: 'Sign in to receive AI-powered storage analysis.',
      score: 0,
      recommendations: [{ title: 'Sign In Required', description: 'Authenticate to enable AI storage audit.', spaceReclaimed: 'N/A' }],
    });
    return;
  }

  try {
    const { prisma } = await import('./config/prisma.js');
    const accounts = await prisma.connectedAccount.findMany({ where: { userId, isActive: true } });
    const totalQuota = accounts.length > 0 ? 'N/A' : 'No accounts';
    const dupGroups = await prisma.duplicateGroup.findMany({
      where: { userId, resolvedAt: null },
      include: { duplicateFiles: { include: { account: { select: { email: true } } } } },
    });
    const totalWastedBytes = dupGroups.reduce((acc, g) => acc + Number(g.totalWaste ?? 0n), 0);

    res.json({
      persona: 'Automated Optimizer Engine',
      statusSummary: dupGroups.length > 0
        ? `Unified storage has ${dupGroups.length} duplicate group${dupGroups.length > 1 ? 's' : ''} wasting ~${(totalWastedBytes / 1e9).toFixed(1)} GB.`
        : 'Storage looks clean — no duplicates detected.',
      score: dupGroups.length > 0 ? 65 : 92,
      recommendations: dupGroups.slice(0, 3).map((g) => ({
        title: `Resolve: ${g.checksum?.startsWith('name:') ? g.checksum.slice(5) : g.checksum?.slice(0, 16) + '…' || 'Unknown'}`,
        description: `${g.fileCount} copies wasting ${(Number(g.totalWaste ?? 0n) / 1e6).toFixed(0)} MB across accounts.`,
        spaceReclaimed: `${(Number(g.totalWaste ?? 0n) / 1e9).toFixed(1)} GB`,
      })),
    });
  } catch {
    res.json({
      persona: 'Automated Optimizer Engine',
      statusSummary: 'Storage intelligence system is active.',
      score: 72,
      recommendations: [
        { title: 'Scan for Duplicates', description: 'Run a duplicate scan to identify reclaimable space.', spaceReclaimed: 'Varies' },
      ],
    });
  }
});

// Direct account creation stub (frontend calls this; real flow is OAuth-only)
app.post('/api/accounts', (req, res) => {
  res.status(400).json({ success: false, error: { code: 'OAUTH_REQUIRED', message: 'Accounts can only be linked via Google OAuth. Use /api/auth/google to sign in.' } });
});

// Account action stub (reauthorize, frequency — frontend-only features)
app.post('/api/accounts/:id/action', (req, res) => {
  res.status(400).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'This action is not available in the current version.' } });
});

// File upload via JSON stub (frontend uses this; real endpoint is multipart POST /api/upload)
app.post('/api/files/upload', (req, res) => {
  res.status(400).json({ success: false, error: { code: 'USE_MULTIPART', message: 'Use the Upload button in the File Manager for actual uploads.' } });
});

// Error handler
app.use(errorHandler);

export default app;
