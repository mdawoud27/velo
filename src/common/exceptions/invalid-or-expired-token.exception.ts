import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base.exception';

export class InvalidOrExpiredTokenException extends DomainException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'INVALID_OR_EXPIRED_TOKEN',
      'This verification link is invalid or has expired.',
    );
  }
}
