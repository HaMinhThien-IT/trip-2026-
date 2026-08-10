'use client';

import { useState } from 'react';
import { useTrip } from '@/context/TripProvider';
import { useNow } from '@/hooks/useNow';
import { pickActiveDay, useCurrentActivity } from '@/hooks/useCurrentActivity';
import { useActivitySheets } from '@/hooks/useActivitySheets';
import { Timeline } from '@/components/Timeline';
import { ExcelStatusCard } from '@/components/ExcelStatusCard';
import { ErrorState, LoadingState } from '@/components/States';
import { formatVnd, totalForDate } from '@/services/expenseService';

export default function ItineraryPage() {
  const { status, error, trip, expenses, selections } = useTrip();
  const now = useNow();
  const sheets = useActivitySheets();
  const progress = useCurrentActivity(trip, now);
  // null = chưa chọn tay → mặc định mở đúng ngày đang diễn ra
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  if (status === 'dang-tai') return <LoadingState />;
  if (status === 'loi' || !trip) return <ErrorState message={error} />;

  const activeDate = pickedDate ?? pickActiveDay(trip, now).day?.date ?? null;
  const day = trip.days.find((item) => item.date === activeDate) ?? trip.days[0];
  if (!day) return <ErrorState message="File Excel chưa có hoạt động nào." />;

  const dayTotal = totalForDate(expenses, day.date);

  return (
    <div className="space-y-5 pb-2">
      <header>
        <h1 className="text-2xl font-bold leading-tight">Lịch trình</h1>
        <p className="text-sm text-muted">{trip.name}</p>
      </header>

      {trip.days.length > 1 ? (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {trip.days.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPickedDate(item.date)}
              className={`min-h-[52px] shrink-0 rounded-2xl px-4 text-left text-sm font-semibold ${
                item.date === day.date
                  ? 'bg-primary text-white'
                  : 'border border-soft-pink bg-white text-muted'
              }`}
            >
              <span className="block">{item.label}</span>
              <span className="block text-xs font-medium tabular-nums opacity-80">
                {item.date}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">
            {day.label} · {day.date}
          </h2>
          {dayTotal > 0 ? (
            <span className="text-sm font-semibold text-primary-dark tabular-nums">
              {formatVnd(dayTotal)}
            </span>
          ) : null}
        </div>

        <Timeline
          activities={day.activities}
          currentKey={
            // Chỉ đánh dấu "đang diễn ra" khi đang xem đúng ngày thật của hôm nay
            progress.isRealToday && progress.day?.date === day.date
              ? (progress.current?.activityKey ?? null)
              : null
          }
          selections={selections}
          expenses={expenses}
          onOpenActivity={sheets.openActivity}
        />
      </section>

      <ExcelStatusCard />

      {sheets.sheets}
    </div>
  );
}
