import { HttpException } from '@nestjs/common';
import { ErrorCode } from '../types';

export class DomainException extends HttpException {
  constructor(
    statusCode: number,
    errorCode: ErrorCode,
    message: string,
    extra?: Record<string, unknown>,
  ) {
    super(
      {
        success: false,
        error: {
          code: errorCode,
          message,
        },
        ...extra,
      },
      statusCode,
    );
  }
}
