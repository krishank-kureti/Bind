import { google, drive_v3 } from 'googleapis';
import { getValidAccessToken } from './token.service.js';

const FILE_FIELDS = [
  'id', 'name', 'mimeType', 'size', 'parents',
  'createdTime', 'modifiedTime', 'webViewLink', 'webContentLink',
  'iconLink', 'thumbnailLink', 'starred', 'trashed',
  'md5Checksum', 'owners', 'capabilities',
].join(',');

function getDriveClient(accessToken: string): drive_v3.Drive {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

export async function listAllFiles(
  accountId: string,
  pageToken?: string,
): Promise<{ files: drive_v3.Schema$File[]; nextPageToken?: string }> {
  const token = await getValidAccessToken(accountId);
  const drive = getDriveClient(token);

  const res = await drive.files.list({
    pageSize: 1000,
    fields: `nextPageToken, files(${FILE_FIELDS})`,
    q: 'trashed = false',
    spaces: 'drive',
    pageToken,
    orderBy: 'modifiedTime desc',
  });

  return {
    files: res.data.files ?? [],
    nextPageToken: res.data.nextPageToken ?? undefined,
  };
}

export async function getStorageQuota(accountId: string) {
  const token = await getValidAccessToken(accountId);
  const drive = getDriveClient(token);

  const res = await drive.about.get({
    fields: 'storageQuota',
  });

  return res.data.storageQuota;
}
