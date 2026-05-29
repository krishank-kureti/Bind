import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './config/prisma.js';

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

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, `Server running on ${env.APP_URL}`);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
