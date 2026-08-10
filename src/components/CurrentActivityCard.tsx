'use client';

import { Plus, PartyPopper } from 'lucide-react';
import type { Activity } from '@/types/itinerary';
import type { Selection } from '@/types/expense';
import { DirectionsButton } from './DirectionsButton';
import { formatCountdown, type DayProgress } from '@/hooks/useCurrentActivity';
import { formatVnd } from '@/services/expenseService';

type CurrentActivityCardProps = {
  progress: DayProgress;
  selection?: Selection;
  spent: number;
  onAddExpense: (activity: Activity) => void;
  onOpenActivity: (activity: Activity) => void;
};

export function CurrentActivityCard({
  progress,
  selection,
  spent,
  onAddExpense,
  onOpenActivity,
}: CurrentActivityCardProps) {
  const { phase, current, next, minutesToNext } = progress;

  if (phase === 'da-xong' && !current) {
    return <EmptyCard />;
  }

  // Trước hoạt động đầu tiên: giới thiệu hoạt động sắp tới thay vì để trống
  const activity = phase === 'chua-bat-dau' ? next : current;
  if (!activity) return <EmptyCard />;

  const label = phase === 'chua-bat-dau' ? 'SẮP BẮT ĐẦU' : 'BÂY GIỜ';
  const place = selection?.selectedPlace ?? activity.place;
  const address = selection?.selectedAddress ?? activity.address;

  return (
    <section className="rounded-3xl bg-gradient-to-b from-primary to-primary-dark p-5 text-white shadow-lg shadow-primary/30">
      <p className="text-xs font-bold tracking-[0.18em] text-white/80">{label}</p>

      <button
        type="button"
        onClick={() => onOpenActivity(activity)}
        className="mt-2 block w-full text-left"
      >
        <p className="text-3xl font-bold tabular-nums">{activity.startTime}</p>
        <h2 className="mt-1 text-2xl font-bold leading-tight">{activity.title}</h2>

        {place ? <p className="mt-3 text-lg font-medium leading-snug">{place}</p> : null}
        {address ? <p className="text-sm leading-snug text-white/85">{address}</p> : null}

        {!place && activity.options.length > 0 ? (
          <p className="mt-3 text-base font-medium text-white/90">
            {activity.options.length} địa điểm có thể chọn
          </p>
        ) : null}
      </button>

      {typeof minutesToNext === 'number' && next ? (
        <p className="mt-4 text-base font-semibold text-white/95">
          {phase === 'chua-bat-dau'
            ? `Bắt đầu sau ${formatCountdown(minutesToNext)}`
            : `Còn ${formatCountdown(minutesToNext)} đến hoạt động tiếp theo`}
        </p>
      ) : null}

      <div className="mt-4">
        <DirectionsButton
          parts={[place, address, activity.title]}
          variant="on-primary"
          className="w-full"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/25 pt-3">
        <p className="text-sm text-white/90">
          {spent > 0 ? `Đã chi: ${formatVnd(spent)}` : 'Chưa ghi chi phí'}
        </p>
        <button
          type="button"
          onClick={() => onAddExpense(activity)}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-white/20 px-4 text-sm font-semibold active:bg-white/30"
        >
          <Plus size={16} aria-hidden />
          Ghi chi phí
        </button>
      </div>
    </section>
  );
}

function EmptyCard() {
  return (
    <section className="rounded-3xl bg-gradient-to-b from-primary to-primary-dark p-6 text-center text-white shadow-lg shadow-primary/30">
      <PartyPopper size={36} className="mx-auto" aria-hidden />
      <p className="mt-3 text-xl font-bold leading-snug">Đã hoàn thành lịch trình hôm nay 🎉</p>
      <p className="mt-1 text-sm text-white/85">Nghỉ ngơi thôi, mai đi tiếp nhé.</p>
    </section>
  );
}
