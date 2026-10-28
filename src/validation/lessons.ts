import { z } from 'zod';
import { dayOfWeek, shortText, timeHHmm, uuid } from './common';

const baseLesson = z.object({
  subjectId: uuid,
  teacherId: uuid,
  classId: uuid,
  dayOfWeek: z.number().int().min(0, 'יום בין 0 (ראשון) ל-5 (שישי)').max(5, 'יום בין 0 (ראשון) ל-5 (שישי)'),
  startTime: timeHHmm,
  endTime: timeHHmm,
  room: shortText('חדר'),
  changeNote: z.string().trim().max(300).optional()
});

export const createLessonBody = baseLesson.refine((v) => v.startTime < v.endTime, {
  path: ['endTime'],
  message: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה'
});

export const updateLessonBody = baseLesson
  .partial()
  .extend({
    status: z.enum(['ACTIVE', 'CANCELLED']).optional(),
    changeNote: z.string().trim().max(300).nullable().optional()
  })
  .refine((v) => Object.keys(v).length > 0, 'לא נשלחו שדות לעדכון')
  .refine((v) => !(v.startTime && v.endTime) || v.startTime < v.endTime, {
    path: ['endTime'],
    message: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה'
  });

export const listLessonsQuery = z.object({
  classId: uuid.optional(),
  teacherId: uuid.optional(),
  dayOfWeek: dayOfWeek.optional(),
  status: z.enum(['ACTIVE', 'CANCELLED']).optional()
});

export const dayParams = z.object({ dayOfWeek });
