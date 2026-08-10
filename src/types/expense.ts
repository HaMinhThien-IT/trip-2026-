export type Expense = {
  id: string;
  activityKey?: string | null;
  date: string;
  time?: string;
  activity?: string;
  place?: string;
  amount: number;
  description?: string;
  category: string;
  createdAt: string;
};

export type Selection = {
  activityKey: string;
  selectedPlace: string;
  selectedAddress?: string;
  updatedAt: string;
};

export const EXPENSE_CATEGORIES = [
  'Ăn uống',
  'Di chuyển',
  'Tham quan',
  'Vé / Giải trí',
  'Lưu trú',
  'Mua sắm',
  'Khác',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
