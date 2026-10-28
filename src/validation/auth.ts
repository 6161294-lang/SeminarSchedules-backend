import { z } from 'zod';

export const passwordRule = z
  .string({ required_error: 'סיסמה היא שדה חובה' })
  .min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים')
  .max(100, 'הסיסמה ארוכה מדי');

export const loginBody = z.object({
  email: z.string({ required_error: 'אימייל הוא שדה חובה' }).trim().toLowerCase().email('אימייל לא תקין'),
  password: z.string({ required_error: 'סיסמה היא שדה חובה' }).min(1, 'סיסמה היא שדה חובה').max(100)
});

export const registerBody = z.object({
  seminarName: z.string({ required_error: 'שם הסמינר הוא שדה חובה' }).trim().min(2, 'שם הסמינר קצר מדי').max(100, 'שם הסמינר ארוך מדי'),
  fullName: z.string({ required_error: 'שם מלא הוא שדה חובה' }).trim().min(2, 'השם קצר מדי').max(100, 'השם ארוך מדי'),
  email: z.string({ required_error: 'אימייל הוא שדה חובה' }).trim().toLowerCase().email('אימייל לא תקין').max(200),
  password: passwordRule
});

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1, 'הסיסמה הנוכחית היא שדה חובה'),
  newPassword: passwordRule
});
