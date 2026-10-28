import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL חסר'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET חסר'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGINS: z.string().default('*'),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_DEMO_DATA: z.string().optional(),
  SEED_DEMO_PASSWORD: z.string().optional()
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`הגדרות סביבה שגויות:\n${problems}`);
}

const data = parsed.data;

if (data.NODE_ENV === 'production' && data.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET חייב להיות באורך 32 תווים לפחות בסביבת production');
}
if (data.JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET חייב להיות באורך 16 תווים לפחות');
}

export const env = {
  ...data,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  corsOrigins: data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
};
