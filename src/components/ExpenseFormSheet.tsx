'use client';

import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { EXPENSE_CATEGORIES, type Expense } from '@/types/expense';
import { formatAmountInput, parseAmountInput } from '@/services/expenseService';

export type ExpenseDraft = {
  /** Có id nghĩa là đang sửa một khoản đã lưu */
  id?: string;
  activityKey: string | null;
  date: string;
  time?: string;
  activity?: string;
  place?: string;
  amount?: number;
  description?: string;
  category: string;
};

type ExpenseFormSheetProps = {
  draft: ExpenseDraft | null;
  /** Ngày có thể chọn khi ghi khoản chi ngoài lịch trình */
  availableDates: string[];
  onClose: () => void;
  onSubmit: (expense: Omit<Expense, 'id' | 'createdAt'>, id?: string) => void;
};

export function ExpenseFormSheet({ draft, ...rest }: ExpenseFormSheetProps) {
  if (!draft) return null;
  // `key` làm form khởi tạo lại mỗi lần mở một khoản chi khác
  return (
    <ExpenseForm
      key={draft.id ?? `${draft.activityKey ?? 'ngoai-plan'}_${draft.date}`}
      draft={draft}
      {...rest}
    />
  );
}

function ExpenseForm({
  draft,
  availableDates,
  onClose,
  onSubmit,
}: ExpenseFormSheetProps & { draft: ExpenseDraft }) {
  const [amountText, setAmountText] = useState(() =>
    draft.amount ? formatAmountInput(String(draft.amount)) : '',
  );
  const [description, setDescription] = useState(draft.description ?? '');
  const [category, setCategory] = useState<string>(draft.category);
  const [date, setDate] = useState(draft.date);
  const [touched, setTouched] = useState(false);

  const amount = parseAmountInput(amountText);
  const isEditing = Boolean(draft.id);
  const isFreeform = draft.activityKey === null;

  const handleSubmit = () => {
    setTouched(true);
    if (amount === null) return;
    onSubmit(
      {
        activityKey: draft.activityKey,
        date,
        time: draft.time,
        activity: draft.activity,
        place: draft.place,
        amount,
        description: description.trim() || undefined,
        category,
      },
      draft.id,
    );
    onClose();
  };

  return (
    <BottomSheet
      open
      title={isEditing ? 'Sửa khoản chi' : isFreeform ? 'Thêm khoản chi' : 'Ghi chi phí'}
      onClose={onClose}
    >
      {draft.activity ? (
        <p className="text-sm font-medium text-primary-dark">{draft.activity}</p>
      ) : null}
      {draft.place ? <p className="text-sm text-muted">{draft.place}</p> : null}

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="expense-amount" className="text-sm font-semibold">
            Số tiền
          </label>
          <div className="mt-1 flex items-center gap-2 rounded-2xl border border-soft-pink bg-white px-4 focus-within:border-primary">
            <input
              id="expense-amount"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="150.000"
              value={amountText}
              onChange={(event) => setAmountText(formatAmountInput(event.target.value))}
              className="min-h-[52px] w-full bg-transparent text-lg font-semibold tabular-nums outline-none"
            />
            <span className="text-lg font-semibold text-muted">đ</span>
          </div>
          {touched && amount === null ? (
            <p className="mt-1 text-sm text-primary-dark">Vui lòng nhập số tiền.</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="expense-description" className="text-sm font-semibold">
            Nội dung
          </label>
          <input
            id="expense-description"
            type="text"
            placeholder="Vé thuyền thúng"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 min-h-[52px] w-full rounded-2xl border border-soft-pink bg-white px-4 text-base outline-none focus:border-primary"
          />
        </div>

        <div>
          <span className="text-sm font-semibold">Danh mục</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`min-h-[40px] rounded-full px-4 text-sm font-medium ${
                  category === item
                    ? 'bg-primary text-white'
                    : 'border border-soft-pink bg-white text-muted'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {isFreeform && availableDates.length > 1 ? (
          <div>
            <span className="text-sm font-semibold">Ngày</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableDates.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDate(item)}
                  className={`min-h-[40px] rounded-full px-4 text-sm font-medium tabular-nums ${
                    date === item
                      ? 'bg-primary text-white'
                      : 'border border-soft-pink bg-white text-muted'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          className="min-h-[52px] w-full rounded-2xl bg-primary text-base font-bold text-white active:bg-primary-dark"
        >
          {isEditing ? 'Lưu thay đổi' : 'Lưu chi phí'}
        </button>
      </div>
    </BottomSheet>
  );
}
