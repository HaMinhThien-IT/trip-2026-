/**
 * Kiểm thử nhanh trên trình duyệt thật ở khổ điện thoại.
 * Chạy: node scripts/smoke-test.mjs  (cần dev server ở http://localhost:3000)
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.OUT_DIR ?? '/tmp/trip-smoke';
/** Giả lập đang ở 10:32 ngày 14/07 — đúng giữa lịch trình */
const FAKE_NOW = new Date('2026-07-14T10:32:00').getTime();

mkdirSync(OUT, { recursive: true });

const failures = [];
function check(name, condition, detail = '') {
  const status = condition ? 'PASS' : 'FAIL';
  if (!condition) failures.push(`${name} ${detail}`);
  console.log(`${status}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const width of [390, 430]) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    acceptDownloads: true,
    locale: 'vi-VN',
  });

  // Ép Date về thời điểm giả lập để kiểm tra logic Bây giờ / Tiếp theo
  await context.addInitScript(`{
    const FAKE = ${FAKE_NOW};
    const OriginalDate = Date;
    const offset = FAKE - OriginalDate.now();
    class MockDate extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) super(OriginalDate.now() + offset);
        else super(...args);
      }
      static now() { return OriginalDate.now() + offset; }
    }
    Date = MockDate;
  }`);

  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=BÂY GIỜ', { timeout: 15000 });

  console.log(`\n=== ${width}px ===`);

  // 1. Card Bây giờ hiển thị đúng hoạt động 10:00
  const hero = page.locator('section').first();
  const heroText = await hero.innerText();
  check(`${width} · card Bây giờ là Rừng dừa`, heroText.includes('Tham quan Rừng dừa'), heroText.split('\n').slice(0, 4).join(' / '));
  check(`${width} · hiển thị giờ 10:00`, heroText.includes('10:00'));
  check(`${width} · countdown 28 phút`, heroText.includes('28 phút'), heroText.match(/Còn .*/)?.[0] ?? '');

  // 2. Card Tiếp theo là Cafe, có 3 lựa chọn
  const nextCard = page.locator('section', { hasText: 'TIẾP THEO' }).last();
  const nextText = await nextCard.innerText();
  check(`${width} · card Tiếp theo là Cafe`, nextText.includes('Cafe / nghỉ ngơi'));
  check(`${width} · báo 3 địa điểm có thể chọn`, nextText.includes('3 địa điểm có thể chọn'));

  // 3. Không tràn ngang
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check(`${width} · không tràn ngang`, overflow <= 0, `thừa ${overflow}px`);

  await page.screenshot({ path: `${OUT}/hom-nay-${width}.png`, fullPage: true });

  if (width !== 390) {
    await context.close();
    continue;
  }

  // 4. Chọn option cho hoạt động Cafe
  await nextCard.getByRole('button', { name: 'Xem lựa chọn' }).click();
  await page.waitForSelector('text=Chọn 1 trong 3');
  await page.screenshot({ path: `${OUT}/lua-chon.png` });
  const option = page.locator('li', { hasText: 'Mê Hội An' }).last();
  await option.getByRole('button', { name: 'Chọn', exact: true }).click();
  await page.waitForSelector('text=Đã chọn');
  check('chọn option Mê Hội An', (await nextCard.innerText()).includes('Mê Hội An'));

  // 5. Ghi chi phí cho hoạt động hiện tại
  await hero.getByRole('button', { name: 'Ghi chi phí' }).click();
  await page.waitForSelector('#expense-amount');
  await page.fill('#expense-amount', '150000');
  await page.fill('#expense-description', 'Vé thuyền thúng');
  await page.screenshot({ path: `${OUT}/ghi-chi-phi.png` });
  await page.getByRole('button', { name: 'Lưu chi phí' }).click();
  await page.waitForSelector('text=Đã chi: 150.000đ');
  check('ghi chi phí 150.000đ', (await hero.innerText()).includes('150.000đ'));

  // 6. Ghi thêm khoản thứ hai cho cùng hoạt động → tổng phải cộng dồn
  await hero.getByRole('button', { name: 'Ghi chi phí' }).click();
  await page.fill('#expense-amount', '30000');
  await page.fill('#expense-description', 'Nước uống');
  await page.getByRole('button', { name: 'Lưu chi phí' }).click();
  await page.waitForSelector('text=Đã chi: 180.000đ');
  check('cộng dồn nhiều khoản trong 1 hoạt động', (await hero.innerText()).includes('180.000đ'));

  // 7. Page Chi phí
  await page.getByRole('link', { name: 'Chi phí' }).click();
  await page.waitForSelector('text=CHI PHÍ CHUYẾN ĐI');
  const expensePage = await page.locator('main').innerText();
  check('tổng chuyến đi 180.000đ', expensePage.includes('180.000đ'));
  check('có nhóm Tham quan', expensePage.includes('Tham quan'));
  await page.screenshot({ path: `${OUT}/chi-phi.png`, fullPage: true });

  // 8. Thêm khoản chi ngoài lịch trình
  await page.getByRole('button', { name: 'Thêm khoản chi' }).click();
  await page.fill('#expense-amount', '50000');
  await page.fill('#expense-description', 'Đổ xăng');
  await page.getByRole('button', { name: 'Di chuyển' }).click();
  await page.getByRole('button', { name: 'Lưu chi phí' }).click();
  await page.waitForSelector('text=230.000đ');
  check('thêm khoản ngoài plan', (await page.locator('main').innerText()).includes('230.000đ'));

  // 9. Xuất Excel
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('button', { name: 'Lưu / Xuất Excel' }).click(),
  ]);
  const exported = `${OUT}/${download.suggestedFilename()}`;
  await download.saveAs(exported);
  check('xuất được file Excel', existsSync(exported), download.suggestedFilename());

  // 10. File xuất ra phải giữ sheet lịch trình và có sheet Expenses đầy đủ
  const wb = XLSX.read(readFileSync(exported));
  check('giữ sheet lịch trình', wb.SheetNames.includes('Ngày 1 - Hội An'), wb.SheetNames.join(', '));
  check('có sheet Expenses', wb.SheetNames.includes('Expenses'));
  check('có sheet Selections', wb.SheetNames.includes('Selections'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Expenses']);
  check('Expenses có 3 dòng', rows.length === 3, `thực tế ${rows.length}`);
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  check('tổng trong Excel = 230000', total === 230000, String(total));
  const linked = rows.filter((row) => String(row.activity_key || '').includes('RUNG_DUA'));
  check('expense nối đúng activity_key', linked.length === 2, `${linked.length} dòng`);
  const selectionRows = XLSX.utils.sheet_to_json(wb.Sheets['Selections']);
  check('Selections lưu lựa chọn', selectionRows[0]?.selected_place === 'Mê Hội An', JSON.stringify(selectionRows[0] ?? {}));

  // 11. Import lại file vừa xuất trong context sạch → chi phí phải còn nguyên
  await context.close();

  const context2 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    acceptDownloads: true,
    locale: 'vi-VN',
  });
  await context2.addInitScript(`{
    const FAKE = ${FAKE_NOW};
    const OriginalDate = Date;
    const offset = FAKE - OriginalDate.now();
    class MockDate extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) super(OriginalDate.now() + offset);
        else super(...args);
      }
      static now() { return OriginalDate.now() + offset; }
    }
    Date = MockDate;
  }`);
  const page2 = await context2.newPage();
  await page2.goto(`${BASE}/chi-phi`, { waitUntil: 'networkidle' });
  await page2.waitForSelector('text=CHI PHÍ CHUYẾN ĐI');
  await page2.setInputFiles('input[type=file]', exported);
  await page2.waitForSelector('text=230.000đ', { timeout: 15000 });
  const reimported = await page2.locator('main').innerText();
  check('import lại giữ nguyên tổng chi phí', reimported.includes('230.000đ'));

  await page2.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page2.waitForSelector('text=BÂY GIỜ');
  const heroAfter = await page2.locator('section').first().innerText();
  check('import lại giữ chi phí theo hoạt động', heroAfter.includes('180.000đ'), heroAfter.replace(/\n/g, ' / '));
  const nextAfter = await page2.locator('section', { hasText: 'TIẾP THEO' }).last().innerText();
  check('import lại giữ lựa chọn địa điểm', nextAfter.includes('Mê Hội An'));
  await page2.screenshot({ path: `${OUT}/sau-khi-import.png`, fullPage: true });

  // 12. Xóa một khoản chi
  await page2.goto(`${BASE}/chi-phi`, { waitUntil: 'networkidle' });
  // Mở đúng ngày 14/07 (ngày chứa các khoản chi vừa ghi)
  await page2.getByRole('button', { name: /14\/07/ }).first().click();
  await page2.getByRole('button', { name: /Xóa khoản chi 30\.000đ/ }).first().click();
  await page2.getByRole('button', { name: 'Xóa', exact: true }).click();
  await page2.waitForSelector('text=200.000đ');
  check('xóa khoản chi cập nhật tổng', (await page2.locator('main').innerText()).includes('200.000đ'));

  await context2.close();
}

await browser.close();

console.log(`\nẢnh chụp màn hình: ${OUT}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} kiểm thử thất bại:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nTất cả kiểm thử đã qua.');
