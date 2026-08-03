export interface AuthenticatedUser {
  sub: string;
  [key: string]: unknown;
}
