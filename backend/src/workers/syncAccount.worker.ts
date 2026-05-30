import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { prisma } from '../config/prisma.js';
import { indexQueue } from './queue.js';
import { logger } from '../utils/logger.js';

export function createSyncWorker(): Worker {
  const worker = new Worker('sync-queue', async (job) => {
    logger.info({ jobId: job.id }, 'Starting periodic sync');

    const accounts = await prisma.connectedAccount.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const account of accounts) {
      await indexQueue.add('indexAccount', { accountId: account.id });
    }

    logger.info({ accountCount: accounts.length }, 'Periodic sync queued');
    return { queuedAccounts: accounts.length };
  }, { connection: redis as any });

  worker.on('error', (err) => {
    logger.error({ err }, 'Sync worker error');
  });

  return worker;
}
