import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, buildWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await buildWorld();
});

const ID = '3f1c2b64-8a53-4d1b-9a47-0c2f6e8d1a11';

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
type RoleKey = 'admin' | 't1' | 's1';

// [method, path, תפקידים שאסור להם (403)]
const forbiddenMatrix: [Method, string, RoleKey[]][] = [
  ['get', '/api/users', ['t1', 's1']],
  ['post', '/api/users', ['t1', 's1']],
  ['post', '/api/classes', ['t1', 's1']],
  ['post', '/api/subjects', ['t1', 's1']],
  ['post', '/api/lessons', ['t1', 's1']],
  ['patch', `/api/lessons/${ID}`, ['t1', 's1']],
  ['delete', `/api/lessons/${ID}`, ['t1', 's1']],
  ['get', '/api/lessons/week', ['admin']],
  ['get', '/api/lessons/day/0', ['admin']],
  ['get', '/api/notes', ['admin']],
  ['post', '/api/notes', ['admin']],
  ['get', '/api/homeworks', ['admin']],
  ['post', '/api/homeworks', ['admin', 's1']],
  ['patch', `/api/homeworks/${ID}`, ['admin', 's1']],
  ['delete', `/api/homeworks/${ID}`, ['admin', 's1']],
  ['post', `/api/homeworks/${ID}/submission`, ['admin', 't1']],
  ['get', '/api/submissions/mine', ['admin', 't1']],
  ['get', '/api/submissions', ['admin', 's1']],
  ['get', `/api/submissions/${ID}`, ['admin']],
  ['get', `/api/submission-files/${ID}`, ['admin']],
  ['put', `/api/submissions/${ID}/feedback`, ['admin', 's1']],
  ['get', `/api/submissions/${ID}/feedback`, ['admin']],
  ['post', '/api/announcements', ['t1', 's1']],
  ['get', '/api/teacher-messages', ['s1']],
  ['post', '/api/teacher-messages', ['s1']],
  ['get', '/api/teacher-messages/threads', ['t1', 's1']]
];

describe('403 - אין הרשאה לתפקיד', () => {
  for (const [method, path, roles] of forbiddenMatrix) {
    for (const role of roles) {
      it(`${role} לא רשאית ${method.toUpperCase()} ${path}`, async () => {
        const res = await api()[method](path).set(bearer(w.keys[role])).send({});
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });
    }
  }
});

describe('401 - ללא התחברות', () => {
  const protectedRoutes = new Set(forbiddenMatrix.map(([m, p]) => `${m} ${p}`));
  protectedRoutes.add('get /api/lessons');
  protectedRoutes.add('get /api/classes');
  protectedRoutes.add('get /api/subjects');
  protectedRoutes.add('get /api/notifications');
  protectedRoutes.add('get /api/announcements');
  protectedRoutes.add('post /api/auth/logout');

  for (const key of protectedRoutes) {
    const [method, path] = key.split(' ') as [Method, string];
    it(`${method.toUpperCase()} ${path} בלי Token מחזיר 401`, async () => {
      const res = await api()[method](path).send({});
      expect(res.status).toBe(401);
    });
  }
});

describe('Endpoints ציבוריים', () => {
  it('GET /api/health פתוח בלי התחברות', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('נתיב לא קיים מחזיר 404 בפורמט אחיד', async () => {
    const res = await api().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('JSON שבור מחזיר 400', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
