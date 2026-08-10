'use client';

import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { ImportExcelButton } from './ImportExcelButton';

export function LoadingState() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-muted">
      <Loader2 size={28} className="animate-spin text-primary" aria-hidden />
      <p className="text-sm">Đang đọc file Excel…</p>
    </div>
  );
}

export function ErrorState({ message }: { message?: string | null }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
      <FileSpreadsheet size={32} className="text-primary" aria-hidden />
      <p className="text-base font-semibold">Chưa đọc được lịch trình</p>
      <p className="max-w-[280px] text-sm text-muted">
        {message ?? 'Hãy chọn file Excel lịch trình để bắt đầu.'}
      </p>
      <ImportExcelButton className="mt-2" />
    </div>
  );
}
