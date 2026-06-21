import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base.exception';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
}
