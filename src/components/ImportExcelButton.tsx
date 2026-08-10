'use client';

import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useTrip } from '@/context/TripProvider';

export function ImportExcelButton({ className = '' }: { className?: string }) {
  const { importFile, pickFile, canWriteInPlace } = useTrip();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => {
    // Chrome desktop/Android: chọn qua File System Access API để có thể ghi đè file gốc
    if (canWriteInPlace) {
      void pickFile();
      return;
    }
    inputRef.current?.click();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-soft-pink bg-white px-5 text-sm font-semibold text-primary-dark active:bg-soft-pink ${className}`}
      >
        <Upload size={18} aria-hidden />
        Chọn file Excel
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.target.value = '';
        }}
      />
    </>
  );
}
