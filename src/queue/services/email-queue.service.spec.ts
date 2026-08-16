import { EmailQueueService } from './email-queue.service';
import { EmailJobType, EMAIL_JOB_OPTIONS } from '../constants/constants';

function makeQueue() {
  return { add: jest.fn().mockResolvedValue({ id: 'job-1' }) } as any;
}

describe('EmailQueueService', () => {
  let service: EmailQueueService;
  let queue: ReturnType<typeof makeQueue>;

  beforeEach(() => {
    queue = makeQueue();
    service = new EmailQueueService(queue);
  });

  it('addWelcomeEmail enqueues a WELCOME job', async () => {
    const payload = { to: 'a@b.com', name: 'Alice' };
    await service.addWelcomeEmail(payload as any);
    expect(queue.add).toHaveBeenCalledWith(EmailJobType.WELCOME, payload, EMAIL_JOB_OPTIONS);
  });

  it('addVerifyEmail enqueues a VERIFY_EMAIL job', async () => {
    const payload = { to: 'a@b.com', name: 'Alice', verificationUrl: 'https://v.url' };
    await service.addVerifyEmail(payload as any);
    expect(queue.add).toHaveBeenCalledWith(EmailJobType.VERIFY_EMAIL, payload, EMAIL_JOB_OPTIONS);
  });

  it('addPasswordResetEmail enqueues a PASSWORD_RESET job', async () => {
    const payload = { to: 'a@b.com', name: 'Alice', resetUrl: 'https://r.url' };
    await service.addPasswordResetEmail(payload as any);
    expect(queue.add).toHaveBeenCalledWith(EmailJobType.PASSWORD_RESET, payload, EMAIL_JOB_OPTIONS);
  });

  it('addInvitationEmail enqueues an INVITATION job', async () => {
    const payload = { to: 'a@b.com', inviterName: 'Bob', orgName: 'Acme' };
    await service.addInvitationEmail(payload as any);
    expect(queue.add).toHaveBeenCalledWith(EmailJobType.INVITATION, payload, EMAIL_JOB_OPTIONS);
  });

  it('addSubscriptionExpiryWarning enqueues correct job', async () => {
    const payload = { email: 'o@a.com', orgName: 'Acme', expiresAt: new Date() };
    await service.addSubscriptionExpiryWarning(payload as any);
    expect(queue.add).toHaveBeenCalledWith(
      EmailJobType.SUBSCRIPTION_EXPIRY_WARNING,
      payload,
      EMAIL_JOB_OPTIONS,
    );
  });

  describe('addTaskAssignedEmail', () => {
    it('enqueues when assignee exists', async () => {
      const task = {
        id: 't-1',
        title: 'My Task',
        assignee: { email: 'a@b.com', name: 'Alice', notifPreferences: null },
      };
      await service.addTaskAssignedEmail(task as any);
      expect(queue.add).toHaveBeenCalledWith(
        EmailJobType.TASK_ASSIGNED,
        expect.objectContaining({ to: 'a@b.com', taskTitle: 'My Task' }),
        EMAIL_JOB_OPTIONS,
      );
    });

    it('does not enqueue when there is no assignee', async () => {
      await service.addTaskAssignedEmail({ id: 't-1', title: 'X', assignee: null } as any);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('does not enqueue when assignee opted out', async () => {
      const task = {
        id: 't-1',
        title: 'X',
        assignee: {
          email: 'a@b.com',
          name: 'Alice',
          notifPreferences: { emailOnTaskAssigned: false },
        },
      };
      await service.addTaskAssignedEmail(task as any);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('addMentionEmail', () => {
    it('enqueues when prefs allow', async () => {
      const recipient = { email: 'a@b.com', name: 'Alice', notifPreferences: null };
      await service.addMentionEmail(recipient, { commentBody: 'Hi' } as any);
      expect(queue.add).toHaveBeenCalledWith(
        EmailJobType.MENTION,
        expect.objectContaining({ to: 'a@b.com' }),
        EMAIL_JOB_OPTIONS,
      );
    });

    it('does not enqueue when opted out', async () => {
      const recipient = {
        email: 'a@b.com',
        name: 'Alice',
        notifPreferences: { emailOnMention: false },
      };
      await service.addMentionEmail(recipient, { commentBody: 'Hi' } as any);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('addCommentEmail', () => {
    it('enqueues when prefs allow', async () => {
      const recipient = { email: 'a@b.com', name: 'Alice', notifPreferences: null };
      await service.addCommentEmail(recipient, { commentBody: 'Nice!' } as any);
      expect(queue.add).toHaveBeenCalledWith(
        EmailJobType.COMMENT,
        expect.objectContaining({ to: 'a@b.com' }),
        EMAIL_JOB_OPTIONS,
      );
    });

    it('does not enqueue when opted out', async () => {
      const recipient = {
        email: 'a@b.com',
        name: 'Alice',
        notifPreferences: { emailOnComment: false },
      };
      await service.addCommentEmail(recipient, { commentBody: 'Nice!' } as any);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('addDueReminderEmail', () => {
    it('enqueues when prefs allow', async () => {
      const recipient = { email: 'a@b.com', name: 'Alice', notifPreferences: null };
      await service.addDueReminderEmail(recipient, { taskTitle: 'T1' } as any);
      expect(queue.add).toHaveBeenCalledWith(
        EmailJobType.DUE_REMINDER,
        expect.objectContaining({ to: 'a@b.com' }),
        EMAIL_JOB_OPTIONS,
      );
    });

    it('does not enqueue when opted out', async () => {
      const recipient = {
        email: 'a@b.com',
        name: 'Alice',
        notifPreferences: { emailOnDueReminder: false },
      };
      await service.addDueReminderEmail(recipient, { taskTitle: 'T1' } as any);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });
});
