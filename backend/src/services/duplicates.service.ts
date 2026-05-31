import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

export async function scanDuplicates(userId: string): Promise<{ groupsCreated: number; wasteBytes: bigint }> {
  logger.info({ userId }, 'Starting duplicate scan');

  const files = await prisma.fileIndex.findMany({
    where: {
      account: { userId, isActive: true },
      isFolder: false,
      isTrashed: false,
      md5Checksum: { not: null },
    },
    select: {
      id: true,
      md5Checksum: true,
      size: true,
      accountId: true,
    },
  });

  const groups = new Map<string, { fileIds: string[]; accountIds: string[]; sizes: bigint[] }>();

  for (const f of files) {
    if (!f.md5Checksum) continue;
    const existing = groups.get(f.md5Checksum);
    if (existing) {
      existing.fileIds.push(f.id);
      existing.accountIds.push(f.accountId);
      existing.sizes.push(f.size ?? 0n);
    } else {
      groups.set(f.md5Checksum, {
        fileIds: [f.id],
        accountIds: [f.accountId],
        sizes: [f.size ?? 0n],
      });
    }
  }

  let groupsCreated = 0;
  let wasteBytes = 0n;

  for (const [checksum, data] of groups.entries()) {
    if (data.fileIds.length < 2) continue;

    const fileSize = data.sizes[0] ?? 0n;
    const fileCount = data.fileIds.length;
    const totalWaste = fileSize * BigInt(fileCount - 1);

    const existingGroup = await prisma.duplicateGroup.findFirst({
      where: { userId, checksum },
    });

    if (existingGroup) {
      await prisma.duplicateGroup.update({
        where: { id: existingGroup.id },
        data: {
          fileCount,
          fileSize,
          totalWaste,
          detectedAt: new Date(),
          resolvedAt: null,
        },
      });

      await prisma.duplicateFile.deleteMany({ where: { groupId: existingGroup.id } });

      await prisma.duplicateFile.createMany({
        data: data.fileIds.map((fileId, i) => ({
          groupId: existingGroup.id,
          fileId,
          accountId: data.accountIds[i]!,
        })),
      });
    } else {
      const group = await prisma.duplicateGroup.create({
        data: {
          userId,
          checksum,
          fileSize,
          fileCount,
          totalWaste,
        },
      });

      await prisma.duplicateFile.createMany({
        data: data.fileIds.map((fileId, i) => ({
          groupId: group.id,
          fileId,
          accountId: data.accountIds[i]!,
        })),
      });
    }

    groupsCreated++;
    wasteBytes += totalWaste;
  }

  const stale = await prisma.duplicateGroup.findMany({
    where: {
      userId,
      resolvedAt: null,
      checksum: { notIn: Array.from(groups.keys()) },
    },
  });

  for (const s of stale) {
    await prisma.duplicateFile.deleteMany({ where: { groupId: s.id } });
    await prisma.duplicateGroup.delete({ where: { id: s.id } });
  }

  logger.info({ userId, groupsCreated, wasteBytes: wasteBytes.toString() }, 'Duplicate scan complete');
  return { groupsCreated, wasteBytes };
}
