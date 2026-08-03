import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { LoggerService } from '../../logger/logger.service';
import { MailService } from '../../mail/mail.service';
import { EMAIL_QUEUE, EmailJobType } from '../constants/constants';
import { EmailJob } from '../types';
import { DueReminderPayload } from '../interfaces';

@Processor(EMAIL_QUEUE, { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  constructor(
    private readonly mail: MailService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async process(job: EmailJob): Promise<void> {
    const jobName: string = job.name;

    this.logger.log(`Processing job ${jobName} (id: ${job.id})`, 'EmailProcessor');

    switch (job.name) {
      case EmailJobType.WELCOME:
        await this.mail.sendWelcomeEmail(job.data.to, job.data.name);
        break;

      case EmailJobType.VERIFY_EMAIL:
        await this.mail.sendVerifyEmail(job.data.to, job.data.name, job.data.verificationUrl);
        break;

      case EmailJobType.PASSWORD_RESET:
        await this.mail.sendPasswordResetEmail(job.data.to, job.data.name, job.data.resetUrl);
        break;

      case EmailJobType.INVITATION:
        await this.mail.sendInvitationEmail(
          job.data.to,
          job.data.orgName,
          job.data.role,
          job.data.inviterName,
          job.data.invitationUrl,
          job.data.declineInvitationUrl,
        );
        break;

      case EmailJobType.TASK_ASSIGNED:
        await this.mail.sendTaskAssignedEmail(
          job.data.to,
          job.data.name,
          job.data.taskTitle,
          job.data.taskUrl,
        );
        break;

      case EmailJobType.MENTION:
        await this.mail.sendMentionEmail(
          job.data.to,
          job.data.name,
          job.data.mentionedBy,
          job.data.taskTitle,
          job.data.commentBody,
          job.data.taskUrl,
        );
        break;

      case EmailJobType.COMMENT:
        await this.mail.sendCommentEmail(
          job.data.to,
          job.data.name,
          job.data.commenterName,
          job.data.taskTitle,
          job.data.commentBody,
          job.data.taskUrl,
        );
        break;

      case EmailJobType.DUE_REMINDER:
        await this.handleDueReminder(job.data);
        break;

      case EmailJobType.SUBSCRIPTION_EXPIRY_WARNING:
        await this.mail.sendSubscriptionExpiryWarningEmail(
          job.data.email,
          job.data.orgName,
          job.data.expiresAt,
        );
        break;

      default:
        this.logger.error(`Unknown job type: ${jobName}`, undefined, 'EmailProcessor');
        throw new Error(`Unsupported email job type: ${jobName}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: EmailJob | undefined, error: Error) {
    if (!job) {
      this.logger.error(
        `Email job failed before job metadata was available: ${error.message}`,
        error,
        'EmailProcessor',
      );
      return;
    }
    this.logger.error(
      `Job ${job.name} (id: ${job.id}) failed after ${job.attemptsMade} attempts: ${error.message}`,
      error,
      'EmailProcessor',
    );
  }

  private async handleDueReminder(data: DueReminderPayload): Promise<void> {
    await this.mail.sendDueReminderEmail(
      data.to,
      data.name,
      data.taskTitle,
      data.dueDate,
      data.taskUrl,
    );
  }
}
