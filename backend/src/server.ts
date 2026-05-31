import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './config/prisma.js';
import { existsSync, mkdirSync } from 'node:fs';
import { syncQueue } from './workers/queue.js';
import { createIndexWorker } from './workers/indexFiles.worker.js';
import { createSyncWorker } from './workers/syncAccount.worker.js';
import { createUploadWorker } from './workers/processUpload.worker.js';
import { createDuplicateWorker } from './workers/duplicates.worker.js';

async function main(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');

  const { redis } = await import('./config/redis.js');
  try {
    await redis.ping();
    logger.info('Redis connected');
  } catch {
    logger.warn('Redis not available — sessions and queues will not work');
  }

  // Ensure uploads directory exists
  const uploadsDir = 'uploads';
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir);
  }

  // Start BullMQ workers
  const indexWorker = createIndexWorker();
  const syncWorker = createSyncWorker();
  const uploadWorker = createUploadWorker();
  const duplicateWorker = createDuplicateWorker();
  logger.info('BullMQ workers started');

  // Schedule periodic sync (every 30 minutes)
  await syncQueue.add(
    'periodicSync',
    {},
    {
      repeat: { pattern: '*/30 * * * *' },
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
  logger.info('Periodic sync scheduled (every 30 min)');

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, `Server running on ${env.APP_URL}`);
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    await indexWorker.close();
    await syncWorker.close();
    await uploadWorker.close();
    await duplicateWorker.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
