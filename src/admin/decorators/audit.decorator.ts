import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { AuditInterceptor } from '../interceptors';
import { AUDIT_ACTION_KEY } from '../constants';

export const Audit = (action: string) =>
  applyDecorators(SetMetadata(AUDIT_ACTION_KEY, action), UseInterceptors(AuditInterceptor));
