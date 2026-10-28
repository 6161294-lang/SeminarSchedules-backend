import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { hashSessionKey } from '../utils/security';

/**
 * בודק את המפתח שנשלח ב-Authorization: Bearer <sessionKey>.
 * ה-JWT עצמו נשמר בשרת, והמשתמשת נקבעת לפי ה-JWT ולא לפי מידע מהלקוח.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw HttpError.unauthorized('חסר מפתח התחברות');
    }
    const key = header.slice('Bearer '.length).trim();
    if (!key) throw HttpError.unauthorized('חסר מפתח התחברות');

    const session = await prisma.session.findUnique({ where: { keyHash: hashSessionKey(key) } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw HttpError.unauthorized('ההתחברות פגה או אינה תקינה');
    }

    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(session.jwt, env.JWT_SECRET, { algorithms: ['HS256'] });
      if (typeof decoded === 'string') throw new Error('bad payload');
      payload = decoded;
    } catch {
      throw HttpError.unauthorized('ההתחברות פגה או אינה תקינה');
    }

    if (payload.sub !== session.userId) throw HttpError.unauthorized('ההתחברות אינה תקינה');

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive) throw HttpError.unauthorized('המשתמשת אינה פעילה');

    req.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      classId: user.classId,
      seminarId: user.seminarId
    };
    req.sessionId = session.id;
    next();
  } catch (err) {
    next(err);
  }
}
