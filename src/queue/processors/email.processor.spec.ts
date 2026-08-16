import { EmailProcessor } from './email.processor';
import { EmailJobType } from '../constants/constants';

function makeMail() {
  return {
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    sendVerifyEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendInvitationEmail: jest.fn().mockResolvedValue(undefined),
    sendTaskAssignedEmail: jest.fn().mockResolvedValue(undefined),
    sendMentionEmail: jest.fn().mockResolvedValue(undefined),
    sendCommentEmail: jest.fn().mockResolvedValue(undefined),
    sendDueReminderEmail: jest.fn().mockResolvedValue(undefined),
    sendSubscriptionExpiryWarningEmail: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeLogger() {
  return { log: jest.fn(), error: jest.fn() } as any;
}

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let mail: ReturnType<typeof makeMail>;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    mail = makeMail();
    logger = makeLogger();
    processor = new EmailProcessor(mail, logger);
  });

  it('processes WELCOME email job', async () => {
    const job = {
      id: '1',
      name: EmailJobType.WELCOME,
      data: { to: 'a@b.com', name: 'Alice' },
    } as any;
    await processor.process(job);

    expect(mail.sendWelcomeEmail).toHaveBeenCalledWith('a@b.com', 'Alice');
  });

  it('processes VERIFY_EMAIL job', async () => {
    const job = {
      id: '2',
      name: EmailJobType.VERIFY_EMAIL,
      data: { to: 'a@b.com', name: 'Alice', verificationUrl: 'https://v.url' },
    } as any;
    await processor.process(job);

    expect(mail.sendVerifyEmail).toHaveBeenCalledWith('a@b.com', 'Alice', 'https://v.url');
  });

  it('throws error for unknown job type', async () => {
    const job = { id: '9', name: 'UNKNOWN_JOB', data: {} } as any;
    await expect(processor.process(job)).rejects.toThrow('Unsupported email job type: UNKNOWN_JOB');
  });

  it('onFailed logs job failure details', () => {
    const job = { id: '1', name: EmailJobType.WELCOME, attemptsMade: 3 } as any;
    const err = new Error('SMTP connection refused');

    processor.onFailed(job, err);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Job welcome (id: 1) failed after 3 attempts'),
      err,
      'EmailProcessor',
    );
  });
});
