import { prisma } from '../config/prisma.js';
import { listAllFiles } from './drive.service.js';
import { logger } from '../utils/logger.js';

const BATCH_SIZE = 25;

function buildUpsertPayload(file: any, accountId: string) {
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
    isOwned: file.owners?.some((o: { me?: boolean }) => o.me === true) ?? true,
    md5Checksum: file.md5Checksum ?? null,
  };

  return prisma.fileIndex.upsert({
    where: { accountId_providerId: { accountId, providerId: file.id! } },
    update: base,
    create: { ...base, accountId, providerId: file.id! },
  });
}

export async function indexAccount(accountId: string): Promise<number> {
  let pageToken: string | undefined;
  let totalIndexed = 0;
  let pageNumber = 0;

  do {
    const { files, nextPageToken } = await listAllFiles(accountId, pageToken);
    pageToken = nextPageToken;
    pageNumber++;

    const batch: Array<ReturnType<typeof prisma.fileIndex.upsert>> = [];

    for (const file of files) {
      batch.push(buildUpsertPayload(file, accountId));
    }

    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const chunk = batch.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      try {
        await Promise.all(chunk);
        logger.debug({ accountId, pageNumber, pageSize: files.length, batchNumber, batchSize: chunk.length, totalIndexed }, 'Indexed batch');
      } catch (err) {
        logger.error({ accountId, pageNumber, batchNumber, batchSize: chunk.length, err }, 'Batch upsert failed');
        throw err;
      }
    }

    totalIndexed += files.length;
    logger.debug({ accountId, pageNumber, pageSize: files.length, totalIndexed }, 'Indexed page');
  } while (pageToken);

  // TODO: Future optimization — update searchVector only for changed rows
  // using a generated column or PostgreSQL trigger instead of the full UPDATE.
  await prisma.$executeRaw`
    UPDATE file_index
    SET "searchVector" = to_tsvector('english', COALESCE(name, ''))
    WHERE "accountId" = ${accountId}
  `;

  logger.info({ accountId, totalIndexed }, 'Account indexing complete');
  return totalIndexed;
}
