-- DropIndex
DROP INDEX "file_index_search_vector_idx";

-- CreateTable
CREATE TABLE "duplicate_files" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "duplicate_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "duplicate_files_fileId_idx" ON "duplicate_files"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "duplicate_files_groupId_fileId_key" ON "duplicate_files"("groupId", "fileId");

-- AddForeignKey
ALTER TABLE "duplicate_groups" ADD CONSTRAINT "duplicate_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_files" ADD CONSTRAINT "duplicate_files_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "duplicate_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_files" ADD CONSTRAINT "duplicate_files_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_index"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_files" ADD CONSTRAINT "duplicate_files_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
