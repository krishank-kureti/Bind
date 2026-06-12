import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';

interface SearchRow {
  id: string;
  name: string;
  mimeType: string;
  size: bigint | null;
  isFolder: boolean;
  isTrashed: boolean;
  accountId: string;
  providerId: string;
  parentFolderId: string | null;
  webViewLink: string | null;
  thumbnailLink: string | null;
  starred: boolean;
  modifiedAtProvider: Date | null;
  accountEmail: string;
  accountDisplayName: string | null;
  rank: number;
}

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as Express.User).id;
    const q = req.query.q as string | undefined;
    const { accountId, limit: limitStr, offset: offsetStr } = req.query as Record<string, string | undefined>;

    if (!q || q.trim().length === 0) {
      res.json({ success: true, data: [], meta: { total: 0 } });
      return;
    }

    const limit = Math.min(Math.max(Number(limitStr) || 50, 1), 200);
    const offset = Math.max(Number(offsetStr) || 0, 0);

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId, isActive: true, ...(accountId ? { id: accountId } : {}) },
      select: { id: true },
    });

    const accountIds = accounts.map((a) => a.id);
    if (accountIds.length === 0) {
      res.json({ success: true, data: [], meta: { total: 0 } });
      return;
    }

    const results = await prisma.$queryRaw<SearchRow[]>`
      SELECT
        fi.id, fi.name, fi."mimeType", fi.size, fi."isFolder", fi."isTrashed",
        fi."accountId", fi."providerId", fi."parentFolderId",
        fi."webViewLink", fi."thumbnailLink", fi.starred, fi."modifiedAtProvider",
        ca.email as "accountEmail",
        ca."displayName" as "accountDisplayName",
        ts_rank(fi."searchVector", plainto_tsquery('english', ${q})) as rank
      FROM file_index fi
      JOIN connected_accounts ca ON fi."accountId" = ca.id
      WHERE
        fi."accountId" = ANY(${accountIds}::text[])
        AND fi."isTrashed" = false
        AND fi."searchVector" @@ plainto_tsquery('english', ${q})
      ORDER BY rank DESC, fi."modifiedAtProvider" DESC NULLS LAST
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count
      FROM file_index fi
      JOIN connected_accounts ca ON fi."accountId" = ca.id
      WHERE
        fi."accountId" = ANY(${accountIds}::text[])
        AND fi."isTrashed" = false
        AND fi."searchVector" @@ plainto_tsquery('english', ${q})
    `;

    const total = Number(countResult[0]?.count ?? 0);

    res.json({
      success: true,
      data: results,
      meta: { total, limit, offset },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
