import { Router } from 'express';
import passport from 'passport';
import { getUserWithAccounts } from '../services/auth.service.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/google', passport.authenticate('google', {
  scope: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive',
  ],
  accessType: 'offline',
  prompt: 'select_account consent',
}));

router.get('/google/callback', passport.authenticate('google', {
  successRedirect: `${env.FRONTEND_URL}/`,
  failureRedirect: `${env.FRONTEND_URL}/?error=auth_failed`,
}));

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      next(err);
      return;
    }
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

router.get('/me', async (req, res, next) => {
  if (!req.isAuthenticated()) {
    res.status(200).json({
      success: true,
      data: { user: null, accounts: [] },
    });
    return;
  }

  try {
    const userData = await getUserWithAccounts(req.user.id);
    if (!userData) {
      res.status(200).json({
        success: true,
        data: { user: null, accounts: [] },
      });
      return;
    }

    const { accounts, ...user } = userData;
    res.json({
      success: true,
      data: { user, accounts },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
