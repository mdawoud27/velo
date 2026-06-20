import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base.exception';
import { OrgRole } from '../types';

export class InsufficientRoleException extends DomainException {
  constructor(required: OrgRole) {
    super(HttpStatus.FORBIDDEN, 'INSUFFICIENT_ROLE', `This action requires the ${required} role.`);
  }
}
