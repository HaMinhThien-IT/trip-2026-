'use client';

import { CircleCheck } from 'lucide-react';
import type { Activity } from '@/types/itinerary';
import type { Selection } from '@/types/expense';
import { BottomSheet } from './BottomSheet';
import { DirectionsButton } from './DirectionsButton';
import { formatEstimated } from '@/services/expenseService';

type ActivityOptionPickerProps = {
  activity: Activity | null;
  selection?: Selection;
  onClose: () => void;
  onSelect: (activityKey: string, place: string, address?: string) => void;
  onClear: (activityKey: string) => void;
};

export function ActivityOptionPicker({
  activity,
  selection,
  onClose,
  onSelect,
  onClear,
}: ActivityOptionPickerProps) {
  if (!activity) return null;

  return (
    <BottomSheet open title={activity.title} onClose={onClose}>
      <p className="text-sm text-muted">
        {activity.startTime} · Chọn 1 trong {activity.options.length}
      </p>

      <ul className="mt-4 space-y-3">
        {activity.options.map((option) => {
          const chosen = selection?.selectedPlace === option.name;
          return (
            <li
              key={option.id}
              className={`rounded-2xl border p-4 ${
                chosen ? 'border-primary bg-soft-pink' : 'border-soft-pink bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-snug">{option.name}</p>
                  {option.address ? (
                    <p className="text-sm text-muted">{option.address}</p>
                  ) : null}
                  {option.estimatedCost !== null && option.estimatedCost !== undefined ? (
                    <p className="mt-1 text-sm text-muted">
                      Dự kiến: {formatEstimated(option.estimatedCost)}
                    </p>
                  ) : null}
                </div>
                {chosen ? (
                  <CircleCheck size={22} className="shrink-0 text-primary-dark" aria-hidden />
                ) : null}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    chosen
                      ? onClear(activity.activityKey)
                      : onSelect(activity.activityKey, option.name, option.address)
                  }
                  className={`min-h-[48px] flex-1 rounded-2xl text-sm font-semibold ${
                    chosen
                      ? 'border border-primary text-primary-dark active:bg-white'
                      : 'bg-primary text-white active:bg-primary-dark'
                  }`}
                >
                  {chosen ? 'Bỏ chọn' : 'Chọn'}
                </button>
                <DirectionsButton
                  parts={[option.name, option.address]}
                  variant="ghost"
                  className="flex-1"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
