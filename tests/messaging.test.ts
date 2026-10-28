import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma';
import { api, bearer, buildWorld, mkClass, mkLesson, type World } from './helpers';

let w: World;
let lessonA: string;
let lessonB: string;

beforeEach(async () => {
  w = await buildWorld();
  const base = { subjectId: w.subject.id, startTime: '09:00', endTime: '10:30', room: '12', dayOfWeek: 0 };
  lessonA = (await mkLesson({ ...base, teacherId: w.t1.id, classId: w.classA.id })).id;
  lessonB = (await mkLesson({ ...base, teacherId: w.t2.id, classId: w.classB.id, room: '13' })).id;
});

describe('הערות אישיות (מחברת)', () => {
  const addNote = (key: string, lessonId: string, content = 'הערה') =>
    api().post('/api/notes').set(bearer(key)).send({ lessonId, content });

  it('תלמידה כותבת הערה עם תווית השיעור', async () => {
    const res = await addNote(w.keys.s1, lessonA, 'לחזור על רקורסיה');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ content: 'לחזור על רקורסיה', lesson: { subject: 'מבני נתונים', class: 'ה1' } });
  });

  it('כל אחת רואה רק את ההערות שלה (גם תלמידה אחרת באותה כיתה, גם המורה)', async () => {
    await addNote(w.keys.s1, lessonA, 'של מרים');
    await addNote(w.keys.s2, lessonA, 'של דינה');
    await addNote(w.keys.t1, lessonA, 'של המורה');

    const s1 = (await api().get('/api/notes').set(bearer(w.keys.s1))).body;
    expect(s1.map((n: { content: string }) => n.content)).toEqual(['של מרים']);
    const s2 = (await api().get('/api/notes').set(bearer(w.keys.s2))).body;
    expect(s2.map((n: { content: string }) => n.content)).toEqual(['של דינה']);
    const t1 = (await api().get('/api/notes').set(bearer(w.keys.t1))).body;
    expect(t1.map((n: { content: string }) => n.content)).toEqual(['של המורה']);
    expect((await api().get('/api/notes').set(bearer(w.keys.t2))).body).toEqual([]);
  });

  it('סינון לפי שיעור וחיפוש בתוכן', async () => {
    await addNote(w.keys.s1, lessonA, 'עצים בינאריים');
    await addNote(w.keys.s1, lessonA, 'מיון בועות');
    expect((await api().get(`/api/notes?lessonId=${lessonA}`).set(bearer(w.keys.s1))).body).toHaveLength(2);
    expect((await api().get('/api/notes?search=עצים').set(bearer(w.keys.s1))).body).toHaveLength(1);
    expect((await api().get(`/api/notes?lessonId=${lessonB}`).set(bearer(w.keys.s1))).body).toHaveLength(0);
  });

  it('אי אפשר לכתוב הערה לשיעור שאינו שלך', async () => {
    expect((await addNote(w.keys.s1, lessonB)).status).toBe(403);
    expect((await addNote(w.keys.t1, lessonB)).status).toBe(403);
    expect((await addNote(w.keys.s1, '3f1c2b64-8a53-4d1b-9a47-0c2f6e8d1a11')).status).toBe(404);
    expect((await addNote(w.keys.s1, lessonA, '')).status).toBe(400);
  });

  it('עריכה ומחיקה רק על ידי הכותבת', async () => {
    const id = (await addNote(w.keys.s1, lessonA)).body.id;
    expect((await api().patch(`/api/notes/${id}`).set(bearer(w.keys.s2)).send({ content: 'x' })).status).toBe(403);
    expect((await api().delete(`/api/notes/${id}`).set(bearer(w.keys.t1))).status).toBe(403);
    const edit = await api().patch(`/api/notes/${id}`).set(bearer(w.keys.s1)).send({ content: 'עודכן' });
    expect(edit.body.content).toBe('עודכן');
    expect((await api().delete(`/api/notes/${id}`).set(bearer(w.keys.s1))).status).toBe(204);
    expect(await prisma.note.count()).toBe(0);
  });
});

