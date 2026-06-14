import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import { prisma } from '../config/prisma.js';
import { uploadFile as driveUploadFile } from './drive.service.js';
import { logger } from '../utils/logger.js';

export async function processUpload(jobId: string, tempPath: string): Promise<void> {
  const job = await prisma.uploadJob.findUnique({ where: { id: jobId } });
  if (!job) {
    logger.error({ jobId }, 'Upload job not found');
    return;
  }

  try {
    logger.info({ jobId, fileName: job.fileName, size: job.sizeBytes?.toString(), targetAccountId: job.targetAccountId }, '[1] Setting job to UPLOADING status');

    await prisma.uploadJob.update({
      where: { id: jobId },
      data: { status: 'UPLOADING', progress: 10 },
    });

    logger.info({ jobId }, '[2] Database updated to UPLOADING');

    const stream = createReadStream(tempPath);

    logger.info({ jobId, tempPath, targetAccountId: job.targetAccountId, fileName: job.fileName, mimeType: job.mimeType }, '[3] Calling driveUploadFile');

    const result = await driveUploadFile(
      job.targetAccountId,
      job.fileName,
      job.mimeType,
      stream,
      job.targetFolderId ?? undefined,
    );

    logger.info({ jobId }, '[4] driveUploadFile returned');
    logger.info({ jobId, driveFileId: result.id, driveFileName: result.name, driveMimeType: result.mimeType, driveSize: result.size }, '[5] Uploaded to Drive, Google file ID');

    logger.info({ jobId, driveFileId: result.id }, '[6] Updating upload job to COMPLETE');

    await prisma.uploadJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETE',
        progress: 100,
        resultFileId: result.id ?? null,
      },
    });

    logger.info({ jobId, driveFileId: result.id }, '[7] Upload job updated to COMPLETE successfully');

    await unlink(tempPath).catch(() => {});
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    const gaxiosErr = err as { response?: { status?: number; data?: unknown }; config?: { url?: string; method?: string } };
    logger.error({
      jobId,
      err,
      errorMessage: message,
      stack: err instanceof Error ? err.stack : undefined,
      googleApiResponse: gaxiosErr?.response?.data ?? undefined,
      googleApiStatus: gaxiosErr?.response?.status ?? undefined,
      googleApiUrl: gaxiosErr?.config?.url ?? undefined,
      googleApiMethod: gaxiosErr?.config?.method ?? undefined,
    }, '[8] Upload job failed');

    await prisma.uploadJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: message },
    });

    await unlink(tempPath).catch(() => {});
  }
}
