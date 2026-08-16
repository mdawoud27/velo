import { WsException } from '@nestjs/websockets';
import { WsJwtGuard } from './ws-jwt.guard';

function makeContext(user?: object) {
  return {
    switchToWs: () => ({
      getClient: () => ({ data: { user } }),
    }),
  } as any;
}

describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;

  beforeEach(() => {
    guard = new WsJwtGuard();
  });

  it('returns true when the socket has an authenticated user', () => {
    const ctx = makeContext({ sub: 'user-1', email: 'a@b.com' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws WsException when the socket has no user (data.user is undefined)', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(WsException);
  });

  it('throws WsException when the socket has no user (data.user is null)', () => {
    const ctx = makeContext(null);
    expect(() => guard.canActivate(ctx)).toThrow(WsException);
  });

  it('WsException message is "Unauthenticated"', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow('Unauthenticated');
  });
});
