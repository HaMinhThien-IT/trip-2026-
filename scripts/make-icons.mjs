/**
 * Sinh icon PWA từ một SVG, bằng chính Chromium có sẵn.
 * Chạy: node scripts/make-icons.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const SIZES = [
  { file: 'public/icon-192.png', size: 192, rounded: false },
  { file: 'public/icon-512.png', size: 512, rounded: false },
  // iOS tự bo góc, nền phải đặc — icon trong suốt sẽ thành nền đen
  { file: 'public/apple-icon.png', size: 180, rounded: false },
];

/** Ghim bản đồ trên nền hồng — cùng tông với app */
function markup(size) {
  return `<!doctype html><html><body style="margin:0">
    <div style="width:${size}px;height:${size}px;display:grid;place-items:center;
                background:linear-gradient(160deg,#f472b6 0%,#db2777 100%)">
      <svg width="${size * 0.56}" height="${size * 0.56}" viewBox="0 0 24 24" fill="none"
           stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    </div>
  </body></html>`;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const { file, size } of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(markup(size));
  const buffer = await page.screenshot({ omitBackground: false });
  writeFileSync(file, buffer);
  await page.close();
  console.log(`${file}  ${size}x${size}`);
}

await browser.close();
