import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Response } from 'express';
import { PrismaErrorShape } from '../interfaces';

@Catch(PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly errorMap: Partial<Record<string, PrismaErrorShape>> = {
    P2002: {
      status: HttpStatus.CONFLICT,
      code: 'ALREADY_EXISTS',
      message: 'Resource already exists',
    },
    P2025: {
      status: HttpStatus.NOT_FOUND,
      code: 'NOT_FOUND',
      message: 'Resource not found',
    },
    P2003: {
      status: HttpStatus.BAD_REQUEST,
      code: 'FOREIGN_KEY_VIOLATION',
      message: 'Related resource does not exist',
    },
    P2014: {
      status: HttpStatus.BAD_REQUEST,
      code: 'RELATION_VIOLATION',
      message: 'This operation would violate a required relation',
    },
  };

  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const mapped = this.errorMap[exception.code] ?? {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'DATABASE_ERROR',
      message: 'An unexpected database error occurred',
    };

    response.status(mapped.status).json({
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
