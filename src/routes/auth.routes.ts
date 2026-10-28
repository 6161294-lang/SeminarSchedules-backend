import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import * as c from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import { changePasswordBody, loginBody, registerBody } from '../validation/auth';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'יותר מדי ניסיונות התחברות, אפשר לנסות שוב בעוד כמה דקות' } }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'יותר מדי הרשמות, אפשר לנסות שוב מאוחר יותר' } }
});

export const authRouter = Router();

authRouter.post('/register', registerLimiter, validate({ body: registerBody }), h(c.register));

authRouter.post('/login', loginLimiter, validate({ body: loginBody }), h(c.login));
authRouter.post('/logout', authenticate, h(c.logout));
authRouter.get('/me', authenticate, h(c.me));
authRouter.post('/change-password', authenticate, validate({ body: changePasswordBody }), h(c.changePassword));
