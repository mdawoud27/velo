import { Priority, TaskStatus } from '@prisma/client';

export const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: 'FFF5F5F5',
  IN_PROGRESS: 'FFFFF3CD',
  IN_REVIEW: 'FFD1ECF1',
  DONE: 'FFD4EDDA',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: 'FFF0FFF4',
  MEDIUM: 'FFFFFCE7',
  HIGH: 'FFFFF3CD',
  URGENT: 'FFFCE8E8',
};

export const HEADER_COLOR = 'FF2D3748';
export const HEADER_FONT_COLOR = 'FFFFFFFF';
