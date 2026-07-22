export const EMAIL_QUEUE = 'email-queue';

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

export const REALTIME_EVICTION_QUEUE = 'realtime-eviction';

export enum RealtimeEvictionJobType {
  EVICT_FROM_ROOM = 'evict-from-room',
}
