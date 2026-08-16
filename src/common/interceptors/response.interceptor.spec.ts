import { of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { ResponseInterceptor } from './response.interceptor';
import { ServiceMessage } from '../classes/service-message';

function makeInterceptor(message?: string) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(message),
  } as unknown as Reflector;
  return new ResponseInterceptor(reflector);
}

function makeHandler(value: unknown): CallHandler {
  return { handle: () => of(value) } as CallHandler;
}

describe('ResponseInterceptor', () => {
  it('wraps a plain object in the success envelope', (done) => {
    const interceptor = makeInterceptor();
    const ctx = { getHandler: jest.fn(), getClass: jest.fn() } as unknown as ExecutionContext;

    interceptor.intercept(ctx, makeHandler({ id: '1', name: 'test' })).subscribe((result) => {
      expect(result.success).toBe(true);
      expect((result as any).data).toEqual({ id: '1', name: 'test' });
      expect((result as any).timestamp).toBeDefined();
      done();
    });
  });

  it('sets data: null when handler returns null', (done) => {
    const interceptor = makeInterceptor();
    const ctx = { getHandler: jest.fn(), getClass: jest.fn() } as unknown as ExecutionContext;

    interceptor.intercept(ctx, makeHandler(null)).subscribe((result) => {
      expect((result as any).data).toBeNull();
      done();
    });
  });

  it('sets data: null when handler returns undefined', (done) => {
    const interceptor = makeInterceptor();
    const ctx = { getHandler: jest.fn(), getClass: jest.fn() } as unknown as ExecutionContext;

    interceptor.intercept(ctx, makeHandler(undefined)).subscribe((result) => {
      expect((result as any).data).toBeNull();
      done();
    });
  });

  it('includes the custom @ResponseMessage when metadata is set', (done) => {
    const interceptor = makeInterceptor('Created successfully');
    const ctx = { getHandler: jest.fn(), getClass: jest.fn() } as unknown as ExecutionContext;

    interceptor.intercept(ctx, makeHandler({ id: '42' })).subscribe((result) => {
      expect((result as any).message).toBe('Created successfully');
      done();
    });
  });

  it('does NOT include message key when no @ResponseMessage is set', (done) => {
    const interceptor = makeInterceptor(undefined);
    const ctx = { getHandler: jest.fn(), getClass: jest.fn() } as unknown as ExecutionContext;

    interceptor.intercept(ctx, makeHandler({ id: '42' })).subscribe((result) => {
      expect(result).not.toHaveProperty('message');
      done();
    });
  });

  it('handles a ServiceMessage by returning data: null with the message string', (done) => {
    const interceptor = makeInterceptor();
    const ctx = { getHandler: jest.fn(), getClass: jest.fn() } as unknown as ExecutionContext;
    const msg = new ServiceMessage('Invitation sent');

    interceptor.intercept(ctx, makeHandler(msg)).subscribe((result) => {
      expect(result.success).toBe(true);
      expect((result as any).data).toBeNull();
      expect((result as any).message).toBe('Invitation sent');
      done();
    });
  });

  it('handles a paginated payload by including data array and meta', (done) => {
    const interceptor = makeInterceptor();
    const ctx = { getHandler: jest.fn(), getClass: jest.fn() } as unknown as ExecutionContext;
    const paginated = {
      data: [{ id: '1' }, { id: '2' }],
      meta: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    interceptor.intercept(ctx, makeHandler(paginated)).subscribe((result) => {
      expect(result.success).toBe(true);
      expect((result as any).data).toEqual(paginated.data);
      expect((result as any).meta).toEqual(paginated.meta);
      done();
    });
  });

  it('always includes a non-empty timestamp string', (done) => {
    const interceptor = makeInterceptor();
    const ctx = { getHandler: jest.fn(), getClass: jest.fn() } as unknown as ExecutionContext;

    interceptor.intercept(ctx, makeHandler('hello')).subscribe((result) => {
      expect(typeof (result as any).timestamp).toBe('string');
      expect((result as any).timestamp.length).toBeGreaterThan(0);
      done();
    });
  });
});
