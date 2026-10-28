import type { Class, Feedback, Homework, Lesson, Prisma, Subject, Submission, SubmissionFile, User } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { AuthUser } from '../types/express';
import { HttpError } from '../utils/httpError';
import { israelDateString, toDateString } from '../utils/clock';
import { notifyUsers } from './notification.service';

const fileSelect = { id: true, fileName: true, mimeType: true, sizeBytes: true } as const;

const include = {
  files: { select: fileSelect, orderBy: { createdAt: 'asc' } },
  feedback: { include: { teacher: { select: { id: true, fullName: true } } } },
  student: { select: { id: true, fullName: true, class: { select: { id: true, name: true } } } },
  homework: {
    include: { lesson: { include: { subject: true, class: true } } }
  }
} satisfies Prisma.SubmissionInclude;

type SubmissionFull = Submission & {
  files: Pick<SubmissionFile, 'id' | 'fileName' | 'mimeType' | 'sizeBytes'>[];
  feedback: (Feedback & { teacher: Pick<User, 'id' | 'fullName'> }) | null;
  student: { id: string; fullName: string; class: { id: string; name: string } | null };
  homework: Homework & { lesson: Lesson & { subject: Subject; class: Class } };
};

function toDto(s: SubmissionFull) {
  return {
    id: s.id,
    comment: s.comment,
    submittedAt: s.submittedAt,
    updatedAt: s.updatedAt,
    isLate: israelDateString(s.submittedAt) > toDateString(s.homework.dueDate),
    files: s.files,
    student: s.student,
    homework: {
      id: s.homework.id,
      title: s.homework.title,
      dueDate: toDateString(s.homework.dueDate),
      lesson: {
        id: s.homework.lesson.id,
        subject: { id: s.homework.lesson.subject.id, name: s.homework.lesson.subject.name },
        class: { id: s.homework.lesson.class.id, name: s.homework.lesson.class.name }
      }
    },
    feedback: s.feedback
      ? {
          content: s.feedback.content,
          createdAt: s.feedback.createdAt,
          updatedAt: s.feedback.updatedAt,
          teacher: s.feedback.teacher
        }
      : null
  };
}

function assertAccess(user: AuthUser, s: { studentId: string; homework: { lesson: { teacherId: string } } }) {
  const ok =
    (user.role === 'STUDENT' && s.studentId === user.id) ||
    (user.role === 'TEACHER' && s.homework.lesson.teacherId === user.id);
  if (!ok) throw HttpError.forbidden('ההגשה אינה שייכת אליך');
}

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** יוצר הגשה, או מעדכן הגשה קיימת של אותה תלמידה לאותו שיעורי בית */
export async function submit(
  user: AuthUser,
  homeworkId: string,
  files: UploadedFile[],
  comment: string | undefined
) {
  const homework = await prisma.homework.findUnique({ where: { id: homeworkId }, include: { lesson: true } });
  if (!homework) throw HttpError.notFound('שיעור הבית לא נמצא');
  if (homework.lesson.classId !== user.classId) throw HttpError.forbidden('שיעורי הבית אינם של הכיתה שלך');

  const existing = await prisma.submission.findUnique({
    where: { homeworkId_studentId: { homeworkId, studentId: user.id } }
  });
  if (files.length === 0 && !existing) {
    throw HttpError.badRequest('חובה לצרף לפחות קובץ אחד בשדה "files"', 'NO_FILES');
  }
  if (files.some((f) => f.size === 0)) {
    throw HttpError.badRequest('אי אפשר להעלות קובץ ריק', 'EMPTY_FILE');
  }

  const id = await prisma.$transaction(async (tx) => {
    const sub = existing
      ? await tx.submission.update({
          where: { id: existing.id },
          data: { ...(comment !== undefined ? { comment } : {}), ...(files.length ? { submittedAt: new Date() } : {}) }
        })
      : await tx.submission.create({ data: { homeworkId, studentId: user.id, comment: comment ?? null } });
    if (files.length > 0) {
      await tx.submissionFile.deleteMany({ where: { submissionId: sub.id } });
      await tx.submissionFile.createMany({
        data: files.map((f) => ({
          submissionId: sub.id,
          fileName: f.originalname,
          mimeType: f.mimetype,
          sizeBytes: f.size,
          data: Uint8Array.from(f.buffer)
        }))
      });
    }
    return sub.id;
  });

  const full = await prisma.submission.findUniqueOrThrow({ where: { id }, include });
  return { submission: toDto(full), created: !existing };
}

export async function listMine(user: AuthUser) {
  const rows = await prisma.submission.findMany({
    where: { studentId: user.id },
    include,
    orderBy: { submittedAt: 'desc' }
  });
  return rows.map(toDto);
}

export async function listForTeacher(
  user: AuthUser,
  q: {
    classId?: string;
    subjectId?: string;
    homeworkId?: string;
    search?: string;
    sortBy: 'submittedAt' | 'studentName';
    order: 'asc' | 'desc';
  }
) {
  const rows = await prisma.submission.findMany({
    where: {
      homework: {
        lesson: {
          teacherId: user.id,
          ...(q.classId ? { classId: q.classId } : {}),
          ...(q.subjectId ? { subjectId: q.subjectId } : {})
        }
      },
      ...(q.homeworkId ? { homeworkId: q.homeworkId } : {}),
      ...(q.search ? { student: { fullName: { contains: q.search, mode: 'insensitive' } } } : {})
    },
    include,
    orderBy: q.sortBy === 'studentName' ? { student: { fullName: q.order } } : { submittedAt: q.order }
  });
  return rows.map(toDto);
}

export async function getSubmission(user: AuthUser, id: string) {
  const s = await prisma.submission.findUnique({ where: { id }, include });
  if (!s) throw HttpError.notFound('ההגשה לא נמצאה');
  assertAccess(user, s);
  return toDto(s);
}

export async function getFile(user: AuthUser, fileId: string) {
  const file = await prisma.submissionFile.findUnique({
    where: { id: fileId },
    include: { submission: { include: { homework: { include: { lesson: true } } } } }
  });
  if (!file) throw HttpError.notFound('הקובץ לא נמצא');
  assertAccess(user, file.submission);
  return file;
}

export async function saveFeedback(user: AuthUser, submissionId: string, content: string) {
  const s = await prisma.submission.findUnique({ where: { id: submissionId }, include });
  if (!s) throw HttpError.notFound('ההגשה לא נמצאה');
  if (s.homework.lesson.teacherId !== user.id) throw HttpError.forbidden('ההגשה אינה של שיעור שלך');

  const feedback = await prisma.feedback.upsert({
    where: { submissionId },
    create: { submissionId, teacherId: user.id, content },
    update: { content, teacherId: user.id },
    include: { teacher: { select: { id: true, fullName: true } } }
  });
  await notifyUsers([s.studentId], {
    type: 'FEEDBACK_ADDED',
    title: 'קיבלת משוב על ההגשה',
    body: `${s.homework.lesson.subject.name}: ${s.homework.title}`,
    lessonId: s.homework.lessonId
  });
  return {
    content: feedback.content,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
    teacher: feedback.teacher
  };
}

export async function getFeedback(user: AuthUser, submissionId: string) {
  const s = await prisma.submission.findUnique({ where: { id: submissionId }, include });
  if (!s) throw HttpError.notFound('ההגשה לא נמצאה');
  assertAccess(user, s);
  if (!s.feedback) throw HttpError.notFound('עדיין אין משוב על ההגשה', 'FEEDBACK_NOT_FOUND');
  return toDto(s).feedback;
}
