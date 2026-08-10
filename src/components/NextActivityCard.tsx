'use client';

import { ChevronRight } from 'lucide-react';
import type { Activity } from '@/types/itinerary';
import type { Selection } from '@/types/expense';
import { DirectionsButton } from './DirectionsButton';
import { formatCountdown } from '@/hooks/useCurrentActivity';

type NextActivityCardProps = {
  activity: Activity;
  minutesToNext: number | null;
  selection?: Selection;
  onOpenOptions: (activity: Activity) => void;
};

export function NextActivityCard({
  activity,
  minutesToNext,
  selection,
  onOpenOptions,
}: NextActivityCardProps) {
  const hasOptions = activity.options.length > 0;

  return (
    <section className="rounded-3xl border border-soft-pink bg-white p-5 shadow-sm">
      <p className="text-xs font-bold tracking-[0.18em] text-muted">TIẾP THEO</p>

      <p className="mt-2 text-xl font-bold tabular-nums">{activity.startTime}</p>
      <h3 className="text-lg font-semibold leading-snug">{activity.title}</h3>

      {typeof minutesToNext === 'number' ? (
        <p className="mt-1 text-sm font-medium text-primary-dark">
          Bắt đầu sau {formatCountdown(minutesToNext)}
        </p>
      ) : null}

      {hasOptions && !selection ? (
        <div className="mt-4">
          <p className="text-sm text-muted">
            {activity.options.length} địa điểm có thể chọn
          </p>
          <button
            type="button"
            onClick={() => onOpenOptions(activity)}
            className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-1 rounded-2xl bg-soft-pink px-5 text-sm font-semibold text-primary-dark active:bg-primary active:text-white"
          >
            Xem lựa chọn
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      ) : null}

      {hasOptions && selection ? (
        <div className="mt-4">
          <p className="text-sm text-muted">Đã chọn</p>
          <p className="text-base font-semibold">{selection.selectedPlace}</p>
          {selection.selectedAddress ? (
            <p className="text-sm text-muted">{selection.selectedAddress}</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <DirectionsButton
              parts={[selection.selectedPlace, selection.selectedAddress]}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => onOpenOptions(activity)}
              className="min-h-[48px] flex-1 rounded-2xl border border-soft-pink text-sm font-semibold text-primary-dark active:bg-soft-pink"
            >
              Đổi lựa chọn
            </button>
          </div>
        </div>
      ) : null}

      {!hasOptions && (activity.place || activity.address) ? (
        <div className="mt-4">
          <p className="text-base font-medium">{activity.place}</p>
          {activity.address ? (
            <p className="text-sm text-muted">{activity.address}</p>
          ) : null}
          <DirectionsButton
            parts={[activity.place, activity.address, activity.title]}
            variant="ghost"
            className="mt-3 w-full"
          />
        </div>
      ) : null}
    </section>
  );
}
