import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';

function makePrisma() {
  return {
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  } as any;
}

function makeLogger() {
  return {
    error: jest.fn(),
  } as any;
}

function makeReflector(action?: string) {
  return {
    get: jest.fn().mockReturnValue(action),
  } as unknown as Reflector;
}

function makeContext(
  params: Record<string, any> = {},
  user: any = { sub: 'admin-1' },
): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user, params }),
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(resultData = { success: true }): CallHandler {
  return {
    handle: jest.fn().mockReturnValue(of(resultData)),
  };
}

describe('AuditInterceptor', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    prisma = makePrisma();
    logger = makeLogger();
  });

  it('passes through directly if no AUDIT_ACTION_KEY metadata is found', async () => {
    const reflector = makeReflector(undefined);
    const interceptor = new AuditInterceptor(reflector, prisma, logger);
    const ctx = makeContext();
    const handler = makeHandler();

    const result$ = await interceptor.intercept(ctx, handler);
    result$.subscribe((val) => {
      expect(val).toEqual({ success: true });
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  it('writes audit log and preserves response when action metadata is present', (done) => {
    const reflector = makeReflector('admin.user.banned');
    const interceptor = new AuditInterceptor(reflector, prisma, logger);
    const ctx = makeContext({ userId: 'u-123' }, { sub: 'admin-1' });
    const handler = makeHandler({ res: 'ok' });

    interceptor.intercept(ctx, handler).subscribe((res) => {
      expect(res).toEqual({ res: 'ok' });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin-1',
          action: 'admin.user.banned',
          targetType: 'User',
          targetId: 'u-123',
          metadata: { params: { userId: 'u-123' } },
        },
      });
      done();
    });
  });

  it('handles auditLog.create errors gracefully without failing request', (done) => {
    prisma.auditLog.create.mockRejectedValueOnce(new Error('DB write failed'));
    const reflector = makeReflector('admin.user.banned');
    const interceptor = new AuditInterceptor(reflector, prisma, logger);
    const ctx = makeContext({ userId: 'u-123' });
    const handler = makeHandler({ res: 'ok' });

    interceptor.intercept(ctx, handler).subscribe((res) => {
      expect(res).toEqual({ res: 'ok' });
      expect(logger.error).toHaveBeenCalledWith(
        'Audit log write failed',
        expect.any(Error),
        'AuditInterceptor',
      );
      done();
    });
  });
});
