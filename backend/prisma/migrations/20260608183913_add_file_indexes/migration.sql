-- CreateIndex
CREATE INDEX "file_index_isTrashed_idx" ON "file_index"("isTrashed");

-- CreateIndex
CREATE INDEX "file_index_starred_idx" ON "file_index"("starred");

-- CreateIndex
CREATE INDEX "file_index_isOwned_idx" ON "file_index"("isOwned");

-- CreateIndex
CREATE INDEX "file_index_isFolder_idx" ON "file_index"("isFolder");

-- CreateIndex
CREATE INDEX "file_index_accountId_isTrashed_parentFolderId_idx" ON "file_index"("accountId", "isTrashed", "parentFolderId");
