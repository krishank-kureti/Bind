import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from './prisma.js';
import { env } from './env.js';
import { encrypt } from '../utils/encryption.js';

passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(new GoogleStrategy({
  clientID: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  callbackURL: env.GOOGLE_CALLBACK_URL,
  passReqToCallback: true,
  scope: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive',
  ],
} as const, async (
  req: Express.Request,
  accessToken: string,
  refreshToken: string,
  profile: { id: string; displayName?: string; emails?: Array<{ value: string }>; photos?: Array<{ value: string }> },
  done: (error: unknown, user?: Express.User | false) => void,
) => {
  try {
    const googleAccountId = profile.id;
    const email = profile.emails?.[0]?.value ?? '';
    const displayName = profile.displayName ?? null;
    const avatarUrl = profile.photos?.[0]?.value ?? null;

    const encAccessToken = encrypt(accessToken);
    const encRefreshToken = refreshToken ? encrypt(refreshToken) : '';
    const tokenExpiresAt = new Date(Date.now() + 3600 * 1000);

    if (req.user) {
      const existing = await prisma.connectedAccount.findUnique({
        where: {
          userId_providerAccountId: { userId: req.user.id, providerAccountId: googleAccountId },
        },
      });

      if (existing) {
        await prisma.connectedAccount.update({
          where: { id: existing.id },
          data: {
            accessToken: encAccessToken,
            refreshToken: refreshToken ? encRefreshToken : existing.refreshToken,
            tokenExpiresAt,
            isActive: true,
          },
        });
      } else {
        await prisma.connectedAccount.create({
          data: {
            userId: req.user.id,
            provider: 'google',
            providerAccountId: googleAccountId,
            email,
            displayName,
            avatarUrl,
            accessToken: encAccessToken,
            refreshToken: encRefreshToken,
            tokenExpiresAt,
            scopes: ['drive'],
          },
        });
      }

      done(null, req.user);
      return;
    }

    const account = await prisma.connectedAccount.findFirst({
      where: { providerAccountId: googleAccountId, provider: 'google' },
      include: { user: true },
    });

    if (account) {
      await prisma.connectedAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encAccessToken,
          refreshToken: refreshToken ? encRefreshToken : account.refreshToken,
          tokenExpiresAt,
        },
      });
      done(null, account.user);
      return;
    }

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        avatarUrl,
        accounts: {
          create: {
            provider: 'google',
            providerAccountId: googleAccountId,
            email,
            displayName,
            avatarUrl,
            accessToken: encAccessToken,
            refreshToken: encRefreshToken,
            tokenExpiresAt,
            scopes: ['drive'],
          },
        },
      },
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });

    done(null, user);
  } catch (err) {
    done(err);
  }
}));
