'use client';

type ConfirmDialogProps = {
  open: boolean;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  message,
  confirmLabel = 'Xóa',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <button
        type="button"
        aria-label="Hủy"
        className="absolute inset-0 bg-ink/40"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-[340px] rounded-3xl bg-white p-5 shadow-2xl"
      >
        <p className="text-center text-base font-semibold leading-snug">{message}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] flex-1 rounded-2xl border border-soft-pink text-sm font-semibold text-muted active:bg-app-bg"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[48px] flex-1 rounded-2xl bg-primary text-sm font-bold text-white active:bg-primary-dark"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