describe('התראות', () => {
  beforeEach(async () => {
    await prisma.notification.createMany({
      data: [
        { userId: w.s1.id, type: 'LESSON_CHANGED', title: 'א', body: 'א' },
        { userId: w.s1.id, type: 'LESSON_CHANGED', title: 'ב', body: 'ב' },
        { userId: w.s2.id, type: 'LESSON_CHANGED', title: 'ג', body: 'ג' }
      ]
    });
  });

  it('רואה רק התראות שלי עם מונה שלא נקראו', async () => {
    const res = await api().get('/api/notifications').set(bearer(w.keys.s1));
    expect(res.body.items).toHaveLength(2);
    expect(res.body.unreadCount).toBe(2);
  });

  it('סימון כנקראה, ואי אפשר לסמן התראה של אחרת', async () => {
    const mine = (await api().get('/api/notifications').set(bearer(w.keys.s1))).body.items[0];
    const other = await prisma.notification.findFirstOrThrow({ where: { userId: w.s2.id } });
    expect((await api().patch(`/api/notifications/${other.id}/read`).set(bearer(w.keys.s1))).status).toBe(404);
    const ok = await api().patch(`/api/notifications/${mine.id}/read`).set(bearer(w.keys.s1));
    expect(ok.body.isRead).toBe(true);
    const unread = await api().get('/api/notifications?unreadOnly=true').set(bearer(w.keys.s1));
    expect(unread.body.items).toHaveLength(1);
    expect(unread.body.unreadCount).toBe(1);
  });

  it('סימון הכול כנקרא לא נוגע בהתראות של אחרות', async () => {
    const res = await api().post('/api/notifications/read-all').set(bearer(w.keys.s1));
    expect(res.body.updated).toBe(2);
    expect((await prisma.notification.findFirstOrThrow({ where: { userId: w.s2.id } })).isRead).toBe(false);
  });
});

