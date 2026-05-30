import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    const accountIds = accounts.map((a) => a.id);
    if (accountIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const folders = await prisma.fileIndex.findMany({
      where: {
        accountId: { in: accountIds },
        isFolder: true,
        isTrashed: false,
        parentFolderId: null,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: folders });
  } catch (err) {
    next(err);
  }
});

router.get('/:folderId/contents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const folderId = req.params.folderId as string;
    const { limit: limitStr, cursor } = req.query as Record<string, string | undefined>;

    const limit = Math.min(Math.max(Number(limitStr) || 50, 1), 200);

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    const accountIds = accounts.map((a) => a.id);

    const where = {
      accountId: { in: accountIds },
      parentFolderId: folderId,
      isTrashed: false,
    } as const;

    const total = await prisma.fileIndex.count({ where });

    const cursorClause = cursor ? { id: { lt: cursor } } : {};
    const files = await prisma.fileIndex.findMany({
      where: { ...where, ...cursorClause },
      take: limit + 1,
      orderBy: [{ isFolder: 'desc' }, { name: 'asc' }, { id: 'desc' }],
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

export default router;
