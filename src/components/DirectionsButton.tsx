'use client';

import { Navigation } from 'lucide-react';
import { hasDestination, mapsUrl } from '@/lib/maps';

type DirectionsButtonProps = {
  parts: (string | undefined | null)[];
  /** `on-primary` dùng khi nút nằm trên nền hồng đậm (card Bây giờ) */
  variant?: 'primary' | 'ghost' | 'on-primary';
  className?: string;
};

const VARIANTS = {
  primary: 'bg-primary text-white active:bg-primary-dark',
  ghost: 'border border-soft-pink bg-white text-primary-dark active:bg-soft-pink',
  'on-primary': 'bg-white text-primary-dark active:bg-soft-pink',
} as const;

export function DirectionsButton({
  parts,
  variant = 'primary',
  className = '',
}: DirectionsButtonProps) {
  if (!hasDestination(...parts)) return null;

  const base =
    'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition-colors';
  const styles = VARIANTS[variant];

  return (
    <a
      href={mapsUrl(...parts)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${styles} ${className}`}
    >
      <Navigation size={18} aria-hidden />
      Chỉ đường
    </a>
  );
}
