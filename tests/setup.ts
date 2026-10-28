import dotenv from 'dotenv';

// רץ לפני כל קובץ בדיקות, לפני שהאפליקציה נטענת
dotenv.config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = 'test-secret-0123456789-abcdefghijklmnopqrstuvwxyz';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_COST = '4';
process.env.CORS_ORIGINS = 'http://localhost:5173';
