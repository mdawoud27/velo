import { requireParam, requireUser } from './cache.utils';
import { Request } from 'express';

describe('cache.utils', () => {
  describe('requireParam', () => {
    it('returns param value when present and non-empty', () => {
      const req = { params: { id: '123' } } as unknown as Request;
      expect(requireParam(req, 'id')).toBe('123');
    });

    it('throws error when param is missing', () => {
      const req = { params: {} } as unknown as Request;
      expect(() => requireParam(req, 'id')).toThrow(
        'Expected route param "id" to be a non-empty string',
      );
    });

    it('throws error when param is empty string', () => {
      const req = { params: { id: '' } } as unknown as Request;
      expect(() => requireParam(req, 'id')).toThrow(
        'Expected route param "id" to be a non-empty string',
      );
    });
  });

  describe('requireUser', () => {
    it('returns authenticated user when user.sub exists', () => {
      const user = { sub: 'u-1', email: 'a@b.com' };
      const req = { user } as unknown as Request;
      expect(requireUser(req)).toBe(user);
    });

    it('throws error when req.user is undefined', () => {
      const req = {} as unknown as Request;
      expect(() => requireUser(req)).toThrow('Expected authenticated user on request');
    });

    it('throws error when req.user.sub is missing', () => {
      const req = { user: {} } as unknown as Request;
      expect(() => requireUser(req)).toThrow('Expected authenticated user on request');
    });
  });
});
