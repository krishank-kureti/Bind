import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';
import { duplicatesQueue } from '../workers/queue.js';
import { permanentlyDeleteFile, trashFile } from '../services/drive.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(requireAuth);

const duplicateFileSelect = {
  select: {
    id: true,
    name: true,
    mimeType: true,
    size: true,
    providerId: true,
    isOwned: true,
    webViewLink: true,
    thumbnailLink: true,
    md5Checksum: true,
  },
} as const;

router.post('/scan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;

    await duplicatesQueue.add('scan', { userId }, {
      removeOnComplete: true,
      removeOnFail: true,
    });

    res.json({ success: true, data: { message: 'Duplicate scan queued' } });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;

    const groups = await prisma.duplicateGroup.findMany({
      where: { userId },
      orderBy: { totalWaste: 'desc' },
      include: {
        duplicateFiles: {
          include: {
            file: duplicateFileSelect,
            account: {
              select: {
                email: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    res.json({ success: true, data: groups });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const groupId = req.params.id as string;

    const group = await prisma.duplicateGroup.findFirst({
      where: { id: groupId, userId },
      include: {
        duplicateFiles: {
          include: {
            file: duplicateFileSelect,
            account: {
              select: {
                email: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      res.status(404).json({ success: false, error: { code: 'GROUP_NOT_FOUND', message: 'Duplicate group not found' } });
      return;
    }

    res.json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const groupId = req.params.id as string;
    const { keepFileId } = req.body as { keepFileId?: string };

    const group = await prisma.duplicateGroup.findFirst({
      where: { id: groupId, userId },
      include: {
        duplicateFiles: {
          include: {
            file: {
              select: {
                id: true,
                providerId: true,
                isOwned: true,
                accountId: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      res.status(404).json({ success: false, error: { code: 'GROUP_NOT_FOUND', message: 'Duplicate group not found' } });
      return;
    }

    const toRemove = keepFileId
      ? group.duplicateFiles.filter((df) => df.fileId !== keepFileId)
      : group.duplicateFiles.slice(1);

    if (toRemove.length === 0) {
      res.json({ success: true, data: { message: 'No files to remove', removed: [] } });
      return;
    }

    const results: Array<{ fileId: string; action: string; success: boolean; error?: string }> = [];

    for (const df of toRemove) {
      try {
        const fileIndexRecord = df.file;
        if (fileIndexRecord.isOwned) {
          await permanentlyDeleteFile(fileIndexRecord.accountId, fileIndexRecord.providerId);
          await prisma.fileIndex.delete({ where: { id: fileIndexRecord.id } });
          results.push({ fileId: fileIndexRecord.id, action: 'permanently_deleted', success: true });
        } else {
          await trashFile(fileIndexRecord.accountId, fileIndexRecord.providerId);
          await prisma.fileIndex.update({
            where: { id: fileIndexRecord.id },
            data: { isTrashed: true },
          });
          results.push({ fileId: fileIndexRecord.id, action: 'trashed', success: true });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.warn({ fileId: df.fileId, err }, 'Failed to remove duplicate file');
        results.push({ fileId: df.fileId, action: 'failed', success: false, error: msg });
      }
    }

    await prisma.duplicateFile.deleteMany({
      where: { groupId },
    });

    await prisma.duplicateGroup.update({
      where: { id: groupId },
      data: { resolvedAt: new Date(), fileCount: keepFileId ? 1 : 1 },
    });

    res.json({ success: true, data: { message: `Processed ${results.length} duplicate files`, results } });
  } catch (err) {
    next(err);
  }
});

export default router;
