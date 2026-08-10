import type { NextConfig } from 'next';

/**
 * App chạy hoàn toàn phía client (đọc/ghi Excel trong trình duyệt) nên xuất
 * tĩnh được. GitHub Pages phục vụ site dự án dưới đường dẫn /<tên-repo>,
 * nên basePath lấy từ biến môi trường lúc build; chạy dev để trống.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
