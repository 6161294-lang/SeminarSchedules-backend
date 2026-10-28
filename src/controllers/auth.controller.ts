import type { Request, Response } from 'express';
import { currentUser } from '../middleware/authorize';
import * as authService from '../services/auth.service';
import * as userService from '../services/user.service';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  res.json(await authService.login(email, password));
}

export async function register(req: Request, res: Response) {
  res.status(201).json(
    await authService.register(req.body as { seminarName: string; fullName: string; email: string; password: string })
  );
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.sessionId ?? '');
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json(await userService.getMe(currentUser(req).id));
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await authService.changePassword(currentUser(req).id, req.sessionId ?? '', currentPassword, newPassword);
  res.status(204).end();
}
