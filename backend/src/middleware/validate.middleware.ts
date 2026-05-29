import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    if (source === 'body') req.body = result.data;
    else if (source === 'query') (req as unknown as Record<string, unknown>).validatedQuery = result.data;
    else if (source === 'params') (req as unknown as Record<string, unknown>).validatedParams = result.data;
    next();
  };
}
