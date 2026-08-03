import { OrgMember } from '@prisma/client';

export type TokenOrgMembership = Pick<OrgMember, 'orgId' | 'role'>;
