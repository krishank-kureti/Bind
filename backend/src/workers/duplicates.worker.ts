import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { scanDuplicates } from '../services/duplicates.service.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connection = redis as any;

export function createDuplicateWorker(): Worker {
  const worker = new Worker('duplicates-queue', async (job) => {
    const { userId } = job.data as { userId: string };
    logger.info({ jobId: job.id, userId }, 'Duplicate scan job started');
    const result = await scanDuplicates(userId);
    logger.info({ jobId: job.id, ...result }, 'Duplicate scan job complete');
    return result;
  }, {
    connection,
    concurrency: 1,
    limiter: { max: 1, duration: 10000 },
    drainDelay: 10000,
    stalledInterval: 60000,
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Duplicate scan job failed');
  });

  return worker;
}
