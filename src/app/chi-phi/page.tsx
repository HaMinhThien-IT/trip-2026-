'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTrip } from '@/context/TripProvider';
import { useNow } from '@/hooks/useNow';
import { pickActiveDay } from '@/hooks/useCurrentActivity';
import { useActivitySheets } from '@/hooks/useActivitySheets';
import { ExcelStatusCard } from '@/components/ExcelStatusCard';
import { ErrorState, LoadingState } from '@/components/States';
import {
  formatVnd,
  groupByCategory,
  groupExpensesByActivity,
  totalEstimated,
  totalForDate,
  totalOf,
} from '@/services/expenseService';

export default function ExpensesPage() {
  const { status, error, trip, expenses } = useTrip();
  const now = useNow();
  const sheets = useActivitySheets();
  const [openDate, setOpenDate] = useState<string | null>(null);

  const activeDate = trip ? (pickActiveDay(trip, now).day?.date ?? null) : null;

  const total = useMemo(() => totalOf(expenses), [expenses]);
  const byCategory = useMemo(() => groupByCategory(expenses), [expenses]);
  const estimated = useMemo(() => (trip ? totalEstimated(trip.days) : null), [trip]);

  if (status === 'dang-tai') return <LoadingState />;
  if (status === 'loi' || !trip) return <ErrorState message={error} />;

  const todayTotal = activeDate ? totalForDate(expenses, activeDate) : 0;
  const largestCategory = byCategory[0]?.total ?? 0;

  return (
    <div className="space-y-5 pb-2">
      <header>
        <h1 className="text-2xl font-bold leading-tight">Chi phí</h1>
        <p className="text-sm text-muted">{trip.name}</p>
      </header>

      <section className="rounded-3xl bg-gradient-to-b from-primary to-primary-dark p-5 text-white shadow-lg shadow-primary/30">
        <p className="text-xs font-bold tracking-[0.18em] text-white/80">
          CHI PHÍ CHUYẾN ĐI
        </p>
        <p className="mt-1 text-sm text-white/85">Tổng đã chi</p>
        <p className="text-4xl font-bold tabular-nums">{formatVnd(total)}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/25 pt-3">
          <div>
            <p className="text-xs text-white/80">Hôm nay</p>
            <p className="text-lg font-semibold tabular-nums">{formatVnd(todayTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-white/80">Toàn chuyến</p>
            <p className="text-lg font-semibold tabular-nums">{formatVnd(total)}</p>
          </div>
        </div>
      </section>

      {/* Chỉ so sánh khi Excel thực sự có chi phí dự kiến — ô trống không phải 0đ */}
      {estimated !== null ? (
        <section className="rounded-3xl border border-soft-pink bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted">DỰ KIẾN</p>
              <p className="text-lg font-semibold tabular-nums">{formatVnd(estimated)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted">ĐÃ CHI</p>
              <p className="text-lg font-semibold tabular-nums">{formatVnd(total)}</p>
            </div>
          </div>
          <p className="mt-2 text-sm text-primary-dark">
            {total <= estimated
              ? `Còn lại so với dự kiến: ${formatVnd(estimated - total)}`
              : `Vượt dự kiến: ${formatVnd(total - estimated)}`}
          </p>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => sheets.openFreeExpense(activeDate ?? undefined)}
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white active:bg-primary-dark"
      >
        <Plus size={20} aria-hidden />
        Thêm khoản chi
      </button>

      {expenses.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-soft-pink bg-white px-4 py-8 text-center text-sm text-muted">
          Chưa ghi khoản chi nào. Ghi ngay khi vừa tiêu để không quên nhé.
        </p>
      ) : null}

      {byCategory.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-semibold">Chi theo nhóm</h2>
          <ul className="space-y-3">
            {byCategory.map((item) => (
              <li key={item.category}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{item.category}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatVnd(item.total)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-soft-pink">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: largestCategory
                        ? `${(item.total / largestCategory) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {trip.days.length > 0 && expenses.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-semibold">Theo ngày</h2>
          <ul className="space-y-2">
            {trip.days.map((day) => {
              const dayExpenses = expenses.filter((expense) => expense.date === day.date);
              const dayTotal = totalOf(dayExpenses);
              const expanded = openDate === day.date;

              return (
                <li key={day.id} className="rounded-2xl border border-soft-pink bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenDate(expanded ? null : day.date)}
                    aria-expanded={expanded}
                    className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 text-left"
                  >
                    <span>
                      <span className="block text-sm font-semibold">{day.label}</span>
                      <span className="block text-xs text-muted tabular-nums">{day.date}</span>
                    </span>
                    <span className="text-base font-bold tabular-nums text-primary-dark">
                      {formatVnd(dayTotal)}
                    </span>
                  </button>

                  {expanded ? (
                    <div className="border-t border-soft-pink px-4 py-3">
                      {dayExpenses.length === 0 ? (
                        <p className="text-sm text-muted">Chưa có khoản chi nào trong ngày.</p>
                      ) : (
                        <ul className="space-y-4">
                          {groupExpensesByActivity(dayExpenses, day.activities).map((group) => (
                            <li key={group.key}>
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="text-sm font-semibold">{group.title}</span>
                                <span className="text-sm font-semibold tabular-nums">
                                  {formatVnd(group.total)}
                                </span>
                              </div>
                              {group.subtitle ? (
                                <p className="text-xs text-muted">{group.subtitle}</p>
                              ) : null}

                              <ul className="mt-2 space-y-1">
                                {group.items.map((expense) => (
                                  <li key={expense.id} className="flex items-center gap-2">
                                    <span className="min-w-0 flex-1 truncate text-sm text-muted">
                                      {expense.description || expense.category}
                                    </span>
                                    <span className="text-sm tabular-nums">
                                      {formatVnd(expense.amount)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => sheets.openEditExpense(expense)}
                                      aria-label={`Sửa khoản chi ${formatVnd(expense.amount)}`}
                                      className="flex size-9 items-center justify-center rounded-full text-muted active:bg-soft-pink"
                                    >
                                      <Pencil size={15} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => sheets.requestDeleteExpense(expense)}
                                      aria-label={`Xóa khoản chi ${formatVnd(expense.amount)}`}
                                      className="flex size-9 items-center justify-center rounded-full text-muted active:bg-soft-pink"
                                    >
                                      <Trash2 size={15} aria-hidden />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      )}

                      <p className="mt-4 flex items-baseline justify-between border-t border-soft-pink pt-2 text-sm font-bold">
                        <span>Tổng ngày</span>
                        <span className="tabular-nums">{formatVnd(dayTotal)}</span>
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <ExcelStatusCard />

      {sheets.sheets}
    </div>
  );
}
