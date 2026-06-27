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
          message: 'Resource already exists',
        });
        break;
      case 'P2025': // Record not found
        response.status(404).json({
          success: false,
          message: 'Resource not found',
        });
        break;
      default:
        response.status(500).json({ success: false, message: 'Database error' });
    }
  }
}
