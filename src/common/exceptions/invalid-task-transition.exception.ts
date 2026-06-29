import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base.exception';
import { TaskStatus } from '../types';

export class InvalidTaskTransitionException extends DomainException {
  constructor(from: TaskStatus, to: TaskStatus) {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'INVALID_TASK_TRANSITION',
      `Cannot transition task from ${from} to ${to}`,
    );
  }
}
