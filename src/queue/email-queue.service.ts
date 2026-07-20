import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { EMAIL_QUEUE, EmailJobType } from './constants';
import { NotifPreferences } from 'src/notifications/types';

export interface WelcomeEmailPayload {
  to: string;
  name: string;
}

export interface VerifyEmailPayload {
  to: string;
  name: string;
  verificationUrl: string;
}

export interface PasswordResetPayload {
  to: string;
  name: string;
  resetUrl: string;
}

export interface TaskAssignedPayload {
  to: string;
  name: string;
  taskTitle: string;
  taskUrl: string;
}

export interface MentionPayload {
  to: string;
  name: string;
  mentionedBy: string;
  taskTitle: string;
  commentBody: string;
  taskUrl: string;
}

export interface CommentPayload {
  to: string;
  name: string;
  commenterName: string;
  taskTitle: string;
  commentBody: string;
  taskUrl: string;
}

export interface DueReminderPayload {
  to: string;
  name: string;
  taskTitle: string;
  dueDate: string;
  taskUrl: string;
}

export interface InvitationPayload {
  to: string;
  orgName: string;
  role: string;
  inviterName: string;
  invitationUrl: string;
  declineInvitationUrl: string;
}

interface AssignableTask {
  id: string;
  title: string;
  assignee: {
    email: string;
    name: string;
    notifPreferences: unknown;
  } | null;
}

const EMAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

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
        taskUrl: `${process.env.CLIENT_URL}/tasks/${task.id}`,
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
}
