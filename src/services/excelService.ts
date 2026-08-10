import type { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';
import type { Expense, Selection } from '@/types/expense';
import { EXPENSES_SHEET, SELECTIONS_SHEET } from './itineraryParser';

const EXPENSE_HEADER = [
  'expense_id',
  'activity_key',
  'date',
  'time',
  'activity',
  'place',
  'amount',
  'description',
  'category',
  'created_at',
] as const;

const SELECTION_HEADER = [
  'activity_key',
  'selected_place',
  'selected_address',
  'updated_at',
] as const;

export function readWorkbook(data: ArrayBuffer): WorkBook {
  return XLSX.read(data, { type: 'array', cellStyles: true, cellDates: false });
}

function sheetRows(workbook: WorkBook, sheetName: string): Record<string, unknown>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
}

function readNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  const digits = String(raw ?? '').replace(/[^\d-]/g, '');
  const value = Number(digits);
  return Number.isFinite(value) ? value : 0;
}

function readText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

/** Đọc sheet Expenses (nếu có) để khôi phục chi phí sau khi import lại file */
export function readExpenses(workbook: WorkBook): Expense[] {
  return sheetRows(workbook, EXPENSES_SHEET)
    .map((row, index) => {
      const amount = readNumber(row.amount);
      const activityKey = readText(row.activity_key);
      return {
        id: readText(row.expense_id) || `EXP_${index + 1}`,
        activityKey: activityKey || null,
        date: readText(row.date),
        time: readText(row.time) || undefined,
        activity: readText(row.activity) || undefined,
        place: readText(row.place) || undefined,
        amount,
        description: readText(row.description) || undefined,
        category: readText(row.category) || 'Khác',
        createdAt: readText(row.created_at) || new Date().toISOString(),
      } satisfies Expense;
    })
    .filter((expense) => expense.date !== '' || expense.amount !== 0);
}

export function readSelections(workbook: WorkBook): Selection[] {
  return sheetRows(workbook, SELECTIONS_SHEET)
    .map((row) => ({
      activityKey: readText(row.activity_key),
      selectedPlace: readText(row.selected_place),
      selectedAddress: readText(row.selected_address) || undefined,
      updatedAt: readText(row.updated_at) || new Date().toISOString(),
    }))
    .filter((selection) => selection.activityKey && selection.selectedPlace);
}

/**
 * Ghi lại sheet Expenses/Selections từ model hiện tại.
 * Các sheet lịch trình và mọi sheet khác được giữ nguyên — chỉ hai sheet của app
 * bị thay thế, nên workbook export vẫn mở bình thường bằng Excel.
 */
export function writeAppSheets(
  workbook: WorkBook,
  expenses: Expense[],
  selections: Selection[],
): WorkBook {
  const expenseRows = expenses.map((expense) => ({
    expense_id: expense.id,
    activity_key: expense.activityKey ?? '',
    date: expense.date,
    time: expense.time ?? '',
    activity: expense.activity ?? '',
    place: expense.place ?? '',
    amount: expense.amount,
    description: expense.description ?? '',
    category: expense.category,
    created_at: expense.createdAt,
  }));

  const expenseSheet = XLSX.utils.json_to_sheet(expenseRows, {
    header: [...EXPENSE_HEADER],
  });
  expenseSheet['!cols'] = [
    { wch: 12 },
    { wch: 30 },
    { wch: 10 },
    { wch: 8 },
    { wch: 26 },
    { wch: 26 },
    { wch: 12 },
    { wch: 28 },
    { wch: 14 },
    { wch: 22 },
  ];
  upsertSheet(workbook, EXPENSES_SHEET, expenseSheet);

  const selectionRows = selections.map((selection) => ({
    activity_key: selection.activityKey,
    selected_place: selection.selectedPlace,
    selected_address: selection.selectedAddress ?? '',
    updated_at: selection.updatedAt,
  }));
  const selectionSheet = XLSX.utils.json_to_sheet(selectionRows, {
    header: [...SELECTION_HEADER],
  });
  selectionSheet['!cols'] = [{ wch: 30 }, { wch: 26 }, { wch: 30 }, { wch: 22 }];
  upsertSheet(workbook, SELECTIONS_SHEET, selectionSheet);

  return workbook;
}

function upsertSheet(workbook: WorkBook, name: string, sheet: XLSX.WorkSheet): void {
  workbook.Sheets[name] = sheet;
  if (!workbook.SheetNames.includes(name)) workbook.SheetNames.push(name);
}

export function workbookToBlob(workbook: WorkBook): Blob {
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([output], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function buildExportName(sourceName?: string): string {
  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[-:]/g, '')
    .replace('T', '-');
  const base = (sourceName ?? 'lich-trinh.xlsx').replace(/\.(xlsx|xlsm|xls)$/i, '');
  return `${base}-cap-nhat-${stamp}.xlsx`;
}

/** Trình duyệt mobile thường không cho ghi đè file gốc — khi đó tải file mới về */
export function canWriteInPlace(handle: FileSystemFileHandle | null): boolean {
  return Boolean(handle && typeof handle.createWritable === 'function');
}

export async function saveWorkbook(
  workbook: WorkBook,
  handle: FileSystemFileHandle | null,
  sourceName?: string,
): Promise<'ghi-de' | 'tai-ve'> {
  const blob = workbookToBlob(workbook);

  if (canWriteInPlace(handle)) {
    try {
      const writable = await handle!.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'ghi-de';
    } catch {
      // Không ghi đè được (quyền bị thu hồi, trình duyệt chặn) → rơi về tải file
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildExportName(sourceName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'tai-ve';
}
