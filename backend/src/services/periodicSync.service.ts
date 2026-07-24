import { prisma } from '../config/prisma.js';
import { indexAccount } from './index.service.js';
import { logger } from '../utils/logger.js';

const SYNC_STALE_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
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
    const accounts = await prisma.connectedAccount.findMany({
      where: {
        isActive: true,
        syncStatus: { not: 'SYNCING' },
        OR: [
          { lastSyncedAt: null },
          { lastSyncedAt: { lt: staleBefore } },
        ],
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
    { checkIntervalMin: CHECK_INTERVAL_MS / 60000, staleMin: SYNC_STALE_MS / 60000 },
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
