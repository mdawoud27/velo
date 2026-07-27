import { JobsOptions } from 'bullmq';

export const EMAIL_QUEUE = 'email-queue';
export const EXPORT_QUEUE = 'export-queue';

export enum EmailJobType {
  WELCOME = 'welcome',
  VERIFY_EMAIL = 'verify-email',
  PASSWORD_RESET = 'password-reset',
  INVITATION = 'invitation',
  TASK_ASSIGNED = 'task-assigned',
  MENTION = 'mention',
  COMMENT = 'comment',
  DUE_REMINDER = 'due-reminder',
  SUBSCRIPTION_EXPIRY_WARNING = 'subscription-expiry-warning',
}

export enum ExportJobType {
  PROJECT_TASKS = 'export-project-tasks',
  WEEKLY_TASKS_REPORT = 'scheduled-weekly-tasks',
  BIWEEKLY_PROJECTS_REPORT = 'scheduled-biweekly-projects',
  MONTHLY_ORG_REPORT = 'scheduled-monthly-org',
}

export const EMAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

export const EXPORT_JOB_OPTIONS: JobsOptions = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 10000 },
  removeOnComplete: 50,
  removeOnFail: 20,
};

export const REALTIME_EVICTION_QUEUE = 'realtime-eviction';
export enum RealtimeEvictionJobType {
  EVICT_FROM_ROOM = 'evict-from-room',
}
