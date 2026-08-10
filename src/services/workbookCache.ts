/**
 * Cache tạm workbook trong IndexedDB để không mất dữ liệu khi reload trang.
 * Đây KHÔNG phải nơi lưu chính — file Excel mới là nguồn dữ liệu và đầu ra.
 */
const DB_NAME = 'trip-workbook';
const STORE = 'workbook';
const KEY = 'current';

type CachedWorkbook = {
  bytes: ArrayBuffer;
  fileName: string;
  savedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheWorkbook(bytes: ArrayBuffer, fileName: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(
        { bytes, fileName, savedAt: new Date().toISOString() } satisfies CachedWorkbook,
        KEY,
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Cache hỏng thì bỏ qua — app vẫn chạy được từ file Excel
  }
}

export async function loadCachedWorkbook(): Promise<CachedWorkbook | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    const result = await new Promise<CachedWorkbook | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve((request.result as CachedWorkbook) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function clearCachedWorkbook(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // bỏ qua
  }
}
