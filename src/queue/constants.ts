export const EMAIL_QUEUE = 'email-queue';

export enum EmailJobType {
  WELCOME = 'welcome',
  VERIFY_EMAIL = 'verify-email',
  PASSWORD_RESET = 'password-reset',
  INVITATION = 'invitation',
}
