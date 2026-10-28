import type { AnnouncementAudience, Grade, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { AuthUser } from '../types/express';
import { HttpError } from '../utils/httpError';
import { notifyUsers } from './notification.service';

// ---------- הודעות מהמזכירה לקבוצות ----------

function recipientsWhere(
  seminarId: string,
  a: {
    audience: AnnouncementAudience;
    grade?: Grade;
    classId?: string;
  }
): Prisma.UserWhereInput {
  const base = { isActive: true, seminarId };
  switch (a.audience) {
    case 'ALL_TEACHERS':
      return { ...base, role: 'TEACHER' };
    case 'ALL_STUDENTS':
      return { ...base, role: 'STUDENT' };
    case 'GRADE':
      return { ...base, role: 'STUDENT', class: { grade: a.grade } };
    case 'CLASS':
      return { ...base, role: 'STUDENT', classId: a.classId };
  }
}

export async function createAnnouncement(
  sender: AuthUser,
  input: { audience: AnnouncementAudience; grade?: Grade; classId?: string; title: string; body: string }
) {
  if (input.classId) {
    const cls = await prisma.class.findFirst({ where: { id: input.classId, seminarId: sender.seminarId } });
    if (!cls) throw HttpError.badRequest('הכיתה שנבחרה לא קיימת', 'CLASS_NOT_FOUND');
  }
  const recipients = await prisma.user.findMany({ where: recipientsWhere(sender.seminarId, input), select: { id: true } });
  if (recipients.length === 0) {
    throw HttpError.badRequest('אין נמענות פעילות לקהל שנבחר', 'NO_RECIPIENTS');
  }

  return prisma.$transaction(async (tx) => {
    const announcement = await tx.announcement.create({
      data: {
        senderId: sender.id,
        audience: input.audience,
        grade: input.audience === 'GRADE' ? input.grade : null,
        classId: input.audience === 'CLASS' ? input.classId : null,
        title: input.title,
        body: input.body
      }
    });
    await notifyUsers(
      recipients.map((r) => r.id),
      { type: 'ANNOUNCEMENT', title: input.title, body: input.body, announcementId: announcement.id },
      tx
    );
    return { ...announcement, recipientCount: recipients.length };
  });
}

export async function listAnnouncements(user: AuthUser) {
  const select = {
    id: true,
    audience: true,
    grade: true,
    classId: true,
    title: true,
    body: true,
    createdAt: true,
    sender: { select: { id: true, fullName: true } }
  } satisfies Prisma.AnnouncementSelect;

  if (user.role === 'ADMIN') {
    const rows = await prisma.announcement.findMany({
      where: { sender: { seminarId: user.seminarId } },
      select: { ...select, _count: { select: { notifications: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return rows.map(({ _count, ...a }) => ({ ...a, recipientCount: _count.notifications }));
  }
  return prisma.announcement.findMany({
    where: { notifications: { some: { userId: user.id } } },
    select,
    orderBy: { createdAt: 'desc' }
  });
}

// ---------- שיחה בין מורה למזכירה ----------

const senderSelect = { select: { id: true, fullName: true, role: true } } as const;

function resolveThreadTeacherId(user: AuthUser, teacherId?: string) {
  if (user.role === 'TEACHER') return user.id;
  if (!teacherId) throw HttpError.badRequest('חובה לציין teacherId', 'TEACHER_ID_REQUIRED');
  return teacherId;
}

async function assertTeacherInSeminar(user: AuthUser, teacherId: string, asBadRequest = false) {
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, seminarId: user.seminarId, role: 'TEACHER' } });
  if (teacher) return;
  throw asBadRequest ? HttpError.badRequest('המורה לא נמצאה', 'TEACHER_NOT_FOUND') : HttpError.notFound('המורה לא נמצאה');
}

export async function getThread(user: AuthUser, teacherIdParam?: string) {
  const teacherId = resolveThreadTeacherId(user, teacherIdParam);
  await assertTeacherInSeminar(user, teacherId);
  const messages = await prisma.teacherMessage.findMany({
    where: { teacherId },
    include: { sender: senderSelect },
    orderBy: { createdAt: 'asc' }
  });
  // הודעות שהצד השני שלח נחשבות כנקראו כשפותחים את השיחה
  await prisma.teacherMessage.updateMany({
    where: { teacherId, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() }
  });
  return messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt,
    readAt: m.readAt,
    sender: m.sender,
    isMine: m.senderId === user.id
  }));
}

export async function sendThreadMessage(user: AuthUser, input: { teacherId?: string; body: string }) {
  const teacherId = resolveThreadTeacherId(user, input.teacherId);
  await assertTeacherInSeminar(user, teacherId, true);
  const message = await prisma.teacherMessage.create({
    data: { teacherId, senderId: user.id, body: input.body },
    include: { sender: senderSelect }
  });

  const recipients =
    user.role === 'TEACHER'
      ? (await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true, seminarId: user.seminarId }, select: { id: true } })).map((u) => u.id)
      : [teacherId];
  await notifyUsers(recipients, {
    type: 'MESSAGE',
    title: user.role === 'TEACHER' ? `הודעה חדשה מ${user.fullName}` : 'הודעה חדשה מהמזכירה',
    body: input.body.slice(0, 200)
  });

  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    readAt: message.readAt,
    sender: message.sender,
    isMine: true
  };
}

export async function listThreads(user: AuthUser) {
  const last = await prisma.teacherMessage.findMany({
    where: { teacher: { seminarId: user.seminarId } },
    distinct: ['teacherId'],
    orderBy: [{ teacherId: 'asc' }, { createdAt: 'desc' }],
    include: { teacher: { select: { id: true, fullName: true } } }
  });
  const unread = await prisma.teacherMessage.groupBy({
    by: ['teacherId'],
    where: { readAt: null, sender: { role: 'TEACHER' }, teacher: { seminarId: user.seminarId } },
    _count: { _all: true }
  });
  const unreadByTeacher = new Map(unread.map((u) => [u.teacherId, u._count._all]));
  return last
    .map((m) => ({
      teacher: m.teacher,
      lastMessage: { body: m.body, createdAt: m.createdAt, senderId: m.senderId },
      unreadCount: unreadByTeacher.get(m.teacherId) ?? 0
    }))
    .sort((a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime());
}
