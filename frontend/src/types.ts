export interface CloudAccount {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  provider: string;
  isActive: boolean;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR';
  lastSyncedAt: string | null;
  createdAt: string;
  quotaUsed: number;
  quotaTotal: number;
  usagePercent: number;
  color: string;
}

export interface CloudFile {
  id: string;
  accountId: string;
  providerId: string;
  name: string;
  mimeType: string;
  size: string | null;
  isFolder: boolean;
  isTrashed: boolean;
  parentFolderId: string | null;
  starred: boolean;
  isOwned: boolean;
  webViewLink: string | null;
  iconLink: string | null;
  thumbnailLink: string | null;
  modifiedAtProvider: string | null;
  createdAtProvider: string | null;
  fullPath: string | null;
  indexedAt: string;
  updatedAt: string;
  account: { email: string; displayName: string | null; };
  accountEmail: string;
  category: string;
  modified: string;
  sizeBytes: number;
}

export interface ActivityLog {
  id: string;
  message: string;
  timestamp: string;
  iconType: 'sync' | 'upload' | 'move' | 'delete' | 'warning';
  sizeBytes?: number;
  accountEmail: string;
}

export interface DuplicateGroup {
  id: string;
  checksum: string;
  fileSize: string | null;
  fileCount: number;
  totalWaste: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  duplicateFiles: Array<{
    id: string;
    fileId: string;
    accountId: string;
    file: {
      id: string;
      name: string;
      mimeType: string;
      size: string | null;
      providerId: string;
      isOwned: boolean;
      webViewLink: string | null;
      md5Checksum: string | null;
    };
    account: { email: string; displayName: string | null; };
  }>;
  wastedSizeBytes: number;
  filename: string;
}

export interface StaleFile {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  lastModifiedYear: number;
  accountEmail: string;
}

export interface GeminiReport {
  persona: string;
  statusSummary: string;
  score: number;
  recommendations: Array<{ title: string; description: string; spaceReclaimed: string; }>;
}
