import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';
import { TripProvider } from '@/context/TripProvider';
import { BottomNavigation } from '@/components/BottomNavigation';

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
});

export const metadata: Metadata = {
  title: 'Lịch trình du lịch',
  description: 'Trợ lý lịch trình khi đang đi du lịch',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#fff7fa',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${beVietnam.variable} antialiased`}>
        <TripProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-app-bg">
            <main
              className="flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))]"
              style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
            >
              {children}
            </main>
            <BottomNavigation />
          </div>
        </TripProvider>
      </body>
    </html>
  );
}
