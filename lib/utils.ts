export const fmtVND = (n: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Math.round(n));

export const fmtNum = (n: number): string => new Intl.NumberFormat('vi-VN').format(Math.round(n));

/** Lãi bán hàng = số lượng × (giá bán − giá nhập). */
export const profitOf = (qty: number, sale: number, cost: number): number => qty * (sale - cost);

/** TT88/2021 hộ kinh doanh: thuế khoán theo doanh thu — VAT 1% + TNCN 0,5%. */
export const tax88 = (revenue: number, vatRate = 0.01, tncnRate = 0.005) => {
  const vat = Math.round(revenue * vatRate);
  const tncn = Math.round(revenue * tncnRate);
  return { vat, tncn, total: vat + tncn };
};

/** TNCN lũy tiến từng phần (biểu thuế hiện hành, tính trên thu nhập tính thuế/tháng). */
export const calcTNCNProgressive = (taxableIncome: number): number => {
  const brackets: Array<[number, number]> = [
    [5000000, 0.05], [5000000, 0.1], [8000000, 0.15], [14000000, 0.2],
    [20000000, 0.25], [28000000, 0.3], [Infinity, 0.35],
  ];
  let remaining = Math.max(0, taxableIncome);
  let tax = 0;
  for (const [width, rate] of brackets) {
    if (remaining <= 0) break;
    const part = Math.min(remaining, width);
    tax += part * rate;
    remaining -= part;
  }
  return Math.round(tax);
};

/** TNDN = lợi nhuận trước thuế × thuế suất (mặc định 20%). */
export const calcTNDN = (profitBeforeTax: number, rate = 0.2): number =>
  Math.round(Math.max(0, profitBeforeTax) * rate);

/** Thuế môn bài theo bậc doanh thu năm (mẫu TT88 — đối chiếu thông báo cơ quan thuế). */
export const monBaiByRevenue = (yearRevenue: number): number => {
  if (yearRevenue > 500000000) return 1000000;
  if (yearRevenue > 300000000) return 500000;
  if (yearRevenue > 100000000) return 300000;
  return 0;
};

/** ID duy nhất — phải là UUID v4 hợp lệ vì mọi khóa chính trên Supabase đều
 *  là cột uuid. Trước đây uid() sinh chuỗi "base36-xxx" không phải UUID nên
 *  mọi upsert lên Supabase đều lỗi âm thầm (chỉ log ra console). */
export const uid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const hex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${hex()}${hex()}-4000-4000-8000-${hex()}${hex()}${hex()}`;
};

export const todayISO = (): string => new Date().toISOString().slice(0, 10);
export const monthISO = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const quarterOf = (dateISO: string): string => {
  const d = new Date(dateISO);
  return `Q${Math.floor(d.getMonth() / 3) + 1}/${d.getFullYear()}`;
};
export const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('vi-VN');
};

/** Tạo file CSV từ mảng object — dùng chung cho mọi báo cáo. */
export function downloadCSV(filename: string, rows: Array<Record<string, string | number | null | undefined>>): void {
  if (rows.length === 0) { alert('Không có dữ liệu để xuất.'); return; }
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number | null | undefined): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Xuất Excel thật bằng thư viện xlsx: mỗi sheet là 1 mảng object. */
export function downloadXLSX(
  filename: string,
  sheets: Array<{ name: string; rows: Array<Record<string, string | number | null | undefined>> }>,
): Promise<void> {
  return import('xlsx').then((XLSX) => {
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const ws = XLSX.utils.json_to_sheet(sheet.rows.length > 0 ? sheet.rows : [{ 'Không có dữ liệu': '' }]);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
    }
    XLSX.writeFile(wb, filename);
  });
}

/** Nhóm giao dịch theo tháng YYYY-MM, trả về map tháng -> mảng giao dịch. */
export function groupByMonth<T extends { date: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const key = r.date.slice(0, 7);
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  return map;
}
