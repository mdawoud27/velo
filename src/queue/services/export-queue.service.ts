import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { ResourceNotFoundException } from 'src/common/exceptions';
import { EXPORT_JOB_OPTIONS, EXPORT_QUEUE, ExportJobType } from '../constants';
import {
  BiweeklyProjectsReportJobData,
  ExportJobResult,
  JobStatusResponse,
  MonthlyOrgReportJobData,
  ProjectExportJobData,
  WeeklyTasksReportJobData,
} from '../interfaces';

@Injectable()
export class ExportQueueService {
  constructor(@InjectQueue(EXPORT_QUEUE) private readonly queue: Queue) {}

  // On-demand project export
  async addProjectExportJob(data: ProjectExportJobData): Promise<Job> {
    return this.queue.add(ExportJobType.PROJECT_TASKS, data, {
      ...EXPORT_JOB_OPTIONS,
      jobId: `project-export-${data.projectId}-${data.requesterId}`,
    });
  }

  // Scheduled report jobs (called by schedulers)
  async addWeeklyTasksReport(data: WeeklyTasksReportJobData): Promise<void> {
    await this.queue.add(ExportJobType.WEEKLY_TASKS_REPORT, data, EXPORT_JOB_OPTIONS);
  }

  async addBiweeklyProjectsReport(data: BiweeklyProjectsReportJobData): Promise<void> {
    await this.queue.add(ExportJobType.BIWEEKLY_PROJECTS_REPORT, data, EXPORT_JOB_OPTIONS);
  }

  async addMonthlyOrgReport(data: MonthlyOrgReportJobData): Promise<void> {
    await this.queue.add(ExportJobType.MONTHLY_ORG_REPORT, data, EXPORT_JOB_OPTIONS);
  }

  // Status polling
  async getJobStatus(
    jobId: string,
    projectId: string,
    requesterId: string,
  ): Promise<JobStatusResponse> {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new ResourceNotFoundException('Export job', jobId);

    const jobData = job.data as Partial<ProjectExportJobData>;

    if (jobData.projectId !== projectId) {
      throw new ResourceNotFoundException('Export job', jobId);
    }

    if (jobData.requesterId !== requesterId) {
      throw new ForbiddenException('You do not have access to this export job');
    }

    const state = await job.getState();
    const result = job.returnvalue as ExportJobResult | null;

    return {
      jobId,
      status: state as JobStatusResponse['status'],
      progress: typeof job.progress === 'number' ? job.progress : 0,
      downloadUrl: state === 'completed' ? (result?.downloadUrl ?? null) : null,
      filename: state === 'completed' ? (result?.filename ?? null) : null,
      rowCount: state === 'completed' ? (result?.rowCount ?? null) : null,
      failedReason: state === 'failed' ? job.failedReason : null,
    };
  }
}
