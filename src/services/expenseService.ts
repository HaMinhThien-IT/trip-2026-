import type { Activity, Day } from '@/types/itinerary';
import type { Expense } from '@/types/expense';

export function nextExpenseId(expenses: Expense[]): string {
  const max = expenses.reduce((highest, expense) => {
    const match = expense.id.match(/EXP_(\d+)/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `EXP_${String(max + 1).padStart(3, '0')}`;
}

export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))}đ`;
}

/** Chi phí có thể chưa biết (null) — khác hẳn với 0đ (miễn phí) */
export function formatEstimated(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Chưa có';
  if (amount === 0) return 'Miễn phí';
  return formatVnd(amount);
}

/** Người dùng gõ "150000" hoặc "150.000" → 150000 */
export function parseAmountInput(input: string): number | null {
  const digits = input.replace(/[^\d]/g, '');
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function formatAmountInput(input: string): string {
  const value = parseAmountInput(input);
  return value === null ? '' : new Intl.NumberFormat('vi-VN').format(value);
}

export function expensesForActivity(expenses: Expense[], activityKey: string): Expense[] {
  return expenses.filter((expense) => expense.activityKey === activityKey);
}

export function totalOf(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export function totalForActivity(expenses: Expense[], activityKey: string): number {
  return totalOf(expensesForActivity(expenses, activityKey));
}

export function totalForDate(expenses: Expense[], date: string): number {
  return totalOf(expenses.filter((expense) => expense.date === date));
}

/**
 * Tổng chi phí dự kiến của chuyến đi. Chỉ trả về số khi MỌI hoạt động đều ghi
 * chi phí dự kiến trong Excel — thiếu dù một ô thì con số so sánh vô nghĩa,
 * và ô trống không được coi là 0đ. Khi đó trả null để UI bỏ hẳn phần so sánh.
 */
export function totalEstimated(days: Day[]): number | null {
  let sum = 0;
  let total = 0;
  let withEstimate = 0;

  days.forEach((day) =>
    day.activities.forEach((activity) => {
      total += 1;
      if (activity.estimatedCost !== null && activity.estimatedCost !== undefined) {
        sum += activity.estimatedCost;
        withEstimate += 1;
      }
    }),
  );

  return total > 0 && withEstimate === total ? sum : null;
}

export function groupByCategory(expenses: Expense[]): { category: string; total: number }[] {
  const totals = new Map<string, number>();
  expenses.forEach((expense) => {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  });
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export type ExpenseGroup = {
  key: string;
  title: string;
  subtitle?: string;
  total: number;
  items: Expense[];
};

/** Gom chi phí trong một ngày theo hoạt động; khoản ngoài plan gom riêng */
export function groupExpensesByActivity(
  expenses: Expense[],
  activities: Activity[],
): ExpenseGroup[] {
  const groups = new Map<string, ExpenseGroup>();
  const order: string[] = [];

  expenses.forEach((expense) => {
    const key = expense.activityKey ?? '__NGOAI_PLAN__';
    if (!groups.has(key)) {
      const activity = activities.find((item) => item.activityKey === key);
      groups.set(key, {
        key,
        title: activity?.title ?? expense.activity ?? 'Chi phí ngoài lịch trình',
        subtitle: activity?.place ?? expense.place,
        total: 0,
        items: [],
      });
      order.push(key);
    }
    const group = groups.get(key)!;
    group.items.push(expense);
    group.total += expense.amount;
  });

  return order.map((key) => groups.get(key)!);
}
