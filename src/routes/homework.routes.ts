import { Router } from 'express';
import * as c from '../controllers/homework.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { submissionUpload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import { idParams } from '../validation/common';
import {
  createHomeworkBody,
  feedbackBody,
  listHomeworksQuery,
  listSubmissionsQuery,
  updateHomeworkBody
} from '../validation/homework';

export const homeworkRouter = Router();

const teacherOrStudent = [authenticate, authorize('TEACHER', 'STUDENT')];
const teacherOnly = [authenticate, authorize('TEACHER')];
const studentOnly = [authenticate, authorize('STUDENT')];

// שיעורי בית: מורה ותלמידה. המזכירה אינה רואה אותם
homeworkRouter.get('/homeworks', ...teacherOrStudent, validate({ query: listHomeworksQuery }), h(c.list));
homeworkRouter.get('/homeworks/:id', ...teacherOrStudent, validate({ params: idParams }), h(c.getOne));
homeworkRouter.post('/homeworks', ...teacherOnly, validate({ body: createHomeworkBody }), h(c.create));
homeworkRouter.patch(
  '/homeworks/:id',
  ...teacherOnly,
  validate({ params: idParams, body: updateHomeworkBody }),
  h(c.update)
);
homeworkRouter.delete('/homeworks/:id', ...teacherOnly, validate({ params: idParams }), h(c.remove));

// הגשות. /submissions/mine לפני /submissions/:id
homeworkRouter.post(
  '/homeworks/:id/submission',
  ...studentOnly,
  validate({ params: idParams }),
  submissionUpload,
  h(c.submit)
);
homeworkRouter.get('/submissions/mine', ...studentOnly, h(c.mine));
homeworkRouter.get('/submissions', ...teacherOnly, validate({ query: listSubmissionsQuery }), h(c.listForTeacher));
homeworkRouter.get('/submissions/:id', ...teacherOrStudent, validate({ params: idParams }), h(c.getSubmission));
homeworkRouter.get('/submission-files/:id', ...teacherOrStudent, validate({ params: idParams }), h(c.downloadFile));
homeworkRouter.put(
  '/submissions/:id/feedback',
  ...teacherOnly,
  validate({ params: idParams, body: feedbackBody }),
  h(c.saveFeedback)
);
homeworkRouter.get(
  '/submissions/:id/feedback',
  ...teacherOrStudent,
  validate({ params: idParams }),
  h(c.getFeedback)
);
