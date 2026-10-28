import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  classId: string | null;
  seminarId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}
