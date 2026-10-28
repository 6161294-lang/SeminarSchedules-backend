import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma';
import { api, bearer, buildWorld, mkLesson, mkUser, type World } from './helpers';

let w: World;
beforeEach(async () => {
  w = await buildWorld();
});

const lessonBody = (over: Record<string, unknown> = {}) => ({
  subjectId: w.subject.id,
  teacherId: w.t1.id,
  classId: w.classA.id,
  dayOfWeek: 0,
  startTime: '09:00',
  endTime: '10:30',
  room: '12',
  ...over
});

const create = (body: Record<string, unknown>, key = w.keys.admin) =>
  api().post('/api/lessons').set(bearer(key)).send(body);

describe('יצירת שיעור', () => {
  it('המזכירה יוצרת שיעור ונשלחות התראות לכיתה ולמורה בלבד', async () => {
    const res = await create(lessonBody());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      dayOfWeek: 0,
      room: '12',
      status: 'ACTIVE',
      subject: { name: 'מבני נתונים' },
      teacher: { fullName: 'רחל כהן' },
      class: { name: 'ה1' }
    });

    const notified = await prisma.notification.findMany({ where: { type: 'LESSON_CHANGED' } });
    expect(notified.map((n) => n.userId).sort()).toEqual([w.t1.id, w.s1.id, w.s2.id].sort());
    expect(notified.some((n) => n.userId === w.s3.id)).toBe(false);
  });

  it('ולידציה: סיום לפני התחלה, יום לא תקין, שעה לא תקינה, שדות חסרים', async () => {
    expect((await create(lessonBody({ startTime: '11:00', endTime: '10:00' }))).status).toBe(400);
    expect((await create(lessonBody({ dayOfWeek: 6 }))).status).toBe(400);
    expect((await create(lessonBody({ startTime: '9:00' }))).status).toBe(400);
    const missing = await create({ subjectId: w.subject.id });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    expect(missing.body.error.details.length).toBeGreaterThan(0);
  });

  it('מורה שאינה מורה (או לא קיימת) נדחית', async () => {
    expect((await create(lessonBody({ teacherId: w.s1.id }))).status).toBe(400);
    expect((await create(lessonBody({ classId: '3f1c2b64-8a53-4d1b-9a47-0c2f6e8d1a11' }))).status).toBe(400);
  });

  it('מזהה לא תקין ב-URL מחזיר 400', async () => {
    const res = await api().get('/api/lessons/abc').set(bearer(w.keys.admin));
    expect(res.status).toBe(400);
  });
});

