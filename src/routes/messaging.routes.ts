import { Router } from 'express';
import * as lessonC from '../controllers/lesson.controller';
import * as c from '../controllers/admin.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import { idParams } from '../validation/common';
import {
  createAnnouncementBody,
  listNotificationsQuery,
  sendTeacherMessageBody,
  teacherMessagesQuery
} from '../validation/messaging';

export const messagingRouter = Router();

// התראות: כל משתמשת מחוברת
messagingRouter.get('/notifications', authenticate, validate({ query: listNotificationsQuery }), h(lessonC.listNotifications));
messagingRouter.post('/notifications/read-all', authenticate, h(lessonC.markAllNotificationsRead));
messagingRouter.patch(
  '/notifications/:id/read',
  authenticate,
  validate({ params: idParams }),
  h(lessonC.markNotificationRead)
);

// הודעות מהמזכירה
messagingRouter.post(
  '/announcements',
  authenticate,
  authorize('ADMIN'),
  validate({ body: createAnnouncementBody }),
  h(c.createAnnouncement)
);
messagingRouter.get('/announcements', authenticate, h(c.listAnnouncements));

// שיחה בין מורה למזכירה. /threads לפני נתיבים אחרים
messagingRouter.get('/teacher-messages/threads', authenticate, authorize('ADMIN'), h(c.listThreads));
messagingRouter.get(
  '/teacher-messages',
  authenticate,
  authorize('TEACHER', 'ADMIN'),
  validate({ query: teacherMessagesQuery }),
  h(c.getThread)
);
messagingRouter.post(
  '/teacher-messages',
  authenticate,
  authorize('TEACHER', 'ADMIN'),
  validate({ body: sendTeacherMessageBody }),
  h(c.sendThreadMessage)
);
