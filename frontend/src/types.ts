export interface CloudAccount {
  id: string;
  email: string;
  displayName: string | null;
  provider: string;
  isActive: boolean;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR';
  lastSyncedAt: string | null;
  createdAt: string;
  avatarUrl?: string | null;
  // Legacy fields (computed)
  status: 'synced' | 'syncing' | 'auth_error';
  quotaBytes: number;
  usedBytes: number;
  color: string;
  syncFrequency: string;
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
  thumbnailLink: string | null;
  iconLink: string | null;
  md5Checksum: string | null;
  modifiedAtProvider: string | null;
  createdAtProvider: string | null;
  fullPath: string | null;
  indexedAt: string;
  updatedAt: string;
  account: {
    email: string;
    displayName: string | null;
  };
  // Legacy fields (computed)
  category: string;
  path: string;
  modified: string;
  accountEmail: string;
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

export interface DuplicateInstance {
  fileId: string;
  path: string;
  sizeBytes: number;
  accountEmail: string;
}

export interface DuplicateGroup {
  id: string;
  checksum: string;
  filename?: string;
  totalSizeBytes: number;
  wastedSizeBytes: number;
  fileCount: number;
  fileSize: string | null;
  totalWaste: string | null;
  instances: DuplicateInstance[];
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
      thumbnailLink: string | null;
      md5Checksum: string | null;
    };
    account: {
      email: string;
      displayName: string | null;
    };
  }>;
}

export interface IntelligenceAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  canResolve: boolean;
  actionLabel?: string;
}

export interface StaleFile {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  lastModifiedYear: number;
  accountEmail: string;
}
