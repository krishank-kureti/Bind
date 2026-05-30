import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { prisma } from '../config/prisma.js';
import { indexAccount } from '../services/index.service.js';
import { logger } from '../utils/logger.js';

export function createIndexWorker(): Worker {
  const worker = new Worker('index-queue', async (job) => {
    const { accountId } = job.data;

    logger.info({ accountId, jobId: job.id }, 'Starting index job');

    await prisma.connectedAccount.update({
      where: { id: accountId },
      data: { syncStatus: 'SYNCING' },
    });

    try {
      const totalIndexed = await indexAccount(accountId);

      await prisma.connectedAccount.update({
        where: { id: accountId },
        data: { syncStatus: 'SYNCED', lastSyncedAt: new Date() },
      });

      logger.info({ accountId, totalIndexed, jobId: job.id }, 'Index job complete');
      return { totalIndexed };
    } catch (error) {
      await prisma.connectedAccount.update({
        where: { id: accountId },
        data: { syncStatus: 'ERROR' },
      });
      logger.error({ accountId, error, jobId: job.id }, 'Index job failed');
      throw error;
    }
  }, { connection: redis as any });

  worker.on('error', (err) => {
    logger.error({ err }, 'Index worker error');
  });

  return worker;
}
