import { createReadStream, existsSync } from 'fs';
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
    logger.info("STEP 1");

    await prisma.uploadJob.update({
      where: { id: jobId },
      data: { status: 'UPLOADING', progress: 10 },
    });

    logger.info("STEP 2");

    logger.info({ exists: existsSync(tempPath), tempPath }, 'File existence check');

    const stream = createReadStream(tempPath);

    logger.info("STEP 3");

    const result = await Promise.race([
      driveUploadFile(
        job.targetAccountId,
        job.fileName,
        job.mimeType,
        stream,
        job.targetFolderId ?? undefined,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Google upload timeout")), 30000)
      ),
    ]);

    logger.info("STEP 4");

    await prisma.uploadJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETE',
        progress: 100,
        resultFileId: result.id ?? null,
      },
    });

    logger.info("STEP 5");

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
    }, 'Upload job failed');

    await prisma.uploadJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: message },
    });

    await unlink(tempPath).catch(() => {});
  }
}
