export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown) {
    return new HttpError(400, code, message, details);
  }
  static unauthorized(message = 'נדרשת התחברות', code = 'UNAUTHORIZED') {
    return new HttpError(401, code, message);
  }
  static forbidden(message = 'אין לך הרשאה לבצע פעולה זו', code = 'FORBIDDEN') {
    return new HttpError(403, code, message);
  }
  static notFound(message = 'המשאב לא נמצא', code = 'NOT_FOUND') {
    return new HttpError(404, code, message);
  }
  static conflict(message: string, code = 'CONFLICT', details?: unknown) {
    return new HttpError(409, code, message, details);
  }
}