describe('הודעות מהמזכירה', () => {
  const send = (body: Record<string, unknown>) =>
    api().post('/api/announcements').set(bearer(w.keys.admin)).send({ title: 'כותרת', body: 'תוכן', ...body });

  it('לכל התלמידות', async () => {
    const res = await send({ audience: 'ALL_STUDENTS' });
    expect(res.status).toBe(201);
    expect(res.body.recipientCount).toBe(3);
    expect(await prisma.notification.count({ where: { type: 'ANNOUNCEMENT' } })).toBe(3);
  });

  it('לכל המורות', async () => {
    const res = await send({ audience: 'ALL_TEACHERS' });
    expect(res.body.recipientCount).toBe(2);
    expect(await prisma.notification.count({ where: { userId: w.t1.id, type: 'ANNOUNCEMENT' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: w.s1.id } })).toBe(0);
  });

  it('למחזור ולכיתה', async () => {
    expect((await send({ audience: 'GRADE', grade: 'HEH' })).body.recipientCount).toBe(2);
    expect((await send({ audience: 'GRADE', grade: 'VAV' })).body.recipientCount).toBe(1);
    expect((await send({ audience: 'CLASS', classId: w.classB.id })).body.recipientCount).toBe(1);
    expect(await prisma.notification.count({ where: { userId: w.s3.id } })).toBe(2);
  });

  it('ולידציה וכיתה בלי נמענות', async () => {
    expect((await send({ audience: 'GRADE' })).status).toBe(400);
    expect((await send({ audience: 'CLASS' })).status).toBe(400);
    expect((await send({ audience: 'WHATEVER' })).status).toBe(400);
    expect((await send({ audience: 'ALL_STUDENTS', title: '' })).status).toBe(400);
    const empty = await mkClass('ריקה', 'HEH');
    const res = await send({ audience: 'CLASS', classId: empty.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_RECIPIENTS');
  });

  it('תלמידה רואה רק הודעות שקיבלה, מזכירה רואה את ששלחה', async () => {
    await send({ audience: 'CLASS', classId: w.classB.id, title: 'לכיתה ו1' });
    await send({ audience: 'ALL_STUDENTS', title: 'לכולן' });
    const s1 = (await api().get('/api/announcements').set(bearer(w.keys.s1))).body;
    expect(s1.map((a: { title: string }) => a.title)).toEqual(['לכולן']);
    const s3 = (await api().get('/api/announcements').set(bearer(w.keys.s3))).body;
    expect(s3).toHaveLength(2);
    const admin = (await api().get('/api/announcements').set(bearer(w.keys.admin))).body;
    expect(admin).toHaveLength(2);
    expect(admin[0].recipientCount).toBeGreaterThan(0);
    expect((await api().get('/api/announcements').set(bearer(w.keys.t1))).body).toEqual([]);
  });
});

describe('שיחה בין מורה למזכירה', () => {
  const teacherSend = (key: string, body: string) => api().post('/api/teacher-messages').set(bearer(key)).send({ body });

  it('מורה שולחת, המזכירה מקבלת התראה ורואה שיחה עם מונה', async () => {
    const sent = await teacherSend(w.keys.t1, 'אפשר להחליף חדר?');
    expect(sent.status).toBe(201);
    expect(await prisma.notification.count({ where: { userId: w.admin.id, type: 'MESSAGE' } })).toBe(1);

    const threads = await api().get('/api/teacher-messages/threads').set(bearer(w.keys.admin));
    expect(threads.body).toHaveLength(1);
    expect(threads.body[0]).toMatchObject({ teacher: { fullName: 'רחל כהן' }, unreadCount: 1 });

    const thread = await api().get(`/api/teacher-messages?teacherId=${w.t1.id}`).set(bearer(w.keys.admin));
    expect(thread.body).toHaveLength(1);
    expect(thread.body[0].isMine).toBe(false);
    const after = await api().get('/api/teacher-messages/threads').set(bearer(w.keys.admin));
    expect(after.body[0].unreadCount).toBe(0);
  });

  it('המזכירה משיבה והמורה רואה את השיחה כולה', async () => {
    await teacherSend(w.keys.t1, 'שלום');
    const reply = await api().post('/api/teacher-messages').set(bearer(w.keys.admin)).send({ teacherId: w.t1.id, body: 'בוודאי' });
    expect(reply.status).toBe(201);
    expect(await prisma.notification.count({ where: { userId: w.t1.id, type: 'MESSAGE' } })).toBe(1);

    const thread = await api().get('/api/teacher-messages').set(bearer(w.keys.t1));
    expect(thread.body.map((m: { body: string }) => m.body)).toEqual(['שלום', 'בוודאי']);
    expect(thread.body.map((m: { isMine: boolean }) => m.isMine)).toEqual([true, false]);
  });

  it('מורה אחרת לא רואה את השיחה, והמזכירה חייבת לציין מורה', async () => {
    await teacherSend(w.keys.t1, 'סודי');
    expect((await api().get('/api/teacher-messages').set(bearer(w.keys.t2))).body).toEqual([]);
    const spoof = await api().get(`/api/teacher-messages?teacherId=${w.t1.id}`).set(bearer(w.keys.t2));
    expect(spoof.body).toEqual([]); // teacherId של מורה נתעלם, נקבע לפי ה-Token
    expect((await api().get('/api/teacher-messages').set(bearer(w.keys.admin))).status).toBe(400);
    const bad = await api().post('/api/teacher-messages').set(bearer(w.keys.admin)).send({ body: 'x' });
    expect(bad.status).toBe(400);
    const notTeacher = await api().post('/api/teacher-messages').set(bearer(w.keys.admin)).send({ teacherId: w.s1.id, body: 'x' });
    expect(notTeacher.status).toBe(400);
    expect((await teacherSend(w.keys.t1, '')).status).toBe(400);
  });
});

describe('ניהול משתמשים', () => {
  const create = (body: Record<string, unknown>) => api().post('/api/users').set(bearer(w.keys.admin)).send(body);

  it('המזכירה יוצרת תלמידה, והסיסמה לא חוזרת', async () => {
    const res = await create({ fullName: 'חדשה', email: 'New@Test.com', password: 'Password123!', role: 'STUDENT', classId: w.classA.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'new@test.com', role: 'STUDENT', class: { name: 'ה1' } });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    const login = await api().post('/api/auth/login').send({ email: 'new@test.com', password: 'Password123!' });
    expect(login.status).toBe(200);
  });

  it('ולידציה: תלמידה בלי כיתה, מורה עם כיתה, סיסמה קצרה, כפילות, כיתה לא קיימת', async () => {
    const base = { fullName: 'א', email: 'x@test.com', password: 'Password123!' };
    expect((await create({ ...base, role: 'STUDENT' })).status).toBe(400);
    expect((await create({ ...base, role: 'TEACHER', classId: w.classA.id })).status).toBe(400);
    expect((await create({ ...base, role: 'TEACHER', password: '123' })).status).toBe(400);
    expect((await create({ ...base, role: 'TEACHER', email: 't1@test.com' })).status).toBe(409);
    expect((await create({ ...base, role: 'STUDENT', classId: '3f1c2b64-8a53-4d1b-9a47-0c2f6e8d1a11' })).status).toBe(400);
  });

  it('רשימה עם סינון וחיפוש, בלי hash', async () => {
    const all = await api().get('/api/users').set(bearer(w.keys.admin));
    expect(all.body.total).toBe(6);
    expect(JSON.stringify(all.body)).not.toContain('passwordHash');
    const students = await api().get(`/api/users?role=STUDENT&classId=${w.classA.id}`).set(bearer(w.keys.admin));
    expect(students.body.items).toHaveLength(2);
    const search = await api().get('/api/users?search=רחל').set(bearer(w.keys.admin));
    expect(search.body.items).toHaveLength(1);
    expect((await api().get('/api/users?role=HACKER').set(bearer(w.keys.admin))).status).toBe(400);
  });

  it('עדכון, העברת כיתה, ולא ניתן להשבית את עצמך', async () => {
    const upd = await api().patch(`/api/users/${w.s1.id}`).set(bearer(w.keys.admin)).send({ classId: w.classB.id, fullName: 'מרים כהן' });
    expect(upd.body).toMatchObject({ fullName: 'מרים כהן', class: { name: 'ו1' } });
    expect((await api().patch(`/api/users/${w.t1.id}`).set(bearer(w.keys.admin)).send({ classId: w.classA.id })).status).toBe(400);
    expect((await api().patch(`/api/users/${w.admin.id}`).set(bearer(w.keys.admin)).send({ isActive: false })).status).toBe(400);
    expect((await api().patch(`/api/users/${w.s1.id}`).set(bearer(w.keys.admin)).send({})).status).toBe(400);
    expect((await api().get('/api/users/3f1c2b64-8a53-4d1b-9a47-0c2f6e8d1a11').set(bearer(w.keys.admin))).status).toBe(404);
  });

  it('איפוס סיסמה על ידי המזכירה', async () => {
    await api().patch(`/api/users/${w.s1.id}`).set(bearer(w.keys.admin)).send({ password: 'ResetPass123!' });
    expect((await api().post('/api/auth/login').send({ email: 's1@test.com', password: 'Password123!' })).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: 's1@test.com', password: 'ResetPass123!' })).status).toBe(200);
  });
});

