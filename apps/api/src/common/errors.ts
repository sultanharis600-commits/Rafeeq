import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * API errors carry a stable `code` the apps translate (no hard-coded text in the
 * apps). `message` is English for developers and logs.
 *   { "statusCode": 409, "code": "booking.invalid_transition", "message": "..." }
 */
export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details?: Record<string, unknown>) {
    super({ statusCode: status, code, message, ...(details ? { details } : {}) }, status);
  }
}

export const notFound = (what: string) => new AppError(HttpStatus.NOT_FOUND, `${what}.not_found`, `${what} not found`);
export const forbidden = (code = 'auth.forbidden', message = 'Not allowed') => new AppError(HttpStatus.FORBIDDEN, code, message);
export const badRequest = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(HttpStatus.BAD_REQUEST, code, message, details);
export const conflict = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(HttpStatus.CONFLICT, code, message, details);
