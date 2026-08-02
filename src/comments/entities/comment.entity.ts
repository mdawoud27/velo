import { Comment } from '@prisma/client';
import { Exclude } from 'class-transformer';
import { AuthorSummary, CommentWithAuthor } from '../types';

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
