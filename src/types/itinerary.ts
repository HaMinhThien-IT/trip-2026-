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
  /** Tên sheet chứa ngày này, ví dụ "Ngày 1 · Hội An" */
  title: string;
  /** Số thứ tự ngày trong chuyến đi; null với chặng đi trước Ngày 1 */
  dayNumber: number | null;
  /** Nhãn hiển thị: "Ngày 1" hoặc "Xuất phát" */
  label: string;
  activities: Activity[];
};

export type Trip = {
  name: string;
  days: Day[];
  /** Tên sheet chứa lịch trình, để không ghi đè khi export */
  itinerarySheets: string[];
};
