import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { NotifPreferences } from 'src/notifications/types';
import { EMAIL_JOB_OPTIONS, EMAIL_QUEUE, EmailJobType } from '../constants';
import {
  AssignableTask,
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

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly queue: Queue) {}

  addWelcomeEmail(payload: WelcomeEmailPayload) {
    return this.queue.add(EmailJobType.WELCOME, payload, EMAIL_JOB_OPTIONS);
  }

  addVerifyEmail(payload: VerifyEmailPayload) {
    return this.queue.add(EmailJobType.VERIFY_EMAIL, payload, EMAIL_JOB_OPTIONS);
  }

  addPasswordResetEmail(payload: PasswordResetPayload) {
    return this.queue.add(EmailJobType.PASSWORD_RESET, payload, EMAIL_JOB_OPTIONS);
  }

  addInvitationEmail(payload: InvitationPayload) {
    return this.queue.add(EmailJobType.INVITATION, payload, EMAIL_JOB_OPTIONS);
  }

  async addTaskAssignedEmail(task: AssignableTask): Promise<void> {
    if (!task.assignee) return;

    const prefs = task.assignee.notifPreferences as NotifPreferences | null;
    if (prefs?.emailOnTaskAssigned === false) return;

    await this.queue.add(
      EmailJobType.TASK_ASSIGNED,
      {
        to: task.assignee.email,
        name: task.assignee.name,
        taskTitle: task.title,
        taskUrl: `${process.env.FRONTEND_URL}/tasks/${task.id}`,
      } satisfies TaskAssignedPayload,
      EMAIL_JOB_OPTIONS,
    );
  }

  async addMentionEmail(
    recipient: { email: string; name: string; notifPreferences: unknown },
    payload: Omit<MentionPayload, 'to' | 'name'>,
  ): Promise<void> {
    const prefs = recipient.notifPreferences as NotifPreferences | null;
    if (prefs?.emailOnMention === false) return;

    await this.queue.add(
      EmailJobType.MENTION,
      {
        to: recipient.email,
        name: recipient.name,
        ...payload,
      } satisfies MentionPayload,
      EMAIL_JOB_OPTIONS,
    );
  }

  async addCommentEmail(
    recipient: { email: string; name: string; notifPreferences: unknown },
    payload: Omit<CommentPayload, 'to' | 'name'>,
  ): Promise<void> {
    const prefs = recipient.notifPreferences as NotifPreferences | null;
    if (prefs?.emailOnComment === false) return;

    await this.queue.add(
      EmailJobType.COMMENT,
      {
        to: recipient.email,
        name: recipient.name,
        ...payload,
      } satisfies CommentPayload,
      EMAIL_JOB_OPTIONS,
    );
  }

  async addDueReminderEmail(
    recipient: { email: string; name: string; notifPreferences: unknown },
    payload: Omit<DueReminderPayload, 'to' | 'name'>,
  ): Promise<void> {
    const prefs = recipient.notifPreferences as NotifPreferences | null;
    if (prefs?.emailOnDueReminder === false) return; // explicit opt-out only

    await this.queue.add(
      EmailJobType.DUE_REMINDER,
      {
        to: recipient.email,
        name: recipient.name,
        ...payload,
      } satisfies DueReminderPayload,
      EMAIL_JOB_OPTIONS,
    );
  }

  addSubscriptionExpiryWarning(payload: SubscriptionExpiryWarningPayload) {
    return this.queue.add(EmailJobType.SUBSCRIPTION_EXPIRY_WARNING, payload, EMAIL_JOB_OPTIONS);
  }
}
