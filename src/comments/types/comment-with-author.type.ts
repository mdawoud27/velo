import { Comment } from '@prisma/client';
import { AuthorSummary } from './auth-summary.type';

export type CommentWithAuthor = Comment & {
  author?: AuthorSummary;
};
