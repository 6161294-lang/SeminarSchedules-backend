import type { Class, Lesson, Note, Prisma, Subject } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { AuthUser } from '../types/express';
import { HttpError } from '../utils/httpError';

type NoteFull = Note & { lesson: Lesson & { subject: Subject; class: Class } };

const include = { lesson: { include: { subject: true, class: true } } } satisfies Prisma.NoteInclude;

function toDto(n: NoteFull) {
  return {
    id: n.id,
    content: n.content,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    // התווית של השיעור שבו ההערה נכתבה
    lesson: {
      id: n.lesson.id,
      subject: n.lesson.subject.name,
      class: n.lesson.class.name,
      dayOfWeek: n.lesson.dayOfWeek,
      startTime: n.lesson.startTime
    }
  };
}

/** ההערות של המשתמשת המחוברת בלבד */
export async function listMine(user: AuthUser, q: { lessonId?: string; search?: string }) {
  const notes = await prisma.note.findMany({
    where: {
      authorId: user.id,
      ...(q.lessonId ? { lessonId: q.lessonId } : {}),
      ...(q.search ? { content: { contains: q.search, mode: 'insensitive' } } : {})
    },
    include,
    orderBy: { createdAt: 'desc' }
  });
  return notes.map(toDto);
}

export async function createNote(user: AuthUser, input: { lessonId: string; content: string }) {
  const lesson = await prisma.lesson.findUnique({ where: { id: input.lessonId } });
  if (!lesson) throw HttpError.notFound('השיעור לא נמצא');
  const own = user.role === 'TEACHER' ? lesson.teacherId === user.id : lesson.classId === user.classId;
  if (!own) throw HttpError.forbidden('אפשר להוסיף הערות רק לשיעורים שלך');
  const note = await prisma.note.create({
    data: { authorId: user.id, lessonId: lesson.id, content: input.content },
    include
  });
  return toDto(note);
}

async function ownNote(user: AuthUser, id: string) {
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) throw HttpError.notFound('ההערה לא נמצאה');
  if (note.authorId !== user.id) throw HttpError.forbidden('ההערה שייכת למשתמשת אחרת');
  return note;
}

export async function updateNote(user: AuthUser, id: string, content: string) {
  await ownNote(user, id);
  return toDto(await prisma.note.update({ where: { id }, data: { content }, include }));
}

export async function deleteNote(user: AuthUser, id: string) {
  await ownNote(user, id);
  await prisma.note.delete({ where: { id } });
}
