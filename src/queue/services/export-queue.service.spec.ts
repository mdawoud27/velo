import { ExportQueueService } from './export-queue.service';
import { ExportJobType, EXPORT_JOB_OPTIONS } from '../constants/constants';
import { ForbiddenException } from '@nestjs/common';
import { ResourceNotFoundException } from 'src/common/exceptions';

function makeQueue() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    getJob: jest.fn(),
  } as any;
}

describe('ExportQueueService', () => {
  let service: ExportQueueService;
  let queue: ReturnType<typeof makeQueue>;

  beforeEach(() => {
    queue = makeQueue();
    service = new ExportQueueService(queue);
  });

  describe('addProjectExportJob', () => {
    it('enqueues with a deterministic jobId', async () => {
      const data = { projectId: 'p-1', requesterId: 'u-1', orgId: 'o-1' };
      await service.addProjectExportJob(data);

      expect(queue.add).toHaveBeenCalledWith(
        ExportJobType.PROJECT_TASKS,
        data,
        expect.objectContaining({ jobId: 'project-export-p-1-u-1' }),
      );
    });
  });

  describe('addWeeklyTasksReport', () => {
    it('enqueues a weekly tasks report job', async () => {
      const data = { orgId: 'o-1', ownerEmail: 'e@x.com', ownerName: 'A', orgName: 'Org' };
      await service.addWeeklyTasksReport(data);
      expect(queue.add).toHaveBeenCalledWith(
        ExportJobType.WEEKLY_TASKS_REPORT,
        data,
        EXPORT_JOB_OPTIONS,
      );
    });
  });

  describe('addBiweeklyProjectsReport', () => {
    it('enqueues a bi-weekly projects report job', async () => {
      const data = { orgId: 'o-1', ownerEmail: 'e@x.com', ownerName: 'A', orgName: 'Org' };
      await service.addBiweeklyProjectsReport(data);
      expect(queue.add).toHaveBeenCalledWith(
        ExportJobType.BIWEEKLY_PROJECTS_REPORT,
        data,
        EXPORT_JOB_OPTIONS,
      );
    });
  });

  describe('addMonthlyOrgReport', () => {
    it('enqueues a monthly org report job', async () => {
      const data = { orgId: 'o-1', ownerEmail: 'e@x.com', ownerName: 'A', orgName: 'Org' };
      await service.addMonthlyOrgReport(data);
      expect(queue.add).toHaveBeenCalledWith(
        ExportJobType.MONTHLY_ORG_REPORT,
        data,
        EXPORT_JOB_OPTIONS,
      );
    });
  });

  describe('getJobStatus', () => {
    it('returns status for a valid completed job', async () => {
      queue.getJob.mockResolvedValueOnce({
        data: { projectId: 'p-1', requesterId: 'u-1' },
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: { downloadUrl: 'https://dl.url', filename: 'f.xlsx', rowCount: 10 },
        progress: 100,
      });

      const result = await service.getJobStatus('job-1', 'p-1', 'u-1');

      expect(result).toEqual({
        jobId: 'job-1',
        status: 'completed',
        progress: 100,
        downloadUrl: 'https://dl.url',
        filename: 'f.xlsx',
        rowCount: 10,
        failedReason: null,
      });
    });

    it('throws ResourceNotFoundException when job not found', async () => {
      queue.getJob.mockResolvedValueOnce(null);

      await expect(service.getJobStatus('nope', 'p-1', 'u-1')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('throws ResourceNotFoundException when projectId does not match', async () => {
      queue.getJob.mockResolvedValueOnce({
        data: { projectId: 'other-project', requesterId: 'u-1' },
      });

      await expect(service.getJobStatus('job-1', 'p-1', 'u-1')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('throws ForbiddenException when requesterId does not match', async () => {
      queue.getJob.mockResolvedValueOnce({
        data: { projectId: 'p-1', requesterId: 'other-user' },
      });

      await expect(service.getJobStatus('job-1', 'p-1', 'u-1')).rejects.toThrow(ForbiddenException);
    });

    it('returns failedReason for failed jobs', async () => {
      queue.getJob.mockResolvedValueOnce({
        data: { projectId: 'p-1', requesterId: 'u-1' },
        getState: jest.fn().mockResolvedValue('failed'),
        returnvalue: null,
        progress: 40,
        failedReason: 'Upload timeout',
      });

      const result = await service.getJobStatus('job-1', 'p-1', 'u-1');

      expect(result.failedReason).toBe('Upload timeout');
      expect(result.downloadUrl).toBeNull();
    });
  });
});
