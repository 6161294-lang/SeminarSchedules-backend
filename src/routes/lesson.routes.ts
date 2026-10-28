import { Router } from 'express';
import * as c from '../controllers/lesson.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import { idParams } from '../validation/common';
import { createLessonBody, dayParams, listLessonsQuery, updateLessonBody } from '../validation/lessons';
import { createNoteBody, listNotesQuery, updateNoteBody } from '../validation/messaging';

export const lessonRouter = Router();

// לוח זמנים. הסדר חשוב: /week ו-/day לפני /:id
lessonRouter.get('/lessons', authenticate, validate({ query: listLessonsQuery }), h(c.list));
lessonRouter.get('/lessons/week', authenticate, authorize('TEACHER', 'STUDENT'), h(c.week));
lessonRouter.get(
  '/lessons/day/:dayOfWeek',
  authenticate,
  authorize('TEACHER', 'STUDENT'),
  validate({ params: dayParams }),
  h(c.day)
);
lessonRouter.get('/lessons/:id', authenticate, validate({ params: idParams }), h(c.getOne));
lessonRouter.post('/lessons', authenticate, authorize('ADMIN'), validate({ body: createLessonBody }), h(c.create));
lessonRouter.patch(
  '/lessons/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: idParams, body: updateLessonBody }),
  h(c.update)
);
lessonRouter.delete('/lessons/:id', authenticate, authorize('ADMIN'), validate({ params: idParams }), h(c.remove));

// הערות אישיות: מורה ותלמידה, כל אחת רואה רק את שלה
lessonRouter.get('/notes', authenticate, authorize('TEACHER', 'STUDENT'), validate({ query: listNotesQuery }), h(c.listNotes));
lessonRouter.post('/notes', authenticate, authorize('TEACHER', 'STUDENT'), validate({ body: createNoteBody }), h(c.createNote));
lessonRouter.patch(
  '/notes/:id',
  authenticate,
  authorize('TEACHER', 'STUDENT'),
  validate({ params: idParams, body: updateNoteBody }),
  h(c.updateNote)
);
lessonRouter.delete(
  '/notes/:id',
  authenticate,
  authorize('TEACHER', 'STUDENT'),
  validate({ params: idParams }),
  h(c.deleteNote)
);