describe('התנגשויות', () => {
  beforeEach(async () => {
    await create(lessonBody());
  });

  it('אותה מורה בשעה חופפת מחזירה 409', async () => {
    const res = await create(lessonBody({ classId: w.classB.id, room: '99', startTime: '10:00', endTime: '11:00' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LESSON_CONFLICT');
    expect(res.body.error.details[0].reasons).toContain('המורה כבר מלמדת בשעה זו');
  });

  it('אותה כיתה בשעה חופפת מחזירה 409', async () => {
    const res = await create(lessonBody({ teacherId: w.t2.id, room: '99', startTime: '10:00', endTime: '11:00' }));
    expect(res.status).toBe(409);
    expect(res.body.error.details[0].reasons).toContain('לכיתה כבר יש שיעור בשעה זו');
  });

  it('אותו חדר בשעה חופפת מחזיר 409', async () => {
    const res = await create(lessonBody({ teacherId: w.t2.id, classId: w.classB.id, startTime: '09:30', endTime: '10:00' }));
    expect(res.status).toBe(409);
    expect(res.body.error.details[0].reasons).toContain('החדר תפוס בשעה זו');
  });

  it('שיעור רצוף (הסיום שווה להתחלה) או ביום אחר מותר', async () => {
    expect((await create(lessonBody({ startTime: '10:30', endTime: '12:00' }))).status).toBe(201);
    expect((await create(lessonBody({ dayOfWeek: 1 }))).status).toBe(201);
  });

  it('שיעור מבוטל לא יוצר התנגשות', async () => {
    const [first] = await prisma.lesson.findMany();
    await api().patch(`/api/lessons/${first!.id}`).set(bearer(w.keys.admin)).send({ status: 'CANCELLED' });
    expect((await create(lessonBody())).status).toBe(201);
  });
});

describe('צפייה בלוח הזמנים לפי תפקיד', () => {
  beforeEach(async () => {
    await mkLesson({ subjectId: w.subject.id, teacherId: w.t1.id, classId: w.classA.id, dayOfWeek: 0, startTime: '09:00', endTime: '10:30', room: '12' });
    await mkLesson({ subjectId: w.subject2.id, teacherId: w.t2.id, classId: w.classB.id, dayOfWeek: 0, startTime: '09:00', endTime: '10:30', room: '13' });
    await mkLesson({ subjectId: w.subject.id, teacherId: w.t1.id, classId: w.classA.id, dayOfWeek: 2, startTime: '11:00', endTime: '12:00', room: '12' });
  });

  it('המזכירה רואה הכול ויכולה לסנן', async () => {
    const all = await api().get('/api/lessons').set(bearer(w.keys.admin));
    expect(all.body).toHaveLength(3);
    const byClass = await api().get(`/api/lessons?classId=${w.classB.id}`).set(bearer(w.keys.admin));
    expect(byClass.body).toHaveLength(1);
    const byTeacher = await api().get(`/api/lessons?teacherId=${w.t1.id}&dayOfWeek=2`).set(bearer(w.keys.admin));
    expect(byTeacher.body).toHaveLength(1);
  });

  it('תלמידה רואה רק שיעורי הכיתה שלה', async () => {
    const res = await api().get('/api/lessons').set(bearer(w.keys.s1));
    expect(res.body).toHaveLength(2);
    expect(res.body.every((l: { class: { name: string } }) => l.class.name === 'ה1')).toBe(true);
    const other = await api().get('/api/lessons').set(bearer(w.keys.s3));
    expect(other.body).toHaveLength(1);
  });

  it('תלמידה לא יכולה לסנן כדי לראות כיתה אחרת', async () => {
    const res = await api().get(`/api/lessons?classId=${w.classB.id}`).set(bearer(w.keys.s1));
    expect(res.body.every((l: { class: { name: string } }) => l.class.name === 'ה1')).toBe(true);
  });

  it('מורה רואה רק את השיעורים שלה', async () => {
    const res = await api().get('/api/lessons').set(bearer(w.keys.t2));
    expect(res.body).toHaveLength(1);
    expect(res.body[0].teacher.fullName).toBe('לאה מזרחי');
  });

  it('מערכת שבועית מקובצת לפי ימים', async () => {
    const res = await api().get('/api/lessons/week').set(bearer(w.keys.s1));
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(6);
    expect(res.body.days[0].lessons).toHaveLength(1);
    expect(res.body.days[2].lessons).toHaveLength(1);
    expect(res.body.days[1].lessons).toHaveLength(0);
  });

  it('מערכת יומית לתלמידה כוללת שם שיעור וחדר', async () => {
    const res = await api().get('/api/lessons/day/0').set(bearer(w.keys.s1));
    expect(res.status).toBe(200);
    expect(res.body.lessons).toHaveLength(1);
    expect(res.body.lessons[0]).toMatchObject({ subject: { name: 'מבני נתונים' }, room: '12' });
  });

  it('מערכת יומית למורה כוללת מקצוע, כיתה וחדר', async () => {
    const res = await api().get('/api/lessons/day/2').set(bearer(w.keys.t1));
    expect(res.status).toBe(200);
    expect(res.body.lessons[0]).toMatchObject({ class: { name: 'ה1' }, room: '12', startTime: '11:00' });
    expect((await api().get('/api/lessons/day/2').set(bearer(w.keys.t2))).body.lessons).toHaveLength(0);
  });

  it('יום לא תקין מחזיר 400', async () => {
    expect((await api().get('/api/lessons/day/9').set(bearer(w.keys.s1))).status).toBe(400);
  });

  it('תלמידה לא יכולה לפתוח שיעור של כיתה אחרת', async () => {
    const other = await prisma.lesson.findFirstOrThrow({ where: { classId: w.classB.id } });
    expect((await api().get(`/api/lessons/${other.id}`).set(bearer(w.keys.s1))).status).toBe(404);
    expect((await api().get(`/api/lessons/${other.id}`).set(bearer(w.keys.s3))).status).toBe(200);
  });
});

describe('ביטול, העברה ומחיקה', () => {
  let lessonId: string;
  beforeEach(async () => {
    const res = await create(lessonBody());
    lessonId = res.body.id;
    await prisma.notification.deleteMany();
  });

  const patch = (body: Record<string, unknown>) =>
    api().patch(`/api/lessons/${lessonId}`).set(bearer(w.keys.admin)).send(body);

  it('שיעור מבוטל נעלם מהמערכת של תלמידות ומורה אבל נשאר אצל המזכירה', async () => {
    const res = await patch({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');

    for (const key of [w.keys.s1, w.keys.t1]) {
      expect((await api().get('/api/lessons').set(bearer(key))).body).toHaveLength(0);
      expect((await api().get('/api/lessons/day/0').set(bearer(key))).body.lessons).toHaveLength(0);
      expect((await api().get('/api/lessons/week').set(bearer(key))).body.days[0].lessons).toHaveLength(0);
      expect((await api().get(`/api/lessons/${lessonId}`).set(bearer(key))).status).toBe(404);
    }
    const adminList = await api().get('/api/lessons?status=CANCELLED').set(bearer(w.keys.admin));
    expect(adminList.body).toHaveLength(1);

    const notes = await prisma.notification.findMany();
    expect(notes).toHaveLength(3);
    expect(notes[0]!.title).toBe('שיעור בוטל');
  });

  it('החזרת שיעור מבוטל מחזירה אותו למערכת', async () => {
    await patch({ status: 'CANCELLED' });
    await patch({ status: 'ACTIVE' });
    expect((await api().get('/api/lessons/day/0').set(bearer(w.keys.s1))).body.lessons).toHaveLength(1);
  });

  it('שיעור שהועבר מופיע רק ביום החדש', async () => {
    const res = await patch({ dayOfWeek: 3, startTime: '11:00', endTime: '12:30', room: '14' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dayOfWeek: 3, room: '14' });
    expect(res.body.changeNote).toContain('הועבר');

    expect((await api().get('/api/lessons/day/0').set(bearer(w.keys.s1))).body.lessons).toHaveLength(0);
    const newDay = await api().get('/api/lessons/day/3').set(bearer(w.keys.s1));
    expect(newDay.body.lessons).toHaveLength(1);
    expect(newDay.body.lessons[0].room).toBe('14');
    expect((await api().get('/api/lessons/day/3').set(bearer(w.keys.t1))).body.lessons).toHaveLength(1);

    const notes = await prisma.notification.findMany({ where: { userId: w.s1.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]!.body).toContain('הועבר');
  });

  it('העברה להתנגשות נדחית ב-409', async () => {
    await create(lessonBody({ dayOfWeek: 1, teacherId: w.t2.id, classId: w.classB.id, room: '99' }));
    const res = await patch({ dayOfWeek: 1, teacherId: w.t2.id });
    expect(res.status).toBe(409);
  });

  it('עדכון ללא שינוי בפועל לא שולח התראות', async () => {
    await patch({ room: '12' });
    expect(await prisma.notification.count()).toBe(0);
  });

  it('החלפת מורה מודיעה גם למורה הקודמת', async () => {
    await patch({ teacherId: w.t2.id });
    const recipients = (await prisma.notification.findMany()).map((n) => n.userId);
    expect(recipients).toContain(w.t1.id);
    expect(recipients).toContain(w.t2.id);
  });

  it('עדכון ריק או נתונים שגויים מחזירים 400', async () => {
    expect((await patch({})).status).toBe(400);
    expect((await patch({ startTime: '12:00', endTime: '11:00' })).status).toBe(400);
    expect((await patch({ endTime: '08:00' })).status).toBe(400);
  });

  it('מחיקה מחזירה 204 ואז 404 ושולחת התראות', async () => {
    const del = await api().delete(`/api/lessons/${lessonId}`).set(bearer(w.keys.admin));
    expect(del.status).toBe(204);
    expect((await api().get(`/api/lessons/${lessonId}`).set(bearer(w.keys.admin))).status).toBe(404);
    expect(await prisma.notification.count()).toBe(3);
  });

  it('מורה ותלמידה לא יכולות לעדכן או למחוק', async () => {
    expect((await api().patch(`/api/lessons/${lessonId}`).set(bearer(w.keys.t1)).send({ room: '1' })).status).toBe(403);
    expect((await api().delete(`/api/lessons/${lessonId}`).set(bearer(w.keys.s1))).status).toBe(403);
  });

  it('תלמידה שהושבתה לא מקבלת התראות', async () => {
    await mkUser('STUDENT', 'לא פעילה', 'inactive@test.com', w.classA.id, false);
    await patch({ room: '20' });
    const inactive = await prisma.user.findUniqueOrThrow({ where: { email: 'inactive@test.com' } });
    expect(await prisma.notification.count({ where: { userId: inactive.id } })).toBe(0);
  });
});
