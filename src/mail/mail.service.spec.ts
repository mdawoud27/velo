import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

function makeMailer() {
  return {
    sendMail: jest.fn().mockResolvedValue(true),
  } as unknown as MailerService;
}

describe('MailService', () => {
  let service: MailService;
  let mailer: jest.Mocked<MailerService>;

  beforeEach(() => {
    mailer = makeMailer() as any;
    service = new MailService(mailer);
  });

  it('sendWelcomeEmail sends welcome template', async () => {
    await service.sendWelcomeEmail('user@test.com', 'John');

    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'user@test.com',
      subject: 'Welcome!',
      template: 'welcome',
      context: { name: 'John' },
    });
  });

  it('sendVerifyEmail sends verify-email template', async () => {
    await service.sendVerifyEmail('user@test.com', 'John', 'https://verify.url');

    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'user@test.com',
      subject: 'Verify your email',
      template: 'verify-email',
      context: { name: 'John', verificationUrl: 'https://verify.url' },
    });
  });

  it('sendPasswordResetEmail sends password-reset template', async () => {
    await service.sendPasswordResetEmail('user@test.com', 'John', 'https://reset.url');

    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'user@test.com',
      subject: 'Reset your password',
      template: 'password-reset',
      context: { name: 'John', resetUrl: 'https://reset.url' },
    });
  });

  it('sendInvitationEmail sends invitation template', async () => {
    await service.sendInvitationEmail(
      'user@test.com',
      'Acme Corp',
      'ADMIN',
      'Alice',
      'https://invite.url',
      'https://decline.url',
    );

    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'user@test.com',
      subject: "You're invited to join Acme Corp",
      template: 'invitation',
      context: {
        orgName: 'Acme Corp',
        role: 'ADMIN',
        inviterName: 'Alice',
        invitationUrl: 'https://invite.url',
        declineInvitationUrl: 'https://decline.url',
      },
    });
  });

  it('sendDueReminderEmail sends due-reminder template', async () => {
    await service.sendDueReminderEmail(
      'user@test.com',
      'John',
      'Fix bug',
      '2026-08-20',
      'https://task.url',
    );

    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'user@test.com',
      subject: 'Task due soon: Fix bug',
      template: 'due-reminder',
      context: {
        name: 'John',
        taskTitle: 'Fix bug',
        dueDate: '2026-08-20',
        taskUrl: 'https://task.url',
      },
    });
  });
});
