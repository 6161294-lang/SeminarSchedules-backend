import { z } from 'zod';
import { booleanQuery, dateYMD, longText, shortText, uuid } from './common';

export const createHomeworkBody = z.object({
  lessonId: uuid,
  title: shortText('כותרת'),
  description: longText('הסבר'),
  dueDate: dateYMD
});

export const updateHomeworkBody = z
  .object({
    title: shortText('כותרת').optional(),
    description: longText('הסבר').optional(),
    dueDate: dateYMD.optional()
  })
  .refine((v) => Object.keys(v).length > 0, 'לא נשלחו שדות לעדכון');

export const listHomeworksQuery = z.object({
  lessonId: uuid.optional(),
  upcoming: booleanQuery.optional()
});

export const submissionCommentBody = z.object({
  comment: z.string().trim().max(2000, 'ההערה ארוכה מדי').optional()
});

export const listSubmissionsQuery = z.object({
  classId: uuid.optional(),
  subjectId: uuid.optional(),
  homeworkId: uuid.optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['submittedAt', 'studentName']).default('submittedAt'),
  order: z.enum(['asc', 'desc']).default('desc')
});

export const feedbackBody = z.object({ content: longText('משוב') });
