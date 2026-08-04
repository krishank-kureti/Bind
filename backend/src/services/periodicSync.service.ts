import { prisma } from '../config/prisma.js';
import { indexAccount } from './index.service.js';
import { logger } from '../utils/logger.js';

/** How often we look for accounts that need a full re-index. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
/** Account is eligible only if last successful sync is older than this (or never). */
const SYNC_STALE_MS = 30 * 60 * 1000;
/** Only re-index Drive accounts for users who opened BIND in this window. */
const ACTIVE_USER_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CONCURRENT = 1;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

async function syncAccount(accountId: string): Promise<void> {
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
    logger.info({ accountId, totalIndexed }, 'Periodic sync completed');
  } catch (err) {
    await prisma.connectedAccount.update({
      where: { id: accountId },
      data: { syncStatus: 'ERROR' },
    }).catch(() => {});
    logger.error({ accountId, err }, 'Periodic sync failed');
  }
}

export async function runPeriodicSyncCheck(): Promise<void> {
  if (running) {
    logger.debug('Periodic sync already in progress, skipping tick');
    return;
  }
  running = true;

  try {
    const staleBefore = new Date(Date.now() - SYNC_STALE_MS);
    const activeSince = new Date(Date.now() - ACTIVE_USER_MS);

    const accounts = await prisma.connectedAccount.findMany({
      where: {
        isActive: true,
        // Skip broken tokens until the user reconnects / manual sync succeeds
        syncStatus: { notIn: ['SYNCING', 'ERROR'] },
        OR: [
          { lastSyncedAt: null },
          { lastSyncedAt: { lt: staleBefore } },
        ],
        user: {
          lastSeenAt: { gte: activeSince },
        },
      },
      select: { id: true, email: true, lastSyncedAt: true },
      orderBy: { lastSyncedAt: 'asc' },
      take: MAX_CONCURRENT,
    });

    if (accounts.length === 0) {
      return;
    }

    logger.info({ count: accounts.length }, 'Starting periodic sync for stale accounts');
    for (const account of accounts) {
      await syncAccount(account.id);
    }
  } catch (err) {
    logger.error({ err }, 'Periodic sync check failed');
  } finally {
    running = false;
  }
}

export function startPeriodicSync(): void {
  if (intervalHandle) return;

  logger.info(
    {
      checkIntervalMin: CHECK_INTERVAL_MS / 60000,
      staleMin: SYNC_STALE_MS / 60000,
      activeUserDays: ACTIVE_USER_MS / (24 * 60 * 60 * 1000),
    },
    'Periodic account sync scheduler started',
  );

  // First check shortly after boot so long-idle accounts catch up
  setTimeout(() => {
    runPeriodicSyncCheck().catch(() => {});
  }, 15_000);

  intervalHandle = setInterval(() => {
    runPeriodicSyncCheck().catch(() => {});
  }, CHECK_INTERVAL_MS);

  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }
}

export function stopPeriodicSync(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
