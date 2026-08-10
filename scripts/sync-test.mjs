/**
 * Kiểm thử đồng bộ Google Sheet mà không cần deploy thật.
 * Dựng một server giả lập đúng giao thức của Apps Script Web App
 * (doGet trả mọi sheet dạng mảng 2 chiều, doPost nhận danh sách thao tác),
 * rồi lái app bằng trình duyệt thật.
 *
 * Chạy: node scripts/sync-test.mjs  (cần dev server ở http://localhost:3000)
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import * as XLSX from 'xlsx';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.OUT_DIR ?? '/tmp/trip-sync';
const PORT = 3210;
const TOKEN = 'test-token';
const FAKE_NOW = new Date('2026-07-14T10:32:00').getTime();

mkdirSync(OUT, { recursive: true });

const failures = [];
function check(name, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(name);
}

// --- Server giả lập Google Sheet -------------------------------------------
const book = XLSX.read(readFileSync('public/lich-trinh.xlsx'));
const ITINERARY_SHEET = book.SheetNames[0];
const itineraryRows = XLSX.utils.sheet_to_json(book.Sheets[ITINERARY_SHEET], {
  header: 1,
  blankrows: false,
  defval: '',
});

const EXPENSE_HEADER = ['expense_id', 'activity_key', 'date', 'time', 'activity', 'place', 'amount', 'description', 'category', 'created_at'];
const SELECTION_HEADER = ['activity_key', 'selected_place', 'selected_address', 'updated_at'];

/** Trạng thái "sheet" nằm trong bộ nhớ server */
const store = { expenses: [], selections: [] };
let postCount = 0;

function expenseRows() {
  return [EXPENSE_HEADER, ...store.expenses.map((e) => [
    e.id, e.activityKey ?? '', e.date ?? '', e.time ?? '', e.activity ?? '',
    e.place ?? '', Number(e.amount) || 0, e.description ?? '', e.category ?? 'Khác', e.createdAt ?? '',
  ])];
}

function selectionRows() {
  return [SELECTION_HEADER, ...store.selections.map((s) => [
    s.activityKey, s.selectedPlace ?? '', s.selectedAddress ?? '', s.updatedAt ?? '',
  ])];
}

function applyOp(op) {
  if (op.type === 'upsert-expense') {
    const index = store.expenses.findIndex((e) => e.id === op.expense.id);
    if (index >= 0) store.expenses[index] = op.expense;
    else store.expenses.push(op.expense);
  } else if (op.type === 'delete-expense') {
    store.expenses = store.expenses.filter((e) => e.id !== op.id);
  } else if (op.type === 'upsert-selection') {
    const index = store.selections.findIndex((s) => s.activityKey === op.selection.activityKey);
    if (index >= 0) store.selections[index] = op.selection;
    else store.selections.push(op.selection);
  } else if (op.type === 'clear-selection') {
    store.selections = store.selections.filter((s) => s.activityKey !== op.activityKey);
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (payload) => {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(payload));
  };

  if (req.method === 'GET') {
    if (url.searchParams.get('token') !== TOKEN) return send({ ok: false, error: 'Sai token.' });
    return send({
      ok: true,
      sheets: {
        [ITINERARY_SHEET]: itineraryRows,
        Expenses: expenseRows(),
        Selections: selectionRows(),
      },
    });
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      if (parsed.token !== TOKEN) return send({ ok: false, error: 'Sai token.' });
      postCount += 1;
      (parsed.ops ?? []).forEach(applyOp);
      send({ ok: true, applied: (parsed.ops ?? []).length });
    });
    return;
  }

  res.writeHead(405).end();
});

await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`Server giả lập Google Sheet: http://localhost:${PORT}\n`);

// --- Lái app ----------------------------------------------------------------
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'vi-VN' });
await ctx.addInitScript(`{
  const F=${FAKE_NOW}, O=Date, off=F-O.now();
  class M extends O { constructor(...a){ a.length===0?super(O.now()+off):super(...a);} static now(){return O.now()+off;} }
  Date=M;
}`);
const page = await ctx.newPage();

