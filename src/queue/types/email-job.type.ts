import { Job } from 'bullmq';
import {
  CommentPayload,
  DueReminderPayload,
  InvitationPayload,
  MentionPayload,
  PasswordResetPayload,
  SubscriptionExpiryWarningPayload,
  TaskAssignedPayload,
  VerifyEmailPayload,
  WelcomeEmailPayload,
} from '../interfaces';
import { EmailJobType } from '../constants';

export type EmailJob =
  | Job<WelcomeEmailPayload, void, EmailJobType.WELCOME>
  | Job<VerifyEmailPayload, void, EmailJobType.VERIFY_EMAIL>
  | Job<PasswordResetPayload, void, EmailJobType.PASSWORD_RESET>
  | Job<InvitationPayload, void, EmailJobType.INVITATION>
  | Job<TaskAssignedPayload, void, EmailJobType.TASK_ASSIGNED>
  | Job<MentionPayload, void, EmailJobType.MENTION>
  | Job<CommentPayload, void, EmailJobType.COMMENT>
  | Job<DueReminderPayload, void, EmailJobType.DUE_REMINDER>
  | Job<SubscriptionExpiryWarningPayload, void, EmailJobType.SUBSCRIPTION_EXPIRY_WARNING>;
