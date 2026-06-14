import { Queue } from 'bullmq';
import { redis } from '../config/redis.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connection = redis as any;

export const indexQueue = new Queue('index-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
});

export const syncQueue = new Queue('sync-queue', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
});

export const uploadQueue = new Queue('upload-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
});

export const duplicatesQueue = new Queue('duplicates-queue', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
});

export const lazySyncQueue = new Queue('lazy-sync', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
});
