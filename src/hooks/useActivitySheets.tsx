'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Activity } from '@/types/itinerary';
import type { Expense } from '@/types/expense';
import { useTrip } from '@/context/TripProvider';
import { ActivityDetailSheet } from '@/components/ActivityDetailSheet';
import { ActivityOptionPicker } from '@/components/ActivityOptionPicker';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ExpenseFormSheet, type ExpenseDraft } from '@/components/ExpenseFormSheet';
import { formatVnd } from '@/services/expenseService';
import { formatDeviceDate } from './useCurrentActivity';

/**
 * Gom toàn bộ bottom sheet liên quan tới hoạt động và chi phí vào một nơi,
 * để các màn hình chỉ cần gọi openActivity/openExpenseFor và render `sheets`.
 */
export function useActivitySheets() {
  const {
    trip,
    expenses,
    selections,
    addExpense,
    updateExpense,
    removeExpense,
    selectOption,
    clearSelection,
  } = useTrip();

  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);
  const [optionActivity, setOptionActivity] = useState<Activity | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);

  const availableDates = useMemo(
    () => trip?.days.map((day) => day.date) ?? [],
    [trip],
  );

  const selectionFor = useCallback(
    (activityKey: string) => selections.find((item) => item.activityKey === activityKey),
    [selections],
  );

  const openActivity = useCallback((activity: Activity) => {
    // Hoạt động nhiều lựa chọn mà chưa chọn gì thì mở thẳng danh sách lựa chọn
    setDetailActivity(activity);
  }, []);

  const openOptions = useCallback((activity: Activity) => {
    setOptionActivity(activity);
  }, []);

  const openExpenseFor = useCallback(
    (activity: Activity) => {
      const selection = selectionFor(activity.activityKey);
      setDraft({
        activityKey: activity.activityKey,
        date: activity.date,
        time: activity.startTime,
        activity: activity.title,
        place: selection?.selectedPlace ?? activity.place,
        category: activity.category,
      });
    },
    [selectionFor],
  );

  const openFreeExpense = useCallback(
    (date?: string) => {
      const fallback = date ?? availableDates[0] ?? formatDeviceDate(new Date());
      setDraft({ activityKey: null, date: fallback, category: 'Khác' });
    },
    [availableDates],
  );

  const openEditExpense = useCallback((expense: Expense) => {
    setDraft({
      id: expense.id,
      activityKey: expense.activityKey ?? null,
      date: expense.date,
      time: expense.time,
      activity: expense.activity,
      place: expense.place,
      amount: expense.amount,
      description: expense.description,
      category: expense.category,
    });
  }, []);

  const sheets = (
    <>
      <ActivityDetailSheet
        activity={detailActivity}
        expenses={expenses}
        selection={detailActivity ? selectionFor(detailActivity.activityKey) : undefined}
        onClose={() => setDetailActivity(null)}
        onAddExpense={openExpenseFor}
        onEditExpense={openEditExpense}
        onDeleteExpense={setPendingDelete}
        onOpenOptions={openOptions}
      />

      <ActivityOptionPicker
        activity={optionActivity}
        selection={optionActivity ? selectionFor(optionActivity.activityKey) : undefined}
        onClose={() => setOptionActivity(null)}
        onSelect={(activityKey, place, address) => {
          selectOption(activityKey, place, address);
          setOptionActivity(null);
        }}
        onClear={(activityKey) => {
          clearSelection(activityKey);
          setOptionActivity(null);
        }}
      />

      <ExpenseFormSheet
        draft={draft}
        availableDates={availableDates}
        onClose={() => setDraft(null)}
        onSubmit={(expense, id) => {
          if (id) updateExpense(id, expense);
          else addExpense(expense);
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        message={
          pendingDelete ? `Xóa khoản chi ${formatVnd(pendingDelete.amount)}?` : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) removeExpense(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );

  return {
    sheets,
    openActivity,
    openOptions,
    openExpenseFor,
    openFreeExpense,
    openEditExpense,
    requestDeleteExpense: setPendingDelete,
    selectionFor,
  };
}
