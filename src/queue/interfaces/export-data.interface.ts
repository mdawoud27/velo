export interface ExportJobData {
  orgId: string;
  requestedBy: string;
  format: 'csv' | 'json';
}
