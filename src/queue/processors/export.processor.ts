import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import ExcelJS from 'exceljs';
import { EXPORT_QUEUE, ExportJobType } from '../constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { TaskStatus } from '@prisma/client';
import {
  BiweeklyProjectsReportJobData,
  ExportJobResult,
  MonthlyOrgReportJobData,
  ProjectExportJobData,
  TaskRow,
  WeeklyTasksReportJobData,
} from '../interfaces';
import { addSummarySheet, buildTasksSheet, sanitizeFilename, workbookToBuffer } from '../utils';
import { MailService } from 'src/mail/mail.service';
import { LoggerService } from 'src/logger/logger.service';
import { RedisService } from 'src/redis/redis.service';

@Processor(EXPORT_QUEUE)
export class ExportProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly mailer: MailService,
    private readonly logger: LoggerService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job): Promise<ExportJobResult> {
    this.logger.log(`Processing export job: ${job.name} [id=${job.id}]`);

    const jobType = job.name as ExportJobType;

    switch (jobType) {
      case ExportJobType.PROJECT_TASKS:
        return this.processProjectExport(job as Job<ProjectExportJobData>);
      case ExportJobType.WEEKLY_TASKS_REPORT:
        return this.processWeeklyTasksReport(job as Job<WeeklyTasksReportJobData>);
      case ExportJobType.BIWEEKLY_PROJECTS_REPORT:
        return this.processBiweeklyProjectsReport(job as Job<BiweeklyProjectsReportJobData>);
      case ExportJobType.MONTHLY_ORG_REPORT:
        return this.processMonthlyOrgReport(job as Job<MonthlyOrgReportJobData>);
      default:
        throw new Error(`Unknown export job type: ${job.name}`);
    }
  }

  // On-demand: project task export
  private async processProjectExport(job: Job<ProjectExportJobData>): Promise<ExportJobResult> {
    const { projectId } = job.data;

    await job.updateProgress(10);

    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      include: {
        assignee: { select: { name: true, email: true } },
        creator: { select: { name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    await job.updateProgress(40);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    const rows: TaskRow[] = tasks.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      assigneeName: t.assignee?.name ?? 'Unassigned',
      dueDate: t.dueDate ? t.dueDate.toLocaleDateString() : '—',
      tags: t.tags.join(', '),
      commentsCount: t._count.comments,
      createdAt: t.createdAt.toLocaleDateString(),
    }));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Velo';
    workbook.created = new Date();

    buildTasksSheet(workbook, 'Tasks', rows);
    addSummarySheet(workbook, {
      total: tasks.length,
      done: tasks.filter((t) => t.status === TaskStatus.DONE).length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      overdue: tasks.filter(
        (t) => t.dueDate && t.dueDate < new Date() && t.status !== TaskStatus.DONE,
      ).length,
      period: `As of ${new Date().toLocaleDateString()}`,
    });

    await job.updateProgress(70);

    const buffer = await workbookToBuffer(workbook);
    const safeName = project?.name ? sanitizeFilename(project.name) : projectId;
    const filename = `tasks-${safeName}-${Date.now()}.xlsx`;

    const result = await this.cloudinary.uploadBuffer(
      buffer,
      filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'velo/exports',
    );

    await job.updateProgress(100);
    this.logger.log(`Project export complete: ${result.secureUrl}`);

    return {
      downloadUrl: result.secureUrl,
      filename,
      rowCount: tasks.length,
    };
  }

  // Scheduled: weekly tasks report
  private async processWeeklyTasksReport(
    job: Job<WeeklyTasksReportJobData>,
  ): Promise<ExportJobResult> {
    const { orgId, ownerEmail, ownerName, orgName } = job.data;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const tasks = await this.prisma.task.findMany({
      where: {
        project: { team: { orgId } },
        deletedAt: null,
        // Tasks created OR updated this week
        OR: [{ createdAt: { gte: weekAgo } }, { updatedAt: { gte: weekAgo } }],
      },
      include: {
        assignee: { select: { name: true } },
        project: { select: { name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    await job.updateProgress(40);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Velo';

    const rows: TaskRow[] = tasks.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      assigneeName: t.assignee?.name ?? 'Unassigned',
      dueDate: t.dueDate ? t.dueDate.toLocaleDateString() : '—',
      tags: t.tags.join(', '),
      commentsCount: t._count.comments,
      createdAt: t.createdAt.toLocaleDateString(),
    }));

    buildTasksSheet(workbook, 'Tasks This Week', rows);
    addSummarySheet(workbook, {
      total: tasks.length,
      done: tasks.filter((t) => t.status === TaskStatus.DONE).length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      overdue: tasks.filter(
        (t) => t.dueDate && t.dueDate < new Date() && t.status !== TaskStatus.DONE,
      ).length,
      period: `Week of ${weekAgo.toLocaleDateString()} – ${new Date().toLocaleDateString()}`,
    });

    await job.updateProgress(70);

    const buffer = await workbookToBuffer(workbook);
    const filename = `weekly-tasks-${sanitizeFilename(orgName)}-${job.id}.xlsx`;

    const { downloadUrl } = await this.uploadAndNotifyOnce(
      job,
      buffer,
      filename,
      'velo/reports/weekly',
      async (url) => {
        await this.mailer.sendReportEmail({
          to: ownerEmail,
          name: ownerName,
          orgName,
          reportType: 'Weekly Tasks Report',
          period: `${weekAgo.toLocaleDateString()} – ${new Date().toLocaleDateString()}`,
          downloadUrl: url,
          rowCount: tasks.length,
        });
      },
    );

    await job.updateProgress(100);

    return {
      downloadUrl,
      filename,
      rowCount: tasks.length,
    };
  }

  // Scheduled: bi-weekly projects report
  private async processBiweeklyProjectsReport(
    job: Job<BiweeklyProjectsReportJobData>,
  ): Promise<ExportJobResult> {
    const { orgId, ownerEmail, ownerName, orgName } = job.data;

    const projects = await this.prisma.project.findMany({
      where: { team: { orgId }, deletedAt: null },
      include: {
        _count: {
          select: {
            tasks: { where: { deletedAt: null } },
            members: true,
          },
        },
        tasks: {
          where: { deletedAt: null },
          select: { status: true, dueDate: true },
        },
      },
    });

    await job.updateProgress(40);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Velo';
    const sheet = workbook.addWorksheet('Projects');

    sheet.columns = [
      { header: 'Project Name', key: 'name', width: 35 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Total Tasks', key: 'totalTasks', width: 14 },
      { header: 'Done', key: 'doneTasks', width: 10 },
      { header: 'In Progress', key: 'inProgress', width: 14 },
      { header: 'Overdue Tasks', key: 'overdue', width: 14 },
      { header: '% Complete', key: 'completion', width: 13 },
      { header: 'Members', key: 'members', width: 10 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const now = new Date();

    projects.forEach((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === TaskStatus.DONE).length;
      const inProg = p.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const overdue = p.tasks.filter(
        (t) => t.dueDate && t.dueDate < now && t.status !== TaskStatus.DONE,
      ).length;
      const pct = total > 0 ? `${Math.round((done / total) * 100)}%` : 'N/A';

      sheet.addRow({
        name: p.name,
        status: p.status,
        totalTasks: total,
        doneTasks: done,
        inProgress: inProg,
        overdue,
        completion: pct,
        members: p._count.members,
      });
    });

    await job.updateProgress(70);

    const buffer = await workbookToBuffer(workbook);
    const filename = `projects-report-${sanitizeFilename(orgName)}-${job.id}.xlsx`;

    const { downloadUrl } = await this.uploadAndNotifyOnce(
      job,
      buffer,
      filename,
      'velo/reports/biweekly',
      async (url) => {
        await this.mailer.sendReportEmail({
          to: ownerEmail,
          name: ownerName,
          orgName,
          reportType: 'Bi-Weekly Projects Report',
          period: `${now.toLocaleDateString()}`,
          downloadUrl: url,
          rowCount: projects.length,
        });
      },
    );

    await job.updateProgress(100);

    return {
      downloadUrl,
      filename,
      rowCount: projects.length,
    };
  }

  // Scheduled: monthly org report

  private async processMonthlyOrgReport(
    job: Job<MonthlyOrgReportJobData>,
  ): Promise<ExportJobResult> {
    const { orgId, ownerEmail, ownerName, orgName } = job.data;

    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [members, projects] = await this.prisma.$transaction([
      this.prisma.orgMember.findMany({
        where: { orgId },
        select: {
          role: true,
          joinedAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      this.prisma.project.count({ where: { team: { orgId }, deletedAt: null } }),
    ]);

    const taskStats = await this.prisma.task.groupBy({
      by: ['status'],
      where: { project: { team: { orgId } }, deletedAt: null },
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });

    await job.updateProgress(40);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Velo';

    const summarySheet = workbook.addWorksheet('Organization Summary');
    summarySheet.columns = [{ width: 30 }, { width: 20 }];

    const statusMap = Object.fromEntries(taskStats.map((s) => [s.status, s._count?._all ?? 0]));
    const totalTasks = Object.values(statusMap).reduce((a, b) => a + b, 0);

    const summaryRows: [string, string | number][] = [
      ['Organization', orgName],
      ['Report Period', `${monthAgo.toLocaleDateString()} – ${new Date().toLocaleDateString()}`],
      ['Total Members', members.length],
      ['Active Projects', projects],
      ['Total Tasks', totalTasks],
      ['Tasks Done', statusMap['DONE'] ?? 0],
      ['In Progress', statusMap['IN_PROGRESS'] ?? 0],
      [
        'Completion Rate',
        totalTasks > 0 ? `${Math.round(((statusMap['DONE'] ?? 0) / totalTasks) * 100)}%` : 'N/A',
      ],
    ];

    summaryRows.forEach(([label, value]) => {
      const row = summarySheet.addRow([label, value]);
      row.getCell(1).font = { bold: true };
    });

    const membersSheet = workbook.addWorksheet('Members');
    membersSheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Email', key: 'email', width: 35 },
      { header: 'Role', key: 'role', width: 12 },
      { header: 'Joined', key: 'joinedAt', width: 15 },
    ];
    membersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    membersSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D3748' },
    };

    members.forEach((m) => {
      membersSheet.addRow({
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt.toLocaleDateString(),
      });
    });

    await job.updateProgress(70);

    const buffer = await workbookToBuffer(workbook);
    const filename = `monthly-org-report-${sanitizeFilename(orgName)}-${job.id}.xlsx`;

    const { downloadUrl } = await this.uploadAndNotifyOnce(
      job,
      buffer,
      filename,
      'velo/reports/monthly',
      async (url) => {
        await this.mailer.sendReportEmail({
          to: ownerEmail,
          name: ownerName,
          orgName,
          reportType: 'Monthly Organization Report',
          period: `${monthAgo.toLocaleDateString()} – ${new Date().toLocaleDateString()}`,
          downloadUrl: url,
          rowCount: members.length,
        });
      },
    );

    await job.updateProgress(100);

    return {
      downloadUrl,
      filename,
      rowCount: members.length,
    };
  }

  private async uploadAndNotifyOnce(
    job: Job,
    buffer: Buffer,
    filename: string,
    folder: string,
    emailFn: (downloadUrl: string) => Promise<void>,
  ): Promise<{ downloadUrl: string; filename: string }> {
    const idempotencyKey = `export:done:${job.id}`;

    // Check if this job already completed a previous attempt
    const cached = await this.redis.get(idempotencyKey);
    if (cached) {
      this.logger.debug(
        `Job ${job.id} already completed on a prior attempt — skipping upload+email`,
      );
      const { downloadUrl, filename: cachedFilename } = JSON.parse(cached) as {
        downloadUrl: string;
        filename: string;
      };
      return { downloadUrl, filename: cachedFilename };
    }

    // First attempt
    const result = await this.cloudinary.uploadBuffer(
      buffer,
      filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      folder,
    );

    await emailFn(result.secureUrl);

    // Mark as done — TTL 7 days
    await this.redis.setex(
      idempotencyKey,

      JSON.stringify({ downloadUrl: result.secureUrl, filename }),
      7 * 24 * 60 * 60,
    );

    return { downloadUrl: result.secureUrl, filename };
  }
}