describe('כיתות ומקצועות', () => {
  it('כל משתמשת מחוברת קוראת, רק מזכירה כותבת', async () => {
    expect((await api().get('/api/classes').set(bearer(w.keys.s1))).body).toHaveLength(2);
    expect((await api().get('/api/subjects').set(bearer(w.keys.t1))).body).toHaveLength(2);
    expect((await api().post('/api/classes').set(bearer(w.keys.s1)).send({ name: 'ה2', grade: 'HEH' })).status).toBe(403);

    const created = await api().post('/api/classes').set(bearer(w.keys.admin)).send({ name: 'ה2', grade: 'HEH' });
    expect(created.status).toBe(201);
    expect((await api().post('/api/classes').set(bearer(w.keys.admin)).send({ name: 'ה2', grade: 'HEH' })).status).toBe(409);
    expect((await api().post('/api/classes').set(bearer(w.keys.admin)).send({ name: 'ה9', grade: 'XYZ' })).status).toBe(400);
    const upd = await api().patch(`/api/classes/${created.body.id}`).set(bearer(w.keys.admin)).send({ name: 'ה2 א' });
    expect(upd.body.name).toBe('ה2 א');

    const subj = await api().post('/api/subjects').set(bearer(w.keys.admin)).send({ name: 'אלגוריתמים' });
    expect(subj.status).toBe(201);
    expect((await api().post('/api/subjects').set(bearer(w.keys.admin)).send({ name: 'אלגוריתמים' })).status).toBe(409);
    expect((await api().patch(`/api/subjects/${subj.body.id}`).set(bearer(w.keys.admin)).send({ name: '' })).status).toBe(400);
    expect((await api().patch('/api/subjects/3f1c2b64-8a53-4d1b-9a47-0c2f6e8d1a11').set(bearer(w.keys.admin)).send({ name: 'x' })).status).toBe(404);
  });
});
