'use client';
import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import GlassCard, { EmptyState, Field, Modal, StatCard } from '@/components/GlassCard';
import { useAppData } from '@/lib/data';
import {
  downloadCSV, downloadXLSX, estimateWorkspaceTax, fmtDate,
  fmtVND, monthISO, quarterOf,
} from '@/lib/utils';
import { ACCOUNTING_REGIMES, BUSINESS_SECTOR_LABELS, BUSINESS_TYPE_LABELS, TAX_CALCULATION_METHOD_LABELS, TAX_CIRCULAR_LABELS } from '@/lib/types';
import type { BusinessSector, BusinessType, TaxCircular, TaxKind } from '@/lib/types';
import { defaultTaxMethod, inferBusinessType, taxMethodOptions, TAX_RULES_2026 } from '@/lib/tax-config';

const BOOKS = [
  { code: 'S1-HKD', name: 'Sổ chi tiết doanh thu bán hàng, cung cấp dịch vụ' },
  { code: 'S2-HKD', name: 'Sổ chi tiết vật liệu, dụng cụ, sản phẩm, hàng hóa' },
  { code: 'S3-HKD', name: 'Sổ chi phí sản xuất, kinh doanh' },
  { code: 'S4-HKD', name: 'Sổ theo dõi tình hình thực hiện nghĩa vụ thuế' },
  { code: 'S5-HKD', name: 'Sổ chi tiết tiền gửi ngân hàng' },
  { code: 'S6-HKD', name: 'Sổ chi tiết tiền vay' },
  { code: 'S7-HKD', name: 'Sổ theo dõi công nợ' },
];

