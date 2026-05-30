import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';
import { downloadFile } from '../services/drive.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const {
      accountId,
      mimeType,
      folderId,
      query,
      starred,
      trashed,
      limit: limitStr,
      cursor,
      sortBy,
      sortDir,
    } = req.query as Record<string, string | undefined>;

    const limit = Math.min(Math.max(Number(limitStr) || 50, 1), 200);

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, isActive: true, ...(accountId ? { id: accountId } : {}) },
      select: { id: true },
    });

    const accountIds = accounts.map((a) => a.id);
    if (accountIds.length === 0) {
      res.json({ success: true, data: [], meta: { limit, hasMore: false, nextCursor: null, total: 0 } });
      return;
    }

    const where: Prisma.FileIndexWhereInput = {
      accountId: { in: accountIds },
      isTrashed: trashed === 'true' ? true : trashed === 'all' ? undefined : false,
    };

    if (mimeType) where.mimeType = mimeType;
    if (folderId) where.parentFolderId = folderId;
    if (starred === 'true') where.starred = true;
    if (query) where.name = { contains: query, mode: 'insensitive' };

    const orderBy: Prisma.FileIndexOrderByWithRelationInput = {};
    if (sortBy === 'name') orderBy.name = sortDir === 'asc' ? 'asc' : 'desc';
    else if (sortBy === 'size') orderBy.size = sortDir === 'asc' ? 'asc' : 'desc';
    else orderBy.modifiedAtProvider = sortDir === 'asc' ? 'asc' : 'desc';

    const total = await prisma.fileIndex.count({ where });

    const cursorClause = cursor ? { id: { lt: cursor } } : {};
    const files = await prisma.fileIndex.findMany({
      where: { ...where, ...cursorClause },
      take: limit + 1,
      orderBy: [orderBy, { id: 'desc' }],
    });

    const hasMore = files.length > limit;
    const visible = hasMore ? files.slice(0, limit) : files;
    const nextCursor = hasMore ? visible[visible.length - 1]?.id ?? null : null;

    res.json({
      success: true,
      data: visible,
      meta: { limit, hasMore, nextCursor, total },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const fileId = req.params.fileId as string;

    const file = await prisma.fileIndex.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    const account = await prisma.connectedAccount.findFirst({
      where: { id: file.accountId, userId },
      select: { id: true },
    });

    if (!account) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    res.json({ success: true, data: file });
  } catch (err) {
    next(err);
  }
});

router.get('/:fileId/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const fileId = req.params.fileId as string;

    const file = await prisma.fileIndex.findUnique({ where: { id: fileId } });
    if (!file) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    const account = await prisma.connectedAccount.findFirst({
      where: { id: file.accountId, userId },
      select: { id: true },
    });

    if (!account) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    const { stream, mimeType, name } = await downloadFile(account.id, file.providerId);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
