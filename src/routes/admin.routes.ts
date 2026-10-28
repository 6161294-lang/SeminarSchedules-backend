import { Router } from 'express';
import * as c from '../controllers/admin.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import { createClassBody, subjectBody, updateClassBody } from '../validation/catalog';
import { idParams } from '../validation/common';
import { createUserBody, listUsersQuery, updateUserBody } from '../validation/users';

export const adminRouter = Router();

// משתמשים: מזכירה בלבד
adminRouter.get('/users', authenticate, authorize('ADMIN'), validate({ query: listUsersQuery }), h(c.listUsers));
adminRouter.post('/users', authenticate, authorize('ADMIN'), validate({ body: createUserBody }), h(c.createUser));
adminRouter.get('/users/:id', authenticate, authorize('ADMIN'), validate({ params: idParams }), h(c.getUser));
adminRouter.patch(
  '/users/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: idParams, body: updateUserBody }),
  h(c.updateUser)
);

// כיתות ומקצועות: קריאה לכל משתמשת מחוברת, כתיבה למזכירה
adminRouter.get('/classes', authenticate, h(c.listClasses));
adminRouter.post('/classes', authenticate, authorize('ADMIN'), validate({ body: createClassBody }), h(c.createClass));
adminRouter.patch(
  '/classes/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: idParams, body: updateClassBody }),
  h(c.updateClass)
);
adminRouter.get('/subjects', authenticate, h(c.listSubjects));
adminRouter.post('/subjects', authenticate, authorize('ADMIN'), validate({ body: subjectBody }), h(c.createSubject));
adminRouter.patch(
  '/subjects/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: idParams, body: subjectBody }),
  h(c.updateSubject)
);
