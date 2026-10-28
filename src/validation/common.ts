import { z } from 'zod';

export const uuid = z.string().uuid('מזהה לא תקין');
export const idParams = z.object({ id: uuid });

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} הוא שדה חובה`, invalid_type_error: `${label} חייב להיות טקסט` })
    .trim()
    .min(min, `${label} הוא שדה חובה`)
    .max(max, `${label} ארוך מדי (עד ${max} תווים)`);

export const shortText = (label: string) => trimmed(1, 120, label);
export const longText = (label: string) => trimmed(1, 4000, label);

export const timeHHmm = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'שעה בפורמט HH:mm');
export const dateYMD = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך בפורמט YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'תאריך לא תקין');

export const dayOfWeek = z.coerce.number().int().min(0).max(5);

export const booleanQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100)
};
