import { Router } from 'express';
import { prisma } from '../db/prisma';
import { adminRouter } from './admin.routes';
import { authRouter } from './auth.routes';
import { homeworkRouter } from './homework.routes';
import { lessonRouter } from './lesson.routes';
import { messagingRouter } from './messaging.routes';

export const apiRouter = Router();

// בדיקת בריאות ציבורית (Render משתמש בה). בודקת גם חיבור למסד הנתונים
apiRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', database: 'down', time: new Date().toISOString() });
  }
});

apiRouter.use('/auth', authRouter);
apiRouter.use(adminRouter);
apiRouter.use(lessonRouter);
apiRouter.use(homeworkRouter);
apiRouter.use(messagingRouter);
