import { Request } from 'express';

export function requireParam(req: Request, key: string): string {
  const value = req.params[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Expected route param "${key}" to be a non-empty string`);
  }

  return value;
}
