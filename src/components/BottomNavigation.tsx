'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Sun, Wallet } from 'lucide-react';

const TABS = [
  { href: '/', label: 'Hôm nay', Icon: Sun },
  { href: '/lich-trinh', label: 'Lịch trình', Icon: CalendarDays },
  { href: '/chi-phi', label: 'Chi phí', Icon: Wallet },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 z-40 w-full max-w-[430px] border-t border-soft-pink bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Điều hướng chính"
    >
      <ul className="flex">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  active ? 'text-primary-dark' : 'text-muted'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
