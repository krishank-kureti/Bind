import { prisma } from '../config/prisma.js';

export async function getUserWithAccounts(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      accounts: {
        where: { isActive: true },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          provider: true,
          isActive: true,
          syncStatus: true,
          lastSyncedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return user;
}

export async function getUserAccounts(userId: string) {
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId, isActive: true },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      provider: true,
      isActive: true,
      syncStatus: true,
      lastSyncedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return accounts;
}

export async function deactivateAccount(accountId: string, userId: string) {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId },
  });

  if (!account) {
    return null;
  }

  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: { isActive: false },
  });

  return account;
}

export async function scheduleAccountSync(accountId: string, userId: string) {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId, isActive: true },
  });

  if (!account) {
    return null;
  }

  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: { syncStatus: 'PENDING' },
  });

  return account;
}
