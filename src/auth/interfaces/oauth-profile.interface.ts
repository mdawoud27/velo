export interface OAuthProfile {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}
