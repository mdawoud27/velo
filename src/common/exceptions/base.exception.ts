import { HttpException } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(
    statusCode: number,
    errorCode: string,
    message: string,
    extra?: Record<string, unknown>,
  ) {
    super(
      {
        success: false,
        statusCode,
        error: errorCode,
        message,
        ...extra,
      },
      statusCode,
    );
  }
}
