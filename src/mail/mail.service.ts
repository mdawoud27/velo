import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailer: MailerService) {}

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.mailer.sendMail({
      to,
      subject: 'Welcome!',
      template: 'welcome',
      context: { name },
    });
  }

  async sendVerifyEmail(to: string, name: string, verificationUrl: string): Promise<void> {
    await this.mailer.sendMail({
      to,
      subject: 'Verify your email',
      template: 'verify-email',
      context: { name, verificationUrl },
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
    await this.mailer.sendMail({
      to,
      subject: 'Reset your password',
      template: 'password-reset',
      context: { name, resetUrl },
    });
  }
}
