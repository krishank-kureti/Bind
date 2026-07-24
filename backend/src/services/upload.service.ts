import { createReadStream, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { prisma } from '../config/prisma.js';
import { uploadFile as driveUploadFile } from './drive.service.js';
import { invalidateFileListCache } from '../utils/cache.js';
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

    logger.info({ exists: existsSync(tempPath), tempPath }, 'File existence check');

    const stream = createReadStream(tempPath);

    const result = await Promise.race([
      driveUploadFile(
        job.targetAccountId,
        job.fileName,
        job.mimeType,
        stream,
        job.targetFolderId ?? undefined,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Google upload timeout')), 30000),
      ),
    ]);

    await prisma.uploadJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETE',
        progress: 100,
        resultFileId: result.id ?? null,
      },
    });

    // Real-time FileIndex so listings update without waiting for full re-sync
    if (result.id) {
      const parentId = result.parents?.[0] ?? job.targetFolderId ?? null;
      await prisma.fileIndex.upsert({
        where: {
          accountId_providerId: {
            accountId: job.targetAccountId,
            providerId: result.id,
          },
        },
        create: {
          accountId: job.targetAccountId,
          providerId: result.id,
          name: result.name ?? job.fileName,
          mimeType: result.mimeType ?? job.mimeType,
          size: result.size ? BigInt(result.size) : job.sizeBytes,
          isFolder: (result.mimeType ?? job.mimeType) === 'application/vnd.google-apps.folder',
          isTrashed: false,
          parentFolderId: parentId,
          webViewLink: result.webViewLink ?? null,
          webContentLink: result.webContentLink ?? null,
          starred: false,
          isOwned: true,
        },
        update: {
          name: result.name ?? job.fileName,
          mimeType: result.mimeType ?? job.mimeType,
          size: result.size ? BigInt(result.size) : job.sizeBytes,
          parentFolderId: parentId,
          webViewLink: result.webViewLink ?? null,
          webContentLink: result.webContentLink ?? null,
          isTrashed: false,
          isOwned: true,
        },
      });

      await prisma.$executeRaw`
        UPDATE file_index
        SET "searchVector" = to_tsvector('english', COALESCE(name, ''))
        WHERE "accountId" = ${job.targetAccountId}
          AND "providerId" = ${result.id}
      `;

      await invalidateFileListCache(job.userId);
    }

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
