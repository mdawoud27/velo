import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base.exception';

export class BannedUserException extends DomainException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'BANNED_USER', 'Your account has been suspended.');
  }
}
