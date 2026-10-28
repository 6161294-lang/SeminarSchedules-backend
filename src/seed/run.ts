import { prisma } from '../db/prisma';
import { runSeed } from './seed';

runSeed()
  .catch((err) => {
    console.error('Seed נכשל:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
