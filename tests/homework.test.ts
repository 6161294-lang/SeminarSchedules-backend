import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/db/prisma';
import { clock } from '../src/utils/clock';
import { api, bearer, buildWorld, mkLesson, mkUser, type World } from './helpers';

let w: World;
let sundayLessonId: string;
let mondayLessonId: string;
let otherTeacherLessonId: string;

// 2026-11-01 הוא יום ראשון בישראל
beforeEach(async () => {
  vi.spyOn(clock, 'now').mockReturnValue(new Date('2026-11-01T09:00:00+02:00'));
  w = await buildWorld();
  const base = { subjectId: w.subject.id, classId: w.classA.id, startTime: '09:00', endTime: '10:30', room: '12' };
  sundayLessonId = (await mkLesson({ ...base, teacherId: w.t1.id, dayOfWeek: 0 })).id;
  mondayLessonId = (await mkLesson({ ...base, teacherId: w.t1.id, dayOfWeek: 1 })).id;
  otherTeacherLessonId = (
    await mkLesson({ ...base, subjectId: w.subject2.id, teacherId: w.t2.id, dayOfWeek: 0, startTime: '11:00', endTime: '12:00', room: '13' })
  ).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const hwBody = (over: Record<string, unknown> = {}) => ({
  lessonId: sundayLessonId,
  title: 'תרגיל 3',
  description: 'פתרי את שאלות 1-5',
  dueDate: '2026-11-05',
  ...over
});

const createHomework = (body = hwBody(), key = w.keys.t1) =>
  api().post('/api/homeworks').set(bearer(key)).send(body);

describe('שיעורי בית', () => {
  it('המורה יוצרת שיעורי בית לשיעור של היום והתלמידות מקבלות התראה', async () => {
    const res = await createHomework();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'תרגיל 3',
      lessonDate: '2026-11-01',
      dueDate: '2026-11-05',
      lesson: { subject: { name: 'מבני נתונים' }, room: '12' }
    });
    const notified = await prisma.notification.findMany({ where: { type: 'HOMEWORK_ADDED' } });
    expect(notified.map((n) => n.userId).sort()).toEqual([w.s1.id, w.s2.id].sort());
  });

  it('אי אפשר ליצור לשיעור שלא מתקיים היום', async () => {
    const res = await createHomework(hwBody({ lessonId: mondayLessonId }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_TODAYS_LESSON');
  });

  it('אי אפשר ליצור לשיעור של מורה אחרת', async () => {
    expect((await createHomework(hwBody({ lessonId: otherTeacherLessonId }))).status).toBe(403);
  });

  it('אי אפשר ליצור לשיעור מבוטל', async () => {
    await prisma.lesson.update({ where: { id: sundayLessonId }, data: { status: 'CANCELLED' } });
    expect((await createHomework()).body.error.code).toBe('LESSON_CANCELLED');
  });

  it('ולידציה: תאריך הגשה לא אחרי היום, כותרת חסרה, תאריך שגוי', async () => {
    expect((await createHomework(hwBody({ dueDate: '2026-11-01' }))).body.error.code).toBe('INVALID_DUE_DATE');
    expect((await createHomework(hwBody({ title: '' }))).status).toBe(400);
    expect((await createHomework(hwBody({ dueDate: '01/11/2026' }))).status).toBe(400);
    expect((await createHomework(hwBody({ lessonId: '3f1c2b64-8a53-4d1b-9a47-0c2f6e8d1a11' }))).status).toBe(404);
  });

  it('תלמידות הכיתה רואות, כיתה אחרת לא', async () => {
    await createHomework();
    const mine = await api().get('/api/homeworks').set(bearer(w.keys.s1));
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].mySubmission).toBeNull();
    expect((await api().get('/api/homeworks').set(bearer(w.keys.s3))).body).toHaveLength(0);
    expect((await api().get('/api/homeworks').set(bearer(w.keys.t2))).body).toHaveLength(0);
    const teacher = await api().get('/api/homeworks').set(bearer(w.keys.t1));
    expect(teacher.body[0].submissionsCount).toBe(0);
  });

  it('תלמידה מכיתה אחרת לא יכולה לפתוח שיעורי בית', async () => {
    const hw = (await createHomework()).body;
    expect((await api().get(`/api/homeworks/${hw.id}`).set(bearer(w.keys.s3))).status).toBe(403);
    expect((await api().get(`/api/homeworks/${hw.id}`).set(bearer(w.keys.s1))).status).toBe(200);
    expect((await api().get(`/api/homeworks/${hw.id}`).set(bearer(w.keys.t2))).status).toBe(403);
  });

  it('עריכה ומחיקה רק על ידי היוצרת', async () => {
    const hw = (await createHomework()).body;
    const byOther = await api().patch(`/api/homeworks/${hw.id}`).set(bearer(w.keys.t2)).send({ title: 'x' });
    expect(byOther.status).toBe(403);
    const edit = await api().patch(`/api/homeworks/${hw.id}`).set(bearer(w.keys.t1)).send({ title: 'תרגיל 3 מעודכן' });
    expect(edit.status).toBe(200);
    expect(edit.body.title).toBe('תרגיל 3 מעודכן');
    expect((await api().delete(`/api/homeworks/${hw.id}`).set(bearer(w.keys.t2))).status).toBe(403);
    expect((await api().delete(`/api/homeworks/${hw.id}`).set(bearer(w.keys.t1))).status).toBe(204);
  });
});

