import ExcelJS from 'exceljs';
import { addSummarySheet, buildTasksSheet, workbookToBuffer } from './excel.builder';

describe('excel.builder', () => {
  let workbook: ExcelJS.Workbook;

  beforeEach(() => {
    workbook = new ExcelJS.Workbook();
  });

  describe('buildTasksSheet', () => {
    it('creates a formatted worksheet with tasks', () => {
      const rows = [
        {
          title: 'Task 1',
          status: 'DONE',
          priority: 'HIGH',
          assigneeName: 'Alice',
          dueDate: '2026-08-20',
          tags: 'bug',
          commentsCount: 2,
          createdAt: '2026-08-01',
        },
      ];

      const sheet = buildTasksSheet(workbook, 'Tasks', rows);

      expect(sheet).toBeDefined();
      expect(sheet.name).toBe('Tasks');
      expect(sheet.rowCount).toBe(2); // Header + 1 row
    });
  });

  describe('addSummarySheet', () => {
    it('adds summary sheet to workbook with correct statistics', () => {
      addSummarySheet(workbook, {
        total: 10,
        done: 8,
        inProgress: 2,
        overdue: 1,
        period: 'Q3 2026',
      });

      const sheet = workbook.getWorksheet('Summary');
      expect(sheet).toBeDefined();
      expect(sheet?.rowCount).toBe(6);
    });
  });

  describe('workbookToBuffer', () => {
    it('converts workbook to buffer', async () => {
      addSummarySheet(workbook, { total: 0, done: 0, inProgress: 0, overdue: 0, period: 'Test' });
      const buffer = await workbookToBuffer(workbook);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
