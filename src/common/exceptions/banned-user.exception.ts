import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base.exception';

export class BannedUserException extends DomainException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'ACCOUNT_BANNED', 'Your account has been suspended.');
  }
}
