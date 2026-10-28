import { createHash, randomBytes } from 'crypto';

export function generateSessionKey(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
