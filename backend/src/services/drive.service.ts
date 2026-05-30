import { google, drive_v3 } from 'googleapis';
import { getValidAccessToken } from './token.service.js';
import { type Readable } from 'stream';

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

export async function uploadFile(
  accountId: string,
  fileName: string,
  mimeType: string,
  stream: Readable,
  parentFolderId?: string,
): Promise<drive_v3.Schema$File> {
  const token = await getValidAccessToken(accountId);
  const drive = getDriveClient(token);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id,name,mimeType,size,webViewLink,webContentLink,parents',
  });

  return res.data;
}

export async function downloadFile(
  accountId: string,
  fileId: string,
): Promise<{ stream: Readable; mimeType: string; name: string; size: string | null }> {
  const token = await getValidAccessToken(accountId);
  const drive = getDriveClient(token);

  const meta = await drive.files.get({
    fileId,
    fields: 'name,mimeType,size',
  });

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' },
  );

  return {
    stream: res.data as unknown as Readable,
    mimeType: meta.data.mimeType ?? 'application/octet-stream',
    name: meta.data.name ?? 'file',
    size: meta.data.size ?? null,
  };
}
