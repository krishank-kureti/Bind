import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getUserAccounts, deactivateAccount, scheduleAccountSync } from '../services/auth.service.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const userId = (req.user as Express.User).id;
    const accounts = await getUserAccounts(userId);
    res.json({ success: true, data: accounts });
  } catch (err) {
    next(err);
  }
});

router.delete('/:accountId', async (req, res, next) => {
  try {
    const userId = (req.user as Express.User).id;
    const account = await deactivateAccount(req.params.accountId, userId);
    if (!account) {
      res.status(404).json({
        success: false,
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' },
      });
      return;
    }
    res.json({ success: true, data: { id: account.id, isActive: false } });
  } catch (err) {
    next(err);
  }
});

router.post('/:accountId/sync', async (req, res, next) => {
  try {
    const userId = (req.user as Express.User).id;
    const account = await scheduleAccountSync(req.params.accountId, userId);
    if (!account) {
      res.status(404).json({
        success: false,
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' },
      });
      return;
    }
    res.json({
      success: true,
      data: { id: account.id, syncStatus: 'PENDING', message: 'Sync queued' },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
