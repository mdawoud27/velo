import { Comment, User } from '@prisma/client';
import { Exclude } from 'class-transformer';

type AuthorSummary = Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;

type CommentWithAuthor = Comment & {
  author?: AuthorSummary;
};

export class CommentEntity implements Comment {
  id: string;
  body: string;
  taskId: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;

  @Exclude() deletedAt: Date | null;

  author?: AuthorSummary;

  constructor(comment: CommentWithAuthor) {
    Object.assign(this, comment);
  }
}
