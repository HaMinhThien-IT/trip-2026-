'use client';

import { useSyncExternalStore } from 'react';

const TICK_MS = 30_000;

let snapshot: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  snapshot = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    tick();
    timer = setInterval(tick, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => snapshot;
/** Server không có "bây giờ" của điện thoại — trả null để render khớp lần đầu */
const getServerSnapshot = () => null;

/** Đồng hồ theo giờ local của điện thoại, cập nhật mỗi 30 giây */
export function useNow(): Date | null {
  const timestamp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return timestamp === null ? null : new Date(timestamp);
}
