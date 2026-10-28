import { z } from 'zod';
import { shortText } from './common';

export const createClassBody = z.object({
  name: shortText('שם כיתה'),
  grade: z.enum(['HEH', 'VAV'], { errorMap: () => ({ message: 'מחזור חייב להיות HEH או VAV' }) })
});
export const updateClassBody = createClassBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'לא נשלחו שדות לעדכון');

export const subjectBody = z.object({ name: shortText('שם מקצוע') });
