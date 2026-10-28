import type { Class, Lesson, LessonStatus, Prisma, Subject, User } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { AuthUser } from '../types/express';
import { HttpError } from '../utils/httpError';
import { notifyUsers } from './notification.service';

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

const include = {
  subject: true,
  teacher: { select: { id: true, fullName: true } },
  class: true
} satisfies Prisma.LessonInclude;

type LessonFull = Lesson & { subject: Subject; teacher: Pick<User, 'id' | 'fullName'>; class: Class };

export function toLessonDto(l: LessonFull) {
  return {
    id: l.id,
    subject: { id: l.subject.id, name: l.subject.name },
    teacher: { id: l.teacher.id, fullName: l.teacher.fullName },
    class: { id: l.class.id, name: l.class.name, grade: l.class.grade },
    dayOfWeek: l.dayOfWeek,
    startTime: l.startTime,
    endTime: l.endTime,
    room: l.room,
    status: l.status,
    changeNote: l.changeNote
  };
}

/** מה כל תפקיד רשאי לראות. שיעורים מבוטלים מוסתרים ממורות ותלמידות */
export function visibilityWhere(user: AuthUser): Prisma.LessonWhereInput {
  if (user.role === 'ADMIN') return { class: { seminarId: user.seminarId } };
  if (user.role === 'TEACHER') return { teacherId: user.id, status: 'ACTIVE' };
  return { classId: user.classId ?? '__none__', status: 'ACTIVE' };
}

const order: Prisma.LessonOrderByWithRelationInput[] = [{ dayOfWeek: 'asc' }, { startTime: 'asc' }];

export async function listLessons(
  user: AuthUser,
  q: { classId?: string; teacherId?: string; dayOfWeek?: number; status?: LessonStatus }
) {
  const filters: Prisma.LessonWhereInput =
    user.role === 'ADMIN'
      ? {
          ...(q.classId ? { classId: q.classId } : {}),
          ...(q.teacherId ? { teacherId: q.teacherId } : {}),
          ...(q.status ? { status: q.status } : {})
        }
      : {};
  const where: Prisma.LessonWhereInput = {
    AND: [visibilityWhere(user), filters, q.dayOfWeek !== undefined ? { dayOfWeek: q.dayOfWeek } : {}]
  };
  const lessons = await prisma.lesson.findMany({ where, include, orderBy: order });
  return lessons.map(toLessonDto);
}

export async function weekSchedule(user: AuthUser) {
  const lessons = await listLessons(user, {});
  return {
    days: DAY_NAMES.map((name, dayOfWeek) => ({
      dayOfWeek,
      name,
      lessons: lessons.filter((l) => l.dayOfWeek === dayOfWeek)
    }))
  };
}

export async function daySchedule(user: AuthUser, dayOfWeek: number) {
  const lessons = await listLessons(user, { dayOfWeek });
  return { dayOfWeek, name: DAY_NAMES[dayOfWeek] ?? '', lessons };
}

export async function getLesson(user: AuthUser, id: string) {
  const lesson = await prisma.lesson.findFirst({ where: { AND: [{ id }, visibilityWhere(user)] }, include });
  if (!lesson) throw HttpError.notFound('השיעור לא נמצא');
  return toLessonDto(lesson);
}

