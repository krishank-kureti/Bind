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
    await prisma.uploadJob.update({
      where: { id: jobId },
      data: { status: 'UPLOADING', progress: 10 },
    });

    const stream = createReadStream(tempPath);

    const result = await driveUploadFile(
      job.targetAccountId,
      job.fileName,
      job.mimeType,
      stream,
      job.targetFolderId ?? undefined,
    );

    await prisma.uploadJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETE',
        progress: 100,
        resultFileId: result.id ?? null,
      },
    });

    await unlink(tempPath).catch(() => {});
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    logger.error({ jobId, err }, 'Upload job failed');

    await prisma.uploadJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: message },
    });

    await unlink(tempPath).catch(() => {});
  }
}
