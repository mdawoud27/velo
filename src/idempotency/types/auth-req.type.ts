import { JwtPayload } from 'src/auth/interfaces';

export type AuthedRequest = Request & {
  user?: JwtPayload;
  method: string;
  originalUrl: string;
  headers: Record<string, string | string[] | undefined>;
};
