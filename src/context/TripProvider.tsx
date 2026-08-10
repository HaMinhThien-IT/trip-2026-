'use client';

import type { WorkBook } from 'xlsx';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Expense, Selection } from '@/types/expense';
import type { Trip } from '@/types/itinerary';
import { parseTrip } from '@/services/itineraryParser';
import {
  readExpenses,
  readSelections,
  readWorkbook,
  saveWorkbook,
  writeAppSheets,
} from '@/services/excelService';
import { newExpenseId } from '@/services/expenseService';
import { cacheWorkbook, loadCachedWorkbook } from '@/services/workbookCache';
import {
  pullWorkbook,
  pushOps,
  readConfig,
  writeConfig,
  type SheetsConfig,
  type SyncOp,
} from '@/services/sheetsService';
import { enqueue, readAll, removeUpTo } from '@/services/syncQueue';

/** File Excel mặc định đi kèm app, người dùng vẫn có thể import file khác */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const DEFAULT_WORKBOOK_URL = `${BASE_PATH}/lich-trinh.xlsx`;
const DEFAULT_WORKBOOK_NAME = 'lich-trinh.xlsx';
/** Tên hiển thị khi dữ liệu đến từ Google Sheet thay vì file trên máy */
const SHEETS_FILE_NAME = 'Google Sheet';

type Status = 'dang-tai' | 'san-sang' | 'loi';

/** Trạng thái đồng bộ với Google Sheet, hiển thị trên UI */
export type SyncState =
  | 'tat' // chưa cấu hình Google Sheet
  | 'dang-dong-bo'
  | 'da-dong-bo'
  | 'cho-mang' // có thao tác đang xếp hàng
  | 'loi';

