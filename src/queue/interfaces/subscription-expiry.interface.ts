export interface SubscriptionExpiryWarningPayload {
  email: string;
  orgName: string;
  expiresAt: Date | string;
}
