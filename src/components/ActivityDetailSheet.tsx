'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Activity } from '@/types/itinerary';
import type { Expense, Selection } from '@/types/expense';
import { BottomSheet } from './BottomSheet';
import { DirectionsButton } from './DirectionsButton';
import {
  expensesForActivity,
  formatEstimated,
  formatVnd,
  totalOf,
} from '@/services/expenseService';

type ActivityDetailSheetProps = {
  activity: Activity | null;
  expenses: Expense[];
  selection?: Selection;
  onClose: () => void;
  onAddExpense: (activity: Activity) => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  onOpenOptions: (activity: Activity) => void;
};

export function ActivityDetailSheet({
  activity,
  expenses,
  selection,
  onClose,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onOpenOptions,
}: ActivityDetailSheetProps) {
  if (!activity) return null;

  const items = expensesForActivity(expenses, activity.activityKey);
  const spent = totalOf(items);
  const place = selection?.selectedPlace ?? activity.place;
  const address = selection?.selectedAddress ?? activity.address;

  return (
    <BottomSheet open title={activity.title} onClose={onClose}>
      <p className="text-sm font-medium text-primary-dark tabular-nums">
        {activity.date} · {activity.startTime}
      </p>

      {place ? <p className="mt-3 text-lg font-semibold leading-snug">{place}</p> : null}
      {address ? <p className="text-sm text-muted">{address}</p> : null}

      {activity.options.length > 0 ? (
        <button
          type="button"
          onClick={() => onOpenOptions(activity)}
          className="mt-3 min-h-[48px] w-full rounded-2xl bg-soft-pink text-sm font-semibold text-primary-dark active:bg-primary active:text-white"
        >
          {selection
            ? 'Đổi lựa chọn'
            : `Xem ${activity.options.length} lựa chọn địa điểm`}
        </button>
      ) : null}

      {activity.notes ? (
        <p className="mt-3 rounded-2xl bg-app-bg px-4 py-3 text-sm leading-relaxed text-muted">
          {activity.notes}
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-soft-pink bg-white px-4 py-3">
          <dt className="text-xs font-semibold tracking-wide text-muted">DỰ KIẾN</dt>
          <dd className="mt-0.5 text-base font-semibold tabular-nums">
            {formatEstimated(activity.estimatedCost)}
          </dd>
        </div>
        <div className="rounded-2xl border border-soft-pink bg-soft-pink px-4 py-3">
          <dt className="text-xs font-semibold tracking-wide text-primary-dark">ĐÃ CHI</dt>
          <dd className="mt-0.5 text-base font-bold tabular-nums text-primary-dark">
            {spent > 0 ? formatVnd(spent) : '0đ'}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex gap-2">
        <DirectionsButton
          parts={[place, address, activity.title]}
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => onAddExpense(activity)}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1 rounded-2xl border border-soft-pink bg-white text-sm font-semibold text-primary-dark active:bg-soft-pink"
        >
          <Plus size={18} aria-hidden />
          Ghi chi phí
        </button>
      </div>

      {items.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {items.map((expense) => (
            <li
              key={expense.id}
              className="flex items-center gap-2 rounded-2xl border border-soft-pink bg-white px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {expense.description || expense.category}
                </p>
                <p className="text-xs text-muted">{expense.category}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {formatVnd(expense.amount)}
              </span>
              <button
                type="button"
                onClick={() => onEditExpense(expense)}
                aria-label={`Sửa khoản chi ${formatVnd(expense.amount)}`}
                className="flex size-10 items-center justify-center rounded-full text-muted active:bg-soft-pink"
              >
                <Pencil size={16} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onDeleteExpense(expense)}
                aria-label={`Xóa khoản chi ${formatVnd(expense.amount)}`}
                className="flex size-10 items-center justify-center rounded-full text-muted active:bg-soft-pink"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </BottomSheet>
  );
}
