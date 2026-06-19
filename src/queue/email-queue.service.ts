import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
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

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly queue: Queue) {}

  addWelcomeEmail(payload: WelcomeEmailPayload) {
    return this.queue.add(EmailJobType.WELCOME, payload);
  }

  addVerifyEmail(payload: VerifyEmailPayload) {
    return this.queue.add(EmailJobType.VERIFY_EMAIL, payload);
  }

  addPasswordResetEmail(payload: PasswordResetPayload) {
    return this.queue.add(EmailJobType.PASSWORD_RESET, payload);
  }
}
