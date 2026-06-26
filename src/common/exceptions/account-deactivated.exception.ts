import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base.exception';

export class AccountDeactivatedException extends DomainException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'ACCOUNT_DEACTIVATED', 'Your account has been deactivated.');
  }
}
