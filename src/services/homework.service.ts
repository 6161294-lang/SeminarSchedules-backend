import type { Class, Homework, Lesson, Prisma, Subject, User } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { AuthUser } from '../types/express';
import { HttpError } from '../utils/httpError';
import { israelToday, toDateString } from '../utils/clock';
import { notifyUsers } from './notification.service';

const include = {
  lesson: { include: { subject: true, class: true } },
  createdBy: { select: { id: true, fullName: true } }
} satisfies Prisma.HomeworkInclude;

type HomeworkFull = Homework & {
  lesson: Lesson & { subject: Subject; class: Class };
  createdBy: Pick<User, 'id' | 'fullName'>;
};

function toDto(h: HomeworkFull, extra: Record<string, unknown> = {}) {
  return {
    id: h.id,
    title: h.title,
    description: h.description,
    lessonDate: toDateString(h.lessonDate),
    dueDate: toDateString(h.dueDate),
    createdAt: h.createdAt,
    createdBy: h.createdBy,
    lesson: {
      id: h.lesson.id,
      subject: { id: h.lesson.subject.id, name: h.lesson.subject.name },
      class: { id: h.lesson.class.id, name: h.lesson.class.name },
      dayOfWeek: h.lesson.dayOfWeek,
      startTime: h.lesson.startTime,
      endTime: h.lesson.endTime,
      room: h.lesson.room
    },
    ...extra
  };
}

function canView(user: AuthUser, h: HomeworkFull) {
  return user.role === 'TEACHER' ? h.lesson.teacherId === user.id : h.lesson.classId === user.classId;
}

export async function listHomeworks(user: AuthUser, q: { lessonId?: string; upcoming?: boolean }) {
  const lessonWhere: Prisma.LessonWhereInput =
    user.role === 'TEACHER' ? { teacherId: user.id } : { classId: user.classId ?? '__none__' };
  const where: Prisma.HomeworkWhereInput = {
    lesson: lessonWhere,
    ...(q.lessonId ? { lessonId: q.lessonId } : {}),
    ...(q.upcoming ? { dueDate: { gte: israelToday().date } } : {})
  };
  const rows = await prisma.homework.findMany({
    where,
    include: {
      ...include,
      submissions: {
        where: user.role === 'STUDENT' ? { studentId: user.id } : {},
        select: { id: true, submittedAt: true }
      }
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
  });
  return rows.map((h) =>
    user.role === 'STUDENT'
      ? toDto(h, { mySubmission: h.submissions[0] ?? null })
      : toDto(h, { submissionsCount: h.submissions.length })
  );
}

async function loadHomework(id: string) {
  const homework = await prisma.homework.findUnique({ where: { id }, include });
  if (!homework) throw HttpError.notFound('שיעור הבית לא נמצא');
  return homework;
}

export async function getHomework(user: AuthUser, id: string) {
  const h = await loadHomework(id);
  if (!canView(user, h)) throw HttpError.forbidden('שיעור הבית אינו שייך אליך');
  if (user.role === 'STUDENT') {
    const mine = await prisma.submission.findUnique({
      where: { homeworkId_studentId: { homeworkId: id, studentId: user.id } },
      select: { id: true, submittedAt: true }
    });
    return toDto(h, { mySubmission: mine });
  }
  return toDto(h);
}

export async function createHomework(
  user: AuthUser,
  input: { lessonId: string; title: string; description: string; dueDate: string }
) {
  const lesson = await prisma.lesson.findUnique({ where: { id: input.lessonId } });
  if (!lesson) throw HttpError.notFound('השיעור לא נמצא');
  if (lesson.teacherId !== user.id) throw HttpError.forbidden('אפשר להוסיף שיעורי בית רק לשיעורים שלך');
  if (lesson.status !== 'ACTIVE') {
    throw HttpError.badRequest('אי אפשר להוסיף שיעורי בית לשיעור מבוטל', 'LESSON_CANCELLED');
  }

  const today = israelToday();
  if (lesson.dayOfWeek !== today.dayOfWeek) {
    throw HttpError.badRequest('אפשר להוסיף שיעורי בית רק לשיעור שמתקיים היום', 'NOT_TODAYS_LESSON');
  }
  if (input.dueDate <= today.dateString) {
    throw HttpError.badRequest('תאריך ההגשה חייב להיות אחרי היום', 'INVALID_DUE_DATE');
  }

  const created = await prisma.homework.create({
    data: {
      lessonId: lesson.id,
      createdById: user.id,
      title: input.title,
      description: input.description,
      lessonDate: today.date,
      dueDate: new Date(`${input.dueDate}T00:00:00.000Z`)
    },
    include
  });

  const students = await prisma.user.findMany({
    where: { classId: lesson.classId, role: 'STUDENT', isActive: true },
    select: { id: true }
  });
  await notifyUsers(
    students.map((s) => s.id),
    {
      type: 'HOMEWORK_ADDED',
      title: 'שיעורי בית חדשים',
      body: `${created.lesson.subject.name}: ${created.title} (להגשה עד ${input.dueDate})`,
      lessonId: lesson.id
    }
  );
  return toDto(created);
}

async function ownHomework(user: AuthUser, id: string) {
  const h = await loadHomework(id);
  if (h.createdById !== user.id) throw HttpError.forbidden('אפשר לערוך רק שיעורי בית שיצרת');
  return h;
}

export async function updateHomework(
  user: AuthUser,
  id: string,
  input: { title?: string; description?: string; dueDate?: string }
) {
  const existing = await ownHomework(user, id);
  if (input.dueDate && input.dueDate <= toDateString(existing.lessonDate)) {
    throw HttpError.badRequest('תאריך ההגשה חייב להיות אחרי תאריך השיעור', 'INVALID_DUE_DATE');
  }
  const updated = await prisma.homework.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.dueDate !== undefined ? { dueDate: new Date(`${input.dueDate}T00:00:00.000Z`) } : {})
    },
    include
  });
  return toDto(updated);
}

export async function deleteHomework(user: AuthUser, id: string) {
  await ownHomework(user, id);
  await prisma.homework.delete({ where: { id } });
}
