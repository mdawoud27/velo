import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { STATUS_CODE_MAP } from '../constants';

@Catch(HttpException)
export class HttpResponseFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const timestamp = new Date().toISOString();

    const exceptionResponse = exception.getResponse();

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'error' in exceptionResponse
    ) {
      return response
        .status(status)
        .json({ ...(exceptionResponse as Record<string, unknown>), timestamp });
    }

    const rawMessage =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as Record<string, unknown>).message;

    response.status(status).json({
      success: false,
      error: {
        code: STATUS_CODE_MAP[status] ?? 'INTERNAL_SERVER_ERROR',
        message: typeof rawMessage === 'string' ? rawMessage : 'An error occurred',
      },
      timestamp,
    });
  }
}
