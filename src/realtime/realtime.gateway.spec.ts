import { WsException } from '@nestjs/websockets';
import { RealtimeGateway } from './realtime.gateway';

function makePrisma() {
  return {
    orgMember: { findUnique: jest.fn() },
    teamMember: { findUnique: jest.fn() },
    projectMember: { findUnique: jest.fn() },
  } as any;
}

function makeJwtService() {
  return { verify: jest.fn() } as any;
}

function makeTokensService() {
  return { isIssuedBeforeRevocation: jest.fn().mockResolvedValue(false) } as any;
}

function makeServer() {
  const toEmit = { emit: jest.fn() };
  return {
    to: jest.fn().mockReturnValue(toEmit),
    in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
    __toEmit: toEmit,
  } as any;
}

function makeSocket(userId = 'u-1') {
  return {
    id: 'sock-1',
    data: { user: { sub: userId } },
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    on: jest.fn(),
    rooms: new Set(['sock-1']),
  } as any;
}

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let prisma: ReturnType<typeof makePrisma>;
  let server: ReturnType<typeof makeServer>;

  beforeEach(() => {
    prisma = makePrisma();
    server = makeServer();
    gateway = new RealtimeGateway(prisma, makeJwtService(), makeTokensService());
    gateway.server = server;
  });

  describe('handleConnection', () => {
    it('joins user personal room', async () => {
      const client = makeSocket('user-100');
      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('user:user-100');
    });
  });

  describe('room joins', () => {
    it('handleJoinOrg joins org room when membership exists', async () => {
      prisma.orgMember.findUnique.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org-1' });
      const client = makeSocket('u-1');

      await gateway.handleJoinOrg(client, { orgId: 'org-1' });

      expect(client.join).toHaveBeenCalledWith('org:org-1');
      expect(client.emit).toHaveBeenCalledWith('joined', { scope: 'org', orgId: 'org-1' });
    });

    it('handleJoinOrg throws WsException when membership does not exist', async () => {
      prisma.orgMember.findUnique.mockResolvedValueOnce(null);
      const client = makeSocket('u-1');

      await expect(gateway.handleJoinOrg(client, { orgId: 'org-1' })).rejects.toThrow(WsException);
    });
  });

  describe('emitters', () => {
    it('emitTaskCreated emits to project room', () => {
      gateway.emitTaskCreated('p-1', { id: 't-1' } as any);
      expect(server.to).toHaveBeenCalledWith('project:p-1');
      expect(server.__toEmit.emit).toHaveBeenCalledWith('task:created', { id: 't-1' });
    });

    it('emitNotification emits to user personal room', () => {
      gateway.emitNotification('u-1', { title: 'Hello' });
      expect(server.to).toHaveBeenCalledWith('user:u-1');
      expect(server.__toEmit.emit).toHaveBeenCalledWith('notification', { title: 'Hello' });
    });
  });
});
