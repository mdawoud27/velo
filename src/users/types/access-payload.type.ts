import { JwtPayload } from 'src/auth/interfaces';

export type AccessPayload = JwtPayload & { exp?: number };
