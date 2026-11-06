import type { BusinessSector, BusinessType, TaxCalculationMethod } from './types';
import { TAX_RULES_2026 } from './tax-config';

export const fmtVND = (n: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Math.round(n));

export const fmtNum = (n: number): string => new Intl.NumberFormat('vi-VN').format(Math.round(n));

/** Lãi bán hàng = số lượng × (giá bán − giá nhập). */
export const profitOf = (qty: number, sale: number, cost: number): number => qty * (sale - cost);

/** TNCN lũy tiến theo biểu thuế cấu hình năm 2026. */
export const calcTNCNProgressive = (taxableIncome: number): number => {
  let remaining = Math.max(0, taxableIncome);
  let tax = 0;
  for (const { width, rate } of TAX_RULES_2026.personalIncome.progressiveBrackets) {
    if (remaining <= 0) break;
    const part = Math.min(remaining, width);
    tax += part * rate;
    remaining -= part;
  }
  return Math.round(tax);
};

/** TNDN = lợi nhuận tính thuế × thuế suất được xác định theo quy định. */
export const calcTNDN = (taxableProfit: number, rate: number): number =>
  Math.round(Math.max(0, taxableProfit) * rate);

/** TNCN kinh doanh theo thu nhập tính thuế, không phải thuế TNDN. */
const calcHouseholdBusinessIncomeTax = (taxableIncome: number, rate: number): number =>
  Math.round(Math.max(0, taxableIncome) * rate);

export function estimateWorkspaceTax(input: {
  businessType: BusinessType;
  businessSector: BusinessSector;
  method: TaxCalculationMethod;
  revenue: number;
  annualRevenue: number;
  taxableProfit?: number;
  monthlyIncome?: number;
  vatRate?: number;
  deductibleVat?: number;
  monthlyDeduction: number;
  periodMonths?: number;
}) {
  const revenue = Math.max(0, input.revenue);
  const annualRevenue = Math.max(0, input.annualRevenue);
  const periodMonths = Math.max(1, input.periodMonths ?? 1);
  let vat: number | null = null;
  let tncn: number | null = null;
  let tndn: number | null = null;
  let incomeTaxLabel = 'Thuế thu nhập';
  let incomeTaxFormula = '';
  let effectiveMethod = input.method;
  let missingProfit = false;
  const notes: string[] = [];

  if (input.businessType === 'household_business') {
    const policy = TAX_RULES_2026.householdBusiness;
    const rates = policy.revenueRates[input.businessSector];
    incomeTaxLabel = 'TNCN kinh doanh';
    if (annualRevenue <= policy.annualRevenueExemption) {
      vat = 0;
      tncn = 0;
      notes.push(`Doanh thu năm không vượt ngưỡng ${fmtVND(policy.annualRevenueExemption)}; không tính VAT/TNCN kinh doanh trong ước tính.`);
    } else {
      vat = Math.round(revenue * rates.vat);
      if (annualRevenue > policy.profitMethodRevenueThreshold) {
        effectiveMethod = 'business_profit';
        incomeTaxLabel = 'TNCN kinh doanh theo thu nhập tính thuế';
        if (input.taxableProfit === undefined) {
          missingProfit = true;
          notes.push('Chưa nhập thu nhập tính thuế kỳ; không suy ra lợi nhuận từ doanh thu hoặc lãi bán hàng.');
        } else {
          const bracket = policy.incomeTaxRates.find((item) => annualRevenue <= item.maxAnnualRevenue)
            ?? policy.incomeTaxRates[policy.incomeTaxRates.length - 1];
          tncn = calcHouseholdBusinessIncomeTax(input.taxableProfit, bracket.rate);
          incomeTaxFormula = `Thu nhập tính thuế × ${(bracket.rate * 100).toLocaleString('vi-VN')}%`;
        }
      } else {
        effectiveMethod = 'business_revenue';
        tncn = Math.round(revenue * rates.tncn);
        incomeTaxLabel = 'TNCN kinh doanh theo doanh thu';
        incomeTaxFormula = `Doanh thu kỳ × ${(rates.tncn * 100).toLocaleString('vi-VN')}% (${input.businessSector})`;
      }
    }
    if (!incomeTaxFormula && tncn === 0) incomeTaxFormula = 'Không phát sinh theo ngưỡng doanh thu năm cấu hình';
  } else if (input.businessType === 'enterprise') {
    const vatRate = input.vatRate ?? TAX_RULES_2026.enterprise.defaultVatRate;
    const deductibleVat = Math.max(0, input.deductibleVat ?? 0);
    vat = Math.max(0, Math.round(revenue * vatRate) - deductibleVat);
    const bracket = TAX_RULES_2026.enterprise.corporateIncomeTaxRates.find(
      (item) => annualRevenue <= item.maxAnnualRevenue,
    ) ?? TAX_RULES_2026.enterprise.corporateIncomeTaxRates[
      TAX_RULES_2026.enterprise.corporateIncomeTaxRates.length - 1
    ];
    incomeTaxLabel = 'Thuế TNDN';
    effectiveMethod = 'enterprise_profit';
    if (input.taxableProfit === undefined) {
      missingProfit = true;
      notes.push('Chưa nhập lợi nhuận tính thuế kỳ; TNDN chưa được ước tính.');
    } else {
      tndn = calcTNDN(input.taxableProfit, bracket.rate);
      incomeTaxFormula = `Lợi nhuận tính thuế × ${(bracket.rate * 100).toLocaleString('vi-VN')}% (doanh thu năm chọn bậc thuế)`;
    }
    notes.push('VAT doanh nghiệp chỉ là ước tính theo tỷ lệ cấu hình và VAT đầu vào được khấu trừ; cần đối chiếu hóa đơn, mặt hàng và phương pháp kê khai.');
    notes.push('Bậc thuế TNDN có thể phụ thuộc doanh thu kỳ trước và điều kiện loại trừ/ưu đãi; ứng dụng chưa kiểm tra các điều kiện pháp lý này.');
  } else {
    const monthlyIncome = Math.max(0, input.monthlyIncome ?? 0);
    const monthlyTaxableIncome = Math.max(0, monthlyIncome - input.monthlyDeduction);
    effectiveMethod = 'employment_income';
    incomeTaxLabel = 'TNCN tiền lương lũy tiến';
    if (input.monthlyIncome === undefined) {
      missingProfit = true;
      notes.push('Chưa nhập thu nhập tiền lương tháng; không dùng doanh thu kinh doanh làm căn cứ TNCN tiền lương.');
    } else {
      tncn = calcTNCNProgressive(monthlyTaxableIncome) * periodMonths;
      incomeTaxFormula = `Tính lũy tiến trên max(0, thu nhập tháng − ${fmtVND(input.monthlyDeduction)})`;
    }
    notes.push('Ước tính chưa bao gồm người phụ thuộc, bảo hiểm bắt buộc và các khoản giảm trừ khác.');
  }

  const incomeTax = input.businessType === 'enterprise' ? tndn : tncn;
  const estimatedTotal = [vat, tncn, tndn].reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
  return {
    vat,
    tncn,
    tndn,
    other: null,
    incomeTax,
    incomeTaxLabel,
    incomeTaxFormula,
    total: missingProfit ? null : estimatedTotal,
    method: effectiveMethod,
    notes,
  };
}

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
