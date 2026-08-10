'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useTrip } from '@/context/TripProvider';
import { ImportExcelButton } from './ImportExcelButton';

export function ExcelStatusCard() {
  const { fileName, isDirty, exportExcel } = useTrip();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await exportExcel();
      setMessage(
        result === 'ghi-de'
          ? 'Đã lưu thay đổi vào file Excel.'
          : 'Đã tải về file Excel đã cập nhật.',
      );
    } catch {
      setMessage('Không lưu được file. Hãy thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-soft-pink bg-white p-4">
      <div className="flex items-start gap-3">
        <FileSpreadsheet size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Dữ liệu từ Excel</p>
          <p className="truncate text-xs text-muted">{fileName}</p>
          <p
            className={`mt-1 text-xs font-medium ${
              isDirty ? 'text-primary-dark' : 'text-muted'
            }`}
          >
            {isDirty ? 'Đã có thay đổi chưa lưu' : 'Chưa có thay đổi mới'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-white active:bg-primary-dark disabled:opacity-60"
        >
          <Download size={18} aria-hidden />
          {saving ? 'Đang lưu…' : 'Lưu / Xuất Excel'}
        </button>
        <ImportExcelButton className="flex-1" />
      </div>

      {message ? <p className="mt-2 text-xs text-primary-dark">{message}</p> : null}
    </section>
  );
}
