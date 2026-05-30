import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getUserAccounts } from '../services/auth.service.js';
import { indexQueue } from '../workers/queue.js';
import { prisma } from '../config/prisma.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const accounts = await getUserAccounts(userId);
    res.json({ success: true, data: accounts });
  } catch (err) {
    next(err);
  }
});

router.get('/:accountId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const accountId = req.params.accountId as string;

    const account = await prisma.connectedAccount.findFirst({
      where: { id: accountId, userId, isActive: true },
      select: {
        id: true,
        syncStatus: true,
        lastSyncedAt: true,
        email: true,
        displayName: true,
      },
    });

    if (!account) {
      res.status(404).json({
        success: false,
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' },
      });
      return;
    }

    res.json({ success: true, data: account });
  } catch (err) {
    next(err);
  }
});

router.delete('/:accountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const accountId = req.params.accountId as string;

    const account = await prisma.connectedAccount.findFirst({
      where: { id: accountId, userId, isActive: true },
    });

    if (!account) {
      res.status(404).json({
        success: false,
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' },
      });
      return;
    }

    await prisma.connectedAccount.delete({
      where: { id: accountId },
    });

    res.json({ success: true, data: { id: account.id, deleted: true } });
  } catch (err) {
    next(err);
  }
});

router.post('/:accountId/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const accountId = req.params.accountId as string;
    const account = await prisma.connectedAccount.findFirst({
      where: { id: accountId, userId, isActive: true },
    });

    if (!account) {
      res.status(404).json({
        success: false,
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' },
      });
      return;
    }

    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: { syncStatus: 'PENDING' },
    });

    await indexQueue.add('indexAccount', { accountId: account.id });

    res.json({
      success: true,
      data: { id: account.id, syncStatus: 'PENDING', message: 'Sync queued' },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
