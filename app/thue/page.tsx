'use client';
import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import GlassCard, { EmptyState, Field, Modal, StatCard } from '@/components/GlassCard';
import { useAppData } from '@/lib/data';
import {
  calcTNCNProgressive, calcTNDN, downloadCSV, downloadXLSX, fmtDate,
  fmtVND, monBaiByRevenue, monthISO, quarterOf, tax88,
} from '@/lib/utils';
import { TAX_CIRCULAR_LABELS } from '@/lib/types';
import type { TaxCircular, TaxKind } from '@/lib/types';

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
  const [circular, setCircular] = useState<TaxCircular>('TT88/2021');

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
  const rates = ws ?? { vat_rate: 0.01, tncn_rate: 0.005, tndn_rate: 0.2, mon_bai: 1000000 };
  const t88 = tax88(revenue, rates.vat_rate, rates.tncn_rate);
  const tncnProgressive = calcTNCNProgressive(Math.max(0, revenue - 11000000));
  const tndn = calcTNDN(profit, rates.tndn_rate);
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
        'VAT khoán (1%)': t88.vat, 'TNCN khoán (0,5%)': t88.tncn, 'Tổng thuế khoán': t88.total,
        'TNCN lũy tiến (tham khảo)': tncnProgressive, 'TNDN 20% trên lãi': tndn,
        'Môn bài ước tính': monBai, 'Đã nộp': paidTotal, 'Còn phải nộp (đã ghi)': dueTotal },
    ]);
  }

  return (
    <AppShell>
      <div className="flex-row">
        <StatCard label={`Doanh thu ${periodKey}`} value={fmtVND(revenue)} sub={manualRevenue ? 'Nhập tay' : 'Tính từ giao dịch đã ghi'} />
        <StatCard label="Thuế khoán phải nộp" value={fmtVND(t88.total)} sub={`VAT ${fmtVND(t88.vat)} + TNCN ${fmtVND(t88.tncn)}`} />
        <StatCard label="TNDN trên lãi (tham khảo)" value={fmtVND(tndn)} sub={`Lãi ${fmtVND(profit)} × 20%`} />
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
          <Field label="Thông tư áp dụng">
            <select value={ws?.tax_circular ?? circular} onChange={(e) => {
              const c = e.target.value as TaxCircular;
              setCircular(c);
              data.updateTaxSettings({ tax_circular: c });
            }}>
              {(Object.keys(TAX_CIRCULAR_LABELS) as TaxCircular[]).map((c) => (
                <option key={c} value={c}>{TAX_CIRCULAR_LABELS[c]}</option>
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
              <tr><td>VAT khoán</td><td>Doanh thu × {(rates.vat_rate * 100).toFixed(1)}%</td><td>{fmtVND(t88.vat)}</td></tr>
              <tr><td>TNCN khoán</td><td>Doanh thu × {(rates.tncn_rate * 100).toFixed(1)}%</td><td>{fmtVND(t88.tncn)}</td></tr>
              <tr><td><b>Tổng thuế khoán TT88</b></td><td>VAT + TNCN</td><td><b>{fmtVND(t88.total)}</b></td></tr>
              <tr><td>TNCN lũy tiến (tham khảo, cá nhân)</td><td>Biểu lũy tiến trên thu nhập tính thuế</td><td>{fmtVND(tncnProgressive)}</td></tr>
              <tr><td>TNDN (tham khảo, DN)</td><td>Lãi × {(rates.tndn_rate * 100).toFixed(0)}%</td><td>{fmtVND(tndn)}</td></tr>
              <tr><td>Môn bài (ước tính)</td><td>Theo bậc doanh thu năm</td><td>{fmtVND(monBai)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Tỷ lệ trên là mẫu theo TT88/2021 — đối chiếu lại thông báo của cơ quan thuế trước khi nộp.
          Đổi thông tư ở trên sẽ đổi cách tính mặc định cho workspace này.
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
