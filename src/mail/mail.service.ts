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
  async sendInvitationEmail(
    to: string,
    orgName: string,
    role: string,
    inviterName: string,
    invitationUrl: string,
    declineInvitationUrl: string,
  ): Promise<void> {
    await this.mailer.sendMail({
      to,
      subject: `You're invited to join ${orgName}`,
      template: 'invitation',
      context: {
        orgName,
        role,
        inviterName,
        invitationUrl,
        declineInvitationUrl,
      },
    });
  }

  async sendDueReminderEmail(
    to: string,
    name: string,
    taskTitle: string,
    dueDate: string,
    taskUrl: string,
  ): Promise<void> {
    await this.mailer.sendMail({
      to,
      subject: `Task due soon: ${taskTitle}`,
      template: 'due-reminder',
      context: {
        name,
        taskTitle,
        dueDate,
        taskUrl,
      },
    });
  }

  async sendTaskAssignedEmail(
    to: string,
    name: string,
    taskTitle: string,
    taskUrl: string,
  ): Promise<void> {
    await this.mailer.sendMail({
      to,
      subject: `Task assigned: ${taskTitle}`,
      template: 'task-assigned',
      context: {
        name,
        taskTitle,
        taskUrl,
      },
    });
  }

  async sendMentionEmail(
    to: string,
    name: string,
    mentionedBy: string,
    taskTitle: string,
    commentBody: string,
    taskUrl: string,
  ): Promise<void> {
    await this.mailer.sendMail({
      to,
      subject: `${mentionedBy} mentioned you in a comment`,
      template: 'mention',
      context: {
        name,
        mentionedBy,
        taskTitle,
        commentBody,
        taskUrl,
      },
    });
  }

  async sendCommentEmail(
    to: string,
    name: string,
    commenterName: string,
    taskTitle: string,
    commentBody: string,
    taskUrl: string,
  ): Promise<void> {
    await this.mailer.sendMail({
      to,
      subject: `New comment on ${taskTitle}`,
      template: 'comment',
      context: {
        name,
        commenterName,
        taskTitle,
        commentBody,
        taskUrl,
      },
    });
  }

  async sendMail(options: Parameters<MailerService['sendMail']>[0]): Promise<void> {
    await this.mailer.sendMail(options);
  }
}
