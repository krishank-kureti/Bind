import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';

const router = Router();

router.use(requireAuth);

const DEFAULTS = {
  uploadMode: 'auto' as const,
  notificationsEnabled: true,
  showSharedFiles: false,
};

function serializeSettings(settings: {
  uploadMode: string;
  notificationsEnabled: boolean;
  showSharedFiles: boolean;
}) {
  return {
    uploadMode: settings.uploadMode === 'manual' ? 'manual' : 'auto',
    notificationsEnabled: settings.notificationsEnabled,
    showSharedFiles: settings.showSharedFiles === true,
  };
}

async function getOrCreateSettings(userId: string) {
  const existing = await prisma.userSettings.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.userSettings.create({
    data: {
      userId,
      uploadMode: DEFAULTS.uploadMode,
      notificationsEnabled: DEFAULTS.notificationsEnabled,
      showSharedFiles: DEFAULTS.showSharedFiles,
    },
  });
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const settings = await getOrCreateSettings(userId);
    res.json({
      success: true,
      data: serializeSettings(settings),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const body = req.body as {
      uploadMode?: string;
      notificationsEnabled?: boolean;
      showSharedFiles?: boolean;
    };

    const data: {
      uploadMode?: string;
      notificationsEnabled?: boolean;
      showSharedFiles?: boolean;
    } = {};

    if (body.uploadMode !== undefined) {
      if (body.uploadMode !== 'auto' && body.uploadMode !== 'manual') {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_UPLOAD_MODE', message: 'uploadMode must be "auto" or "manual"' },
        });
        return;
      }
      data.uploadMode = body.uploadMode;
    }

    if (body.notificationsEnabled !== undefined) {
      if (typeof body.notificationsEnabled !== 'boolean') {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_NOTIFICATIONS', message: 'notificationsEnabled must be a boolean' },
        });
        return;
      }
      data.notificationsEnabled = body.notificationsEnabled;
    }

    if (body.showSharedFiles !== undefined) {
      if (typeof body.showSharedFiles !== 'boolean') {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_SHOW_SHARED', message: 'showSharedFiles must be a boolean' },
        });
        return;
      }
      data.showSharedFiles = body.showSharedFiles;
    }

    if (Object.keys(data).length === 0) {
      const current = await getOrCreateSettings(userId);
      res.json({
        success: true,
        data: serializeSettings(current),
      });
      return;
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        uploadMode: data.uploadMode ?? DEFAULTS.uploadMode,
        notificationsEnabled: data.notificationsEnabled ?? DEFAULTS.notificationsEnabled,
        showSharedFiles: data.showSharedFiles ?? DEFAULTS.showSharedFiles,
      },
      update: data,
    });

    res.json({
      success: true,
      data: serializeSettings(settings),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
