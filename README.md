# Trip 2026 — App lịch trình du lịch Đà Nẵng · Hội An

App mobile (Next.js) đọc lịch trình **trực tiếp từ file Excel**, giúp mở điện thoại lên là biết ngay:
bây giờ đang làm gì, đi đâu, tiếp theo là gì, còn bao lâu, và đã chi bao nhiêu tiền.

Toàn bộ giao diện bằng tiếng Việt, tối ưu cho khổ máy 390px và 430px.

## Hai chế độ chạy

| | Mặc định — file Excel | Bật đồng bộ — Google Sheet |
|---|---|---|
| Nguồn dữ liệu | `public/lich-trinh.xlsx` hoặc file bạn chọn | Google Sheet qua Apps Script Web App |
| Nhiều máy dùng chung | không | có |
| Người dùng phải đăng nhập | không | **không** — script chạy bằng quyền chủ sheet |
| Ghi chi phí khi mất sóng | được | được, xếp hàng rồi tự đẩy khi có mạng |
| Xuất file `.xlsx` | được | được |

Chưa cấu hình Google Sheet thì app chạy y như chế độ file Excel — đồng bộ là phần cộng thêm,
bật/tắt bất cứ lúc nào trong thẻ **Đồng bộ Google Sheet** ở tab Lịch trình hoặc Chi phí.

Hướng dẫn cài đặt: [`google-sheets/README.md`](google-sheets/README.md).

## Nguyên tắc dữ liệu

- **Excel là nguồn dữ liệu duy nhất.** Không hard-code lịch trình trong source code — đổi dữ liệu
  trong Excel là UI đổi theo, không cần sửa code.
- **Excel cũng là nơi lưu chi phí.** Khi ghi chi phí trong app, dữ liệu được ghi vào sheet
  `Expenses` của workbook; lựa chọn địa điểm ghi vào sheet `Selections`. Hai sheet này được app
  tự tạo nếu chưa có.
- **IndexedDB chỉ là cache tạm** để không mất dữ liệu khi reload — không phải database chính.
- **Ô chi phí trống ≠ 0đ.** App phân biệt rõ `null` (chưa biết giá) và `0` (miễn phí); phần so
  sánh với chi phí dự kiến chỉ hiện khi mọi hoạt động đều có giá dự kiến trong Excel.

### Lưu / xuất file

Trình duyệt mobile thường không cho ghi đè file gốc. App xử lý cả hai đường:

- Trình duyệt hỗ trợ File System Access API (Chrome) → ghi thẳng vào file đã chọn.
- Không hỗ trợ → **tải về một file Excel mới đã chứa toàn bộ thay đổi**, giữ nguyên sheet lịch
  trình và mọi sheet khác.

Import lại file đã xuất thì toàn bộ chi phí và lựa chọn địa điểm được khôi phục.

