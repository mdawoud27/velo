import type { User } from '@prisma/client';

export type TokenUser = Pick<User, 'id' | 'email' | 'systemRole'>;
