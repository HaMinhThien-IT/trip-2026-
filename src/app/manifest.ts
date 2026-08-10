import type { MetadataRoute } from 'next';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// App xuất tĩnh nên manifest phải sinh sẵn lúc build
export const dynamic = 'force-static';

/**
 * Manifest để "Thêm vào màn hình chính" mở app toàn màn hình, không còn
 * thanh địa chỉ và thanh công cụ của trình duyệt.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lịch trình du lịch',
    short_name: 'Lịch trình',
    description: 'Trợ lý lịch trình khi đang đi du lịch',
    lang: 'vi',
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fff7fa',
    theme_color: '#fff7fa',
    icons: [
      {
        src: `${BASE_PATH}/icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${BASE_PATH}/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${BASE_PATH}/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
