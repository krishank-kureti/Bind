import { prisma } from '../config/prisma.js';
import { listAllFiles } from './drive.service.js';
import { logger } from '../utils/logger.js';

export async function indexAccount(accountId: string): Promise<number> {
  let pageToken: string | undefined;
  let totalIndexed = 0;

  do {
    const { files, nextPageToken } = await listAllFiles(accountId, pageToken);
    pageToken = nextPageToken;

    const batch: Array<ReturnType<typeof prisma.fileIndex.upsert>> = [];

    for (const file of files) {
      const base = {
        name: file.name ?? '',
        mimeType: file.mimeType ?? '',
        size: file.size ? BigInt(file.size) : null,
        isFolder: file.mimeType === 'application/vnd.google-apps.folder',
        isTrashed: file.trashed ?? false,
        parentFolderId: file.parents?.[0] ?? null,
        createdAtProvider: file.createdTime ? new Date(file.createdTime) : null,
        modifiedAtProvider: file.modifiedTime ? new Date(file.modifiedTime) : null,
        webViewLink: file.webViewLink ?? null,
        webContentLink: file.webContentLink ?? null,
        thumbnailLink: file.thumbnailLink ?? null,
        iconLink: file.iconLink ?? null,
        starred: file.starred ?? false,
        md5Checksum: file.md5Checksum ?? null,
      };

      batch.push(
        prisma.fileIndex.upsert({
          where: { accountId_providerId: { accountId, providerId: file.id! } },
          update: base,
          create: { ...base, accountId, providerId: file.id! },
        }),
      );
    }

    await prisma.$transaction(batch);
    totalIndexed += files.length;
    logger.debug({ accountId, totalIndexed }, 'Indexed page');
  } while (pageToken);

  await prisma.$executeRaw`
    UPDATE file_index
    SET "searchVector" = to_tsvector('english', COALESCE(name, ''))
    WHERE "accountId" = ${accountId}
  `;

  logger.info({ accountId, totalIndexed }, 'Account indexing complete');
  return totalIndexed;
}
