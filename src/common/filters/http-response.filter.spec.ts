import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpResponseFilter } from './http-response.filter';

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

describe('HttpResponseFilter', () => {
  let filter: HttpResponseFilter;

  beforeEach(() => {
    filter = new HttpResponseFilter();
  });

  it('maps a simple string HttpException to the standard error envelope', () => {
    const res = makeResponse();
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, makeHost(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Not found');
    expect(body.timestamp).toBeDefined();
  });

  it('maps a 400 Bad Request to BAD_REQUEST code', () => {
    const res = makeResponse();
    const exception = new HttpException('Validation failed', HttpStatus.BAD_REQUEST);

    filter.catch(exception, makeHost(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(res.json.mock.calls[0][0].error.code).toBe('BAD_REQUEST');
  });

  it('maps a 401 Unauthorized to UNAUTHORIZED code', () => {
    const res = makeResponse();
    const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    filter.catch(exception, makeHost(res));

    expect(res.json.mock.calls[0][0].error.code).toBe('UNAUTHORIZED');
  });

  it('maps a 403 Forbidden to FORBIDDEN code', () => {
    const res = makeResponse();
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, makeHost(res));

    expect(res.json.mock.calls[0][0].error.code).toBe('FORBIDDEN');
  });

  it('maps a 409 Conflict to CONFLICT code', () => {
    const res = makeResponse();
    const exception = new HttpException('Conflict', HttpStatus.CONFLICT);

    filter.catch(exception, makeHost(res));

    expect(res.json.mock.calls[0][0].error.code).toBe('CONFLICT');
  });

  it('maps an unmapped status to INTERNAL_SERVER_ERROR', () => {
    const res = makeResponse();
    const exception = new HttpException('Something went wrong', 503);

    filter.catch(exception, makeHost(res));

    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('passes through exceptions that already have a nested error object', () => {
    const res = makeResponse();
    const richBody = {
      success: false,
      error: { code: 'CUSTOM_CODE', message: 'Custom message' },
    };
    const exception = new HttpException(richBody, HttpStatus.FORBIDDEN);

    filter.catch(exception, makeHost(res));

    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('CUSTOM_CODE');
    expect(body.error.message).toBe('Custom message');
    expect(body.timestamp).toBeDefined();
  });

  it('includes an ISO timestamp in every response', () => {
    const res = makeResponse();
    const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

    filter.catch(exception, makeHost(res));

    const { timestamp } = res.json.mock.calls[0][0];
    expect(typeof timestamp).toBe('string');
    expect(timestamp.length).toBeGreaterThan(0);
  });

  it('uses "An error occurred" fallback when the message is not a string', () => {
    const res = makeResponse();
    // HttpException with an object body that has no string message
    const exception = new HttpException(
      { message: ['field must be string'] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, makeHost(res));

    const body = res.json.mock.calls[0][0];
    expect(body.error.message).toBe('An error occurred');
  });
});
