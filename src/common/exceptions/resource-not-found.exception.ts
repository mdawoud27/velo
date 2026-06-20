import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base.exception';

export class ResourceNotFoundException extends DomainException {
  constructor(resource: string, id: string) {
    super(HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND', `${resource} with id '${id}' not found`);
  }
}
