import { Request } from 'express';
import { JwtPayload } from 'src/auth/interfaces';

export type AuthedRequest = Request & { user?: JwtPayload };
