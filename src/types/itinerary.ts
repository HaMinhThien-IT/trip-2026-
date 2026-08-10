export type ActivityOption = {
  id: string;
  name: string;
  address?: string;
  estimatedCost?: number | null;
  notes?: string;
};

export type Activity = {
  id: string;
  /** Khóa ổn định để liên kết expense trong sheet Expenses */
  activityKey: string;
  date: string;
  startTime: string;
  /** Phút kể từ 00:00 của ngày, dùng để so sánh */
  startMinutes: number;
  title: string;
  place?: string;
  address?: string;
  estimatedCost?: number | null;
  notes?: string;
  options: ActivityOption[];
  category: string;
};

export type Day = {
  id: string;
  date: string;
  title: string;
  activities: Activity[];
};

export type Trip = {
  name: string;
  days: Day[];
  /** Tên sheet chứa lịch trình, để không ghi đè khi export */
  itinerarySheets: string[];
};
