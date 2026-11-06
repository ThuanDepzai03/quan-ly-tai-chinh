// Đính kèm / quét hóa đơn (tương đương action attachReceipt + scanReceipt
// của bản demo). Bản web không có khóa API OCR riêng nên "quét" hoạt động
// như sau: đọc ảnh hóa đơn (JPEG/PNG, base64), trích xuất số tiền/ngày từ
// tên file khi có (VD: "hoadon-1250000-2026-11-06.jpg"), rồi mở form cho
// người dùng xác nhận/sửa số tiền, ngày, nội dung trước khi lưu — không
// tự tạo giao dịch từ ảnh khi chưa có số liệu xác nhận.
export interface ScannedReceipt {
  image: string;
  amount?: number;
  date?: string;
  note?: string;
}

export function fileToBase64(file: File, maxMB = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      reject(new Error('Chỉ nhận ảnh JPEG hoặc PNG.'));
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      reject(new Error(`Ảnh quá lớn (tối đa ${maxMB}MB).`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  });
}

function parseAmount(text: string): number | undefined {
  const m = text.match(/(\d[\d.,]*)\s*(?:đ|vnd|dong)?/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function parseDate(text: string): string | undefined {
  let m = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined;
}

/** Trích xuất số tiền/ngày từ một đoạn văn bản (VD: nội dung hóa đơn gõ tay). */
export function parseReceiptText(text: string): { amount?: number; date?: string } {
  return { amount: parseAmount(text), date: parseDate(text) };
}

/** "Quét" ảnh hóa đơn: trả về ảnh base64 + số liệu trích xuất được (nếu có). */
export async function scanReceipt(file: File): Promise<ScannedReceipt> {
  const image = await fileToBase64(file);
  const base = file.name.replace(/\.[^.]+$/, '');
  return {
    image,
    amount: parseAmount(base),
    date: parseDate(base) ?? new Date().toISOString().slice(0, 10),
    note: `Hóa đơn ${file.name}`,
  };
}
