import { requestIdMiddleware } from './request-id.middleware';
import { Request, Response, NextFunction } from 'express';

function makeReq(existingId?: string): Partial<Request> {
  return {
    headers: existingId ? { 'x-request-id': existingId } : {},
  };
}

function makeRes(): { setHeader: jest.Mock } {
  return { setHeader: jest.fn() };
}

describe('requestIdMiddleware', () => {
  it('calls next()', () => {
    const next: NextFunction = jest.fn();
    requestIdMiddleware(makeReq() as Request, makeRes() as unknown as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('echoes an existing x-request-id header back on the response', () => {
    const res = makeRes();
    const next: NextFunction = jest.fn();
    requestIdMiddleware(makeReq('my-trace-id') as Request, res as unknown as Response, next);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'my-trace-id');
  });

  it('generates a UUID when no x-request-id header is present', () => {
    const res = makeRes();
    const next: NextFunction = jest.fn();
    requestIdMiddleware(makeReq() as Request, res as unknown as Response, next);

    const [header, value] = res.setHeader.mock.calls[0];
    expect(header).toBe('x-request-id');
    // UUID v4 pattern
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates a different UUID for each request', () => {
    const res1 = makeRes();
    const res2 = makeRes();
    const next: NextFunction = jest.fn();

    requestIdMiddleware(makeReq() as Request, res1 as unknown as Response, next);
    requestIdMiddleware(makeReq() as Request, res2 as unknown as Response, next);

    const id1 = res1.setHeader.mock.calls[0][1];
    const id2 = res2.setHeader.mock.calls[0][1];
    expect(id1).not.toBe(id2);
  });
});
