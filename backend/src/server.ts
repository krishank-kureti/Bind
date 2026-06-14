import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './config/prisma.js';
import { existsSync, mkdirSync } from 'node:fs';
import { redis } from './config/redis.js';

async function main(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');

  try {
    await redis.ping();
    logger.info('Redis connected');
  } catch {
    logger.warn('Redis not available — sessions will not work');
  }

  // Ensure uploads directory exists
  const uploadsDir = 'uploads';
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir);
  }

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, `Server running on ${env.APP_URL}`);
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
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
