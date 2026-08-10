/**
 * Apps Script cho app lịch trình du lịch.
 *
 * Deploy script này thành Web App (Execute as: Me — Who has access: Anyone)
 * để app đọc/ghi Google Sheet mà người dùng KHÔNG phải đăng nhập: script chạy
 * bằng quyền của chủ sheet, người dùng chỉ gọi vào URL.
 *
 * Hướng dẫn cài đặt: xem google-sheets/README.md
 */

/**
 * Chuỗi bí mật do BẠN TỰ ĐẶT — không phải thứ Google cấp, cũng không phải
 * mật khẩu tài khoản Google. Cứ nghĩ ra một chuỗi khó đoán, ví dụ:
 *
 *   const TOKEN = 'hoian-2026-76eig7tb';
 *
 * Rồi gõ đúng chuỗi đó vào ô "Token bí mật" trong app. Hai nơi phải giống hệt.
 * Sai token thì script từ chối, nên lỡ lộ URL chỉ cần đổi chuỗi này.
 */
const TOKEN = 'DAT-CHUOI-BI-MAT-CUA-BAN-O-DAY';

const EXPENSES_SHEET = 'Expenses';
const SELECTIONS_SHEET = 'Selections';

const EXPENSE_HEADER = [
  'expense_id',
  'activity_key',
  'date',
  'time',
  'activity',
  'place',
  'amount',
  'description',
  'category',
  'created_at',
];

const SELECTION_HEADER = ['activity_key', 'selected_place', 'selected_address', 'updated_at'];

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function checkToken(token) {
  if (TOKEN && token !== TOKEN) throw new Error('Sai token.');
}

function sheetByName(name, header) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Đọc toàn bộ sheet thành mảng 2 chiều, ô ngày giờ đổi thành chuỗi */
function readSheetValues(sheet) {
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();
  return values.filter(function (row) {
    return row.some(function (cell) {
      return String(cell).trim() !== '';
    });
  });
}

/** GET: trả về mọi sheet dưới dạng mảng 2 chiều để app dựng lại workbook */
function doGet(event) {
  try {
    checkToken((event && event.parameter && event.parameter.token) || '');

    sheetByName(EXPENSES_SHEET, EXPENSE_HEADER);
    sheetByName(SELECTIONS_SHEET, SELECTION_HEADER);

    const sheets = {};
    SpreadsheetApp.getActiveSpreadsheet()
      .getSheets()
      .forEach(function (sheet) {
        sheets[sheet.getName()] = readSheetValues(sheet);
      });

    return json({ ok: true, sheets: sheets, updatedAt: new Date().toISOString() });
  } catch (error) {
    return json({ ok: false, error: String(error.message || error) });
  }
}

function findRowById(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][0]) === String(id)) return i + 1; // 1-based
  }
  return -1;
}

function expenseToRow(expense) {
  return [
    expense.id,
    expense.activityKey || '',
    expense.date || '',
    expense.time || '',
    expense.activity || '',
    expense.place || '',
    Number(expense.amount) || 0,
    expense.description || '',
    expense.category || 'Khác',
    expense.createdAt || new Date().toISOString(),
  ];
}

function upsertExpense(expense) {
  const sheet = sheetByName(EXPENSES_SHEET, EXPENSE_HEADER);
  const row = expenseToRow(expense);
  const existing = findRowById(sheet, expense.id);
  if (existing > 0) {
    sheet.getRange(existing, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function deleteExpense(id) {
  const sheet = sheetByName(EXPENSES_SHEET, EXPENSE_HEADER);
  const existing = findRowById(sheet, id);
  if (existing > 0) sheet.deleteRow(existing);
}

function upsertSelection(selection) {
  const sheet = sheetByName(SELECTIONS_SHEET, SELECTION_HEADER);
  const row = [
    selection.activityKey,
    selection.selectedPlace || '',
    selection.selectedAddress || '',
    selection.updatedAt || new Date().toISOString(),
  ];
  const existing = findRowById(sheet, selection.activityKey);
  if (existing > 0) {
    sheet.getRange(existing, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function clearSelection(activityKey) {
  const sheet = sheetByName(SELECTIONS_SHEET, SELECTION_HEADER);
  const existing = findRowById(sheet, activityKey);
  if (existing > 0) sheet.deleteRow(existing);
}

/**
 * POST: nhận danh sách thao tác và áp vào sheet.
 * Body gửi dạng text/plain để trình duyệt không phải preflight CORS.
 */
function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const body = JSON.parse((event && event.postData && event.postData.contents) || '{}');
    checkToken(body.token || '');

    const ops = body.ops || [];
    ops.forEach(function (op) {
      if (op.type === 'upsert-expense') upsertExpense(op.expense);
      else if (op.type === 'delete-expense') deleteExpense(op.id);
      else if (op.type === 'upsert-selection') upsertSelection(op.selection);
      else if (op.type === 'clear-selection') clearSelection(op.activityKey);
    });

    return json({ ok: true, applied: ops.length });
  } catch (error) {
    return json({ ok: false, error: String(error.message || error) });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {
      // lock chưa lấy được thì thôi
    }
  }
}
