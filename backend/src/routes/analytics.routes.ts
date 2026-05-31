import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';

const router = Router();

router.use(requireAuth);

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    if (accountIds.length === 0) {
      res.json({ success: true, data: { totalFiles: 0, totalFolders: 0, trashedFiles: 0, totalStorage: '0', usedStorage: '0', accounts: [] } });
      return;
    }

    const [fileStats, storageStats, accountsDetailed] = await Promise.all([
      prisma.fileIndex.aggregate({
        where: { accountId: { in: accountIds } },
        _count: { id: true },
        _sum: { size: true },
      }),
      prisma.storageQuota.aggregate({
        where: { accountId: { in: accountIds } },
        _sum: { totalBytes: true, usedBytes: true },
      }),
      prisma.connectedAccount.findMany({
        where: { id: { in: accountIds } },
        select: {
          id: true,
          email: true,
          displayName: true,
          _count: { select: { files: true } },
          storageQuota: { select: { totalBytes: true, usedBytes: true } },
        },
      }),
    ]);

    const folderCount = await prisma.fileIndex.count({
      where: { accountId: { in: accountIds }, isFolder: true, isTrashed: false },
    });

    const trashedCount = await prisma.fileIndex.count({
      where: { accountId: { in: accountIds }, isTrashed: true },
    });

    const perAccount = accountsDetailed.map((a) => ({
      id: a.id,
      email: a.email,
      displayName: a.displayName,
      fileCount: a._count.files,
      totalBytes: a.storageQuota?.totalBytes?.toString() ?? '0',
      usedBytes: a.storageQuota?.usedBytes?.toString() ?? '0',
    }));

    res.json({
      success: true,
      data: {
        totalFiles: fileStats._count.id,
        totalFolders: folderCount,
        trashedFiles: trashedCount,
        totalStorage: storageStats._sum.totalBytes?.toString() ?? '0',
        usedStorage: storageStats._sum.usedBytes?.toString() ?? '0',
        accounts: perAccount,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/file-types', async (req: Request, res: Response, next: NextFunction) => {
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

    const files = await prisma.fileIndex.findMany({
      where: { accountId: { in: accountIds }, isTrashed: false },
      select: { mimeType: true, size: true, isFolder: true },
    });

    const categories: Record<string, { count: number; totalSize: bigint }> = {};

    for (const f of files) {
      if (f.isFolder) {
        categories.folder = categories.folder || { count: 0, totalSize: 0n };
        categories.folder.count++;
        continue;
      }

      const cat = categorizeMimeType(f.mimeType);
      categories[cat] = categories[cat] || { count: 0, totalSize: 0n };
      categories[cat].count++;
      categories[cat].totalSize += f.size ?? 0n;
    }

    const data = Object.entries(categories).map(([type, stats]) => ({
      type,
      count: stats.count,
      totalSize: stats.totalSize.toString(),
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

function categorizeMimeType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('text/')) return 'text';
  if (mimeType.startsWith('application/')) {
    if (mimeType.includes('pdf')) return 'document';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('7z')) return 'archive';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('yaml')) return 'data';
    return 'application';
  }
  return 'other';
}

export default router;
