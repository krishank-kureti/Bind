-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'ERROR');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connected_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_index" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT,
    "isFolder" BOOLEAN NOT NULL DEFAULT false,
    "isTrashed" BOOLEAN NOT NULL DEFAULT false,
    "parentFolderId" TEXT,
    "fullPath" TEXT,
    "createdAtProvider" TIMESTAMP(3),
    "modifiedAtProvider" TIMESTAMP(3),
    "webViewLink" TEXT,
    "webContentLink" TEXT,
    "iconLink" TEXT,
    "thumbnailLink" TEXT,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "md5Checksum" TEXT,
    "sha256Checksum" TEXT,
    "searchVector" tsvector,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_quotas" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "totalBytes" BIGINT NOT NULL,
    "usedBytes" BIGINT NOT NULL,
    "driveBytes" BIGINT,
    "gmailBytes" BIGINT,
    "photosBytes" BIGINT,
    "trashBytes" BIGINT,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetAccountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "targetFolderId" TEXT,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "resultFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "fileSize" BIGINT,
    "fileCount" INTEGER NOT NULL,
    "totalWaste" BIGINT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "duplicate_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "connected_accounts_userId_providerAccountId_key" ON "connected_accounts"("userId", "providerAccountId");

-- CreateIndex
CREATE INDEX "file_index_accountId_idx" ON "file_index"("accountId");

-- CreateIndex
CREATE INDEX "file_index_name_idx" ON "file_index"("name");

-- CreateIndex
CREATE INDEX "file_index_mimeType_idx" ON "file_index"("mimeType");

-- CreateIndex
CREATE INDEX "file_index_parentFolderId_idx" ON "file_index"("parentFolderId");

-- CreateIndex
CREATE INDEX "file_index_md5Checksum_idx" ON "file_index"("md5Checksum");

-- CreateIndex
CREATE UNIQUE INDEX "file_index_accountId_providerId_key" ON "file_index"("accountId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "storage_quotas_accountId_key" ON "storage_quotas"("accountId");

-- CreateIndex
CREATE INDEX "duplicate_groups_userId_idx" ON "duplicate_groups"("userId");

-- AddForeignKey
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_index" ADD CONSTRAINT "file_index_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_quotas" ADD CONSTRAINT "storage_quotas_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
