import type { Grade, Role } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { hashPassword } from '../src/services/auth.service';

export const app = createApp();
export const api = () => request(app);
export const PASSWORD = 'Password123!';

export const bearer = (key: string) => ({ Authorization: `Bearer ${key}` });

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "teacher_messages", "notifications", "announcements", "feedbacks", "submission_files",
     "submissions", "homeworks", "notes", "sessions", "lessons", "subjects", "users", "classes", "seminars" RESTART IDENTITY CASCADE`
  );
  seminarId = (await prisma.seminar.create({ data: { name: 'סמינר בדיקות' } })).id;
}

/** הסמינר הברירת מחדל של העולם הנוכחי בבדיקות (נוצר ב-resetDb) */
export let seminarId = '';

export const mkSeminar = (name: string) => prisma.seminar.create({ data: { name } });

export async function mkClass(name: string, grade: Grade = 'HEH', semId = seminarId) {
  return prisma.class.create({ data: { name, grade, seminarId: semId } });
}

export async function mkSubject(name: string, semId = seminarId) {
  return prisma.subject.create({ data: { name, seminarId: semId } });
}

export async function mkUser(
  role: Role,
  fullName: string,
  email: string,
  classId?: string,
  isActive = true,
  semId = seminarId
) {
  return prisma.user.create({
    data: { seminarId: semId, role, fullName, email, classId: classId ?? null, isActive, passwordHash: await hashPassword(PASSWORD) }
  });
}

export async function loginKey(email: string, password = PASSWORD) {
  const res = await api().post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.sessionKey as string;
}

export interface LessonInput {
  subjectId: string;
  teacherId: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
}

export function mkLesson(input: LessonInput) {
  return prisma.lesson.create({ data: input });
}

/** עולם בדיקות קבוע: מזכירה, שתי מורות, שלוש תלמידות בשתי כיתות */
export async function buildWorld() {
  await resetDb();
  const classA = await mkClass('ה1', 'HEH');
  const classB = await mkClass('ו1', 'VAV');
  const subject = await mkSubject('מבני נתונים');
  const subject2 = await mkSubject('פיתוח Web');

  const admin = await mkUser('ADMIN', 'שרה המזכירה', 'admin@test.com');
  const t1 = await mkUser('TEACHER', 'רחל כהן', 't1@test.com');
  const t2 = await mkUser('TEACHER', 'לאה מזרחי', 't2@test.com');
  const s1 = await mkUser('STUDENT', 'מרים לוי', 's1@test.com', classA.id);
  const s2 = await mkUser('STUDENT', 'דינה אברהם', 's2@test.com', classA.id);
  const s3 = await mkUser('STUDENT', 'תמר ביטון', 's3@test.com', classB.id);

  const keys = {
    admin: await loginKey('admin@test.com'),
    t1: await loginKey('t1@test.com'),
    t2: await loginKey('t2@test.com'),
    s1: await loginKey('s1@test.com'),
    s2: await loginKey('s2@test.com'),
    s3: await loginKey('s3@test.com')
  };
  return { classA, classB, subject, subject2, admin, t1, t2, s1, s2, s3, keys };
}

export type World = Awaited<ReturnType<typeof buildWorld>>;
