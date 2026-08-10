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
import { nextExpenseId } from '@/services/expenseService';
import { cacheWorkbook, loadCachedWorkbook } from '@/services/workbookCache';

/** File Excel mặc định đi kèm app, người dùng vẫn có thể import file khác */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const DEFAULT_WORKBOOK_URL = `${BASE_PATH}/lich-trinh.xlsx`;
const DEFAULT_WORKBOOK_NAME = 'lich-trinh.xlsx';

type Status = 'dang-tai' | 'san-sang' | 'loi';

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

  // Workbook giữ ngoài state React: object lớn, không cần render lại khi đổi
  const workbookRef = useRef<WorkBook | null>(null);
  const handleRef = useRef<FileSystemFileHandle | null>(null);

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

  // Nạp dữ liệu ban đầu: ưu tiên workbook đã cache, nếu không có thì dùng file mặc định
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setSupportsWriteInPlace(
        typeof window !== 'undefined' && 'showOpenFilePicker' in window,
      );

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
  }, [loadBytes]);

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
      setExpenses((current) => {
        const expense: Expense = {
          ...input,
          id: nextExpenseId(current),
          createdAt: new Date().toISOString(),
        };
        const next = [...current, expense];
        syncWorkbook(next, selections);
        return next;
      });
    },
    [selections, syncWorkbook],
  );

  const updateExpense = useCallback(
    (id: string, patch: Partial<Omit<Expense, 'id' | 'createdAt'>>) => {
      setExpenses((current) => {
        const next = current.map((expense) =>
          expense.id === id ? { ...expense, ...patch } : expense,
        );
        syncWorkbook(next, selections);
        return next;
      });
    },
    [selections, syncWorkbook],
  );

  const removeExpense = useCallback(
    (id: string) => {
      setExpenses((current) => {
        const next = current.filter((expense) => expense.id !== id);
        syncWorkbook(next, selections);
        return next;
      });
    },
    [selections, syncWorkbook],
  );

  const selectOption = useCallback(
    (activityKey: string, place: string, address?: string) => {
      setSelections((current) => {
        const selection: Selection = {
          activityKey,
          selectedPlace: place,
          selectedAddress: address,
          updatedAt: new Date().toISOString(),
        };
        const next = current.some((item) => item.activityKey === activityKey)
          ? current.map((item) => (item.activityKey === activityKey ? selection : item))
          : [...current, selection];
        syncWorkbook(expenses, next);
        return next;
      });
    },
    [expenses, syncWorkbook],
  );

  const clearSelection = useCallback(
    (activityKey: string) => {
      setSelections((current) => {
        const next = current.filter((item) => item.activityKey !== activityKey);
        syncWorkbook(expenses, next);
        return next;
      });
    },
    [expenses, syncWorkbook],
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
    ],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const context = useContext(TripContext);
  if (!context) throw new Error('useTrip phải nằm trong TripProvider');
  return context;
}
