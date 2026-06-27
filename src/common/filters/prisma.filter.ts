import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Response } from 'express';

@Catch(PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
      case 'P2002': // Unique constraint violation
        response.status(409).json({
          success: false,
          statusCode: 409,
          message: 'Resource already exists',
          timestamp: new Date().toISOString(),
        });
        break;
      case 'P2025': // Record not found
        response.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Resource not found',
          timestamp: new Date().toISOString(),
        });
        break;
      default:
        response.status(500).json({
          success: false,
          statusCode: 500,
          message: 'Database error',
          timestamp: new Date().toISOString(),
        });
    }
  }
}
