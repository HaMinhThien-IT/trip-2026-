import type { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';
import type { Activity, ActivityOption, Day, Trip } from '@/types/itinerary';

export const EXPENSES_SHEET = 'Expenses';
export const SELECTIONS_SHEET = 'Selections';

/** Các sheet do app quản lý, không phải lịch trình */
const APP_SHEETS = new Set([EXPENSES_SHEET, SELECTIONS_SHEET]);

type HeaderMap = {
  time: number;
  title: number;
  place: number;
  address: number;
  cost: number;
  notes: number;
};

/**
 * So khớp header theo tiền tố (sau khi bỏ dấu). Dùng tiền tố thay vì `includes`
 * để "Thời gian" không bị cột "gia" nhận nhầm.
 */
const HEADER_ALIASES: Record<keyof HeaderMap, string[]> = {
  time: ['thoi gian', 'gio', 'time'],
  title: ['hoat dong', 'activity'],
  place: ['dia diem', 'quan', 'noi den', 'place'],
  address: ['dia chi', 'address'],
  cost: ['chi phi', 'gia', 'cost', 'price'],
  notes: ['ghi chu', 'note', 'option', 'luu y'],
};

/** Bỏ dấu tiếng Việt + hạ chữ thường để so khớp header/ghi chú */
export function normalize(input: unknown): string {
  return String(input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Đọc chi phí từ ô Excel. Trả về null khi chưa biết (ô trống / không có số),
 * 0 chỉ khi thực sự ghi 0 — null và 0 mang ý nghĩa khác nhau.
 */
export function parseCost(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const text = String(raw).trim();
  if (!text) return null;
  // "180.000đ (tùy chọn)" -> 180000 ; "1,5 triệu" không hỗ trợ, bỏ qua
  const match = text.match(/-?[\d.,\s]*\d/);
  if (!match) return null;
  const digits = match[0].replace(/[.,\s]/g, '');
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

/** "18:00 (13/07)" -> { time: "18:00", date: "13/07" } */
function parseTimeCell(raw: unknown): { time: string; date?: string } | null {
  if (raw === null || raw === undefined) return null;

  // Excel có thể lưu giờ dạng số thực (fraction of a day)
  if (typeof raw === 'number' && raw >= 0 && raw < 1) {
    const totalMinutes = Math.round(raw * 24 * 60);
    return { time: formatMinutes(totalMinutes) };
  }

  const text = String(raw).trim();
  if (!text) return null;

  const timeMatch = text.match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
  if (!timeMatch) return null;

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours > 23 || minutes > 59) return null;

  const dateMatch = text.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
  const date = dateMatch
    ? [pad(dateMatch[1]), pad(dateMatch[2]), dateMatch[3]].filter(Boolean).join('/')
    : undefined;

  return { time: `${pad(hours)}:${pad(minutes)}`, date };
}

function pad(value: string | number): string {
  return String(value).padStart(2, '0');
}

function formatMinutes(totalMinutes: number): string {
  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Nhận biết dòng option: "Option 1/3", "Lựa chọn 2/2", "option 1" */
function parseOptionMarker(notes: string): { index: number; total?: number } | null {
  const text = normalize(notes);
  const match = text.match(/(?:option|lua chon|tuy chon)\s*(\d+)\s*(?:\/\s*(\d+))?/);
  if (!match) return null;
  return { index: Number(match[1]), total: match[2] ? Number(match[2]) : undefined };
}

/** Suy ra danh mục chi phí mặc định từ tên hoạt động */
export function inferCategory(title: string, place = ''): string {
  const text = normalize(`${title} ${place}`);
  const has = (pattern: RegExp) => pattern.test(text);

  // Tín hiệu di chuyển rõ ràng trong tên hoạt động thắng mọi từ khóa ở cột địa điểm
  if (/\b(di chuyen|xuat phat|gui do|nhan xe|len xe|bat xe|don xe)\b/.test(normalize(title))) {
    return 'Di chuyển';
  }

  // Thứ tự có ý nghĩa: nhóm cụ thể được kiểm tra trước nhóm chung
  if (has(/\b(khach san|homestay|resort|nhan phong|tra phong|luu tru)\b/)) return 'Lưu trú';
  if (has(/\b(show|ky uc|ve xem|giai tri|bar|club|rap)\b/)) return 'Vé / Giải trí';
  if (has(/\b(mua sam|shopping|mua qua|cho dem)\b/)) return 'Mua sắm';
  if (has(/\b(tham quan|dao choi|dao|rung dua|pho co|bien|chua|bao tang|thuyen|cau)\b/)) {
    return 'Tham quan';
  }
  if (has(/\b(an sang|an trua|an toi|an uong|nha hang|quan an|cao lau|com|bun|pho|banh)\b/)) {
    return 'Ăn uống';
  }
  if (has(/\b(cafe|ca phe|coffee|tra sua|nuoc)\b/)) return 'Ăn uống';
  if (has(/\b(xe|di chuyen|xuat phat|den|bay|tau|taxi|grab|xang|gui do|san bay)\b/)) {
    return 'Di chuyển';
  }
  return 'Khác';
}

/** activityKey ổn định: date_time_TIEU_DE — dùng để nối lại expense sau khi reload */
export function buildActivityKey(date: string, time: string, title: string): string {
  const slug = normalize(title)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return `${date}_${time}_${slug}`;
}

function findHeaderRow(rows: unknown[][]): { rowIndex: number; map: HeaderMap } | null {
  for (let i = 0; i < Math.min(rows.length, 15); i += 1) {
    const cells = rows[i] ?? [];
    const normalized = cells.map(normalize);
    const map: Partial<HeaderMap> = {};
    const taken = new Set<number>();

    (Object.keys(HEADER_ALIASES) as (keyof HeaderMap)[]).forEach((key) => {
      const index = normalized.findIndex(
        (cell, cellIndex) =>
          Boolean(cell) &&
          !taken.has(cellIndex) &&
          HEADER_ALIASES[key].some((alias) => cell.startsWith(alias)),
      );
      if (index >= 0) {
        map[key] = index;
        taken.add(index);
      }
    });

    // Cần tối thiểu cột thời gian và cột hoạt động mới coi là header
    if (map.time !== undefined && map.title !== undefined) {
      return {
        rowIndex: i,
        map: {
          time: map.time,
          title: map.title,
          place: map.place ?? -1,
          address: map.address ?? -1,
          cost: map.cost ?? -1,
          notes: map.notes ?? -1,
        },
      };
    }
  }
  return null;
}

function cell(row: unknown[], index: number): string {
  if (index < 0) return '';
  const value = row?.[index];
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** "Ngày 1 - Hội An" -> "Ngày 1 · Hội An" (tiêu đề hiển thị) */
function sheetTitle(name: string): string {
  return name.replace(/\s*-\s*/g, ' · ').trim();
}

/** Ngày mặc định khi cột thời gian không ghi ngày ở đâu cả */
function fallbackDate(sheetName: string, sheetIndex: number): string {
  const match = sheetName.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (match) return `${pad(match[1])}/${pad(match[2])}`;
  return `Ngày ${sheetIndex + 1}`;
}

type RawRow = {
  date: string;
  time: string;
  title: string;
  place: string;
  address: string;
  cost: number | null;
  notes: string;
  optionIndex: number | null;
};

function parseSheet(workbook: WorkBook, sheetName: string, sheetIndex: number): Day[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  });

  const header = findHeaderRow(rows);
  if (!header) return [];

  const rawRows: RawRow[] = [];
  let currentDate = '';

  for (let i = header.rowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const parsedTime = parseTimeCell(row[header.map.time]);
    const title = cell(row, header.map.title);
    if (!parsedTime || !title) continue;

    if (parsedTime.date) currentDate = parsedTime.date;
    const date = currentDate || fallbackDate(sheetName, sheetIndex);

    const notes = cell(row, header.map.notes);
    rawRows.push({
      date,
      time: parsedTime.time,
      title,
      place: cell(row, header.map.place),
      address: cell(row, header.map.address),
      cost: parseCost(row[header.map.cost]),
      notes,
      optionIndex: parseOptionMarker(notes)?.index ?? null,
    });
  }

  if (rawRows.length === 0) return [];

  // Gom các dòng cùng (ngày + giờ + tên hoạt động) thành một activity
  const groups = new Map<string, RawRow[]>();
  const order: string[] = [];
  rawRows.forEach((row) => {
    const key = `${row.date}|${row.time}|${normalize(row.title)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(row);
  });

  const activities: Activity[] = order.map((key) => {
    const rowsInGroup = groups.get(key)!;
    const first = rowsInGroup[0];
    const activityKey = buildActivityKey(first.date, first.time, first.title);
    const hasOptions = rowsInGroup.length > 1;

    const options: ActivityOption[] = hasOptions
      ? rowsInGroup.map((row, index) => ({
          id: `${activityKey}_OPT_${row.optionIndex ?? index + 1}`,
          name: row.place || row.title,
          address: row.address || undefined,
          estimatedCost: row.cost,
          notes: row.notes || undefined,
        }))
      : [];

    // Chi phí dự kiến của activity nhiều option = giá trị đầu tiên có thật (nếu có)
    const estimatedCost = hasOptions
      ? (rowsInGroup.find((row) => row.cost !== null)?.cost ?? null)
      : first.cost;

    return {
      id: activityKey,
      activityKey,
      date: first.date,
      startTime: first.time,
      startMinutes: toMinutes(first.time),
      title: first.title,
      place: hasOptions ? undefined : first.place || undefined,
      address: hasOptions ? undefined : first.address || undefined,
      estimatedCost,
      notes: hasOptions ? undefined : first.notes || undefined,
      options,
      category: inferCategory(first.title, first.place),
    };
  });

  // Tách theo ngày (một sheet có thể chứa nhiều ngày)
  const byDate = new Map<string, Activity[]>();
  const dateOrder: string[] = [];
  activities.forEach((activity) => {
    if (!byDate.has(activity.date)) {
      byDate.set(activity.date, []);
      dateOrder.push(activity.date);
    }
    byDate.get(activity.date)!.push(activity);
  });

  return dateOrder.map((date) => ({
    id: `${sheetName}__${date}`,
    date,
    // Tiêu đề lấy từ tên sheet; phần ngày do UI ghép vào để tránh lặp
    title: sheetTitle(sheetName),
    activities: byDate
      .get(date)!
      .slice()
      .sort((a, b) => a.startMinutes - b.startMinutes),
  }));
}

/** Tên chuyến đi: lấy từ dòng tiêu đề của sheet đầu tiên nếu có */
function detectTripName(workbook: WorkBook, sheetNames: string[]): string {
  const first = sheetNames[0];
  if (!first) return 'Chuyến đi';
  const sheet = workbook.Sheets[first];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  const headerRow = findHeaderRow(rows)?.rowIndex ?? 0;

  for (let i = 0; i < headerRow; i += 1) {
    const text = (rows[i] ?? []).map((c) => String(c ?? '').trim()).find(Boolean);
    if (text) {
      // "LỊCH TRÌNH NGÀY 1 – ĐÀ NẴNG → HỘI AN" -> "ĐÀ NẴNG → HỘI AN"
      const parts = text.split(/[–—-]/);
      return (parts.length > 1 ? parts.slice(1).join('-') : text).trim();
    }
  }
  return sheetTitle(first);
}

export function parseTrip(workbook: WorkBook): Trip {
  const itinerarySheets = workbook.SheetNames.filter((name) => !APP_SHEETS.has(name));
  const days = itinerarySheets.flatMap((name, index) => parseSheet(workbook, name, index));

  return {
    name: detectTripName(workbook, itinerarySheets),
    days,
    itinerarySheets,
  };
}
