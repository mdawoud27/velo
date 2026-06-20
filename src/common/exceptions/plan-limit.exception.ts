import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base.exception';

export class PlanLimitException extends DomainException {
  constructor(message: string, upgradeUrl?: string) {
    super(HttpStatus.FORBIDDEN, 'PLAN_LIMIT_REACHED', message, {
      upgradeUrl: upgradeUrl ?? 'https://velo.app/billing',
    });
  }
}
