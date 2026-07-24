import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { AuditInterceptor } from '../interceptors';

export const AUDIT_ACTION_KEY = 'audit:action';

export const Audit = (action: string) =>
  applyDecorators(SetMetadata(AUDIT_ACTION_KEY, action), UseInterceptors(AuditInterceptor));
