import { Queue } from 'bullmq';
import { redis } from '../config/redis.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connection = redis as any;

export const indexQueue = new Queue('index-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const syncQueue = new Queue('sync-queue', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    removeOnComplete: 50,
    removeOnFail: 20,
  },
});
