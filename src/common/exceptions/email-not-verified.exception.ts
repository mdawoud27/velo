import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base.exception';

export class EmailNotVerifiedException extends DomainException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'EMAIL_NOT_VERIFIED', 'Email is not verified.');
  }
}
