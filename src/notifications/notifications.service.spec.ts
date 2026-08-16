import { NotificationsService } from './notifications.service';

function makePrisma() {
  return {
    notification: {
      create: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ id: 'notif-1', ...data })),
      createManyAndReturn: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve(data.map((item: any, idx: number) => ({ id: `notif-${idx}`, ...item }))),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as any;
}

function makeGateway() {
  return {
    emitNotification: jest.fn(),
  } as any;
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof makePrisma>;
  let gateway: ReturnType<typeof makeGateway>;

  beforeEach(() => {
    prisma = makePrisma();
    gateway = makeGateway();
    service = new NotificationsService(prisma, gateway);
  });

  it('create saves notification to DB and emits realtime notification', async () => {
    const dto = {
      userId: 'u-1',
      type: 'TASK_ASSIGNED',
      title: 'New Task',
      body: 'Assigned to fix bug',
      entityType: 'Task',
      entityId: 't-1',
    };

    await service.create(dto);

    expect(prisma.notification.create).toHaveBeenCalledWith({ data: dto });
    expect(gateway.emitNotification).toHaveBeenCalledWith('u-1', expect.objectContaining(dto));
  });

  it('createBulk creates many notifications and emits for each recipient', async () => {
    const list = [
      { userId: 'u-1', type: 'INFO', title: 'T1', body: 'B1', entityType: 'Task', entityId: 't-1' },
      { userId: 'u-2', type: 'INFO', title: 'T2', body: 'B2', entityType: 'Task', entityId: 't-2' },
    ];

    await service.createBulk(list);

    expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith({ data: list });
    expect(gateway.emitNotification).toHaveBeenCalledTimes(2);
  });

  it('markAsRead updates notification matching id and userId', async () => {
    await service.markAsRead('notif-1', 'u-1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif-1', userId: 'u-1' },
      data: { isRead: true },
    });
  });

  it('markAllAsRead updates all unread notifications for userId', async () => {
    await service.markAllAsRead('u-1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', isRead: false },
      data: { isRead: true },
    });
  });
});