type TripContextValue = {
  status: Status;
  error: string | null;
  trip: Trip | null;
  expenses: Expense[];
  selections: Selection[];
  fileName: string;
  isDirty: boolean;
  canWriteInPlace: boolean;
  importFile: (file: File) => Promise<void>;
  pickFile: () => Promise<void>;
  addExpense: (input: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (id: string, patch: Partial<Omit<Expense, 'id' | 'createdAt'>>) => void;
  removeExpense: (id: string) => void;
  selectOption: (activityKey: string, place: string, address?: string) => void;
  clearSelection: (activityKey: string) => void;
  exportExcel: () => Promise<'ghi-de' | 'tai-ve'>;
  sheetsConfig: SheetsConfig | null;
  syncState: SyncState;
  syncError: string | null;
  pendingOps: number;
  saveSheetsConfig: (config: SheetsConfig | null) => Promise<void>;
  syncNow: () => Promise<void>;
};

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('dang-tai');
  const [error, setError] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [fileName, setFileName] = useState(DEFAULT_WORKBOOK_NAME);
  const [isDirty, setIsDirty] = useState(false);
  const [supportsWriteInPlace, setSupportsWriteInPlace] = useState(false);
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('tat');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingOps, setPendingOps] = useState(0);

  // Workbook giữ ngoài state React: object lớn, không cần render lại khi đổi
  const workbookRef = useRef<WorkBook | null>(null);
  const handleRef = useRef<FileSystemFileHandle | null>(null);
  // Đọc trong callback nên giữ bản ref để không phải thêm vào dependency
  const configRef = useRef<SheetsConfig | null>(null);

  const applyWorkbook = useCallback((workbook: WorkBook, name: string, dirty: boolean) => {
    workbookRef.current = workbook;
    setTrip(parseTrip(workbook));
    setExpenses(readExpenses(workbook));
    setSelections(readSelections(workbook));
    setFileName(name);
    setIsDirty(dirty);
    setError(null);
    setStatus('san-sang');
  }, []);

  /**
   * `dirty` đi theo workbook: file vừa import khớp với file trên máy nên sạch,
   * còn workbook khôi phục từ cache có thể đang mang thay đổi chưa xuất ra Excel.
   */
  const loadBytes = useCallback(
    async (bytes: ArrayBuffer, name: string, { cache = true, dirty = false } = {}) => {
      const workbook = readWorkbook(bytes);
      const parsed = parseTrip(workbook);
      if (parsed.days.length === 0) {
        throw new Error(
          'Không đọc được lịch trình trong file. File cần có cột Thời gian và Hoạt động.',
        );
      }
      applyWorkbook(workbook, name, dirty);
      if (cache) await cacheWorkbook(bytes.slice(0), name, dirty);
    },
    [applyWorkbook],
  );

  /** Ghi workbook lấy từ Google Sheet vào state và cache offline */
  const applyRemoteWorkbook = useCallback(
    async (workbook: WorkBook) => {
      applyWorkbook(workbook, SHEETS_FILE_NAME, false);
      const XLSX = await import('xlsx');
      const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      await cacheWorkbook(bytes, SHEETS_FILE_NAME, false);
    },
    [applyWorkbook],
  );

  /** Đẩy hết thao tác đang xếp hàng lên Google Sheet */
  const flushQueue = useCallback(async (): Promise<boolean> => {
    const config = configRef.current;
    if (!config) return false;

    const rows = await readAll();
    if (rows.length === 0) return true;

    await pushOps(
      config,
      rows.map((row) => row.op),
    );
    await removeUpTo(rows[rows.length - 1].seq);
    setPendingOps(await readAll().then((rest) => rest.length));
    return true;
  }, []);

  const syncNow = useCallback(async () => {
    const config = configRef.current;
    if (!config) return;

    setSyncState('dang-dong-bo');
    setSyncError(null);
    try {
      await flushQueue();
      const workbook = await pullWorkbook(config);
      await applyRemoteWorkbook(workbook);
      setSyncState('da-dong-bo');
    } catch (thrown) {
      const remaining = await readAll();
      setPendingOps(remaining.length);
      setSyncError(thrown instanceof Error ? thrown.message : 'Không đồng bộ được.');
      setSyncState(remaining.length > 0 ? 'cho-mang' : 'loi');
    }
  }, [applyRemoteWorkbook, flushQueue]);

  /** Ghi thao tác vào hàng đợi rồi thử đẩy ngay; mất mạng thì để lại chờ */
  const queueOp = useCallback(
    async (op: SyncOp) => {
      if (!configRef.current) return;
      await enqueue(op);
      setPendingOps((await readAll()).length);
      try {
        setSyncState('dang-dong-bo');
        await flushQueue();
        setSyncState('da-dong-bo');
        setSyncError(null);
      } catch (thrown) {
        setSyncError(thrown instanceof Error ? thrown.message : 'Chưa đẩy lên được.');
        setSyncState('cho-mang');
      }
    },
    [flushQueue],
  );

  // Nạp dữ liệu ban đầu: Google Sheet (nếu đã cấu hình) -> cache -> file mặc định
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setSupportsWriteInPlace(
        typeof window !== 'undefined' && 'showOpenFilePicker' in window,
      );

      const config = readConfig();
      configRef.current = config;
      setSheetsConfig(config);
      setPendingOps((await readAll()).length);

      if (config) {
        setSyncState('dang-dong-bo');

        // Đẩy nốt việc còn nợ TRƯỚC khi kéo về, nếu không bản kéo về sẽ đè
        // mất những khoản chi ghi lúc mất sóng.
        let pending = (await readAll()).length;
        if (pending > 0) {
          try {
            await flushQueue();
          } catch {
            // Vẫn mất mạng — giữ nguyên hàng đợi
          }
          pending = (await readAll()).length;
          if (cancelled) return;
          setPendingOps(pending);
        }

        if (pending === 0) {
          try {
            const workbook = await pullWorkbook(config);
            if (cancelled) return;
            await applyRemoteWorkbook(workbook);
            setSyncState('da-dong-bo');
            return;
          } catch (thrown) {
            if (cancelled) return;
            // Mất mạng hoặc URL sai: chạy tiếp bằng dữ liệu đã cache
            setSyncError(
              thrown instanceof Error ? thrown.message : 'Không tải được Google Sheet.',
            );
            setSyncState('cho-mang');
          }
        } else {
          setSyncError('Còn thay đổi chưa đẩy lên, đang dùng dữ liệu trong máy.');
          setSyncState('cho-mang');
        }
      }

      const cached = await loadCachedWorkbook();
      if (cancelled) return;

      if (cached) {
        try {
          await loadBytes(cached.bytes, cached.fileName, {
            cache: false,
            dirty: cached.dirty ?? false,
          });
          return;
        } catch {
          // Cache hỏng → rơi về file mặc định
        }
      }

      try {
        const response = await fetch(DEFAULT_WORKBOOK_URL);
        if (!response.ok) throw new Error('Không tải được file lịch trình mặc định.');
        const bytes = await response.arrayBuffer();
        if (cancelled) return;
        await loadBytes(bytes, DEFAULT_WORKBOOK_NAME);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error ? loadError.message : 'Không đọc được file Excel.',
        );
        setStatus('loi');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyRemoteWorkbook, flushQueue, loadBytes]);

  // Có mạng trở lại thì đẩy nốt những gì đang xếp hàng
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => {
      if (configRef.current) void syncNow();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [syncNow]);

  /** Ghi expense/selection vào workbook đang giữ và cache lại ngay */
  const syncWorkbook = useCallback((nextExpenses: Expense[], nextSelections: Selection[]) => {
    const workbook = workbookRef.current;
    if (!workbook) return;
    writeAppSheets(workbook, nextExpenses, nextSelections);
    setIsDirty(true);
    import('xlsx').then((XLSX) => {
      const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      void cacheWorkbook(bytes, fileName, true);
    });
  }, [fileName]);

  const importFile = useCallback(
    async (file: File) => {
      setStatus('dang-tai');
      try {
        const bytes = await file.arrayBuffer();
        await loadBytes(bytes, file.name);
      } catch (importError) {
        setError(
          importError instanceof Error ? importError.message : 'Không đọc được file Excel.',
        );
        setStatus('loi');
      }
    },
    [loadBytes],
  );

  /** Chọn file qua File System Access API để có thể ghi đè trực tiếp (desktop/Chrome Android) */
  const pickFile = useCallback(async () => {
    const picker = typeof window === 'undefined' ? undefined : window.showOpenFilePicker;
    if (!picker) return;
    try {
      const [handle] = await picker({
        types: [
          {
            description: 'Excel',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            },
          },
        ],
      });
      handleRef.current = handle;
      const file = await handle.getFile();
      await importFile(file);
    } catch {
      // Người dùng hủy chọn file
    }
  }, [importFile]);

  const addExpense = useCallback(
    (input: Omit<Expense, 'id' | 'createdAt'>) => {
      const expense: Expense = {
        ...input,
        id: newExpenseId(),
        createdAt: new Date().toISOString(),
      };
      setExpenses((current) => {
        const next = [...current, expense];
        syncWorkbook(next, selections);
        return next;
      });
      void queueOp({ type: 'upsert-expense', expense });
    },
    [queueOp, selections, syncWorkbook],
  );

  const updateExpense = useCallback(
    (id: string, patch: Partial<Omit<Expense, 'id' | 'createdAt'>>) => {
      setExpenses((current) => {
        const next = current.map((expense) =>
          expense.id === id ? { ...expense, ...patch } : expense,
        );
        syncWorkbook(next, selections);
        const updated = next.find((expense) => expense.id === id);
        if (updated) void queueOp({ type: 'upsert-expense', expense: updated });
        return next;
      });
    },
    [queueOp, selections, syncWorkbook],
  );

  const removeExpense = useCallback(
    (id: string) => {
      void queueOp({ type: 'delete-expense', id });
      setExpenses((current) => {
        const next = current.filter((expense) => expense.id !== id);
        syncWorkbook(next, selections);
        return next;
      });
    },
    [queueOp, selections, syncWorkbook],
  );

  const selectOption = useCallback(
    (activityKey: string, place: string, address?: string) => {
      const selection: Selection = {
        activityKey,
        selectedPlace: place,
        selectedAddress: address,
        updatedAt: new Date().toISOString(),
      };
      setSelections((current) => {
        const next = current.some((item) => item.activityKey === activityKey)
          ? current.map((item) => (item.activityKey === activityKey ? selection : item))
          : [...current, selection];
        syncWorkbook(expenses, next);
        return next;
      });
      void queueOp({ type: 'upsert-selection', selection });
    },
    [expenses, queueOp, syncWorkbook],
  );

  const clearSelection = useCallback(
    (activityKey: string) => {
      setSelections((current) => {
        const next = current.filter((item) => item.activityKey !== activityKey);
        syncWorkbook(expenses, next);
        return next;
      });
      void queueOp({ type: 'clear-selection', activityKey });
    },
    [expenses, queueOp, syncWorkbook],
  );

  /** Lưu cấu hình Google Sheet rồi kéo dữ liệu về ngay để biết URL có chạy không */
  const saveSheetsConfig = useCallback(
    async (config: SheetsConfig | null) => {
      writeConfig(config);
      configRef.current = config;
      setSheetsConfig(config);
      setSyncError(null);

      if (!config) {
        setSyncState('tat');
        return;
      }
      await syncNow();
    },
    [syncNow],
  );

  const exportExcel = useCallback(async () => {
    const workbook = workbookRef.current;
    if (!workbook) throw new Error('Chưa có dữ liệu Excel để lưu.');
    writeAppSheets(workbook, expenses, selections);
    const result = await saveWorkbook(workbook, handleRef.current, fileName);
    setIsDirty(false);
    // Cache phải hết dirty theo, nếu không lần mở lại sẽ báo nhầm "chưa lưu"
    const XLSX = await import('xlsx');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    await cacheWorkbook(bytes, fileName, false);
    return result;
  }, [expenses, fileName, selections]);

  const value = useMemo<TripContextValue>(
    () => ({
      status,
      error,
      trip,
      expenses,
      selections,
      fileName,
      isDirty,
      canWriteInPlace: supportsWriteInPlace,
      importFile,
      pickFile,
      addExpense,
      updateExpense,
      removeExpense,
      selectOption,
      clearSelection,
      exportExcel,
      sheetsConfig,
      syncState,
      syncError,
      pendingOps,
      saveSheetsConfig,
      syncNow,
    }),
    [
      status,
      error,
      trip,
      expenses,
      selections,
      fileName,
      isDirty,
      supportsWriteInPlace,
      importFile,
      pickFile,
      addExpense,
      updateExpense,
      removeExpense,
      selectOption,
      clearSelection,
      exportExcel,
      sheetsConfig,
      syncState,
      syncError,
      pendingOps,
      saveSheetsConfig,
      syncNow,
    ],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const context = useContext(TripContext);
  if (!context) throw new Error('useTrip phải nằm trong TripProvider');
  return context;
}
