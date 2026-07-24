export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  context?: Record<string, unknown>;
}
