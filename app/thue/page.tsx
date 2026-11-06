'use client';
import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import GlassCard, { EmptyState, Field, Modal, StatCard } from '@/components/GlassCard';
import { useAppData } from '@/lib/data';
import {
  downloadCSV, downloadXLSX, estimateWorkspaceTax, fmtDate,
  fmtVND, monBaiByRevenue, monthISO, quarterOf,
} from '@/lib/utils';
import { TAX_CALCULATION_METHOD_LABELS, TAX_CIRCULAR_LABELS } from '@/lib/types';
import type { TaxCircular, TaxKind } from '@/lib/types';
import type { TaxCalculationMethod } from '@/lib/types';

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
  const rates = ws ?? {
    vat_rate: 0.01, tncn_rate: 0.005, tndn_rate: 0.2, mon_bai: 1000000,
    tncn_deduction: 11000000, tax_method: 'turnover_tncn' as const,
  };
  const taxMethod = ws?.tax_method ?? 'turnover_tncn';
  const taxEstimate = estimateWorkspaceTax({
    method: taxMethod,
    revenue,
    recordedProfit: profit,
    vatRate: rates.vat_rate,
    tncnRate: rates.tncn_rate,
    tndnRate: rates.tndn_rate,
    monthlyDeduction: rates.tncn_deduction ?? 11000000,
    periodMonths: period === 'month' ? 1 : period === 'quarter' ? 3 : 12,
  });
  const monBai = monBaiByRevenue(revenue * (period === 'year' ? 1 : period === 'quarter' ? 4 : 12));
  const payments = useMemo(
    () => (state?.taxPayments ?? []).filter((t) => t.workspace_id === wsId),
    [state, wsId]);
  const paidTotal = payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
  const dueTotal = payments.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0);
  const yearRevenue = txs.filter((t) => t.type === 'income' && t.date.startsWith(String(now.getFullYear())))
    .reduce((s, t) => s + t.amount, 0);

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
      { 'Kỳ': periodKey, 'Doanh thu': revenue, 'Chi phí': expense, 'Lãi bán hàng': profit,
        'Thông tư kế toán': ws?.tax_circular ?? 'TT88/2021',
        'Phương pháp thuế thu nhập': TAX_CALCULATION_METHOD_LABELS[taxMethod],
        'VAT ước tính': taxEstimate.vat, [taxEstimate.incomeTaxLabel]: taxEstimate.incomeTax,
        'Tổng thuế ước tính': taxEstimate.total,
        'Môn bài ước tính': monBai, 'Đã nộp': paidTotal, 'Còn phải nộp (đã ghi)': dueTotal },
    ]);
  }

  return (
    <AppShell>
      <div className="flex-row">
        <StatCard label={`Doanh thu ${periodKey}`} value={fmtVND(revenue)} sub={manualRevenue ? 'Nhập tay' : 'Tính từ giao dịch đã ghi'} />
        <StatCard label="Thuế ước tính theo phương pháp đã chọn" value={fmtVND(taxEstimate.total)} sub={`VAT ${fmtVND(taxEstimate.vat)} + ${taxEstimate.incomeTaxLabel}: ${fmtVND(taxEstimate.incomeTax)}`} />
        <StatCard label={taxEstimate.incomeTaxLabel} value={fmtVND(taxEstimate.incomeTax)} sub={taxEstimate.incomeTaxFormula} />
        <StatCard label="Thuế đã ghi: đã nộp / chưa nộp" value={`${fmtVND(paidTotal)} / ${fmtVND(dueTotal)}`} sub="Theo sổ nộp thuế bên dưới" />
        <StatCard label="Môn bài ước tính năm nay" value={fmtVND(monBai)} sub={`Doanh thu năm ${fmtVND(yearRevenue)}`} />
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
          <Field label="Chế độ kế toán / thông tư tham chiếu">
            <select value={ws?.tax_circular ?? 'TT88/2021'} onChange={(e) => {
              const c = e.target.value as TaxCircular;
              data.updateTaxSettings({ tax_circular: c });
            }}>
              {(Object.keys(TAX_CIRCULAR_LABELS) as TaxCircular[]).map((c) => (
                <option key={c} value={c}>{TAX_CIRCULAR_LABELS[c]}</option>
              ))}
            </select>
          </Field>
          <Field label="Phương pháp ước tính thuế thu nhập">
              <select value={taxMethod} onChange={(e) => {
                data.updateTaxSettings({ tax_method: e.target.value as TaxCalculationMethod });
              }}>
                {(Object.keys(TAX_CALCULATION_METHOD_LABELS) as TaxCalculationMethod[]).map((method) => (
                  <option key={method} value={method}>{TAX_CALCULATION_METHOD_LABELS[method]}</option>
                ))}
              </select>
          </Field>
          <Field label="Doanh thu kỳ (đ) — để trống = tự tính từ giao dịch">
            <input type="number" min={0} placeholder={String(revenueFromTx)} value={manualRevenue}
              onChange={(e) => setManualRevenue(e.target.value)} />
          </Field>
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data">
            <thead><tr><th>Khoản thuế</th><th>Cách tính</th><th>Số tiền</th></tr></thead>
            <tbody>
              <tr><td>VAT (ước tính)</td><td>Doanh thu × {(rates.vat_rate * 100).toLocaleString('vi-VN')}%</td><td>{fmtVND(taxEstimate.vat)}</td></tr>
              <tr><td>{taxEstimate.incomeTaxLabel}</td><td>{taxEstimate.incomeTaxFormula}</td><td>{fmtVND(taxEstimate.incomeTax)}</td></tr>
              <tr><td><b>Tổng thuế ước tính</b></td><td>VAT + phương pháp đã chọn</td><td><b>{fmtVND(taxEstimate.total)}</b></td></tr>
              <tr><td>Môn bài (ước tính)</td><td>Theo bậc doanh thu năm</td><td>{fmtVND(monBai)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Thông tư kế toán chỉ chọn chế độ sổ sách; phương pháp và thuế suất được cấu hình riêng ở Cài đặt. Đây là số ước tính theo dữ liệu/tỷ lệ bạn nhập, không thay thế việc xác định nghĩa vụ thuế với cơ quan thuế.
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
                  <b>{p.tax_type} — {p.period}</b>
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

      <GlassCard title="7 sổ kế toán TT88/2021 (S1–S7-HKD)">
        {ws?.tax_circular && ws.tax_circular !== 'TT88/2021' ? (
          <p className="muted" style={{ fontSize: 13 }}>
            Đang chọn {TAX_CIRCULAR_LABELS[ws.tax_circular]}, nhưng mẫu sổ và file Excel hiện tại vẫn là S1–S7-HKD theo TT88/2021. Chưa có bộ biểu mẫu TT133/TT200 tương ứng.
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
            <option value="TNDN">TNDN</option><option value="mon_bai">Môn bài</option>
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
