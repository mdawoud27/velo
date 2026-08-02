import { SetMetadata } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { ROLES_KEY } from '../constants';

export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);
