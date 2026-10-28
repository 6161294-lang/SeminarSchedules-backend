import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(HttpError.notFound(`הנתיב ${req.method} ${req.path} לא קיים`, 'ROUTE_NOT_FOUND'));
}

function send(res: Response, status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, ...(details !== undefined ? { details } : {}) } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return send(res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return send(res, 400, 'VALIDATION_ERROR', 'הנתונים שנשלחו אינם תקינים', details);
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return send(res, 413, 'FILE_TOO_LARGE', 'הקובץ גדול מדי (עד 5MB לקובץ)');
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return send(res, 400, 'TOO_MANY_FILES', 'אפשר להעלות עד 5 קבצים בשדה "files"');
    }
    return send(res, 400, 'UPLOAD_ERROR', 'שגיאה בהעלאת הקובץ');
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return send(res, 409, 'ALREADY_EXISTS', 'הערך כבר קיים במערכת');
    if (err.code === 'P2025') return send(res, 404, 'NOT_FOUND', 'המשאב לא נמצא');
    if (err.code === 'P2003') {
      return send(res, 409, 'IN_USE', 'לא ניתן לבצע את הפעולה כי קיימים נתונים התלויים ברשומה');
    }
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return send(res, 400, 'INVALID_JSON', 'גוף הבקשה אינו JSON תקין');
  }

  const e = err as { type?: string };
  if (e?.type === 'entity.too.large') {
    return send(res, 413, 'PAYLOAD_TOO_LARGE', 'גוף הבקשה גדול מדי');
  }

  if (!env.isTest) console.error('Unhandled error:', err);
  return send(res, 500, 'INTERNAL_ERROR', 'שגיאה פנימית בשרת');
}