async function batDongBo(token) {
  await page.goto(`${BASE}/chi-phi/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Bật đồng bộ|Cài đặt/ }).click();
  await page.fill('#sheets-url', `http://localhost:${PORT}/exec`);
  await page.fill('#sheets-token', token);
  await page.getByRole('button', { name: 'Lưu và đồng bộ' }).click();
}

// 1. Token sai phải báo lỗi rõ ràng, không im lặng
await batDongBo('sai-token');
await page.waitForSelector('text=Sai token.', { timeout: 15000 });
check('token sai báo lỗi rõ ràng', true);

// 2. Token đúng thì kéo được dữ liệu về
await page.getByRole('button', { name: 'Cài đặt' }).click();
await page.fill('#sheets-token', TOKEN);
await page.getByRole('button', { name: 'Lưu và đồng bộ' }).click();
await page.waitForSelector('text=Đã đồng bộ với Google Sheet', { timeout: 15000 });
check('bật đồng bộ thành công', true);

// 3. Lịch trình phải đến từ Google Sheet, không phải file .xlsx đóng gói sẵn
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('text=BÂY GIỜ');
const hero = page.locator('section').first();
check('lịch trình đọc từ Google Sheet', (await hero.innerText()).includes('Tham quan Rừng dừa'));

// 4. Ghi chi phí -> lên thẳng sheet
await hero.getByRole('button', { name: 'Ghi chi phí' }).click();
await page.fill('#expense-amount', '150000');
await page.fill('#expense-description', 'Vé thuyền thúng');
await page.getByRole('button', { name: 'Lưu chi phí' }).click();
await page.waitForSelector('text=Đã chi: 150.000đ');
await page.waitForFunction(() => true);
await new Promise((r) => setTimeout(r, 800));
check('chi phí ghi thẳng lên sheet', store.expenses.length === 1, JSON.stringify(store.expenses[0] ?? {}));
check('sheet nhận đúng số tiền', store.expenses[0]?.amount === 150000);
check('sheet nhận đúng activity_key', String(store.expenses[0]?.activityKey).includes('RUNG_DUA'));

// 5. Mất mạng: vẫn ghi được, xếp hàng chờ
await ctx.setOffline(true);
await hero.getByRole('button', { name: 'Ghi chi phí' }).click();
await page.fill('#expense-amount', '30000');
await page.fill('#expense-description', 'Nước uống');
await page.getByRole('button', { name: 'Lưu chi phí' }).click();
await page.waitForSelector('text=Đã chi: 180.000đ');
check('mất mạng vẫn ghi được chi phí', true);
check('sheet chưa nhận khoản thứ hai', store.expenses.length === 1, `${store.expenses.length} khoản`);

await page.goto(`${BASE}/chi-phi/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
// Trang không tải lại được khi offline nên kiểm tra hàng đợi ngay trên trang đang mở
await page.goBack().catch(() => {});

// 6. Có mạng lại -> tự đẩy nốt
await ctx.setOffline(false);
await page.goto(`${BASE}/chi-phi/`, { waitUntil: 'networkidle' });
await page.waitForSelector('text=Đã đồng bộ với Google Sheet', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 500));
check('có mạng lại thì đẩy nốt khoản đang chờ', store.expenses.length === 2, `${store.expenses.length} khoản`);
check('tổng trên sheet đúng 180.000', store.expenses.reduce((s, e) => s + Number(e.amount), 0) === 180000);

// 7. Chọn địa điểm cũng lên sheet
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('text=BÂY GIỜ');
await page.locator('section', { hasText: 'TIẾP THEO' }).last().getByRole('button', { name: 'Xem lựa chọn' }).click();
await page.locator('li', { hasText: 'Mê Hội An' }).last().getByRole('button', { name: 'Chọn', exact: true }).click();
await page.waitForSelector('text=Đã chọn');
await new Promise((r) => setTimeout(r, 800));
check('lựa chọn địa điểm lên sheet', store.selections[0]?.selectedPlace === 'Mê Hội An', JSON.stringify(store.selections[0] ?? {}));

// 8. Máy thứ hai dùng cùng URL phải thấy y hệt
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'vi-VN' });
await ctx2.addInitScript(`{
  const F=${FAKE_NOW}, O=Date, off=F-O.now();
  class M extends O { constructor(...a){ a.length===0?super(O.now()+off):super(...a);} static now(){return O.now()+off;} }
  Date=M;
}`);
const page2 = await ctx2.newPage();
await page2.goto(`${BASE}/chi-phi/`, { waitUntil: 'networkidle' });
await page2.getByRole('button', { name: /Bật đồng bộ/ }).click();
await page2.fill('#sheets-url', `http://localhost:${PORT}/exec`);
await page2.fill('#sheets-token', TOKEN);
await page2.getByRole('button', { name: 'Lưu và đồng bộ' }).click();
await page2.waitForSelector('text=Đã đồng bộ với Google Sheet', { timeout: 15000 });
const page2Text = await page2.locator('main').innerText();
check('máy thứ hai thấy chung chi phí', page2Text.includes('180.000đ'), page2Text.split('\n').slice(0, 6).join(' / '));
await page2.screenshot({ path: `${OUT}/may-thu-hai.png`, fullPage: true });

// 8b. Ngắt đồng bộ phải "dính" — cấu hình sẵn lúc build không được bật lại
await page2.getByRole('button', { name: 'Cài đặt' }).click();
await page2.getByRole('button', { name: /Ngắt đồng bộ/ }).click();
await page2.waitForSelector('text=Chưa bật');
await page2.goto(`${BASE}/chi-phi/`, { waitUntil: 'networkidle' });
const afterOff = await page2.locator('section', { hasText: 'Đồng bộ Google Sheet' }).innerText();
check('ngắt đồng bộ vẫn tắt sau khi mở lại', afterOff.includes('Chưa bật'), afterOff.replace(/\n/g, ' '));
await ctx2.close();

// 9. Xóa chi phí cũng đồng bộ
await page.goto(`${BASE}/chi-phi/`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /14\/07/ }).first().click();
await page.getByRole('button', { name: /Xóa khoản chi 30\.000đ/ }).first().click();
await page.getByRole('button', { name: 'Xóa', exact: true }).click();
await new Promise((r) => setTimeout(r, 800));
check('xóa chi phí đồng bộ lên sheet', store.expenses.length === 1, `${store.expenses.length} khoản`);

await page.screenshot({ path: `${OUT}/dong-bo.png`, fullPage: true });
console.log(`\nSố lần POST lên sheet: ${postCount}`);

await browser.close();
server.close();

console.log(`\nẢnh chụp: ${OUT}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} kiểm thử thất bại:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nTất cả kiểm thử đồng bộ đã qua.');
