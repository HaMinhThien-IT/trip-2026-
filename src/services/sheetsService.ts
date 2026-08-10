import type { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';
import type { Expense, Selection } from '@/types/expense';

/** Cấu hình trỏ tới Web App của Google Apps Script */
export type SheetsConfig = {
  url: string;
  token: string;
};

const STORAGE_KEY = 'trip.sheets.config';

/**
 * Cấu hình sẵn lúc build để người dùng không phải gõ gì.
 *
 * URL nằm thẳng trong source được: không có token thì script từ chối, nên URL
 * một mình vô hại. TOKEN thì lấy từ biến môi trường và KHÔNG commit vào repo
 * — repo này công khai.
 *
 * Lưu ý thật: biến NEXT_PUBLIC_* bị nhúng vào file JS gửi xuống trình duyệt,
 * nên ai mở DevTools trên trang đã deploy đều đọc được token. Với app tĩnh
 * không có backend thì không có cách nào giấu được. Token chặn người tình cờ
 * biết URL, không chặn người xem mã nguồn trang.
 */
export const DEFAULT_URL =
  process.env.NEXT_PUBLIC_SHEETS_URL ??
  'https://script.google.com/macros/s/AKfycbxdWy5PDXJPfplIRGon77YCmqz2GsfTeNdgWlWwxBCjDANCmBMKDS8lWomCaZ1zmHZT/exec';

export const DEFAULT_TOKEN = process.env.NEXT_PUBLIC_SHEETS_TOKEN ?? '';

function defaultConfig(): SheetsConfig | null {
  if (!DEFAULT_URL || !DEFAULT_TOKEN) return null;
  return { url: DEFAULT_URL, token: DEFAULT_TOKEN };
}

export function hasDefaultConfig(): boolean {
  return defaultConfig() !== null;
}

type StoredConfig = Partial<SheetsConfig> & { off?: boolean };

/** Cấu hình người dùng tự nhập > cấu hình sẵn lúc build */
export function readConfig(): SheetsConfig | null {
  if (typeof localStorage === 'undefined') return defaultConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();

    const parsed = JSON.parse(raw) as StoredConfig;
    // Người dùng đã chủ động tắt: đừng để cấu hình sẵn bật lại
    if (parsed.off) return null;
    if (!parsed.url) return defaultConfig();
    return { url: parsed.url, token: parsed.token ?? '' };
  } catch {
    return defaultConfig();
  }
}

export function writeConfig(config: SheetsConfig | null): void {
  if (typeof localStorage === 'undefined') return;
  // Ghi cờ tắt thay vì xóa, nếu không cấu hình sẵn sẽ bật lại ở lần mở sau
  if (config === null) localStorage.setItem(STORAGE_KEY, JSON.stringify({ off: true }));
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** Thao tác chờ đẩy lên Google Sheet; xếp hàng khi mất mạng */
export type SyncOp =
  | { type: 'upsert-expense'; expense: Expense }
  | { type: 'delete-expense'; id: string }
  | { type: 'upsert-selection'; selection: Selection }
  | { type: 'clear-selection'; activityKey: string };

type PullResponse = {
  ok: boolean;
  error?: string;
  sheets?: Record<string, unknown[][]>;
  updatedAt?: string;
};

/**
 * Dựng lại workbook từ dữ liệu Google Sheet trả về, để mọi thứ phía sau
 * (parser lịch trình, đọc Expenses, xuất file .xlsx) dùng chung một đường.
 */
export function buildWorkbook(sheets: Record<string, unknown[][]>): WorkBook {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows.length > 0 ? rows : [[]]);
    XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
  });
  return workbook;
}

export async function pullWorkbook(config: SheetsConfig): Promise<WorkBook> {
  const url = `${config.url}?token=${encodeURIComponent(config.token)}`;
  const response = await fetch(url, { method: 'GET', redirect: 'follow' });
  if (!response.ok) throw new Error(`Google Sheet trả về lỗi ${response.status}.`);

  const payload = (await response.json()) as PullResponse;
  if (!payload.ok) throw new Error(payload.error ?? 'Google Sheet từ chối yêu cầu.');
  if (!payload.sheets) throw new Error('Google Sheet không trả về dữ liệu.');

  return buildWorkbook(payload.sheets);
}

/**
 * Gửi các thao tác lên Web App. Dùng text/plain để trình duyệt bỏ qua bước
 * preflight — Apps Script không trả header CORS cho request OPTIONS.
 */
export async function pushOps(config: SheetsConfig, ops: SyncOp[]): Promise<void> {
  if (ops.length === 0) return;

  const response = await fetch(config.url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: config.token, ops }),
  });
  if (!response.ok) throw new Error(`Google Sheet trả về lỗi ${response.status}.`);

  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!payload.ok) throw new Error(payload.error ?? 'Google Sheet từ chối ghi dữ liệu.');
}
