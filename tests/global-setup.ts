import { execSync } from 'child_process';
import dotenv from 'dotenv';

// רץ פעם אחת לפני כל הבדיקות: מריץ Migrations על מסד הבדיקות
export default function setup() {
  dotenv.config({ path: '.env.test' });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'חסר TEST_DATABASE_URL. העתיקי את .env.test.example לשם .env.test והגדירי מסד בדיקות ריק (הבדיקות מוחקות נתונים!).'
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL חייב להיות שונה מ-DATABASE_URL כדי לא למחוק נתוני פיתוח.');
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url }
  });
}
