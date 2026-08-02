import { EMAIL_QUEUE, EXPORT_QUEUE } from 'src/queue/constants';

export const MANAGED_QUEUES = [EMAIL_QUEUE, EXPORT_QUEUE];

export const VALID_QUEUE_NAMES = [EMAIL_QUEUE, EXPORT_QUEUE] as const;

export const KNOWN_QUEUES: Record<string, string> = {
  [EMAIL_QUEUE]: EMAIL_QUEUE,
  [EXPORT_QUEUE]: EXPORT_QUEUE,
};

export const AUDIT_ACTION_KEY = 'audit:action';
