import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base.exception';

export class EmailAlreadyRegisteredException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, 'EMAIL_REGISTERED', 'Email is already registered.');
  }
}
