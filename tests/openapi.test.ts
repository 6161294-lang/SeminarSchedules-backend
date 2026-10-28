import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma';
import { listDocumentedOperations, openApiSpec } from '../src/docs/openapi';
import { api, app, mkSeminar } from './helpers';

interface Layer {
  name: string;
  regexp: RegExp;
  route?: { path: string; methods: Record<string, boolean> };
  handle: { stack?: Layer[] };
}

function mountPath(layer: Layer): string {
  return layer.regexp.source
    .replace('^', '')
    .replace('\\/?(?=\\/|$)', '')
    .replace(/\\\//g, '/');
}

function collectRoutes(stack: Layer[], prefix = ''): string[] {
  const out: string[] = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        out.push(`${method.toUpperCase()} ${prefix}${layer.route.path}`);
      }
    } else if (layer.name === 'router' && layer.handle.stack) {
      out.push(...collectRoutes(layer.handle.stack, prefix + mountPath(layer)));
    }
  }
  return out;
}

const expressRoutes = () => {
  const stack = (app as unknown as { _router: { stack: Layer[] } })._router.stack;
  return collectRoutes(stack)
    .filter((r) => r.split(' ')[1]!.startsWith('/api/'))
    .map((r) => r.replace(/:(\w+)/g, '{$1}'))
    .sort();
};

describe('Swagger / OpenAPI', () => {
  it('מסמך OpenAPI תקין לפי הסטנדרט', async () => {
    const clone = JSON.parse(JSON.stringify(openApiSpec));
    const api = await SwaggerParser.validate(clone);
    expect((api as { openapi: string }).openapi).toBe('3.0.3');
  });

  it('כל Endpoint בשרת מתועד, ולכל תיעוד יש Endpoint', () => {
    const real = expressRoutes();
    const documented = listDocumentedOperations();
    expect(real.length).toBeGreaterThan(40);
    expect(documented.filter((d) => !real.includes(d))).toEqual([]);
    expect(real.filter((r) => !documented.includes(r))).toEqual([]);
  });

  it('מוגדר Security Scheme מסוג HTTP Bearer ו-Authorize', () => {
    expect(openApiSpec.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
  });

  it('Endpoints פרטיים דורשים Bearer, וציבוריים לא, וקודי 401/403 מתועדים', () => {
    const publicOps = new Set(['GET /api/health', 'POST /api/auth/login', 'POST /api/auth/register']);
    for (const [path, item] of Object.entries(openApiSpec.paths)) {
      for (const [method, op] of Object.entries(item as Record<string, Record<string, unknown>>)) {
        const key = `${method.toUpperCase()} ${path}`;
        const security = op.security as unknown[];
        const responses = op.responses as Record<string, unknown>;
        if (publicOps.has(key)) {
          expect(security, key).toEqual([]);
        } else {
          expect(security, key).toEqual([{ bearerAuth: [] }]);
          expect(responses['401'], key).toBeDefined();
        }
        expect(op.summary, key).toBeTruthy();
        expect(op.description, key).toContain('הרשאות');
      }
    }
  });

  it('לכל Endpoint עם גוף בקשה יש דוגמת JSON, ולכל תגובת הצלחה סכמה', () => {
    for (const [path, item] of Object.entries(openApiSpec.paths)) {
      for (const [method, op] of Object.entries(item as Record<string, Record<string, any>>)) {
        const key = `${method.toUpperCase()} ${path}`;
        const json = op.requestBody?.content?.['application/json'];
        if (json) expect(json.example, key).toBeDefined();
        for (const [code, res] of Object.entries(op.responses as Record<string, any>)) {
          if (code.startsWith('2') && code !== '204' && res.content) {
            const media = Object.values(res.content)[0] as { schema?: unknown };
            expect(media.schema, `${key} ${code}`).toBeDefined();
          }
        }
      }
    }
  });

  it('/api-docs מגיש את Swagger UI ו-/openapi.json מחזיר את המסמך', async () => {
    const ui = await api().get('/api-docs/');
    expect(ui.status).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');
    expect(ui.text).toContain('swagger-ui');
    const init = await api().get('/api-docs/swagger-ui-init.js');
    expect(init.status).toBe(200);
    expect(init.text).toContain('persistAuthorization');

    const json = await api().get('/openapi.json');
    expect(json.status).toBe(200);
    expect(json.body.openapi).toBe('3.0.3');
    expect(Object.keys(json.body.paths).length).toBe(Object.keys(openApiSpec.paths).length);
  });

  it('CORS מאפשר רק את המקורות שהוגדרו', async () => {
    const allowed = await api().get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await api().get('/api/health').set('Origin', 'http://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Prisma', () => {
  it('מסד הנתונים תואם לסכמה: כל הטבלאות קיימות וניתנות לשאילתה', async () => {
    const tables = (
      await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    ).map((t) => t.tablename);
    for (const t of [
      'users', 'classes', 'subjects', 'lessons', 'notes', 'homeworks', 'submissions',
      'submission_files', 'feedbacks', 'sessions', 'announcements', 'notifications', 'teacher_messages'
    ]) {
      expect(tables, t).toContain(t);
    }
    await expect(prisma.user.count()).resolves.toBeTypeOf('number');
    await expect(prisma.lesson.count()).resolves.toBeTypeOf('number');
  });

  it('אילוצי CHECK במסד פעילים', async () => {
    const seminar = await mkSeminar('בדיקת אילוצים');
    const cls = await prisma.class.create({ data: { name: 'בדיקת אילוצים', grade: 'HEH', seminarId: seminar.id } });
    const subject = await prisma.subject.create({ data: { name: 'בדיקת אילוצים', seminarId: seminar.id } });
    const teacher = await prisma.user.create({
      data: { seminarId: seminar.id, fullName: 'מורה', email: 'check@test.com', role: 'TEACHER', passwordHash: 'x' }
    });
    const bad = { subjectId: subject.id, teacherId: teacher.id, classId: cls.id, room: '1' };
    await expect(prisma.lesson.create({ data: { ...bad, dayOfWeek: 9, startTime: '09:00', endTime: '10:00' } })).rejects.toThrow();
    await expect(prisma.lesson.create({ data: { ...bad, dayOfWeek: 1, startTime: '11:00', endTime: '10:00' } })).rejects.toThrow();
    await expect(
      prisma.user.create({ data: { seminarId: seminar.id, fullName: 'תלמידה בלי כיתה', email: 'nc@test.com', role: 'STUDENT', passwordHash: 'x' } })
    ).rejects.toThrow();
    await prisma.lesson.deleteMany();
    await prisma.user.deleteMany({ where: { email: 'check@test.com' } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.class.delete({ where: { id: cls.id } });
    await prisma.seminar.delete({ where: { id: seminar.id } });
  });
});
