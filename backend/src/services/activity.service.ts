import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

/** Minimum gap between lastSeenAt writes for the same user (avoids a DB write on every /me). */
const TOUCH_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Record that the user opened BIND while authenticated.
 * Safe to call often; throttled to at most once per hour unless force=true.
 */
export async function touchLastSeen(userId: string, options?: { force?: boolean }): Promise<void> {
  const force = options?.force === true;
  const now = new Date();

  try {
    if (!force) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lastSeenAt: true },
      });
      if (user?.lastSeenAt) {
        const age = now.getTime() - user.lastSeenAt.getTime();
        if (age < TOUCH_THROTTLE_MS) {
          return;
        }
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: now },
    });
  } catch (err) {
    // Activity tracking must never break auth or API responses.
    logger.warn({ userId, err }, 'Failed to update user lastSeenAt');
  }
}
