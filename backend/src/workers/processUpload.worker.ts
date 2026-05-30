import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { processUpload } from '../services/upload.service.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connection = redis as any;

export function createUploadWorker(): Worker {
  const worker = new Worker(
    'upload-queue',
    async (job) => {
      const { jobId, tempPath } = job.data as { jobId: string; tempPath: string };
      logger.info({ jobId }, 'Starting upload job');
      await processUpload(jobId, tempPath);
    },
    {
      connection,
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Upload worker job failed');
  });

  return worker;
}
