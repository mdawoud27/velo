import ExcelJS from 'exceljs';
import { HEADER_COLOR, HEADER_FONT_COLOR, PRIORITY_COLORS, STATUS_COLORS } from '../constants';
import { TaskRow } from '../interfaces';

export function buildTasksSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: TaskRow[],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: 'Title', key: 'title', width: 45 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Priority', key: 'priority', width: 12 },
    { header: 'Assignee', key: 'assigneeName', width: 25 },
    { header: 'Due Date', key: 'dueDate', width: 14 },
    { header: 'Tags', key: 'tags', width: 20 },
    { header: 'Comments', key: 'commentsCount', width: 11 },
    { header: 'Created At', key: 'createdAt', width: 18 },
  ];

  // Header styling
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: HEADER_FONT_COLOR }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 22;

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  // Data rows
  rows.forEach((data) => {
    const row = sheet.addRow(data);
    row.alignment = { vertical: 'middle', wrapText: false };

    row.getCell('status').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STATUS_COLORS[data.status] ?? 'FFFFFFFF' },
    };
    row.getCell('priority').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: PRIORITY_COLORS[data.priority] ?? 'FFFFFFFF' },
    };
  });

  // Borders on all cells
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  return sheet;
}

export function addSummarySheet(
  workbook: ExcelJS.Workbook,
  stats: {
    total: number;
    done: number;
    inProgress: number;
    overdue: number;
    period: string;
  },
): void {
  const sheet = workbook.addWorksheet('Summary');

  sheet.columns = [{ width: 25 }, { width: 15 }];

  const rows = [
    ['Report Period', stats.period],
    ['Total Tasks', stats.total],
    ['Completed', stats.done],
    ['In Progress', stats.inProgress],
    ['Overdue', stats.overdue],
    ['Completion %', stats.total > 0 ? `${Math.round((stats.done / stats.total) * 100)}%` : 'N/A'],
  ];

  rows.forEach(([label, value]) => {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  });
}

export async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
