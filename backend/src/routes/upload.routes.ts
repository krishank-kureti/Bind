import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';
import { selectBestAccountForUpload } from '../services/storage.service.js';
import { downloadFile } from '../services/drive.service.js';
import { uploadQueue } from '../workers/queue.js';
import { logger } from '../utils/logger.js';

const uploadDir = path.resolve('uploads');
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
});

const router = Router();

router.use(requireAuth);

router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;

    if (!req.file) {
      res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } });
      return;
    }

    const targetFolderId = req.body.folderId as string | undefined;

    const bestAccount = await selectBestAccountForUpload(userId);
    if (!bestAccount) {
      res.status(400).json({ success: false, error: { code: 'NO_ACCOUNT', message: 'No available account for upload' } });
      return;
    }

    const uploadJob = await prisma.uploadJob.create({
      data: {
        userId,
        targetAccountId: bestAccount.id,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: BigInt(req.file.size),
        targetFolderId: targetFolderId ?? null,
        status: 'PENDING',
      },
    });

    await uploadQueue.add('processUpload', {
      jobId: uploadJob.id,
      tempPath: req.file.path,
    });

    logger.info({ jobId: uploadJob.id, accountId: bestAccount.id, fileName: req.file.originalname }, 'Upload queued');

    res.status(201).json({
      success: true,
      data: {
        id: uploadJob.id,
        status: 'PENDING',
        fileName: req.file.originalname,
        fileSize: req.file.size,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const jobId = req.params.jobId as string;

    const job = await prisma.uploadJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Upload job not found' } });
      return;
    }

    res.json({
      success: true,
      data: {
        id: job.id,
        fileName: job.fileName,
        mimeType: job.mimeType,
        sizeBytes: job.sizeBytes?.toString() ?? null,
        status: job.status,
        progress: job.progress,
        errorMessage: job.errorMessage,
        resultFileId: job.resultFileId,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:jobId/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const jobId = req.params.jobId as string;

    const job = await prisma.uploadJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job || job.status !== 'COMPLETE' || !job.resultFileId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Upload not complete or not found' } });
      return;
    }

    const { stream, mimeType, name } = await downloadFile(job.targetAccountId, job.resultFileId);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
