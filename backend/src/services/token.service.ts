import { google } from 'googleapis';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { encrypt, decrypt } from '../utils/encryption.js';

export async function getValidAccessToken(accountId: string): Promise<string> {
  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });

  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (account.tokenExpiresAt && account.tokenExpiresAt > fiveMinFromNow) {
    return decrypt(account.accessToken);
  }

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
  );

  const refreshToken = decrypt(account.refreshToken);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (credentials.access_token) {
    await prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        accessToken: encrypt(credentials.access_token),
        tokenExpiresAt: credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : null,
      },
    });

    return credentials.access_token;
  }

  throw new Error('Failed to refresh access token');
}