describe('הגשות', () => {
  let homeworkId: string;
  beforeEach(async () => {
    homeworkId = (await createHomework()).body.id;
  });

  const submit = (key: string, files: { name: string; content: string | Buffer }[], comment?: string, hw = homeworkId) => {
    let req = api().post(`/api/homeworks/${hw}/submission`).set(bearer(key));
    for (const f of files) req = req.attach('files', Buffer.from(f.content), f.name);
    if (comment !== undefined) req = req.field('comment', comment);
    return req;
  };

  it('התלמידה מגישה קבצים והמורה רואה אותם', async () => {
    const res = await submit(w.keys.s1, [{ name: 'a.txt', content: 'hello' }, { name: 'b.zip', content: 'zipdata' }], 'לא הצלחתי את שאלה 5');
    expect(res.status).toBe(201);
    expect(res.body.files).toHaveLength(2);
    expect(res.body.comment).toBe('לא הצלחתי את שאלה 5');
    expect(res.body.isLate).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('"data"');

    const mine = await api().get('/api/submissions/mine').set(bearer(w.keys.s1));
    expect(mine.body).toHaveLength(1);
    const hwList = await api().get('/api/homeworks').set(bearer(w.keys.s1));
    expect(hwList.body[0].mySubmission.id).toBe(res.body.id);
  });

  it('הגשה חוזרת מחליפה קבצים ומחזירה 200', async () => {
    await submit(w.keys.s1, [{ name: 'a.txt', content: 'v1' }]);
    const again = await submit(w.keys.s1, [{ name: 'c.txt', content: 'v2' }, { name: 'd.txt', content: 'v3' }]);
    expect(again.status).toBe(200);
    expect(again.body.files.map((f: { fileName: string }) => f.fileName).sort()).toEqual(['c.txt', 'd.txt']);
    expect(await prisma.submission.count()).toBe(1);
    expect(await prisma.submissionFile.count()).toBe(2);
  });

  it('עדכון הערה בלבד משאיר את הקבצים', async () => {
    await submit(w.keys.s1, [{ name: 'a.txt', content: 'v1' }], 'ראשונה');
    const res = await api().post(`/api/homeworks/${homeworkId}/submission`).set(bearer(w.keys.s1)).field('comment', 'שנייה');
    expect(res.status).toBe(200);
    expect(res.body.comment).toBe('שנייה');
    expect(res.body.files).toHaveLength(1);
  });

  it('שם קובץ בעברית נשמר נכון', async () => {
    const res = await submit(w.keys.s1, [{ name: 'תרגיל.txt', content: 'שלום' }]);
    expect(res.status).toBe(201);
    expect(res.body.files[0].fileName).toBe('תרגיל.txt');
  });

  it('דוחה הגשה ללא קבצים, סוג קובץ אסור, קובץ גדול, הרבה קבצים וקובץ ריק', async () => {
    const none = await api().post(`/api/homeworks/${homeworkId}/submission`).set(bearer(w.keys.s1));
    expect(none.status).toBe(400);
    expect(none.body.error.code).toBe('NO_FILES');

    const exe = await submit(w.keys.s1, [{ name: 'virus.exe', content: 'MZ' }]);
    expect(exe.status).toBe(400);
    expect(exe.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');

    const big = await submit(w.keys.s1, [{ name: 'big.zip', content: Buffer.alloc(5 * 1024 * 1024 + 10, 1) }]);
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('FILE_TOO_LARGE');

    const many = await submit(w.keys.s1, Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.txt`, content: 'x' })));
    expect(many.status).toBe(400);
    expect(many.body.error.code).toBe('TOO_MANY_FILES');

    const empty = await submit(w.keys.s1, [{ name: 'empty.txt', content: '' }]);
    expect(empty.status).toBe(400);
    expect(await prisma.submission.count()).toBe(0);
  });

  it('תלמידה מכיתה אחרת לא יכולה להגיש', async () => {
    expect((await submit(w.keys.s3, [{ name: 'a.txt', content: 'x' }])).status).toBe(403);
  });

  it('הגשה מאוחרת מסומנת isLate', async () => {
    const res = await submit(w.keys.s1, [{ name: 'a.txt', content: 'x' }]);
    expect(res.status).toBe(201);
    const id = res.body.id as string;

    await prisma.submission.update({ where: { id }, data: { submittedAt: new Date('2026-11-04T10:00:00+02:00') } });
    expect((await api().get(`/api/submissions/${id}`).set(bearer(w.keys.s1))).body.isLate).toBe(false);

    await prisma.submission.update({ where: { id }, data: { submittedAt: new Date('2026-11-06T10:00:00+02:00') } });
    expect((await api().get(`/api/submissions/${id}`).set(bearer(w.keys.s1))).body.isLate).toBe(true);
  });

  it('ההגשה אינה נכנסת למחברת האישית', async () => {
    await submit(w.keys.s1, [{ name: 'a.txt', content: 'x' }], 'הערה בהגשה');
    const notes = await api().get('/api/notes').set(bearer(w.keys.s1));
    expect(notes.body).toEqual([]);
  });
});

describe('צפייה בהגשות והרשאות', () => {
  let homeworkId: string;
  let submissionId: string;
  let fileId: string;

  beforeEach(async () => {
    homeworkId = (await createHomework()).body.id;
    const res = await api()
      .post(`/api/homeworks/${homeworkId}/submission`)
      .set(bearer(w.keys.s1))
      .attach('files', Buffer.from('print("hi")'), 'main.py');
    submissionId = res.body.id;
    fileId = res.body.files[0].id;
    await api()
      .post(`/api/homeworks/${homeworkId}/submission`)
      .set(bearer(w.keys.s2))
      .attach('files', Buffer.from('other'), 'other.txt');
  });

  it('תלמידה רואה את ההגשה שלה בלבד', async () => {
    expect((await api().get(`/api/submissions/${submissionId}`).set(bearer(w.keys.s1))).status).toBe(200);
    expect((await api().get(`/api/submissions/${submissionId}`).set(bearer(w.keys.s2))).status).toBe(403);
    expect((await api().get(`/api/submissions/${submissionId}`).set(bearer(w.keys.s3))).status).toBe(403);
    expect((await api().get('/api/submissions/mine').set(bearer(w.keys.s2))).body).toHaveLength(1);
  });

  it('מורת השיעור רואה, מורה אחרת והמזכירה לא', async () => {
    expect((await api().get(`/api/submissions/${submissionId}`).set(bearer(w.keys.t1))).status).toBe(200);
    expect((await api().get(`/api/submissions/${submissionId}`).set(bearer(w.keys.t2))).status).toBe(403);
    expect((await api().get(`/api/submissions/${submissionId}`).set(bearer(w.keys.admin))).status).toBe(403);
    expect((await api().get('/api/submissions').set(bearer(w.keys.admin))).status).toBe(403);
    expect((await api().get('/api/submissions').set(bearer(w.keys.t2))).body).toHaveLength(0);
  });

  it('הורדת קובץ: התוכן נשמר והגישה מוגבלת', async () => {
    const ok = await api().get(`/api/submission-files/${fileId}`).set(bearer(w.keys.t1));
    expect(ok.status).toBe(200);
    expect(ok.headers['content-disposition']).toContain('main.py');
    expect(Buffer.from(ok.body).toString()).toBe('print("hi")');
    expect((await api().get(`/api/submission-files/${fileId}`).set(bearer(w.keys.s1))).status).toBe(200);
    expect((await api().get(`/api/submission-files/${fileId}`).set(bearer(w.keys.s2))).status).toBe(403);
    expect((await api().get(`/api/submission-files/${fileId}`).set(bearer(w.keys.t2))).status).toBe(403);
    expect((await api().get(`/api/submission-files/${fileId}`).set(bearer(w.keys.admin))).status).toBe(403);
  });

  it('המורה מסננת לפי כיתה, מקצוע ושם ומיינת', async () => {
    const all = await api().get('/api/submissions').set(bearer(w.keys.t1));
    expect(all.body).toHaveLength(2);

    const byClass = await api().get(`/api/submissions?classId=${w.classA.id}`).set(bearer(w.keys.t1));
    expect(byClass.body).toHaveLength(2);
    const otherClass = await api().get(`/api/submissions?classId=${w.classB.id}`).set(bearer(w.keys.t1));
    expect(otherClass.body).toHaveLength(0);

    const bySubject = await api().get(`/api/submissions?subjectId=${w.subject.id}`).set(bearer(w.keys.t1));
    expect(bySubject.body).toHaveLength(2);
    const otherSubject = await api().get(`/api/submissions?subjectId=${w.subject2.id}`).set(bearer(w.keys.t1));
    expect(otherSubject.body).toHaveLength(0);

    const search = await api().get('/api/submissions?search=מרים').set(bearer(w.keys.t1));
    expect(search.body).toHaveLength(1);
    expect(search.body[0].student.fullName).toBe('מרים לוי');
    expect((await api().get('/api/submissions?search=לא-קיימת').set(bearer(w.keys.t1))).body).toHaveLength(0);

    const sorted = await api().get('/api/submissions?sortBy=studentName&order=asc').set(bearer(w.keys.t1));
    expect(sorted.body.map((s: { student: { fullName: string } }) => s.student.fullName)).toEqual(['דינה אברהם', 'מרים לוי']);

    expect((await api().get('/api/submissions?sortBy=password').set(bearer(w.keys.t1))).status).toBe(400);
  });

  it('משוב: רק מורת השיעור נותנת, רק היא והתלמידה רואות', async () => {
    const put = (key: string, content: string) =>
      api().put(`/api/submissions/${submissionId}/feedback`).set(bearer(key)).send({ content });

    expect((await put(w.keys.t2, 'x')).status).toBe(403);
    expect((await put(w.keys.s1, 'x')).status).toBe(403);
    expect((await put(w.keys.admin, 'x')).status).toBe(403);
    expect((await put(w.keys.t1, '')).status).toBe(400);

    expect((await api().get(`/api/submissions/${submissionId}/feedback`).set(bearer(w.keys.s1))).status).toBe(404);

    const ok = await put(w.keys.t1, 'עבודה טובה');
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ content: 'עבודה טובה', teacher: { fullName: 'רחל כהן' } });
    const updated = await put(w.keys.t1, 'עבודה מצוינת');
    expect(updated.body.content).toBe('עבודה מצוינת');
    expect(await prisma.feedback.count()).toBe(1);

    expect((await api().get(`/api/submissions/${submissionId}/feedback`).set(bearer(w.keys.s1))).body.content).toBe('עבודה מצוינת');
    expect((await api().get(`/api/submissions/${submissionId}/feedback`).set(bearer(w.keys.t1))).status).toBe(200);
    expect((await api().get(`/api/submissions/${submissionId}/feedback`).set(bearer(w.keys.s2))).status).toBe(403);
    expect((await api().get(`/api/submissions/${submissionId}/feedback`).set(bearer(w.keys.t2))).status).toBe(403);
    expect((await api().get(`/api/submissions/${submissionId}/feedback`).set(bearer(w.keys.admin))).status).toBe(403);

    const mine = await api().get('/api/submissions/mine').set(bearer(w.keys.s1));
    expect(mine.body[0].feedback.content).toBe('עבודה מצוינת');
    const notified = await prisma.notification.count({ where: { userId: w.s1.id, type: 'FEEDBACK_ADDED' } });
    expect(notified).toBe(2);
    expect(await prisma.notification.count({ where: { userId: w.s2.id, type: 'FEEDBACK_ADDED' } })).toBe(0);
  });

  it('מחיקת שיעורי בית מוחקת גם הגשות וקבצים', async () => {
    await api().delete(`/api/homeworks/${homeworkId}`).set(bearer(w.keys.t1));
    expect(await prisma.submission.count()).toBe(0);
    expect(await prisma.submissionFile.count()).toBe(0);
  });

  it('תלמידה חדשה שנוספה אחר כך לא רואה הגשות של אחרות', async () => {
    await mkUser('STUDENT', 'חדשה', 'new@test.com', w.classA.id);
    const res = await api().post('/api/auth/login').send({ email: 'new@test.com', password: 'Password123!' });
    const list = await api().get('/api/submissions/mine').set(bearer(res.body.sessionKey));
    expect(list.body).toEqual([]);
  });
});
