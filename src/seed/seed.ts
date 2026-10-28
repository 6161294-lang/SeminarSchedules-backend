import bcrypt from 'bcryptjs';
import type { Grade } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { israelToday } from '../utils/clock';

// כל הנתונים כאן מומצאים. אין כאן אנשים אמיתיים.

const CLASSES: { name: string; grade: Grade }[] = [
  { name: 'ה1', grade: 'HEH' },
  { name: 'ה2', grade: 'HEH' },
  { name: 'ה3', grade: 'HEH' },
  { name: 'ה4', grade: 'HEH' },
  { name: 'ו1', grade: 'VAV' },
  { name: 'ו2', grade: 'VAV' },
  { name: 'ו3', grade: 'VAV' }
];

const SUBJECTS = ['יסודות התכנות', 'מבני נתונים', 'פיתוח Web', 'מסדי נתונים', 'אנגלית טכנית'];

const hash = (password: string) => bcrypt.hash(password, env.BCRYPT_COST);

const DEMO_SEMINAR_NAME = 'סמינר הדגמה';

/** סמינר ההדגמה ונתוני הבסיס שלו (כיתות ומקצועות) */
async function seedBaseData() {
  const seminar =
    (await prisma.seminar.findFirst({ where: { name: DEMO_SEMINAR_NAME } })) ??
    (await prisma.seminar.create({ data: { name: DEMO_SEMINAR_NAME } }));
  const seminarId = seminar.id;
  for (const c of CLASSES) {
    await prisma.class.upsert({
      where: { seminarId_name: { seminarId, name: c.name } },
      update: {},
      create: { ...c, seminarId }
    });
  }
  for (const name of SUBJECTS) {
    await prisma.subject.upsert({
      where: { seminarId_name: { seminarId, name } },
      update: {},
      create: { name, seminarId }
    });
  }
  return seminarId;
}

