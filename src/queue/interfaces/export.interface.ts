export interface ProjectExportJobData {
  projectId: string;
  requesterId: string;
  orgId: string;
}

export interface WeeklyTasksReportJobData {
  orgId: string;
  ownerEmail: string;
  ownerName: string;
  orgName: string;
}

export interface BiweeklyProjectsReportJobData {
  orgId: string;
  ownerEmail: string;
  ownerName: string;
  orgName: string;
}

export interface MonthlyOrgReportJobData {
  orgId: string;
  ownerEmail: string;
  ownerName: string;
  orgName: string;
}

export interface ExportJobResult {
  downloadUrl: string;
  filename: string;
  rowCount: number;
}

export interface JobStatusResponse {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number | object;
  downloadUrl: string | null;
  filename: string | null;
  rowCount: number | null;
  failedReason: string | null;
}
