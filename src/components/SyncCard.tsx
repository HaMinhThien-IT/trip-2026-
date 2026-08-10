'use client';

import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useTrip } from '@/context/TripProvider';
import { DEFAULT_URL } from '@/services/sheetsService';
import { BottomSheet } from './BottomSheet';

const STATE_TEXT: Record<string, string> = {
  tat: 'Chưa bật — dữ liệu chỉ nằm trong máy',
  'dang-dong-bo': 'Đang đồng bộ…',
  'da-dong-bo': 'Đã đồng bộ với Google Sheet',
  'cho-mang': 'Chưa đẩy lên được, sẽ tự thử lại khi có mạng',
  loi: 'Không kết nối được Google Sheet',
};

export function SyncCard() {
  const { sheetsConfig, syncState, syncError, pendingOps, saveSheetsConfig, syncNow } = useTrip();
  const [open, setOpen] = useState(false);
  // URL đã cấu hình sẵn lúc build nên chỉ cần điền token
  const [url, setUrl] = useState(sheetsConfig?.url ?? DEFAULT_URL);
  const [token, setToken] = useState(sheetsConfig?.token ?? '');
  const [busy, setBusy] = useState(false);

  const on = sheetsConfig !== null;

  const handleSave = async () => {
    setBusy(true);
    try {
      await saveSheetsConfig(url.trim() ? { url: url.trim(), token: token.trim() } : null);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await saveSheetsConfig(null);
      setUrl('');
      setToken('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="rounded-3xl border border-soft-pink bg-white p-4">
        <div className="flex items-start gap-3">
          {on ? (
            <Cloud size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          ) : (
            <CloudOff size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Đồng bộ Google Sheet</p>
            <p
              className={`text-xs ${
                syncState === 'da-dong-bo' || syncState === 'tat'
                  ? 'text-muted'
                  : 'text-primary-dark'
              }`}
            >
              {STATE_TEXT[syncState]}
            </p>
            {pendingOps > 0 ? (
              <p className="mt-0.5 text-xs text-primary-dark">
                {pendingOps} thay đổi đang chờ đẩy lên
              </p>
            ) : null}
            {syncError ? (
              <p className="mt-0.5 break-words text-xs text-muted">{syncError}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-[48px] flex-1 rounded-2xl border border-soft-pink text-sm font-semibold text-primary-dark active:bg-soft-pink"
          >
            {on ? 'Cài đặt' : 'Bật đồng bộ'}
          </button>
          {on ? (
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={syncState === 'dang-dong-bo'}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-white active:bg-primary-dark disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                aria-hidden
                className={syncState === 'dang-dong-bo' ? 'animate-spin' : ''}
              />
              Đồng bộ
            </button>
          ) : null}
        </div>
      </section>

      {open ? (
        <BottomSheet open title="Đồng bộ Google Sheet" onClose={() => setOpen(false)}>
          <p className="text-sm leading-relaxed text-muted">
            Dán đường dẫn Web App của Google Apps Script. Không ai phải đăng nhập — script chạy
            bằng quyền của chủ sheet. Hướng dẫn tạo nằm trong file{' '}
            <span className="font-medium text-ink">google-sheets/README.md</span> của repo.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="sheets-url" className="text-sm font-semibold">
                Đường dẫn Web App
              </label>
              <input
                id="sheets-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://script.google.com/macros/s/…/exec"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="mt-1 min-h-[52px] w-full rounded-2xl border border-soft-pink bg-white px-4 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="sheets-token" className="text-sm font-semibold">
                Token bí mật
              </label>
              <p className="text-xs text-muted">
                Chuỗi bạn tự đặt ở dòng <code>const TOKEN</code> trong Code.gs — gõ lại đúng
                y hệt.
              </p>
              <input
                id="sheets-token"
                type="text"
                autoComplete="off"
                placeholder="vd: hoian-2026-76eig7tb"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="mt-1 min-h-[52px] w-full rounded-2xl border border-soft-pink bg-white px-4 text-sm outline-none focus:border-primary"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || !url.trim()}
              className="min-h-[52px] w-full rounded-2xl bg-primary text-base font-bold text-white active:bg-primary-dark disabled:opacity-60"
            >
              {busy ? 'Đang kiểm tra…' : 'Lưu và đồng bộ'}
            </button>

            {on ? (
              <button
                type="button"
                onClick={() => void handleDisconnect()}
                disabled={busy}
                className="min-h-[48px] w-full rounded-2xl border border-soft-pink text-sm font-semibold text-muted active:bg-app-bg"
              >
                Ngắt đồng bộ, quay về dùng file Excel
              </button>
            ) : null}
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}
