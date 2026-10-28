import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma';
import { hashSessionKey } from '../src/utils/security';
import { PASSWORD, api, bearer, buildWorld, loginKey, mkUser, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await buildWorld();
});

describe('Login', () => {
  it('מתחבר בהצלחה ומחזיר מפתח בלי סודות', async () => {
    const res = await api().post('/api/auth/login').send({ email: 's1@test.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.sessionKey).toBe('string');
    expect(res.body.user).toMatchObject({ email: 's1@test.com', role: 'STUDENT' });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('eyJ'); // ה-JWT נשאר בשרת
  });

  it('שומר את ה-JWT בשרת ורק hash של המפתח', async () => {
    const key = await loginKey('t1@test.com');
    const session = await prisma.session.findUnique({ where: { keyHash: hashSessionKey(key) } });
    expect(session).not.toBeNull();
    expect(session!.jwt.split('.')).toHaveLength(3);
    expect(session!.keyHash).not.toBe(key);
    const payload = jwt.decode(session!.jwt) as jwt.JwtPayload;
    expect(payload.sub).toBe(w.t1.id);
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('דוחה סיסמה שגויה ב-401', async () => {
    const res = await api().post('/api/auth/login').send({ email: 's1@test.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('דוחה אימייל לא קיים באותה הודעה', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'nobody@test.com', password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('דוחה משתמשת מושבתת', async () => {
    await mkUser('STUDENT', 'מושבתת', 'off@test.com', w.classA.id, false);
    const res = await api().post('/api/auth/login').send({ email: 'off@test.com', password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('מחזיר 400 על קלט לא תקין', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('לא מבדיל בין אותיות גדולות וקטנות באימייל', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'S1@TEST.com', password: PASSWORD });
    expect(res.status).toBe(200);
  });
});

describe('Token חסר, לא תקין או שפג תוקפו', () => {
  it('בלי Authorization מחזיר 401', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('מפתח אקראי מחזיר 401', async () => {
    const res = await api().get('/api/auth/me').set(bearer('not-a-real-key'));
    expect(res.status).toBe(401);
  });

  it('סכמה שאינה Bearer מחזירה 401', async () => {
    const res = await api().get('/api/auth/me').set('Authorization', `Basic ${w.keys.s1}`);
    expect(res.status).toBe(401);
  });

  it('JWT שפג תוקפו בשרת מחזיר 401', async () => {
    const expired = jwt.sign({ role: 'STUDENT' }, process.env.JWT_SECRET!, { subject: w.s1.id, expiresIn: -60 });
    await prisma.session.create({
      data: { userId: w.s1.id, keyHash: hashSessionKey('expired-jwt-key'), jwt: expired, expiresAt: new Date(Date.now() + 3600_000) }
    });
    const res = await api().get('/api/auth/me').set(bearer('expired-jwt-key'));
    expect(res.status).toBe(401);
  });

  it('התחברות שפג תוקפה (expiresAt) מחזירה 401', async () => {
    const valid = jwt.sign({ role: 'STUDENT' }, process.env.JWT_SECRET!, { subject: w.s1.id, expiresIn: 3600 });
    await prisma.session.create({
      data: { userId: w.s1.id, keyHash: hashSessionKey('old-session-key'), jwt: valid, expiresAt: new Date(Date.now() - 1000) }
    });
    const res = await api().get('/api/auth/me').set(bearer('old-session-key'));
    expect(res.status).toBe(401);
  });

  it('JWT שנחתם בסוד אחר מחזיר 401', async () => {
    const forged = jwt.sign({ role: 'ADMIN' }, 'some-other-secret-0123456789-abcdef', { subject: w.s1.id, expiresIn: 3600 });
    await prisma.session.create({
      data: { userId: w.s1.id, keyHash: hashSessionKey('forged-key'), jwt: forged, expiresAt: new Date(Date.now() + 3600_000) }
    });
    const res = await api().get('/api/auth/me').set(bearer('forged-key'));
    expect(res.status).toBe(401);
  });

  it('המשתמשת נקבעת לפי ה-Token ולא לפי מזהה מהלקוח', async () => {
    const res = await api().get('/api/auth/me?userId=' + w.admin.id).set(bearer(w.keys.s1)).set('X-User-Id', w.admin.id);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(w.s1.id);
  });
});

describe('me, logout ושינוי סיסמה', () => {
  it('me מחזיר את המשתמשת בלי hash', async () => {
    const res = await api().get('/api/auth/me').set(bearer(w.keys.s1));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: w.s1.id, role: 'STUDENT', class: { name: 'ה1' } });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('logout מבטל את המפתח', async () => {
    const key = await loginKey('s2@test.com');
    expect((await api().get('/api/auth/me').set(bearer(key))).status).toBe(200);
    expect((await api().post('/api/auth/logout').set(bearer(key))).status).toBe(204);
    expect((await api().get('/api/auth/me').set(bearer(key))).status).toBe(401);
  });

  it('שינוי סיסמה: סיסמה נוכחית שגויה נדחית, תקינה עובדת ומנתקת אחרים', async () => {
    await mkUser('TEACHER', 'מורה לשינוי סיסמה', 'pw@test.com');
    const keyA = await loginKey('pw@test.com');
    const keyB = await loginKey('pw@test.com');

    const bad = await api().post('/api/auth/change-password').set(bearer(keyA)).send({ currentPassword: 'nope-nope', newPassword: 'BrandNew123!' });
    expect(bad.status).toBe(400);

    const short = await api().post('/api/auth/change-password').set(bearer(keyA)).send({ currentPassword: PASSWORD, newPassword: '123' });
    expect(short.status).toBe(400);

    const ok = await api().post('/api/auth/change-password').set(bearer(keyA)).send({ currentPassword: PASSWORD, newPassword: 'BrandNew123!' });
    expect(ok.status).toBe(204);

    expect((await api().get('/api/auth/me').set(bearer(keyA))).status).toBe(200);
    expect((await api().get('/api/auth/me').set(bearer(keyB))).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: 'pw@test.com', password: PASSWORD })).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: 'pw@test.com', password: 'BrandNew123!' })).status).toBe(200);
  });

  it('השבתת משתמשת על ידי המזכירה מנתקת אותה מיד', async () => {
    const victim = await mkUser('STUDENT', 'להשבתה', 'victim@test.com', w.classA.id);
    const key = await loginKey('victim@test.com');
    expect((await api().get('/api/auth/me').set(bearer(key))).status).toBe(200);
    const res = await api().patch(`/api/users/${victim.id}`).set(bearer(w.keys.admin)).send({ isActive: false });
    expect(res.status).toBe(200);
    expect((await api().get('/api/auth/me').set(bearer(key))).status).toBe(401);
  });
});
