'use client';

import { useTrip } from '@/context/TripProvider';
import { useNow } from '@/hooks/useNow';
import { useCurrentActivity } from '@/hooks/useCurrentActivity';
import { useActivitySheets } from '@/hooks/useActivitySheets';
import { CurrentActivityCard } from '@/components/CurrentActivityCard';
import { NextActivityCard } from '@/components/NextActivityCard';
import { Timeline } from '@/components/Timeline';
import { LoadingState, ErrorState } from '@/components/States';
import { totalForActivity } from '@/services/expenseService';

export default function TodayPage() {
  const { status, error, trip, expenses, selections } = useTrip();
  const now = useNow();
  const progress = useCurrentActivity(trip, now);
  const sheets = useActivitySheets();

  if (status === 'dang-tai') return <LoadingState />;
  if (status === 'loi' || !trip) return <ErrorState message={error} />;

  const { day, isRealToday, current, next, minutesToNext, doneCount, totalCount } = progress;
  if (!day) return <ErrorState message="File Excel chưa có hoạt động nào." />;

  const heroActivity = progress.phase === 'chua-bat-dau' ? next : current;
  const heroSelection = heroActivity ? sheets.selectionFor(heroActivity.activityKey) : undefined;
  const heroSpent = heroActivity ? totalForActivity(expenses, heroActivity.activityKey) : 0;

  return (
    <div className="space-y-5 pb-2">
      <header>
        <h1 className="text-2xl font-bold leading-tight">{trip.name}</h1>
        <p className="text-sm text-muted">
          Ngày {trip.days.findIndex((item) => item.id === day.id) + 1} · {day.date}
        </p>
        {!isRealToday ? (
          <p className="mt-2 rounded-2xl bg-soft-pink px-3 py-2 text-xs leading-relaxed text-primary-dark">
            Hôm nay chưa nằm trong lịch trình — đang xem trước ngày {day.date}.
          </p>
        ) : null}
      </header>

      <CurrentActivityCard
        progress={progress}
        selection={heroSelection}
        spent={heroSpent}
        onAddExpense={sheets.openExpenseFor}
        onOpenActivity={sheets.openActivity}
      />

      {next && progress.phase !== 'chua-bat-dau' ? (
        <NextActivityCard
          activity={next}
          minutesToNext={minutesToNext}
          selection={sheets.selectionFor(next.activityKey)}
          onOpenOptions={sheets.openOptions}
        />
      ) : null}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Lịch trình trong ngày</h2>
          <span className="text-sm text-muted tabular-nums">
            {doneCount}/{totalCount} hoạt động
          </span>
        </div>
        <div
          className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-soft-pink"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label="Tiến độ trong ngày"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: totalCount ? `${(doneCount / totalCount) * 100}%` : '0%' }}
          />
        </div>

        <Timeline
          activities={day.activities}
          currentKey={current?.activityKey ?? null}
          selections={selections}
          expenses={expenses}
          onOpenActivity={sheets.openActivity}
          autoFocusCurrent={isRealToday}
        />
      </section>

      {sheets.sheets}
    </div>
  );
}
