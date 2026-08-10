import type { SyncOp } from './sheetsService';

/**
 * Hàng đợi thao tác chờ đẩy lên Google Sheet. Nằm trong IndexedDB để
 * ghi chi phí lúc mất sóng không mất khi đóng app.
 */
const DB_NAME = 'trip-sync';
const STORE = 'ops';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueue(op: SyncOp): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ op });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function readAll(): Promise<{ seq: number; op: SyncOp }[]> {
  if (typeof indexedDB === 'undefined') return [];
  const db = await openDb();
  const rows = await new Promise<{ seq: number; op: SyncOp }[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as { seq: number; op: SyncOp }[]) ?? []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows;
}

export async function removeUpTo(seq: number): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (Number(cursor.key) <= seq) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function count(): Promise<number> {
  return (await readAll()).length;
}
