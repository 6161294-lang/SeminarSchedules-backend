import bcrypt from 'bcryptjs';
import type { Class, Prisma, User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import type { AuthUser } from '../types/express';
import { HttpError } from '../utils/httpError';

type UserWithClass = User & { class?: Class | null };

/** מחזיר משתמשת בלי סיסמה או hash */
export function toPublicUser(user: UserWithClass) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    classId: user.classId,
    seminarId: user.seminarId,
    isActive: user.isActive,
    createdAt: user.createdAt,
    ...(user.class !== undefined
      ? { class: user.class ? { id: user.class.id, name: user.class.name, grade: user.class.grade } : null }
      : {})
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { class: true } });
  return toPublicUser(user);
}

export async function listUsers(seminarId: string, q: {
  role?: User['role'];
  classId?: string;
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.UserWhereInput = {
    seminarId,
    ...(q.role ? { role: q.role } : {}),
    ...(q.classId ? { classId: q.classId } : {}),
    ...(q.isActive !== undefined ? { isActive: q.isActive } : {}),
    ...(q.search
      ? {
          OR: [
            { fullName: { contains: q.search, mode: 'insensitive' } },
            { email: { contains: q.search, mode: 'insensitive' } }
          ]
        }
      : {})
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { class: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit
    }),
    prisma.user.count({ where })
  ]);
  return { items: items.map(toPublicUser), total, page: q.page, limit: q.limit };
}

export async function getUser(seminarId: string, id: string) {
  const user = await prisma.user.findFirst({ where: { id, seminarId }, include: { class: true } });
  if (!user) throw HttpError.notFound('המשתמשת לא נמצאה');
  return toPublicUser(user);
}

async function assertClassExists(seminarId: string, classId: string) {
  const cls = await prisma.class.findFirst({ where: { id: classId, seminarId } });
  if (!cls) throw HttpError.badRequest('הכיתה שנבחרה לא קיימת', 'CLASS_NOT_FOUND');
}

export async function createUser(seminarId: string, input: {
  fullName: string;
  email: string;
  password: string;
  role: User['role'];
  classId?: string;
}) {
  if (input.classId) await assertClassExists(seminarId, input.classId);
  const user = await prisma.user.create({
    data: {
      seminarId,
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      classId: input.classId ?? null,
      passwordHash: await bcrypt.hash(input.password, env.BCRYPT_COST)
    },
    include: { class: true }
  });
  return toPublicUser(user);
}

export async function updateUser(
  actor: AuthUser,
  id: string,
  input: { fullName?: string; email?: string; password?: string; classId?: string; isActive?: boolean }
) {
  const existing = await prisma.user.findFirst({ where: { id, seminarId: actor.seminarId } });
  if (!existing) throw HttpError.notFound('המשתמשת לא נמצאה');

  if (input.classId !== undefined) {
    if (existing.role !== 'STUDENT') throw HttpError.badRequest('רק תלמידה משויכת לכיתה', 'CLASS_NOT_ALLOWED');
    await assertClassExists(actor.seminarId, input.classId);
  }
  if (input.isActive === false && id === actor.id) {
    throw HttpError.badRequest('אי אפשר להשבית את החשבון של עצמך', 'CANNOT_DEACTIVATE_SELF');
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.classId !== undefined ? { classId: input.classId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password !== undefined
        ? { passwordHash: await bcrypt.hash(input.password, env.BCRYPT_COST) }
        : {})
    },
    include: { class: true }
  });

  // השבתה או איפוס סיסמה מנתקים את כל ההתחברויות הקיימות
  if (input.isActive === false || input.password !== undefined) {
    await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  return toPublicUser(user);
}