/** בפרודקשן: מזכירה נוצרת רק אם הוגדרו אימייל וסיסמה במשתני סביבה */
async function seedAdminFromEnv(seminarId: string) {
  const email = env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('Seed: לא הוגדרו SEED_ADMIN_EMAIL ו-SEED_ADMIN_PASSWORD, לא נוצרה מזכירה.');
    return;
  }
  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD חייבת להכיל לפחות 8 תווים');
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed: המזכירה ${email} כבר קיימת, לא שונתה.`);
    return;
  }
  await prisma.user.create({
    data: { seminarId, fullName: 'מזכירת הסמינר', email, role: 'ADMIN', passwordHash: await hash(password) }
  });
  console.log(`Seed: נוצרה מזכירה ${email}`);
}

function lastDateOfDay(dayOfWeek: number) {
  const today = israelToday();
  const diff = (today.dayOfWeek - dayOfWeek + 7) % 7;
  return new Date(today.date.getTime() - diff * 86_400_000);
}

async function seedDemoData(seminarId: string, password: string) {
  const passwordHash = await hash(password);
  const classByName = Object.fromEntries((await prisma.class.findMany({ where: { seminarId } })).map((c) => [c.name, c]));
  const subjectByName = Object.fromEntries((await prisma.subject.findMany({ where: { seminarId } })).map((s) => [s.name, s]));
  const cls = (name: string) => classByName[name]!.id;
  const subj = (name: string) => subjectByName[name]!.id;

  const person = (fullName: string, email: string, role: 'ADMIN' | 'TEACHER' | 'STUDENT', classId?: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: { seminarId, fullName, email, role, passwordHash, classId: classId ?? null }
    });

  const secretary = await person('שרה המזכירה', 'secretary@example.com', 'ADMIN');
  const rachel = await person('רחל כהן', 'rachel.teacher@example.com', 'TEACHER');
  const leah = await person('לאה מזרחי', 'leah.teacher@example.com', 'TEACHER');
  const miriam = await person('מרים לוי', 'miriam.student@example.com', 'STUDENT', cls('ה1'));
  const dina = await person('דינה אברהם', 'dina.student@example.com', 'STUDENT', cls('ה1'));
  await person('חנה פרידמן', 'hana.student@example.com', 'STUDENT', cls('ה1'));
  await person('יעל שמעוני', 'yael.student@example.com', 'STUDENT', cls('ה2'));
  await person('תמר ביטון', 'tamar.student@example.com', 'STUDENT', cls('ו1'));

  if ((await prisma.lesson.count({ where: { class: { seminarId } } })) > 0) {
    console.log('Seed: כבר קיימים שיעורים, מדלג על יצירת מערכת הדגמה.');
    return;
  }

  const lesson = (
    subject: string,
    teacherId: string,
    className: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    room: string,
    status: 'ACTIVE' | 'CANCELLED' = 'ACTIVE'
  ) =>
    prisma.lesson.create({
      data: {
        subjectId: subj(subject),
        teacherId,
        classId: cls(className),
        dayOfWeek,
        startTime,
        endTime,
        room,
        status,
        changeNote: status === 'CANCELLED' ? 'השיעור בוטל' : null
      }
    });

  const l1 = await lesson('יסודות התכנות', rachel.id, 'ה1', 0, '09:00', '10:30', '101');
  await lesson('אנגלית טכנית', leah.id, 'ה1', 0, '10:45', '12:15', '101');
  await lesson('מבני נתונים', rachel.id, 'ה1', 1, '09:00', '10:30', '101');
  await lesson('יסודות התכנות', leah.id, 'ה2', 0, '09:00', '10:30', '102');
  await lesson('פיתוח Web', rachel.id, 'ו1', 0, '11:00', '12:30', '201');
  await lesson('מסדי נתונים', leah.id, 'ו1', 1, '09:00', '10:30', '201');
  await lesson('פיתוח Web', rachel.id, 'ה1', 2, '09:00', '10:30', '101');
  await lesson('מבני נתונים', rachel.id, 'ה1', 3, '09:00', '10:30', '101', 'CANCELLED');

  const lessonDate = lastDateOfDay(l1.dayOfWeek);
  const homework = await prisma.homework.create({
    data: {
      lessonId: l1.id,
      createdById: rachel.id,
      title: 'תרגיל 1 - משתנים ולולאות',
      description: 'פתרי את שאלות 1 עד 5 בעמוד 12 והעלי את קבצי הקוד.',
      lessonDate,
      dueDate: new Date(lessonDate.getTime() + 7 * 86_400_000)
    }
  });

  const submission = await prisma.submission.create({
    data: {
      homeworkId: homework.id,
      studentId: miriam.id,
      comment: 'לא הצלחתי את שאלה 5',
      files: {
        create: [
          {
            fileName: 'exercise1.txt',
            mimeType: 'text/plain',
            sizeBytes: 21,
            data: Buffer.from('console.log("hello")\n')
          }
        ]
      }
    }
  });
  await prisma.feedback.create({
    data: { submissionId: submission.id, teacherId: rachel.id, content: 'עבודה טובה! נסי לחשוב שוב על שאלה 5.' }
  });

  await prisma.note.createMany({
    data: [
      { authorId: miriam.id, lessonId: l1.id, content: 'לחזור על לולאות for לפני המבחן' },
      { authorId: dina.id, lessonId: l1.id, content: 'לשאול את המורה על שאלה 3' },
      { authorId: rachel.id, lessonId: l1.id, content: 'להקדיש זמן נוסף ללולאות מקוננות' }
    ]
  });

  const announcement = await prisma.announcement.create({
    data: {
      senderId: secretary.id,
      audience: 'ALL_STUDENTS',
      title: 'ברוכות הבאות',
      body: 'המערכת החדשה מעדכנת אתכן אוטומטית בכל שינוי במערכת השעות.'
    }
  });
  const students = await prisma.user.findMany({ where: { role: 'STUDENT', seminarId }, select: { id: true } });
  await prisma.notification.createMany({
    data: students.map((s) => ({
      userId: s.id,
      type: 'ANNOUNCEMENT' as const,
      title: announcement.title,
      body: announcement.body,
      announcementId: announcement.id
    }))
  });

  await prisma.teacherMessage.create({
    data: { teacherId: rachel.id, senderId: rachel.id, body: 'שלום, אפשר להחליף חדר ביום ראשון?' }
  });
  console.log('Seed: נוצרו נתוני הדגמה.');
}

export async function runSeed() {
  const seminarId = await seedBaseData();

  const wantsDemo = env.isProduction ? env.SEED_DEMO_DATA === 'true' : env.SEED_DEMO_DATA !== 'false';
  if (!wantsDemo) {
    await seedAdminFromEnv(seminarId);
    return;
  }

  // בפרודקשן אסור סיסמה קבועה וידועה, ולכן חובה להגדיר SEED_DEMO_PASSWORD
  const password = env.SEED_DEMO_PASSWORD || (env.isProduction ? undefined : 'Password123!');
  if (!password || password.length < 8) {
    throw new Error('בפרודקשן עם SEED_DEMO_DATA=true חובה להגדיר SEED_DEMO_PASSWORD (לפחות 8 תווים)');
  }
  await seedDemoData(seminarId, password);
  await seedAdminFromEnv(seminarId);
}
