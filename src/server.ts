import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`השרת רץ על פורט ${env.PORT} (${env.NODE_ENV})`);
  console.log(`Swagger: /api-docs | Health: /api/health`);
});

async function shutdown(signal: string) {
  console.log(`${signal} התקבל, סוגר את השרת...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
