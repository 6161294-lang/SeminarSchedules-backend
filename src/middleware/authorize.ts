import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';

/** מאפשר גישה רק לתפקידים שצוינו. חייב לבוא אחרי authenticate */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(HttpError.unauthorized());
    if (!roles.includes(req.user.role)) return next(HttpError.forbidden());
    next();
  };
}

/** מחזיר את המשתמשת המחוברת או זורק 401 (עוזר ל-TypeScript) */
export function currentUser(req: Request) {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}
