// One error type for the whole API. The exception filter turns it into
// { "error": { "code", "message", "details" } } (docs/API-CONTRACT.md §1 and §6).

export class AppError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const validationError = (message: string, details: Record<string, unknown> = {}) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Sign in again.') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You are not allowed to do that.') => new AppError(403, 'FORBIDDEN', message);
export const conflict = (code: string, message: string, details: Record<string, unknown> = {}) =>
  new AppError(409, code, message, details);
export const roomNotFound = () => new AppError(404, 'ROOM_NOT_FOUND', 'Room not found.');
export const matchNotFound = () => new AppError(404, 'MATCH_NOT_FOUND', 'Match not found.');

export function toErrorBody(error: AppError) {
  return { code: error.code, message: error.message, details: error.details };
}
