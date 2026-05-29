export interface CursorPaginationParams {
  limit: number;
  cursor?: string | undefined;
}

export function parsePagination(query: Record<string, unknown>): CursorPaginationParams {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const cursor = typeof query.cursor === 'string' && query.cursor.length > 0
    ? query.cursor
    : undefined;
  return { limit, cursor };
}

export interface PaginationMeta {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  total?: number | undefined;
}

export function paginationMeta(
  items: unknown[],
  limit: number,
  total?: number,
): PaginationMeta {
  const hasMore = items.length > limit;
  return {
    limit,
    hasMore,
    nextCursor: null,
    total,
  };
}