## Chạy dự án

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
npm run smoke      # kiểm thử trên trình duyệt thật (cần dev server đang chạy)
npm run test:sync  # kiểm thử đồng bộ, có server giả lập Google Sheet
```

File Excel mặc định app nạp khi mở lần đầu: `public/lich-trinh.xlsx`. Người dùng có thể chọn
file Excel khác bằng nút **Chọn file Excel**.

## Cài lên màn hình chính

App có manifest và icon nên **Thêm vào màn hình chính** sẽ mở toàn màn hình, không còn thanh
địa chỉ và thanh công cụ của trình duyệt.

- **iPhone (Safari)**: nút Chia sẻ → *Thêm vào MH chính*. iOS ghi nhớ cấu hình ngay lúc thêm,
  nên nếu trước đó đã thêm bản chưa có manifest thì phải **xoá icon cũ rồi thêm lại**.
- **Android (Chrome)**: menu ⋮ → *Cài đặt ứng dụng*.

Icon sinh bằng `node scripts/make-icons.mjs` (dùng Chromium để chụp, không cần công cụ ảnh).

> Chưa có service worker, nên app vẫn cần mạng ở lần mở đầu tiên. Chi phí đã ghi thì nằm
> trong máy và ghi tiếp được khi mất sóng.

## Deploy

App chạy hoàn toàn phía client (đọc/ghi Excel ngay trong trình duyệt, không có backend)
nên xuất tĩnh được — `next build` sinh thư mục `out/`.

**Vercel** (cách đang dùng): import repo `HaMinhThien-IT/trip-2026-` trên vercel.com.
Vercel tự nhận diện Next.js — không cần đặt biến môi trường hay đổi build command:

| Mục | Giá trị |
|---|---|
| Framework Preset | Next.js (tự nhận) |
| Build Command | `npm run build` (mặc định) |
| Output Directory | để mặc định |
| Environment Variables | `NEXT_PUBLIC_SHEETS_TOKEN` nếu muốn app tự bật đồng bộ Google Sheet (xem [`.env.example`](.env.example)); ngoài ra không cần gì |

Mỗi lần push lên `main` là Vercel tự deploy lại.

**GitHub Pages** (đường lui): workflow `.github/workflows/deploy.yml` vẫn còn nhưng chỉ chạy
khi bấm tay ở tab Actions. Trước khi chạy, phải vào **Settings → Pages → Source** chọn
**GitHub Actions** một lần — token của workflow không có quyền tự bật Pages.

## Cấu trúc

```
src/
  app/                    Hôm nay (/), Lịch trình (/lich-trinh), Chi phí (/chi-phi)
  components/             Card Bây giờ, Tiếp theo, Timeline, các bottom sheet
  context/TripProvider    Workbook + expense + selection, đánh dấu dirty
  hooks/                  useNow, useCurrentActivity, useActivitySheets
  services/
    itineraryParser.ts    Excel -> Trip/Day/Activity (gom option, chuẩn hóa giờ, suy ngày)
    excelService.ts       Đọc/ghi sheet Expenses + Selections, xuất workbook
    expenseService.ts     Tính tổng, gom nhóm, format tiền
    workbookCache.ts      Cache tạm workbook trong IndexedDB
scripts/smoke-test.mjs    Kiểm thử end-to-end bằng Playwright ở 390px và 430px
```

## Cách parser hiểu file Excel

Với file mẫu (`Thời gian · Hoạt động · Địa điểm / Quán · Địa chỉ · Chi phí · Ghi chú / Option`):

- Header được dò tự động theo tên cột (không phân biệt dấu), nên đổi thứ tự cột vẫn chạy.
- Ngày lấy từ cột thời gian dạng `18:00 (13/07)` và **kế thừa xuống** các dòng sau.
- Nhiều dòng cùng giờ + cùng tên hoạt động được gom thành **một** hoạt động có nhiều lựa chọn,
  ví dụ 3 dòng `Cafe / nghỉ ngơi` 11:00 → một hoạt động "Chọn 1 trong 3".
- **Đánh số ngày**: số ngày lấy từ tên sheet (`Ngày 1 - Hội An` → 1) và gán cho ngày chứa
  nhiều hoạt động nhất trong sheet đó. Ngày đứng trước nó là chặng di chuyển dẫn vào — hiển
  thị là **Xuất phát**, không mang số. Với file mẫu: 13/07 (chỉ có mốc lên xe đêm) là
  *Xuất phát*, 14/07 mới là *Ngày 1*. Sheet không ghi số ngày thì đánh số tuần tự.
- `activityKey` = `ngày_giờ_TÊN_HOẠT_ĐỘNG` — khóa ổn định để nối chi phí lại đúng hoạt động
  sau khi đóng app và import lại file.
- Data model hỗ trợ nhiều ngày ngay từ đầu, kể cả khi Excel chỉ có một ngày.

## Lịch trình

- [Ngày 1 — Đà Nẵng → Hội An (13–14/07)](day1.md)

## Ghi chú kỹ thuật

`xlsx` được cài từ npm registry (0.18.5) vì CDN chính thức của SheetJS bị chặn trong môi trường
build này. Nếu cần bản mới hơn, cài lại theo hướng dẫn của SheetJS:

```bash
npm i https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz
```
