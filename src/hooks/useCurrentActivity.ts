'use client';

import { useMemo } from 'react';
import type { Activity, Day, Trip } from '@/types/itinerary';

export type DayProgress = {
  /** Ngày đang hiển thị trên màn hình Hôm nay */
  day: Day | null;
  /** true khi ngày trong lịch trình trùng đúng ngày hôm nay của điện thoại */
  isRealToday: boolean;
  current: Activity | null;
  next: Activity | null;
  /** Số phút còn lại đến hoạt động tiếp theo, null nếu không có hoạt động tiếp theo */
  minutesToNext: number | null;
  /** 'chua-bat-dau' | 'dang-dien-ra' | 'da-xong' */
  phase: 'chua-bat-dau' | 'dang-dien-ra' | 'da-xong';
  doneCount: number;
  totalCount: number;
};

/** Ngày trong Excel ở dạng "14/07" — so với ngày local của điện thoại */
export function formatDeviceDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function matchesDate(dayDate: string, deviceDate: string): boolean {
  // Chấp nhận cả "14/07" và "14/07/2026"
  return dayDate === deviceDate || dayDate.startsWith(`${deviceDate}/`);
}

export function pickActiveDay(trip: Trip | null, now: Date | null): {
  day: Day | null;
  isRealToday: boolean;
} {
  if (!trip || trip.days.length === 0) return { day: null, isRealToday: false };
  if (!now) return { day: trip.days[0], isRealToday: false };

  const deviceDate = formatDeviceDate(now);
  const match = trip.days.find((day) => matchesDate(day.date, deviceDate));
  if (match) return { day: match, isRealToday: true };

  // Ngoài chuyến đi: vẫn hiển thị ngày đầu tiên để xem trước lịch trình
  return { day: trip.days[0], isRealToday: false };
}

export function useCurrentActivity(trip: Trip | null, now: Date | null): DayProgress {
  return useMemo(() => {
    const { day, isRealToday } = pickActiveDay(trip, now);

    if (!day || day.activities.length === 0) {
      return {
        day,
        isRealToday,
        current: null,
        next: null,
        minutesToNext: null,
        phase: 'chua-bat-dau',
        doneCount: 0,
        totalCount: 0,
      };
    }

    const activities = day.activities;
    const totalCount = activities.length;

    if (!now) {
      return {
        day,
        isRealToday,
        current: null,
        next: activities[0],
        minutesToNext: null,
        phase: 'chua-bat-dau',
        doneCount: 0,
        totalCount,
      };
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Hoạt động hiện tại = hoạt động gần nhất đã tới giờ
    let currentIndex = -1;
    activities.forEach((activity, index) => {
      if (activity.startMinutes <= nowMinutes) currentIndex = index;
    });

    const current = currentIndex >= 0 ? activities[currentIndex] : null;
    const next = activities[currentIndex + 1] ?? null;
    const minutesToNext = next ? next.startMinutes - nowMinutes : null;

    let phase: DayProgress['phase'] = 'dang-dien-ra';
    if (currentIndex < 0) phase = 'chua-bat-dau';
    else if (!next) phase = 'da-xong';

    return {
      day,
      isRealToday,
      current,
      next,
      minutesToNext,
      phase,
      doneCount: Math.max(currentIndex + 1, 0),
      totalCount,
    };
  }, [trip, now]);
}

/** "Còn 28 phút" / "Còn 1 giờ 20 phút" */
export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return 'Đang tới giờ';
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`;
}
