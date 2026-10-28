import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { openApiSpec } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  // Render ו-Heroku עובדים מאחורי proxy
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition']
    })
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (_req, res) => {
    res.json({ name: 'seminar-schedule-backend', docs: '/api-docs', health: '/api/health' });
  });

  // Swagger UI ו-OpenAPI
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'API - מערכת לוח זמנים לסמינר',
      swaggerOptions: { persistAuthorization: true }
    })
  );

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
