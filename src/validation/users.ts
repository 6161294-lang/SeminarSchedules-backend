import { z } from 'zod';
import { booleanQuery, pagination, shortText, uuid } from './common';
import { passwordRule } from './auth';

const email = z.string().trim().toLowerCase().email('אימייל לא תקין').max(200);

export const createUserBody = z
  .object({
    fullName: shortText('שם מלא'),
    email,
    password: passwordRule,
    role: z.enum(['TEACHER', 'STUDENT', 'ADMIN']),
    classId: uuid.optional()
  })
  .superRefine((v, ctx) => {
    if (v.role === 'STUDENT' && !v.classId) {
      ctx.addIssue({ code: 'custom', path: ['classId'], message: 'תלמידה חייבת להשתייך לכיתה' });
    }
    if (v.role !== 'STUDENT' && v.classId) {
      ctx.addIssue({ code: 'custom', path: ['classId'], message: 'רק תלמידה משויכת לכיתה' });
    }
  });

export const updateUserBody = z
  .object({
    fullName: shortText('שם מלא').optional(),
    email: email.optional(),
    password: passwordRule.optional(),
    classId: uuid.optional(),
    isActive: z.boolean().optional()
  })
  .refine((v) => Object.keys(v).length > 0, 'לא נשלחו שדות לעדכון');

export const listUsersQuery = z.object({
  role: z.enum(['TEACHER', 'STUDENT', 'ADMIN']).optional(),
  classId: uuid.optional(),
  isActive: booleanQuery.optional(),
  search: z.string().trim().max(100).optional(),
  ...pagination
});
