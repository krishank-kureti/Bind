import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

const NAME_COPY_PREFIX = /^copy\s+of\s+/i;
const NAME_DUPLICATE_SUFFIX = /\s*\((\d+)\)\s*$/;
const NAME_COPY_SUFFIX = /\s*[-–—]\s*Copy\s*$/i;

function normalizeName(name: string): string {
  return name
    .replace(NAME_COPY_PREFIX, '')
    .replace(NAME_DUPLICATE_SUFFIX, '')
    .replace(NAME_COPY_SUFFIX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export async function scanDuplicates(userId: string): Promise<{ groupsCreated: number; wasteBytes: bigint }> {
  logger.info({ userId }, 'Starting duplicate scan');

  const allFiles = await prisma.fileIndex.findMany({
    where: {
      account: { userId, isActive: true },
      isFolder: false,
      isTrashed: false,
    },
    select: {
      id: true,
      md5Checksum: true,
      size: true,
      accountId: true,
      name: true,
    },
  });

  const hashGroups = new Map<string, { fileIds: string[]; accountIds: string[]; sizes: bigint[] }>();
  const nameGroups = new Map<string, { fileIds: string[]; accountIds: string[]; sizes: bigint[]; names: string[] }>();

  for (const f of allFiles) {
    if (f.md5Checksum) {
      const existing = hashGroups.get(f.md5Checksum);
      if (existing) {
        existing.fileIds.push(f.id);
        existing.accountIds.push(f.accountId);
        existing.sizes.push(f.size ?? 0n);
      } else {
        hashGroups.set(f.md5Checksum, {
          fileIds: [f.id],
          accountIds: [f.accountId],
          sizes: [f.size ?? 0n],
        });
      }
    } else {
      const key = normalizeName(f.name);
      if (!key) continue;
      const existing = nameGroups.get(key);
      if (existing) {
        existing.fileIds.push(f.id);
        existing.accountIds.push(f.accountId);
        existing.sizes.push(f.size ?? 0n);
        existing.names.push(f.name);
      } else {
        nameGroups.set(key, {
          fileIds: [f.id],
          accountIds: [f.accountId],
          sizes: [f.size ?? 0n],
          names: [f.name],
        });
      }
    }
  }

  let groupsCreated = 0;
  let wasteBytes = 0n;

  async function processGroup(
    groupKey: string,
    fileIds: string[],
    accountIds: string[],
    sizes: bigint[],
  ) {
    if (fileIds.length < 2) return;

    const fileSize = sizes[0] ?? 0n;
    const fileCount = fileIds.length;
    const totalWaste = fileSize * BigInt(fileCount - 1);

    const existingGroup = await prisma.duplicateGroup.findFirst({
      where: { userId, checksum: groupKey },
    });

    if (existingGroup) {
      await prisma.duplicateGroup.update({
        where: { id: existingGroup.id },
        data: {
          fileCount,
          fileSize,
          totalWaste,
          detectedAt: new Date(),
        },
      });

      await prisma.duplicateFile.deleteMany({ where: { groupId: existingGroup.id } });

      await prisma.duplicateFile.createMany({
        data: fileIds.map((fileId, i) => ({
          groupId: existingGroup.id,
          fileId,
          accountId: accountIds[i]!,
        })),
      });
    } else {
      const group = await prisma.duplicateGroup.create({
        data: {
          userId,
          checksum: groupKey,
          fileSize,
          fileCount,
          totalWaste,
        },
      });

      await prisma.duplicateFile.createMany({
        data: fileIds.map((fileId, i) => ({
          groupId: group.id,
          fileId,
          accountId: accountIds[i]!,
        })),
      });
    }

    groupsCreated++;
    wasteBytes += totalWaste;
  }

  const activeChecksums = new Set<string>();

  for (const [checksum, data] of hashGroups.entries()) {
    if (data.fileIds.length >= 2) activeChecksums.add(checksum);
    await processGroup(checksum, data.fileIds, data.accountIds, data.sizes);
  }

  for (const [key, data] of nameGroups.entries()) {
    if (data.fileIds.length >= 2) activeChecksums.add(`name:${key}`);
    await processGroup(`name:${key}`, data.fileIds, data.accountIds, data.sizes);
  }

  const stale = await prisma.duplicateGroup.findMany({
    where: {
      userId,
      checksum: { notIn: Array.from(activeChecksums) },
    },
  });

  for (const s of stale) {
    await prisma.duplicateFile.deleteMany({ where: { groupId: s.id } });
    await prisma.duplicateGroup.delete({ where: { id: s.id } });
  }

  logger.info({ userId, groupsCreated, wasteBytes: wasteBytes.toString() }, 'Duplicate scan complete');
  return { groupsCreated, wasteBytes };
}
