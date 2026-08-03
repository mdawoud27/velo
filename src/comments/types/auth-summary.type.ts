import { User } from '@prisma/client';

export type AuthorSummary = Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
