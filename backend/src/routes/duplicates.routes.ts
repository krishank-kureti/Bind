import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';
import { duplicatesQueue } from '../workers/queue.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(requireAuth);

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
            file: {
              select: {
                id: true,
                name: true,
                mimeType: true,
                size: true,
                webViewLink: true,
                thumbnailLink: true,
                md5Checksum: true,
              },
            },
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
            file: {
              select: {
                id: true,
                name: true,
                mimeType: true,
                size: true,
                webViewLink: true,
                thumbnailLink: true,
                md5Checksum: true,
              },
            },
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
        duplicateFiles: true,
      },
    });

    if (!group) {
      res.status(404).json({ success: false, error: { code: 'GROUP_NOT_FOUND', message: 'Duplicate group not found' } });
      return;
    }

    const toTrash = keepFileId
      ? group.duplicateFiles.filter((df) => df.fileId !== keepFileId)
      : group.duplicateFiles.slice(1);

    if (toTrash.length === 0) {
      res.json({ success: true, data: { message: 'No files to trash', trashed: [] } });
      return;
    }

    const trashed: string[] = [];
    for (const df of toTrash) {
      try {
        await prisma.fileIndex.update({
          where: { id: df.fileId },
          data: { isTrashed: true },
        });
        trashed.push(df.fileId);
      } catch (err) {
        logger.warn({ fileId: df.fileId, err }, 'Failed to trash duplicate file');
      }
    }

    await prisma.duplicateGroup.update({
      where: { id: groupId },
      data: { resolvedAt: new Date() },
    });

    res.json({ success: true, data: { message: `Trashed ${trashed.length} duplicate files`, trashed } });
  } catch (err) {
    next(err);
  }
});

export default router;
