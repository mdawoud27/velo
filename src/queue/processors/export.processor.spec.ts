import { ExportProcessor } from './export.processor';
import { ExportJobType } from '../constants/constants';

// We mock the heavy utils so the processor tests stay unit-level
jest.mock('../utils', () => ({
  buildTasksSheet: jest.fn(),
  addSummarySheet: jest.fn(),
  sanitizeFilename: jest.fn((s: string) => s.replace(/\s+/g, '-')),
  workbookToBuffer: jest.fn().mockResolvedValue(Buffer.from('fake')),
}));

jest.mock('exceljs', () => {
  const sheet = {
    columns: [],
    addRow: jest.fn().mockReturnValue({
      font: {},
      fill: {},
      getCell: jest.fn().mockReturnValue({ font: {} }),
    }),
    getRow: jest.fn().mockReturnValue({ font: {}, fill: {} }),
    views: [],
  };
  return {
    __esModule: true,
    default: {
      Workbook: jest.fn().mockImplementation(() => ({
        creator: '',
        created: null,
        addWorksheet: jest.fn().mockReturnValue(sheet),
      })),
    },
  };
});

function makePrisma() {
  return {
    task: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    project: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Test Project' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    orgMember: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation((args: any[]) => Promise.all(args)),
  } as any;
}

function makeCloudinary() {
  return {
    uploadBuffer: jest.fn().mockResolvedValue({ secureUrl: 'https://cdn.example.com/file.xlsx' }),
  } as any;
}

function makeMailer() {
  return { sendReportEmail: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeLogger() {
  return { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
}

function makeRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
  } as any;
}

function makeJob(name: string, data: any, id = 'job-1') {
  return {
    id,
    name,
    data,
    updateProgress: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe('ExportProcessor', () => {
  let processor: ExportProcessor;
  let prisma: ReturnType<typeof makePrisma>;
  let cloudinary: ReturnType<typeof makeCloudinary>;
  let mailer: ReturnType<typeof makeMailer>;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    prisma = makePrisma();
    cloudinary = makeCloudinary();
    mailer = makeMailer();
    redis = makeRedis();
    processor = new ExportProcessor(prisma, cloudinary, mailer, makeLogger(), redis);
  });

  describe('process - PROJECT_TASKS', () => {
    it('fetches tasks, uploads workbook, and returns result', async () => {
      const job = makeJob(ExportJobType.PROJECT_TASKS, { projectId: 'p-1', requesterId: 'u-1' });

      const result = await processor.process(job);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ projectId: 'p-1' }) }),
      );
      expect(cloudinary.uploadBuffer).toHaveBeenCalled();
      expect(result).toHaveProperty('downloadUrl');
      expect(result).toHaveProperty('filename');
      expect(result.rowCount).toBe(0);
    });
  });

  describe('process - WEEKLY_TASKS_REPORT', () => {
    it('fetches tasks, uploads, emails owner, and returns result', async () => {
      const job = makeJob(ExportJobType.WEEKLY_TASKS_REPORT, {
        orgId: 'o-1',
        ownerEmail: 'o@a.com',
        ownerName: 'Owner',
        orgName: 'Acme',
      });

      const result = await processor.process(job);

      expect(cloudinary.uploadBuffer).toHaveBeenCalled();
      expect(mailer.sendReportEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'o@a.com', reportType: 'Weekly Tasks Report' }),
      );
      expect(result).toHaveProperty('downloadUrl');
    });

    it('skips upload+email when idempotency key exists', async () => {
      redis.get.mockResolvedValueOnce(
        JSON.stringify({ downloadUrl: 'https://cached.url', filename: 'cached.xlsx' }),
      );

      const job = makeJob(ExportJobType.WEEKLY_TASKS_REPORT, {
        orgId: 'o-1',
        ownerEmail: 'o@a.com',
        ownerName: 'Owner',
        orgName: 'Acme',
      });

      const result = await processor.process(job);

      expect(cloudinary.uploadBuffer).not.toHaveBeenCalled();
      expect(mailer.sendReportEmail).not.toHaveBeenCalled();
      expect(result.downloadUrl).toBe('https://cached.url');
    });
  });

  describe('process - BIWEEKLY_PROJECTS_REPORT', () => {
    it('fetches projects, uploads, and emails owner', async () => {
      const job = makeJob(ExportJobType.BIWEEKLY_PROJECTS_REPORT, {
        orgId: 'o-1',
        ownerEmail: 'o@a.com',
        ownerName: 'Owner',
        orgName: 'Acme',
      });

      const result = await processor.process(job);

      expect(prisma.project.findMany).toHaveBeenCalled();
      expect(mailer.sendReportEmail).toHaveBeenCalledWith(
        expect.objectContaining({ reportType: 'Bi-Weekly Projects Report' }),
      );
      expect(result).toHaveProperty('downloadUrl');
    });
  });

  describe('process - MONTHLY_ORG_REPORT', () => {
    it('fetches members + task stats, uploads, and emails owner', async () => {
      const job = makeJob(ExportJobType.MONTHLY_ORG_REPORT, {
        orgId: 'o-1',
        ownerEmail: 'o@a.com',
        ownerName: 'Owner',
        orgName: 'Acme',
      });

      const result = await processor.process(job);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.task.groupBy).toHaveBeenCalled();
      expect(mailer.sendReportEmail).toHaveBeenCalledWith(
        expect.objectContaining({ reportType: 'Monthly Organization Report' }),
      );
      expect(result).toHaveProperty('downloadUrl');
    });
  });

  describe('process - unknown type', () => {
    it('throws for unknown job type', async () => {
      const job = makeJob('UNKNOWN', {});
      await expect(processor.process(job)).rejects.toThrow(/Unknown export job type/);
    });
  });
});
