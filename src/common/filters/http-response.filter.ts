import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as Record<string, unknown>).message;

    const isValidationError = Array.isArray(message);

    response.status(status).json({
      success: false,
      error: isValidationError
        ? {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: (message as string[]).map((m) => ({ message: m })),
          }
        : {
            code: exception.constructor.name.replace('Exception', '').toUpperCase(),
            message: typeof message === 'string' ? message : 'An error occurred',
          },
      timestamp: new Date().toISOString(),
    });
  }
}
