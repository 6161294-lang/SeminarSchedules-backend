import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma';
import { api, bearer, buildWorld, loginKey, mkUser, PASSWORD, seminarId, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await buildWorld();
});

const body = {
  seminarName: 'סמינר חדש',
  fullName: 'חנה המזכירה',
  email: 'new-admin@test.com',
  password: PASSWORD
};

describe('הרשמת מזכירה', () => {
  it('יוצרת סמינר ריק ומזכירה, ומחזירה התחברות', async () => {
    const res = await api().post('/api/auth/register').send(body);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: body.email, role: 'ADMIN' });
    expect(res.body.user.seminarId).not.toBe(seminarId);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const key = res.body.sessionKey as string;
    const classes = await api().get('/api/classes').set(bearer(key));
    const subjects = await api().get('/api/subjects').set(bearer(key));
    const users = await api().get('/api/users').set(bearer(key));
    expect(classes.body).toEqual([]);
    expect(subjects.body).toEqual([]);
    expect(users.body.total).toBe(1);
  });

  it('אפשר להתחבר עם הפרטים שנרשמו', async () => {
    await expect(loginKey(body.email)).resolves.toBeTypeOf('string');
  });

  it('דוחה אימייל שכבר קיים ב-409', async () => {
    const res = await api().post('/api/auth/register').send({ ...body, seminarName: 'עוד אחד' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('דוחה סיסמה קצרה ושדות חסרים', async () => {
    expect((await api().post('/api/auth/register').send({ ...body, email: 'a@test.com', password: '123' })).status).toBe(400);
    expect((await api().post('/api/auth/register').send({ email: 'b@test.com', password: PASSWORD })).status).toBe(400);
  });

  it('ההרשמה יוצרת תמיד מזכירה, גם אם נשלח role', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ ...body, email: 'sneaky@test.com', role: 'TEACHER' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('ADMIN');
  });
});

describe('בידוד בין סמינרים', () => {
  it('מזכירה לא רואה ולא משנה נתונים של סמינר אחר', async () => {
    const other = await api()
      .post('/api/auth/register')
      .send({ ...body, email: 'other-admin@test.com', seminarName: 'סמינר אחר' });
    const otherKey = other.body.sessionKey as string;

    // הנתונים של סמינר הבדיקות לא נראים לסמינר החדש
    const users = await api().get('/api/users').set(bearer(otherKey));
    expect(users.body.items.map((u: { email: string }) => u.email)).toEqual(['other-admin@test.com']);
    expect((await api().get(`/api/users/${w.t1.id}`).set(bearer(otherKey))).status).toBe(404);
    expect((await api().patch(`/api/users/${w.s1.id}`).set(bearer(otherKey)).send({ fullName: 'האקר' })).status).toBe(404);
    expect((await api().patch(`/api/classes/${w.classA.id}`).set(bearer(otherKey)).send({ name: 'x' })).status).toBe(404);

    // והנתונים של סמינר הבדיקות לא כוללים את החדש
    const mine = await api().get('/api/users').set(bearer(w.keys.admin));
    expect(mine.body.items.map((u: { email: string }) => u.email)).not.toContain('other-admin@test.com');
  });

  it('אי אפשר לשבץ שיעור עם מורה או כיתה מסמינר אחר', async () => {
    const other = await api()
      .post('/api/auth/register')
      .send({ ...body, email: 'third-admin@test.com', seminarName: 'סמינר שלישי' });
    const res = await api()
      .post('/api/lessons')
      .set(bearer(other.body.sessionKey))
      .send({
        subjectId: w.subject.id,
        teacherId: w.t1.id,
        classId: w.classA.id,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
        room: '1'
      });
    expect(res.status).toBe(400);
  });

  it('אותו שם כיתה מותר בסמינרים שונים', async () => {
    const other = await api()
      .post('/api/auth/register')
      .send({ ...body, email: 'fourth-admin@test.com', seminarName: 'סמינר רביעי' });
    const res = await api()
      .post('/api/classes')
      .set(bearer(other.body.sessionKey))
      .send({ name: w.classA.name, grade: 'HEH' });
    expect(res.status).toBe(201);
    await mkUser('TEACHER', 'x', 'x@test.com'); // לא נוגע בסמינר החדש
    expect(await prisma.class.count({ where: { name: w.classA.name } })).toBe(2);
  });
});
