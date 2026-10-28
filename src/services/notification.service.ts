import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';

interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  lessonId?: string;
  announcementId?: string;
}

type Db = Prisma.TransactionClient | typeof prisma;

/** יוצר התראה לכל אחת מהמשתמשות (בלי כפילויות). מחזיר את מספר הנמענות */
export async function notifyUsers(userIds: string[], input: NotificationInput, db: Db = prisma) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return 0;
  await db.notification.createMany({
    data: unique.map((userId) => ({ userId, ...input }))
  });
  return unique.length;
}

export async function listMine(userId: string, opts: { unreadOnly?: boolean; limit: number }) {
  const where: Prisma.NotificationWhereInput = { userId, ...(opts.unreadOnly ? { isRead: false } : {}) };
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: opts.limit }),
    prisma.notification.count({ where: { userId, isRead: false } })
  ]);
  return { items, unreadCount };
}

export async function markRead(userId: string, id: string) {
  const result = await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  if (result.count === 0) throw HttpError.notFound('ההתראה לא נמצאה');
  return prisma.notification.findUniqueOrThrow({ where: { id } });
}

export async function markAllRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });
  return { updated: result.count };
}
