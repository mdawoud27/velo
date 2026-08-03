import type { JwtPayload } from 'src/auth/interfaces';
import type { Request } from 'express';

export interface AdminRequest extends Request {
  user: JwtPayload;
}
