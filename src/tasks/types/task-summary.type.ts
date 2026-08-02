import { User } from '@prisma/client';
export type TaskUserSummary = Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
