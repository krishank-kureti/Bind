import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { indexQueue } from './queue.js';
import { getPendingAccountIds, clearPendingSync } from '../services/lazySync.service.js';
import { logger } from '../utils/logger.js';

export function createLazySyncWorker(): Worker {
  const worker = new Worker('lazy-sync', async (job) => {
    const { userId } = job.data as { userId: string };
    logger.info({ jobId: job.id, userId }, 'Lazy sync batch started');

    const accountIds = await getPendingAccountIds(userId);
    if (accountIds.length === 0) {
      logger.info({ userId }, 'No pending accounts for lazy sync');
      return { syncedAccounts: 0 };
    }

    for (const accountId of accountIds) {
      await indexQueue.add('indexAccount', { accountId });
    }

    await clearPendingSync(userId);
    logger.info({ userId, accountCount: accountIds.length }, 'Lazy sync batch complete');
    return { syncedAccounts: accountIds.length };
  }, {
    connection: redis as any,
    concurrency: 1,
    drainDelay: 10000,
    stalledInterval: 60000,
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Lazy sync job failed');
  });

  return worker;
}
