import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { EMAIL_QUEUE, EmailJobType } from './constants';

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
}
