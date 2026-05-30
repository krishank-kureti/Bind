import { prisma } from '../config/prisma.js';
import { getStorageQuota as fetchDriveQuota } from './drive.service.js';

const CACHE_TTL_MS = 15 * 60 * 1000;

export async function getAccountQuota(accountId: string) {
  const quota = await prisma.storageQuota.findUnique({
    where: { accountId },
  });
  return quota;
}

export async function refreshAccountQuota(accountId: string) {
  const driveQuota = await fetchDriveQuota(accountId);

  const data = {
    totalBytes: BigInt(driveQuota?.limit ?? '0'),
    usedBytes: BigInt(driveQuota?.usage ?? '0'),
    driveBytes: driveQuota?.usageInDrive ? BigInt(driveQuota.usageInDrive) : null,
    gmailBytes: driveQuota?.usageInDriveTrash ? BigInt(driveQuota.usageInDriveTrash) : null,
    trashBytes: null,
    refreshedAt: new Date(),
  };

  const quota = await prisma.storageQuota.upsert({
    where: { accountId },
    create: { accountId, ...data },
    update: data,
  });

  return quota;
}

export async function getOrRefreshQuota(accountId: string) {
  const quota = await getAccountQuota(accountId);

  if (quota) {
    const age = Date.now() - quota.refreshedAt.getTime();
    if (age < CACHE_TTL_MS) {
      return quota;
    }
  }

  return refreshAccountQuota(accountId);
}

export async function selectBestAccountForUpload(userId: string) {
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId, isActive: true },
    select: { id: true },
  });

  if (accounts.length === 0) return null;
  if (accounts.length === 1) return accounts[0];

  const quotas = await Promise.all(
    accounts.map(async (a) => {
      try {
        const q = await getOrRefreshQuota(a.id);
        if (!q) return null;
        const free = q.totalBytes - q.usedBytes;
        return { accountId: a.id, free, ratio: Number(q.usedBytes) / Number(q.totalBytes || 1n) };
      } catch {
        return null;
      }
    }),
  );

  const valid = quotas.filter((q): q is NonNullable<typeof q> => q !== null && q.free > 0n);
  valid.sort((a, b) => Number(b.free - a.free));

  if (valid.length === 0) return null;

  return { id: valid[0]!.accountId };
}