interface Slot {
  id?: string;
  teacherId: string;
  classId: string;
  room: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

async function assertNoConflict(seminarId: string, slot: Slot) {
  const overlapping = await prisma.lesson.findMany({
    where: {
      status: 'ACTIVE',
      class: { seminarId },
      dayOfWeek: slot.dayOfWeek,
      startTime: { lt: slot.endTime },
      endTime: { gt: slot.startTime },
      ...(slot.id ? { id: { not: slot.id } } : {}),
      OR: [{ teacherId: slot.teacherId }, { classId: slot.classId }, { room: slot.room }]
    },
    include
  });
  if (overlapping.length === 0) return;
  const details = overlapping.map((l) => ({
    lessonId: l.id,
    reasons: [
      ...(l.teacherId === slot.teacherId ? ['המורה כבר מלמדת בשעה זו'] : []),
      ...(l.classId === slot.classId ? ['לכיתה כבר יש שיעור בשעה זו'] : []),
      ...(l.room === slot.room ? ['החדר תפוס בשעה זו'] : [])
    ]
  }));
  throw HttpError.conflict('יש התנגשות עם שיעור קיים במערכת', 'LESSON_CONFLICT', details);
}

async function assertRefs(seminarId: string, teacherId: string, classId: string, subjectId: string) {
  const [teacher, cls, subject] = await Promise.all([
    prisma.user.findFirst({ where: { id: teacherId, seminarId } }),
    prisma.class.findFirst({ where: { id: classId, seminarId } }),
    prisma.subject.findFirst({ where: { id: subjectId, seminarId } })
  ]);
  if (!teacher || teacher.role !== 'TEACHER' || !teacher.isActive) {
    throw HttpError.badRequest('המורה שנבחרה לא קיימת או לא פעילה', 'TEACHER_NOT_FOUND');
  }
  if (!cls) throw HttpError.badRequest('הכיתה שנבחרה לא קיימת', 'CLASS_NOT_FOUND');
  if (!subject) throw HttpError.badRequest('המקצוע שנבחר לא קיים', 'SUBJECT_NOT_FOUND');
}

async function studentIdsOfClass(classId: string) {
  const students = await prisma.user.findMany({
    where: { classId, role: 'STUDENT', isActive: true },
    select: { id: true }
  });
  return students.map((s) => s.id);
}

const describe = (l: Pick<LessonFull, 'dayOfWeek' | 'startTime' | 'endTime' | 'room'>) =>
  `יום ${DAY_NAMES[l.dayOfWeek]} ${l.startTime}-${l.endTime}, חדר ${l.room}`;

export async function createLesson(seminarId: string, input: {
  subjectId: string;
  teacherId: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  changeNote?: string;
}) {
  await assertRefs(seminarId, input.teacherId, input.classId, input.subjectId);
  await assertNoConflict(seminarId, input);
  const lesson = await prisma.lesson.create({ data: input, include });

  const recipients = [...(await studentIdsOfClass(lesson.classId)), lesson.teacherId];
  await notifyUsers(recipients, {
    type: 'LESSON_CHANGED',
    title: 'שיעור חדש במערכת',
    body: `נוסף שיעור ${lesson.subject.name} לכיתה ${lesson.class.name}: ${describe(lesson)}`,
    lessonId: lesson.id
  });
  return toLessonDto(lesson);
}

export async function updateLesson(
  seminarId: string,
  id: string,
  input: Partial<{
    subjectId: string;
    teacherId: string;
    classId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string;
    status: LessonStatus;
    changeNote: string | null;
  }>
) {
  const before = await prisma.lesson.findFirst({ where: { id, class: { seminarId } }, include });
  if (!before) throw HttpError.notFound('השיעור לא נמצא');

  const next = {
    subjectId: input.subjectId ?? before.subjectId,
    teacherId: input.teacherId ?? before.teacherId,
    classId: input.classId ?? before.classId,
    dayOfWeek: input.dayOfWeek ?? before.dayOfWeek,
    startTime: input.startTime ?? before.startTime,
    endTime: input.endTime ?? before.endTime,
    room: input.room ?? before.room,
    status: input.status ?? before.status
  };
  if (next.startTime >= next.endTime) {
    throw HttpError.badRequest('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 'INVALID_TIME_RANGE');
  }
  if (input.teacherId || input.classId || input.subjectId) {
    await assertRefs(seminarId, next.teacherId, next.classId, next.subjectId);
  }
  if (next.status === 'ACTIVE') await assertNoConflict(seminarId, { id, ...next });

  const slotChanged =
    next.dayOfWeek !== before.dayOfWeek ||
    next.startTime !== before.startTime ||
    next.endTime !== before.endTime ||
    next.room !== before.room;
  const statusChanged = next.status !== before.status;
  const teacherChanged = next.teacherId !== before.teacherId;
  const classChanged = next.classId !== before.classId;
  const subjectChanged = next.subjectId !== before.subjectId;

  const parts: string[] = [];
  if (statusChanged) parts.push(next.status === 'CANCELLED' ? 'השיעור בוטל' : 'השיעור חזר למערכת');
  if (slotChanged) parts.push(`הועבר מ${describe(before)} ל${describe(next)}`);
  if (teacherChanged) parts.push('המורה של השיעור הוחלפה');
  if (classChanged) parts.push('הכיתה של השיעור שונתה');
  if (subjectChanged) parts.push('המקצוע של השיעור שונה');
  const anyChange = parts.length > 0;
  const description = parts.join('. ');

  const after = await prisma.lesson.update({
    where: { id },
    data: {
      ...next,
      changeNote: input.changeNote !== undefined ? input.changeNote : anyChange ? description : before.changeNote
    },
    include
  });

  if (anyChange) {
    const recipients = [
      ...(await studentIdsOfClass(after.classId)),
      after.teacherId,
      ...(classChanged ? await studentIdsOfClass(before.classId) : []),
      ...(teacherChanged ? [before.teacherId] : [])
    ];
    await notifyUsers(recipients, {
      type: 'LESSON_CHANGED',
      title: next.status === 'CANCELLED' && statusChanged ? 'שיעור בוטל' : 'שינוי במערכת השעות',
      body: `${after.subject.name} (${after.class.name}): ${description}`,
      lessonId: after.id
    });
  }
  return toLessonDto(after);
}

export async function deleteLesson(seminarId: string, id: string) {
  const lesson = await prisma.lesson.findFirst({ where: { id, class: { seminarId } }, include });
  if (!lesson) throw HttpError.notFound('השיעור לא נמצא');
  const recipients = [...(await studentIdsOfClass(lesson.classId)), lesson.teacherId];
  await prisma.lesson.delete({ where: { id } });
  await notifyUsers(recipients, {
    type: 'LESSON_CHANGED',
    title: 'שיעור הוסר מהמערכת',
    body: `השיעור ${lesson.subject.name} (${lesson.class.name}) ב${describe(lesson)} הוסר מהמערכת`
  });
}
