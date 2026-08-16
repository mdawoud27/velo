import { HttpStatus } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaExceptionFilter } from './prisma.filter';

function makeHost(mockResponse: { status: jest.Mock; json: jest.Mock }) {
  return {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
    }),
  } as any;
}

function makeResponse() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json: json as jest.Mock };
}

function makePrismaError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('prisma error', {
    code,
    clientVersion: '7.x',
  });
}

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
  });

  it('maps P2002 (unique constraint) → 409 CONFLICT / ALREADY_EXISTS', () => {
    const res = makeResponse();
    filter.catch(makePrismaError('P2002'), makeHost(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ALREADY_EXISTS');
    expect(body.error.message).toBe('Resource already exists');
  });

  it('maps P2025 (record not found) → 404 NOT_FOUND', () => {
    const res = makeResponse();
    filter.catch(makePrismaError('P2025'), makeHost(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(res.json.mock.calls[0][0].error.code).toBe('NOT_FOUND');
  });

  it('maps P2003 (foreign key violation) → 400 FOREIGN_KEY_VIOLATION', () => {
    const res = makeResponse();
    filter.catch(makePrismaError('P2003'), makeHost(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(res.json.mock.calls[0][0].error.code).toBe('FOREIGN_KEY_VIOLATION');
  });

  it('maps P2014 (relation violation) → 400 RELATION_VIOLATION', () => {
    const res = makeResponse();
    filter.catch(makePrismaError('P2014'), makeHost(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(res.json.mock.calls[0][0].error.code).toBe('RELATION_VIOLATION');
  });

  it('falls back to 500 DATABASE_ERROR for an unknown Prisma code', () => {
    const res = makeResponse();
    filter.catch(makePrismaError('P9999'), makeHost(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('DATABASE_ERROR');
    expect(body.error.message).toBe('An unexpected database error occurred');
  });

  it('always sets success: false', () => {
    const res = makeResponse();
    filter.catch(makePrismaError('P2002'), makeHost(res));
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  it('always includes a timestamp string', () => {
    const res = makeResponse();
    filter.catch(makePrismaError('P2025'), makeHost(res));
    const { timestamp } = res.json.mock.calls[0][0];
    expect(typeof timestamp).toBe('string');
    expect(timestamp.length).toBeGreaterThan(0);
  });
});
