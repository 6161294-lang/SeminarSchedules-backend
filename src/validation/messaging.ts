import { z } from 'zod';
import { booleanQuery, longText, shortText, uuid } from './common';

export const createNoteBody = z.object({ lessonId: uuid, content: longText('תוכן ההערה') });
export const updateNoteBody = z.object({ content: longText('תוכן ההערה') });
export const listNotesQuery = z.object({
  lessonId: uuid.optional(),
  search: z.string().trim().max(100).optional()
});

export const listNotificationsQuery = z.object({
  unreadOnly: booleanQuery.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export const createAnnouncementBody = z
  .object({
    audience: z.enum(['ALL_STUDENTS', 'ALL_TEACHERS', 'GRADE', 'CLASS']),
    grade: z.enum(['HEH', 'VAV']).optional(),
    classId: uuid.optional(),
    title: shortText('כותרת'),
    body: longText('תוכן ההודעה')
  })
  .superRefine((v, ctx) => {
    if (v.audience === 'GRADE' && !v.grade) {
      ctx.addIssue({ code: 'custom', path: ['grade'], message: 'חובה לבחור מחזור' });
    }
    if (v.audience === 'CLASS' && !v.classId) {
      ctx.addIssue({ code: 'custom', path: ['classId'], message: 'חובה לבחור כיתה' });
    }
  });

export const sendTeacherMessageBody = z.object({
  teacherId: uuid.optional(),
  body: longText('תוכן ההודעה')
});
export const teacherMessagesQuery = z.object({ teacherId: uuid.optional() });
