# Đồng bộ qua Google Sheet — không ai phải đăng nhập

App có thể chạy hoàn toàn bằng file Excel trong máy. Nếu muốn nhiều điện thoại cùng thấy một
danh sách chi phí, bật thêm chế độ đồng bộ qua Google Sheet.

**Vì sao không cần đăng nhập:** Apps Script được deploy dạng Web App với *Execute as: Me*.
Script chạy bằng quyền của bạn — chủ sheet — nên người dùng chỉ gọi vào một URL, không đụng
tới tài khoản Google của họ.

**Đánh đổi phải biết:** ai có URL + token thì đọc và ghi được vào sheet. Đừng đăng URL này
công khai. Đổi token là mọi thiết bị cũ mất quyền ngay.

---

## Cài đặt (làm một lần, ~5 phút)

### 1. Đưa lịch trình lên Google Sheets

Mở [drive.google.com](https://drive.google.com) → **New → File upload** → chọn
`public/lich-trinh.xlsx`. Upload xong, mở file → **File → Save as Google Sheets**.

Giữ nguyên tên tab lịch trình (`Ngày 1 - Hội An`). Hai tab `Expenses` và `Selections` script
sẽ tự tạo, không cần làm gì.

### 2. Mở Apps Script

Trong Google Sheet vừa tạo: **Extensions → Apps Script**.

### 3. Dán script

Xóa hết nội dung `Code.gs` đang có, dán toàn bộ nội dung file
[`Code.gs`](Code.gs) trong thư mục này vào.

Sửa dòng `TOKEN` ở đầu file:

```js
const TOKEN = 'DAT-CHUOI-BI-MAT-CUA-BAN-O-DAY';
```

**Chuỗi này bạn tự nghĩ ra** — không phải thứ Google cấp, không phải API key, và tuyệt đối
không phải mật khẩu tài khoản Google. Cứ đặt một chuỗi khó đoán, ví dụ:

```js
const TOKEN = 'hoian-2026-76eig7tb';
```

Nhớ chuỗi này, lát nữa gõ lại đúng y hệt vào app. Bấm **Save**.

> Tác dụng: Web App URL là công khai, ai có URL cũng gọi được. Token là lớp chặn — sai token
> thì script trả về *"Sai token."* và không đọc/ghi được gì. Lỡ lộ URL thì chỉ cần đổi chuỗi
> này là mọi thiết bị cũ mất quyền ngay.

### 4. Deploy thành Web App

**Deploy → New deployment** → bấm icon bánh răng → chọn **Web app**, rồi điền:

| Trường | Chọn |
|---|---|
| Description | gì cũng được |
| Execute as | **Me** |
| Who has access | **Anyone** |

Bấm **Deploy**. Google sẽ hỏi cấp quyền lần đầu — chọn tài khoản, bấm **Advanced → Go to
… (unsafe)** rồi **Allow**. Đây là script của chính bạn nên cảnh báo đó là bình thường.

Copy **Web app URL**, dạng:

```
https://script.google.com/macros/s/AKfy…/exec
```

### 5. Bật trong app

Mở app → tab **Lịch trình** hoặc **Chi phí** → thẻ **Đồng bộ Google Sheet** → **Bật đồng bộ**.
Dán URL và token vừa đặt → **Lưu và đồng bộ**.

Xong. Điện thoại khác chỉ cần dán đúng URL + token đó là thấy chung dữ liệu.

---

## Sau khi bật thì app chạy thế nào

| Tình huống | Điều gì xảy ra |
|---|---|
| Mở app, có mạng | Kéo lịch trình + chi phí mới nhất từ Google Sheet |
| Ghi chi phí, có mạng | Ghi vào sheet ngay, thẻ đồng bộ báo *Đã đồng bộ* |
| Ghi chi phí, mất sóng | Lưu trong máy, xếp hàng chờ; thẻ báo *n thay đổi đang chờ đẩy lên* |
| Có mạng trở lại | Tự đẩy hết hàng đợi rồi kéo lại bản mới |
| Mở app khi mất sóng | Dùng bản đã cache lần trước, vẫn ghi chi phí được |

Nút **Lưu / Xuất Excel** vẫn còn: tải bản `.xlsx` về máy bất cứ lúc nào, kể cả khi đang bật
đồng bộ.

## Sửa lịch trình

Sửa thẳng trên Google Sheet (thêm ngày, đổi giờ, thêm quán). Lần mở app sau là thấy — không
cần build lại hay sửa code.

## Đổi hoặc gỡ

- **Đổi token**: sửa `TOKEN` trong Code.gs → **Deploy → Manage deployments → Edit → Deploy**.
  Nhớ cập nhật token trong app trên mọi máy.
- **Tắt đồng bộ**: trong app bấm *Ngắt đồng bộ, quay về dùng file Excel*.
