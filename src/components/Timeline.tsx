'use client';

import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import type { Activity } from '@/types/itinerary';
import type { Expense, Selection } from '@/types/expense';
import { formatVnd, totalForActivity } from '@/services/expenseService';

type TimelineProps = {
  activities: Activity[];
  currentKey: string | null;
  selections: Selection[];
  expenses: Expense[];
  onOpenActivity: (activity: Activity) => void;
  /** Cuộn tới hoạt động hiện tại khi mở màn hình Hôm nay */
  autoFocusCurrent?: boolean;
};

export function Timeline({
  activities,
  currentKey,
  selections,
  expenses,
  onOpenActivity,
  autoFocusCurrent = false,
}: TimelineProps) {
  const currentRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (!autoFocusCurrent || !currentRef.current) return;
    currentRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [autoFocusCurrent, currentKey]);

  const currentIndex = activities.findIndex((activity) => activity.activityKey === currentKey);

  return (
    <ol className="relative space-y-2 pl-7">
      <span
        className="absolute left-[9px] top-3 bottom-3 w-px bg-soft-pink"
        aria-hidden
      />
      {activities.map((activity, index) => {
        const isCurrent = activity.activityKey === currentKey;
        const isPast = currentIndex >= 0 && index < currentIndex;
        const selection = selections.find((item) => item.activityKey === activity.activityKey);
        const spent = totalForActivity(expenses, activity.activityKey);
        const place = selection?.selectedPlace ?? activity.place;

        return (
          <li key={activity.activityKey} ref={isCurrent ? currentRef : null} className="relative">
            <span
              className={`absolute -left-7 top-3.5 flex size-[18px] items-center justify-center rounded-full border-2 ${
                isCurrent
                  ? 'border-primary-dark bg-primary-dark'
                  : isPast
                    ? 'border-primary/40 bg-primary/40'
                    : 'border-soft-pink bg-white'
              }`}
              aria-hidden
            >
              {isPast ? <Check size={11} className="text-white" strokeWidth={3} /> : null}
            </span>

            <button
              type="button"
              onClick={() => onOpenActivity(activity)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                isCurrent
                  ? 'border-primary bg-soft-pink shadow-sm'
                  : isPast
                    ? 'border-transparent bg-white/60 opacity-70'
                    : 'border-soft-pink bg-white'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={`text-sm font-bold tabular-nums ${
                    isCurrent ? 'text-primary-dark' : 'text-muted'
                  }`}
                >
                  {activity.startTime}
                </span>
                {spent > 0 ? (
                  <span className="text-xs font-semibold text-muted">{formatVnd(spent)}</span>
                ) : null}
              </div>

              <p
                className={`mt-0.5 leading-snug ${
                  isCurrent ? 'text-base font-bold' : 'text-[15px] font-medium'
                }`}
              >
                {activity.title}
              </p>

              {place ? <p className="text-sm text-muted">{place}</p> : null}

              {!place && activity.options.length > 0 ? (
                <p className="text-sm text-muted">
                  Chọn 1 trong {activity.options.length} địa điểm
                </p>
              ) : null}

              {isCurrent ? (
                <span className="mt-2 inline-block rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white">
                  ĐANG DIỄN RA
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
