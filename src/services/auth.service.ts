import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { generateSessionKey, hashSessionKey } from '../utils/security';
import { toPublicUser } from './user.service';

let dummyHash: string | undefined;
// משמש להשוואת סיסמה גם כשהמשתמשת לא קיימת, כדי לא לחשוף אילו אימיילים רשומים
async function getDummyHash() {
  dummyHash ??= await bcrypt.hash('not-a-real-password', env.BCRYPT_COST);
  return dummyHash;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, env.BCRYPT_COST);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !passwordOk || !user.isActive) {
    throw HttpError.unauthorized('אימייל או סיסמה שגויים', 'INVALID_CREDENTIALS');
  }
  return createSession(user);
}

/** הרשמה: רק מזכירה. נוצר סמינר חדש וריק, והיא המזכירה שלו */
export async function register(input: { seminarName: string; fullName: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw HttpError.conflict('כבר קיים משתמש עם האימייל הזה', 'EMAIL_TAKEN');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      role: 'ADMIN',
      passwordHash,
      seminar: { create: { name: input.seminarName } }
    }
  });
  return createSession(user);
}

async function createSession(user: User) {
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
  });
  const decoded = jwt.decode(token) as jwt.JwtPayload;
  const expiresAt = new Date((decoded.exp ?? 0) * 1000);

  const sessionKey = generateSessionKey();
  // ניקוי התחברויות ישנות של אותה משתמשת
  await prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
  await prisma.session.create({
    data: { userId: user.id, keyHash: hashSessionKey(sessionKey), jwt: token, expiresAt }
  });

  return { sessionKey, expiresAt, user: toPublicUser(user) };
}

export async function logout(sessionId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}

export async function changePassword(
  userId: string,
  currentSessionId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw HttpError.badRequest('הסיסמה הנוכחית שגויה', 'WRONG_PASSWORD');
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  // מנתקים את כל שאר ההתחברויות
  await prisma.session.updateMany({
    where: { userId, id: { not: currentSessionId }, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
