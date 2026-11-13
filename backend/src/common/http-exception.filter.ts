import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppError, toErrorBody } from './errors';

const STATUS_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'INVALID_ACTION',
  413: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  503: 'DEPENDENCY_UNAVAILABLE',
};

/** Every error leaves the API as { error: { code, message, details } }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res: Response = host.switchToHttp().getResponse();

    if (exception instanceof AppError) {
      res.status(exception.status).json({ error: toErrorBody(exception) });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR');
      res.status(status).json({ error: { code, message: exception.message, details: {} } });
      return;
    }

    // Unknown error: log it on the server, never leak details to the client.
    this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', details: {} } });
  }
}