export default function Thue() {
  const data = useAppData();
  const { state, currentWorkspace } = data;
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('quarter');
  const [manualRevenue, setManualRevenue] = useState('');
  const [manualAnnualRevenue, setManualAnnualRevenue] = useState('');
  const [taxableProfit, setTaxableProfit] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [deductibleVat, setDeductibleVat] = useState('');
  const [showForm, setShowForm] = useState(false);

  const wsId = state?.currentWorkspaceId ?? null;
  const ws = currentWorkspace;
  const txs = useMemo(
    () => (state?.transactions ?? []).filter((t) => t.workspace_id === wsId),
    [state, wsId]);
  const now = new Date();
  const periodKey = period === 'month' ? monthISO(now)
    : period === 'quarter' ? quarterOf(now.toISOString().slice(0, 10))
    : String(now.getFullYear());
  const periodTxs = txs.filter((t) => {
    if (period === 'month') return t.date.startsWith(monthISO(now));
    if (period === 'quarter') return quarterOf(t.date) === quarterOf(now.toISOString().slice(0, 10));
    return t.date.startsWith(String(now.getFullYear()));
  });
  const revenueFromTx = periodTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const revenue = manualRevenue ? Number(manualRevenue) || 0 : revenueFromTx;
  const expense = periodTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const profit = periodTxs.reduce((s, t) => s + (t.profit ?? 0), 0);
  const businessType: BusinessType = ws?.business_type ?? (ws ? inferBusinessType(ws.mode) : 'household_business');
  const businessSector: BusinessSector = ws?.business_sector ?? 'goods';
  const yearRevenue = txs.filter((t) => t.type === 'income' && t.date.startsWith(String(now.getFullYear())))
    .reduce((s, t) => s + t.amount, 0);
  const annualRevenue = manualAnnualRevenue !== ''
    ? Number(manualAnnualRevenue) || 0
    : period === 'year' ? revenue : yearRevenue;
  const taxMethod = defaultTaxMethod(businessType, annualRevenue);
  const taxMethods = taxMethodOptions(businessType, annualRevenue);
  const periodMonths = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
  const taxEstimate = estimateWorkspaceTax({
    businessType,
    businessSector,
    method: taxMethod,
    revenue,
    annualRevenue,
    taxableProfit: taxableProfit === '' ? undefined : Number(taxableProfit),
    monthlyIncome: monthlyIncome === '' ? undefined : Number(monthlyIncome),
    vatRate: ws?.vat_rate ?? TAX_RULES_2026.enterprise.defaultVatRate,
    deductibleVat: deductibleVat === '' ? 0 : Number(deductibleVat),
    monthlyDeduction: ws?.tncn_deduction ?? TAX_RULES_2026.personalIncome.monthlyDeduction,
    periodMonths,
  });
  const payments = useMemo(
    () => (state?.taxPayments ?? []).filter((t) => t.workspace_id === wsId),
    [state, wsId]);
  const paidTotal = payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
  const dueTotal = payments.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0);
  const fmtTaxAmount = (value: number | null) => value === null ? '—' : fmtVND(value);
  const needsTaxableProfit = (businessType === 'enterprise')
    || (businessType === 'household_business'
      && annualRevenue > TAX_RULES_2026.householdBusiness.profitMethodRevenueThreshold);

  async function exportBooksXLSX() {
    const sales = txs.filter((t) => t.type === 'income');
    const goods = txs.filter((t) => t.type === 'expense');
    await downloadXLSX(`so-ke-toan-TT88-${periodKey.replace('/', '-')}.xlsx`, [
      {
        name: 'S1-HKD Doanh thu',
        rows: sales.map((t) => ({
          Ngày: t.date, 'Nội dung': t.note ?? '', 'Số tiền': t.amount,
          'Lãi': t.profit ?? 0, 'Ví': state?.wallets.find((w) => w.id === t.wallet_id)?.name ?? '',
        })),
      },
      {
        name: 'S2-HKD Vat lieu HH',
        rows: goods.map((t) => ({ Ngày: t.date, 'Nội dung': t.note ?? '', 'Số tiền': t.amount })),
      },
      {
        name: 'S4-HKD Nghia vu thue',
        rows: payments.map((p) => ({
          'Kỳ': p.period, 'Loại thuế': p.tax_type, 'Số tiền': p.amount,
          'Đã nộp': p.paid ? 'Đã nộp' : 'Chưa nộp', 'Hạn nộp': p.due_date ?? '',
        })),
      },
      {
        name: 'S7-HKD Cong no',
        rows: (state?.debts ?? []).filter((d) => d.workspace_id === wsId).map((d) => ({
          'Đối tác': d.name, 'Loại': d.kind === 'borrow' ? 'Đi vay' : 'Cho vay/Khách nợ',
          'Số tiền': d.amount, 'Đã trả/nhận': d.paid, 'Còn lại': d.amount - d.paid,
          'Hạn': d.due_date ?? '',
        })),
      },
    ]);
  }

  function exportTaxCSV() {
    downloadCSV(`thue-${periodKey.replace('/', '-')}.csv`, [
      { 'Kỳ': periodKey, 'Doanh thu': revenue, 'Doanh thu năm xét ngưỡng': annualRevenue, 'Chi phí': expense, 'Lãi bán hàng': profit,
        'Thông tư kế toán': ws?.tax_circular ?? 'TT152/2025',
        'Loại hình chủ thể': BUSINESS_TYPE_LABELS[businessType],
        'Phương pháp thuế thu nhập': TAX_CALCULATION_METHOD_LABELS[taxEstimate.method],
        'VAT ước tính': taxEstimate.vat, 'TNCN ước tính': taxEstimate.tncn,
        'TNDN ước tính': taxEstimate.tndn,
        'Tổng thuế ước tính': taxEstimate.total,
        'Đã nộp': paidTotal, 'Còn phải nộp (đã ghi)': dueTotal },
    ]);
  }

  return (
    <AppShell>
      <div className="flex-row">
        <StatCard label={`Doanh thu ${periodKey}`} value={fmtVND(revenue)} sub={manualRevenue ? 'Nhập tay' : 'Tính từ giao dịch đã ghi'} />
        <StatCard label="Thuế ước tính theo loại hình" value={fmtTaxAmount(taxEstimate.total)} sub={`${taxEstimate.incomeTaxLabel}: ${fmtTaxAmount(taxEstimate.incomeTax)}`} />
        <StatCard label={taxEstimate.incomeTaxLabel} value={fmtTaxAmount(taxEstimate.incomeTax)} sub={taxEstimate.incomeTaxFormula || taxEstimate.notes[0]} />
        <StatCard label="Thuế đã ghi: đã nộp / chưa nộp" value={`${fmtVND(paidTotal)} / ${fmtVND(dueTotal)}`} sub="Theo sổ nộp thuế bên dưới" />
      </div>

      <GlassCard title="Thống kê thuế" action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label="Kỳ thống kê" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} style={{ width: 'auto' }}>
            <option value="month">Tháng này</option>
            <option value="quarter">Quý này</option>
            <option value="year">Năm nay</option>
          </select>
          <button className="btn-ghost btn-small" onClick={exportTaxCSV}>Xuất CSV</button>
          <button className="btn-small" onClick={exportBooksXLSX}>Xuất 7 sổ Excel</button>
        </div>
      }>
        <div className="form-row">
          <Field label="Loại hình chủ thể tính thuế">
            <select value={businessType} onChange={(e) => {
              const next = e.target.value as BusinessType;
              data.updateTaxSettings({
                business_type: next,
                business_sector: next === 'household_business' ? 'goods' : 'other',
                tax_method: defaultTaxMethod(next, annualRevenue),
                ...(next === 'enterprise' && ws?.vat_rate === 0.01 ? { vat_rate: 0.1 } : {}),
              });
            }}>
              {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((type) => (
                <option key={type} value={type}>{BUSINESS_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </Field>
          {businessType === 'household_business' ? (
            <Field label="Nhóm hoạt động kinh doanh">
              <select value={businessSector} onChange={(e) => data.updateTaxSettings({ business_sector: e.target.value as BusinessSector })}>
                {(Object.keys(BUSINESS_SECTOR_LABELS) as BusinessSector[]).map((sector) => (
                  <option key={sector} value={sector}>{BUSINESS_SECTOR_LABELS[sector]}</option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Chế độ kế toán / thông tư tham chiếu">
            <select value={ws?.tax_circular ?? 'TT152/2025'} onChange={(e) => {
              const c = e.target.value as TaxCircular;
              data.updateTaxSettings({ tax_circular: c });
            }}>
              {ACCOUNTING_REGIMES.map((c) => (
                <option key={c} value={c}>{TAX_CIRCULAR_LABELS[c]}</option>
              ))}
            </select>
          </Field>
          <Field label="Phương pháp ước tính thuế thu nhập (tự xác định theo chủ thể/ngưỡng)">
            <select value={taxMethod} disabled>
              {taxMethods.map((method) => (
                <option key={method} value={method}>{TAX_CALCULATION_METHOD_LABELS[method]}</option>
              ))}
            </select>
          </Field>
          <Field label="Doanh thu kỳ (đ) — để trống = tự tính từ giao dịch">
            <input type="number" min={0} placeholder={String(revenueFromTx)} value={manualRevenue}
              onChange={(e) => setManualRevenue(e.target.value)} />
          </Field>
          <Field label="Doanh thu năm làm căn cứ chọn ngưỡng/bậc (đ) — mặc định dùng số đã ghi nhận">
            <input type="number" min={0} placeholder={String(yearRevenue)} value={manualAnnualRevenue}
              onChange={(e) => setManualAnnualRevenue(e.target.value)} />
          </Field>
          {needsTaxableProfit ? (
            <Field label="Lợi nhuận / thu nhập tính thuế kỳ (đ) — nhập số liệu kế toán, không tự lấy doanh thu">
              <input type="number" min={0} value={taxableProfit} onChange={(e) => setTaxableProfit(e.target.value)} />
            </Field>
          ) : null}
          {businessType === 'individual' ? (
            <Field label="Thu nhập tiền lương tháng (đ), trước giảm trừ">
              <input type="number" min={0} value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
            </Field>
          ) : null}
          {businessType === 'enterprise' ? (
            <Field label="VAT đầu vào được khấu trừ kỳ (đ)">
              <input type="number" min={0} value={deductibleVat} onChange={(e) => setDeductibleVat(e.target.value)} />
            </Field>
          ) : null}
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data">
            <thead><tr><th>Khoản thuế</th><th>Cách tính</th><th>Số tiền</th></tr></thead>
            <tbody>
              {taxEstimate.vat !== null ? <tr><td>VAT</td><td>{businessType === 'household_business'
                ? `Doanh thu kỳ × ${(TAX_RULES_2026.householdBusiness.revenueRates[businessSector].vat * 100).toLocaleString('vi-VN')}% (${businessSector})`
                : `Doanh thu kỳ × ${((ws?.vat_rate ?? TAX_RULES_2026.enterprise.defaultVatRate) * 100).toLocaleString('vi-VN')}% − VAT đầu vào`}</td><td>{fmtVND(taxEstimate.vat)}</td></tr> : null}
              {taxEstimate.tncn !== null ? <tr><td>TNCN</td><td>{taxEstimate.incomeTaxFormula}</td><td>{fmtVND(taxEstimate.tncn)}</td></tr> : null}
              {taxEstimate.tndn !== null ? <tr><td>TNDN</td><td>{taxEstimate.incomeTaxFormula}</td><td>{fmtVND(taxEstimate.tndn)}</td></tr> : null}
              <tr><td>Thuế khác</td><td>Không tự ước tính; ghi nhận theo chứng từ</td><td>—</td></tr>
              <tr><td><b>Tổng thuế ước tính</b></td><td>Chỉ hiện khi đã nhập đủ dữ liệu bắt buộc</td><td><b>{fmtTaxAmount(taxEstimate.total)}</b></td></tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          {taxEstimate.notes.join(' ')} Lệ phí môn bài không còn nằm trong ước tính năm 2026; khoản môn bài đã ghi trước đây chỉ được giữ để tra cứu lịch sử. Đây là số tham khảo, cần đối chiếu quy định và hồ sơ thực tế.
        </p>
      </GlassCard>

      <GlassCard title="Sổ nộp thuế" action={
        <button className="btn-small" onClick={() => setShowForm(true)}>+ Ghi khoản thuế</button>
      }>
        {payments.length === 0 ? <EmptyState text="Chưa ghi khoản thuế nào — bấm “Ghi khoản thuế” để theo dõi hạn nộp." /> : (
          <div className="row-list">
            {payments.map((p) => (
              <div key={p.id} className="row-item">
                <div>
                  <b>{p.tax_type === 'mon_bai' ? 'Môn bài (lịch sử)' : p.tax_type} — {p.period}</b>
                  <div className="sub">Hạn: {p.due_date ? fmtDate(p.due_date) : '—'}{p.note ? ` • ${p.note}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <b>{fmtVND(p.amount)}</b>
                  <span className={`badge ${p.paid ? 'ok' : 'warn'}`}>{p.paid ? 'Đã nộp' : 'Chưa nộp'}</span>
                  <button className="btn-ghost btn-small" onClick={() => data.toggleTaxPaid(p.id)}>
                    {p.paid ? 'Đánh chưa nộp' : 'Đánh đã nộp'}
                  </button>
                  <button className="btn-ghost btn-small" onClick={() => data.deleteTaxPayment(p.id)}>Xóa</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard title="Mẫu sổ HKD hiện có (TT88/2021)">
        {ws?.tax_circular && ws.tax_circular !== 'TT88/2021' ? (
          <p className="muted" style={{ fontSize: 13 }}>
            Đang chọn {TAX_CIRCULAR_LABELS[ws.tax_circular]}, nhưng mẫu và file Excel trong ứng dụng hiện chỉ cung cấp S1–S7-HKD theo TT88/2021.
          </p>
        ) : null}
        <div className="row-list">
          {BOOKS.map((b) => (
            <div key={b.code} className="row-item">
              <div><b>{b.code}</b><div className="sub">{b.name}</div></div>
              <span className="badge">Xuất trong file Excel 7 sổ</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {showForm ? <TaxFormModal onClose={() => setShowForm(false)} /> : null}
    </AppShell>
  );
}

function TaxFormModal({ onClose }: { onClose: () => void }) {
  const data = useAppData();
  const [taxType, setTaxType] = useState<TaxKind>('VAT');
  const [period, setPeriod] = useState(quarterOf(new Date().toISOString().slice(0, 10)));
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Ghi khoản thuế" onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) { setErr('Số tiền phải lớn hơn 0.'); return; }
        setSaving(true);
        setErr('');
        try {
          const error = await data.saveTaxPayment({ tax_type: taxType, period, amount: Number(amount), paid: false, due_date: dueDate || null, note: note || null });
          if (error) { setErr(error); return; }
          onClose();
        } finally {
          setSaving(false);
        }
      }} className="form-grid">
        <Field label="Loại thuế">
          <select value={taxType} onChange={(e) => setTaxType(e.target.value as TaxKind)}>
            <option value="VAT">VAT</option><option value="TNCN">TNCN</option>
            <option value="TNDN">TNDN</option><option value="other">Thuế khác</option>
          </select>
        </Field>
        <Field label="Kỳ (VD: Q4/2026, 11/2026, 2026)">
          <input value={period} onChange={(e) => setPeriod(e.target.value)} required />
        </Field>
        <Field label="Số tiền (đ)">
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Hạn nộp">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Ghi chú">
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {err ? <p className="error">{err}</p> : null}
        <button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu khoản thuế'}</button>
      </form>
    </Modal>
  );
}
