import { OrgRole, SystemRole } from '../types';

export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
  systemRole: SystemRole;
  orgId?: string;
  orgRole?: OrgRole;
}
