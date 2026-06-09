import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';
import { getOrRefreshQuota, refreshAccountQuota } from '../services/storage.service.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    const quotas = await Promise.all(
      accounts.map(async (a) => {
        try {
          const q = await getOrRefreshQuota(a.id);
          return { accountId: a.id, ...(q ? { totalBytes: q.totalBytes, usedBytes: q.usedBytes, refreshedAt: q.refreshedAt } : { totalBytes: null, usedBytes: null, refreshedAt: null }) };
        } catch {
          return { accountId: a.id, totalBytes: null, usedBytes: null, refreshedAt: null };
        }
      }),
    );

    const total = quotas.reduce((acc, q) => ({
      totalBytes: acc.totalBytes + (q.totalBytes ? Number(q.totalBytes) : 0),
      usedBytes: acc.usedBytes + (q.usedBytes ? Number(q.usedBytes) : 0),
    }), { totalBytes: 0, usedBytes: 0 });

    res.json({
      success: true,
      data: {
        accounts: quotas,
        summary: {
          totalBytes: String(total.totalBytes),
          usedBytes: String(total.usedBytes),
          freeBytes: String(total.totalBytes - total.usedBytes),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:accountId/quota', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const accountId = req.params.accountId as string;

    const account = await prisma.connectedAccount.findFirst({
      where: { id: accountId, userId, isActive: true },
    });

    if (!account) {
      res.status(404).json({ success: false, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' } });
      return;
    }

    const quota = await getOrRefreshQuota(accountId);
    res.json({ success: true, data: quota });
  } catch (err) {
    next(err);
  }
});

router.post('/:accountId/quota/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const accountId = req.params.accountId as string;

    const account = await prisma.connectedAccount.findFirst({
      where: { id: accountId, userId, isActive: true },
    });

    if (!account) {
      res.status(404).json({ success: false, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' } });
      return;
    }

    const quota = await refreshAccountQuota(accountId);
    res.json({ success: true, data: quota });
  } catch (err) {
    next(err);
  }
});

export default router;
