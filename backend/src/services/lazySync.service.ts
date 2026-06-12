import { redis } from '../config/redis.js';
import { type Queue } from 'bullmq';
import { logger } from '../utils/logger.js';

const THRESHOLD = 6;
const TTL_SEC = 6 * 3600;

function countKey(userId: string) { return `lazySync:${userId}:count`; }
function accountsKey(userId: string) { return `lazySync:${userId}:accounts`; }
function jobId(userId: string) { return `lazySync:${userId}`; }

export async function incrementPendingSync(userId: string, accountId: string, lazySyncQueue: Queue): Promise<void> {
  const cKey = countKey(userId);
  const aKey = accountsKey(userId);

  await redis.sadd(aKey, accountId);
  await redis.expire(aKey, TTL_SEC);

  const count = await redis.incr(cKey);
  await redis.expire(cKey, TTL_SEC);

  if (count === 1) {
    await lazySyncQueue.add('sync', { userId }, {
      delay: 30 * 60 * 1000,
      jobId: jobId(userId),
      removeOnComplete: true,
      removeOnFail: true,
    });
    logger.info({ userId, count }, 'Lazy sync scheduled (30 min delay)');
  } else if (count >= THRESHOLD) {
    const existing = await lazySyncQueue.getJob(jobId(userId));
    if (existing) {
      await existing.remove();
    }
    await lazySyncQueue.add('sync', { userId }, {
      jobId: jobId(userId),
      removeOnComplete: true,
      removeOnFail: true,
    });
    logger.info({ userId, count }, 'Lazy sync threshold reached — firing immediately');
  }
}

export async function getPendingAccountIds(userId: string): Promise<string[]> {
  return redis.smembers(accountsKey(userId));
}

export async function clearPendingSync(userId: string): Promise<void> {
  await redis.del(countKey(userId), accountsKey(userId));
}
