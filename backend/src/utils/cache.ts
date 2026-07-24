import { redis } from '../config/redis.js';
import { logger } from './logger.js';

/**
 * Invalidate first-page file listing cache for a user.
 * Keys: files:${userId}:${hash}
 */
export async function invalidateFileListCache(userId: string): Promise<void> {
  try {
    const pattern = `files:${userId}:*`;
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn({ err, userId }, 'Failed to invalidate file list cache');
  }
}
