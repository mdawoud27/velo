import { Request } from 'express';

interface AuthenticatedUser {
  sub: string;
  [key: string]: unknown;
}

export function requireParam(req: Request, key: string): string {
  const value = req.params[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Expected route param "${key}" to be a non-empty string`);
  }

  return value;
}

export function requireUser(req: Request): AuthenticatedUser {
  const user = req.user as AuthenticatedUser | undefined;
  if (!user?.sub) {
    throw new Error('Expected authenticated user on request');
  }
  return user;
}
