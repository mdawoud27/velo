import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from '../logger/logger.service';
import { MailService } from '../mail/mail.service';
import { EMAIL_QUEUE, EmailJobType } from './constants';
import type {
  InvitationPayload,
  PasswordResetPayload,
  VerifyEmailPayload,
  WelcomeEmailPayload,
} from './email-queue.service';

type EmailJob =
  | Job<WelcomeEmailPayload, void, EmailJobType.WELCOME>
  | Job<VerifyEmailPayload, void, EmailJobType.VERIFY_EMAIL>
  | Job<PasswordResetPayload, void, EmailJobType.PASSWORD_RESET>
  | Job<InvitationPayload, void, EmailJobType.INVITATION>;

@Processor(EMAIL_QUEUE)
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
}
