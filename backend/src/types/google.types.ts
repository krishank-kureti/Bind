import type { drive_v3 } from 'googleapis';

export type GoogleDriveFile = drive_v3.Schema$File;
export type GoogleDriveFileList = drive_v3.Schema$FileList;
export type GoogleAbout = drive_v3.Schema$About;

export type GoogleStorageQuota = NonNullable<GoogleAbout['storageQuota']>;

export interface IndexedFile {
  id: string;
  accountId: string;
  providerId: string;
  name: string;
  mimeType: string;
  size: bigint | null;
  isFolder: boolean;
  isTrashed: boolean;
  parentFolderId: string | null;
  webViewLink: string | null;
  thumbnailLink: string | null;
  starred: boolean;
  md5Checksum: string | null;
  modifiedAt: Date | null;
}
