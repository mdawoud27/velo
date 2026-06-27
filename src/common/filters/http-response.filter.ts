import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorResponse } from '../interfaces';
import { deriveCode } from '../utils';
import { DomainException } from '../exceptions';

function extractMessage(exceptionResponse: string | object, fallback: string): string {
  if (typeof exceptionResponse === 'string') return exceptionResponse;

  const payload = exceptionResponse as Record<string, unknown>;
  const msg = payload.message;

  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg) && msg.length > 0) return String(msg[0]);

  return fallback;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const timestamp = new Date().toISOString();

    if (exception instanceof DomainException) {
      const payload = exception.getResponse() as Record<string, unknown>;
      response.status(status).json({ ...payload, timestamp });
      return;
    }

    response.status(status).json({
      success: false,
      error: {
        code: deriveCode(status),
        message: extractMessage(exception.getResponse(), exception.message),
      },
      timestamp,
    } satisfies ApiErrorResponse);
  }
}
