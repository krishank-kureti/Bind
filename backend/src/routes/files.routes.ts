import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';
import {
  downloadFile,
  renameFile as driveRename,
  moveFile as driveMove,
  toggleStarFile,
  trashFile as driveTrash,
  restoreFile as driveRestore,
  permanentlyDeleteFile,
  copyFile as driveCopy,
  createDriveFolder,
} from '../services/drive.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const router = Router();

router.use(requireAuth);

const accountSelect = { select: { email: true, displayName: true } };

async function verifyOwnership(userId: string, fileId: string) {
  const file = await prisma.fileIndex.findUnique({ where: { id: fileId } });
  if (!file) return null;
  const account = await prisma.connectedAccount.findFirst({
    where: { id: file.accountId, userId },
  });
  if (!account) return null;
  return { file, account };
}

function isPermissionError(err: unknown): boolean {
  const gaxiosErr = err as { response?: { status?: number }; code?: number };
  return gaxiosErr?.response?.status === 403 || gaxiosErr?.code === 403;
}

function permissionDenied(res: Response) {
  res.status(403).json({ success: false, error: { code: 'PERMISSION_DENIED', message: 'You do not have permission to modify this file' } });
}

router.post('/batch/trash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const { fileIds } = req.body as { fileIds?: string[] };
    if (!fileIds || fileIds.length === 0) {
      res.status(400).json({ success: false, error: { code: 'MISSING_FILEIDS', message: 'fileIds is required' } });
      return;
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    for (const id of fileIds) {
      try {
        const owned = await verifyOwnership(userId, id);
        if (!owned) { results.push({ id, success: false, error: 'Not found' }); continue; }
        await driveTrash(owned.account.id, owned.file.providerId);
        await prisma.fileIndex.update({ where: { id }, data: { isTrashed: true } });
        results.push({ id, success: true });
      } catch (err) {
        results.push({ id, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

router.post('/batch/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const { fileIds } = req.body as { fileIds?: string[] };
    if (!fileIds || fileIds.length === 0) {
      res.status(400).json({ success: false, error: { code: 'MISSING_FILEIDS', message: 'fileIds is required' } });
      return;
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    for (const id of fileIds) {
      try {
        const owned = await verifyOwnership(userId, id);
        if (!owned) { results.push({ id, success: false, error: 'Not found' }); continue; }
        await driveRestore(owned.account.id, owned.file.providerId);
        await prisma.fileIndex.update({ where: { id }, data: { isTrashed: false } });
        results.push({ id, success: true });
      } catch (err) {
        results.push({ id, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

router.post('/batch/delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const { fileIds } = req.body as { fileIds?: string[] };
    if (!fileIds || fileIds.length === 0) {
      res.status(400).json({ success: false, error: { code: 'MISSING_FILEIDS', message: 'fileIds is required' } });
      return;
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    for (const id of fileIds) {
      try {
        const owned = await verifyOwnership(userId, id);
        if (!owned) { results.push({ id, success: false, error: 'Not found' }); continue; }
        await permanentlyDeleteFile(owned.account.id, owned.file.providerId);
        await prisma.fileIndex.delete({ where: { id } });
        results.push({ id, success: true });
      } catch (err) {
        results.push({ id, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

router.post('/batch/move', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const { fileIds, folderId } = req.body as { fileIds?: string[]; folderId?: string };
    if (!fileIds || fileIds.length === 0 || !folderId) {
      res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'fileIds and folderId are required' } });
      return;
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    for (const id of fileIds) {
      try {
        const owned = await verifyOwnership(userId, id);
        if (!owned) { results.push({ id, success: false, error: 'Not found' }); continue; }
        await driveMove(owned.account.id, owned.file.providerId, folderId, owned.file.parentFolderId);
        await prisma.fileIndex.update({ where: { id }, data: { parentFolderId: folderId } });
        results.push({ id, success: true });
      } catch (err) {
        results.push({ id, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

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
      owned,
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
    if (folderId === 'root') where.parentFolderId = null;
    else if (folderId) {
      const folder = await prisma.fileIndex.findUnique({ where: { id: folderId } });
      where.parentFolderId = folder?.providerId ?? folderId;
    }
    if (starred === 'true') where.starred = true;
    if (owned === 'true') where.isOwned = true;
    if (owned === 'false') where.isOwned = false;
    if (query) where.name = { contains: query, mode: 'insensitive' };

    const orderBy: Prisma.FileIndexOrderByWithRelationInput = {};
    if (sortBy === 'name') orderBy.name = sortDir === 'asc' ? 'asc' : 'desc';
    else if (sortBy === 'size') orderBy.size = sortDir === 'asc' ? 'asc' : 'desc';
    else orderBy.modifiedAtProvider = sortDir === 'asc' ? 'asc' : 'desc';

    const total = await prisma.fileIndex.count({ where });

    const files = await prisma.fileIndex.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ isFolder: 'desc' as const }, orderBy, { id: 'desc' as const }],
      include: { account: accountSelect },
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
      include: { account: accountSelect },
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
    if (isPermissionError(err)) {
      res.status(403).json({ success: false, error: { code: 'PERMISSION_DENIED', message: 'You do not have permission to access this file' } });
      return;
    }
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const { name, folderId } = req.body as { name?: string; folderId?: string };

    if (!name) {
      res.status(400).json({ success: false, error: { code: 'MISSING_NAME', message: 'Folder name is required' } });
      return;
    }

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    if (accounts.length === 0) {
      res.status(400).json({ success: false, error: { code: 'NO_ACCOUNT', message: 'No active accounts' } });
      return;
    }

    const accountId = accounts[0]!.id;
    const driveFile = await createDriveFolder(accountId, name, folderId);

    const fileIndex = await prisma.fileIndex.create({
      data: {
        accountId,
        providerId: driveFile.id!,
        name: driveFile.name!,
        mimeType: 'application/vnd.google-apps.folder',
        isFolder: true,
        parentFolderId: folderId ?? null,
        webViewLink: driveFile.webViewLink ?? null,
      },
      include: { account: accountSelect },
    });

    res.status(201).json({ success: true, data: fileIndex });
  } catch (err) {
    if (isPermissionError(err)) {
      permissionDenied(res);
      return;
    }
    next(err);
  }
});

router.patch('/:fileId/rename', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const fileId = req.params.fileId as string;
    const { name } = req.body as { name?: string };

    if (!name) {
      res.status(400).json({ success: false, error: { code: 'MISSING_NAME', message: 'Name is required' } });
      return;
    }

    const owned = await verifyOwnership(userId, fileId);
    if (!owned) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    await driveRename(owned.account.id, owned.file.providerId, name);

    const updated = await prisma.fileIndex.update({
      where: { id: fileId },
      data: { name },
      include: { account: accountSelect },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    if (isPermissionError(err)) {
      permissionDenied(res);
      return;
    }
    next(err);
  }
});

router.patch('/:fileId/move', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const fileId = req.params.fileId as string;
    const { folderId } = req.body as { folderId?: string };

    if (!folderId) {
      res.status(400).json({ success: false, error: { code: 'MISSING_FOLDER', message: 'folderId is required' } });
      return;
    }

    const owned = await verifyOwnership(userId, fileId);
    if (!owned) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    await driveMove(owned.account.id, owned.file.providerId, folderId, owned.file.parentFolderId);

    const updated = await prisma.fileIndex.update({
      where: { id: fileId },
      data: { parentFolderId: folderId },
      include: { account: accountSelect },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    if (isPermissionError(err)) {
      permissionDenied(res);
      return;
    }
    next(err);
  }
});

router.patch('/:fileId/star', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const fileId = req.params.fileId as string;
    const { starred } = req.body as { starred?: boolean };

    const owned = await verifyOwnership(userId, fileId);
    if (!owned) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    await toggleStarFile(owned.account.id, owned.file.providerId, starred ?? !owned.file.starred);

    const updated = await prisma.fileIndex.update({
      where: { id: fileId },
      data: { starred: starred ?? !owned.file.starred },
      include: { account: accountSelect },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    if (isPermissionError(err)) {
      permissionDenied(res);
      return;
    }
    next(err);
  }
});

router.post('/:fileId/trash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const fileId = req.params.fileId as string;

    const owned = await verifyOwnership(userId, fileId);
    if (!owned) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    await driveTrash(owned.account.id, owned.file.providerId);

    const updated = await prisma.fileIndex.update({
      where: { id: fileId },
      data: { isTrashed: true },
      include: { account: accountSelect },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    if (isPermissionError(err)) {
      permissionDenied(res);
      return;
    }
    next(err);
  }
});

router.post('/:fileId/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const fileId = req.params.fileId as string;

    const owned = await verifyOwnership(userId, fileId);
    if (!owned) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    await driveRestore(owned.account.id, owned.file.providerId);

    const updated = await prisma.fileIndex.update({
      where: { id: fileId },
      data: { isTrashed: false },
      include: { account: accountSelect },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    if (isPermissionError(err)) {
      permissionDenied(res);
      return;
    }
    next(err);
  }
});

router.delete('/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const fileId = req.params.fileId as string;

    const owned = await verifyOwnership(userId, fileId);
    if (!owned) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    await permanentlyDeleteFile(owned.account.id, owned.file.providerId);
    await prisma.fileIndex.delete({ where: { id: fileId } });

    res.json({ success: true, data: { id: fileId, deleted: true } });
  } catch (err) {
    if (isPermissionError(err)) {
      permissionDenied(res);
      return;
    }
    next(err);
  }
});

router.post('/:fileId/copy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const fileId = req.params.fileId as string;

    const owned = await verifyOwnership(userId, fileId);
    if (!owned) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
      return;
    }

    const driveFile = await driveCopy(owned.account.id, owned.file.providerId);

    const fileIndex = await prisma.fileIndex.create({
      data: {
        accountId: owned.account.id,
        providerId: driveFile.id!,
        name: driveFile.name!,
        mimeType: driveFile.mimeType ?? owned.file.mimeType,
        size: driveFile.size ? BigInt(driveFile.size) : owned.file.size,
        isFolder: driveFile.mimeType === 'application/vnd.google-apps.folder' || owned.file.isFolder,
        isTrashed: false,
        parentFolderId: owned.file.parentFolderId,
        webViewLink: driveFile.webViewLink ?? owned.file.webViewLink,
        iconLink: driveFile.iconLink ?? owned.file.iconLink,
        thumbnailLink: driveFile.thumbnailLink ?? owned.file.thumbnailLink,
        starred: false,
        md5Checksum: driveFile.md5Checksum ?? owned.file.md5Checksum,
      },
      include: { account: accountSelect },
    });

    res.status(201).json({ success: true, data: fileIndex });
  } catch (err) {
    if (isPermissionError(err)) {
      permissionDenied(res);
      return;
    }
    next(err);
  }
});

export default router;
