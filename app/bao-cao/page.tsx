'use client';
import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import GlassCard, { StatCard } from '@/components/GlassCard';
import { useAppData } from '@/lib/data';
import {
  downloadCSV, downloadXLSX, fmtDate, fmtVND, groupByMonth, monthISO, tax88,
} from '@/lib/utils';

export default function BaoCao() {
  const data = useAppData();
  const { state, currentWorkspace } = data;
  const [month, setMonth] = useState(monthISO());
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  const wsId = state?.currentWorkspaceId ?? null;
  const allTxs = useMemo(
    () => (state?.transactions ?? []).filter((t) => t.workspace_id === wsId),
    [state, wsId]);
  const months = useMemo(
    () => Array.from(groupByMonth(allTxs).keys()).sort().reverse(),
    [allTxs]);
  const txs = useMemo(() => {
    const base = allTxs.filter((t) => t.date.startsWith(month));
    return typeFilter === 'all' ? base : base.filter((t) => t.type === typeFilter);
  }, [allTxs, month, typeFilter]);

  const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const profit = txs.reduce((s, t) => s + (t.profit ?? 0), 0);
  const tax = tax88(income, currentWorkspace?.vat_rate ?? 0.01, currentWorkspace?.tncn_rate ?? 0.005);

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; cost: number; profit: number }>();
    for (const t of txs) {
      if (t.type !== 'income' || !t.product_id) continue;
      const name = state?.products.find((p) => p.id === t.product_id)?.name
        ?? state?.productVariants.find((v) => v.id === t.variant_id)?.name ?? 'Sản phẩm';
      const row = map.get(t.product_id) ?? { name, qty: 0, revenue: 0, cost: 0, profit: 0 };
      row.qty += t.quantity ?? 1;
      row.revenue += t.amount;
      row.cost += (t.cost_price ?? 0) * (t.quantity ?? 1);
      row.profit += t.profit ?? 0;
      map.set(t.product_id, row);
    }
    return Array.from(map.values()).sort((a, b) => b.profit - a.profit);
  }, [txs, state]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; income: number; expense: number }>();
    for (const t of txs) {
      const name = state?.categories.find((c) => c.id === t.category_id)?.name ?? 'Không phân loại';
      const row = map.get(name) ?? { name, income: 0, expense: 0 };
      if (t.type === 'income') row.income += t.amount;
      else if (t.type === 'expense') row.expense += t.amount;
      map.set(name, row);
    }
    return Array.from(map.values()).sort((a, b) => (b.income + b.expense) - (a.income + a.expense));
  }, [txs, state]);

  const monthly = useMemo(() => {
    const map = groupByMonth(allTxs);
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([m, rows]) => ({
      month: m,
      income: rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0),
      expense: rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
      profit: rows.reduce((s, r) => s + (r.profit ?? 0), 0),
      count: rows.length,
    }));
  }, [allTxs]);

  const catName = (id?: string | null) => state?.categories.find((c) => c.id === id)?.name ?? '—';
  const walletName = (id: string) => state?.wallets.find((w) => w.id === id)?.name ?? '—';
  const productName = (t: { product_id?: string | null }) =>
    state?.products.find((p) => p.id === t.product_id)?.name ?? '';

  function txRows() {
    return txs.map((t) => ({
      'Ngày': t.date, 'Loại': t.type === 'income' ? 'Thu' : t.type === 'expense' ? 'Chi' : 'Chuyển ví',
      'Danh mục': catName(t.category_id), 'Sản phẩm': productName(t),
      'Số lượng': t.quantity ?? 1, 'Đơn giá': t.unit_price ?? '', 'Giá vốn/cái': t.cost_price ?? '',
      'Số tiền': t.amount, 'Lãi': t.profit ?? 0, 'Ví': walletName(t.wallet_id),
      'IMEI': t.imei ?? '', 'Ghi chú': t.note ?? '',
    }));
  }

  function exportCSV() {
    downloadCSV(`bao-cao-${month}.csv`, txRows());
  }

  function exportXLSX() {
    downloadXLSX(`bao-cao-${month}.xlsx`, [
      { name: 'Tong hop', rows: [{ 'Tháng': month, 'Tổng thu': income, 'Tổng chi': expense, 'Lãi bán hàng': profit, 'VAT khoán 1%': tax.vat, 'TNCN khoán 0,5%': tax.tncn, 'Tổng thuế khoán': tax.total }] },
      { name: 'Giao dich', rows: txRows() },
      {
        name: 'Lai theo san pham',
        rows: byProduct.map((r) => ({ 'Sản phẩm': r.name, 'Số lượng bán': r.qty, 'Doanh thu': r.revenue, 'Giá vốn': r.cost, 'Lãi': r.profit })),
      },
      {
        name: 'Theo danh muc',
        rows: byCategory.map((r) => ({ 'Danh mục': r.name, 'Thu': r.income, 'Chi': r.expense, 'Chênh lệch': r.income - r.expense })),
      },
      {
        name: 'Theo thang',
        rows: monthly.map((m) => ({ 'Tháng': m.month, 'Thu': m.income, 'Chi': m.expense, 'Lãi': m.profit, 'Số giao dịch': m.count })),
      },
    ]);
  }

  return (
    <AppShell>
      <GlassCard title="Báo cáo & Xuất file" action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label="Tháng báo cáo" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 'auto' }}>
            {months.length === 0 ? <option value={month}>{month}</option> : null}
            {months.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
          <select aria-label="Lọc loại" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} style={{ width: 'auto' }}>
            <option value="all">Tất cả</option>
            <option value="income">Chỉ thu</option>
            <option value="expense">Chỉ chi</option>
          </select>
          <button className="btn-ghost btn-small" onClick={exportCSV}>Xuất CSV</button>
          <button className="btn-small" onClick={exportXLSX}>Xuất Excel (.xlsx)</button>
        </div>
      }>
        <div className="flex-row">
          <StatCard label={`Tổng thu tháng ${month}`} value={fmtVND(income)} sub={`${txs.filter((t) => t.type === 'income').length} giao dịch thu`} />
          <StatCard label={`Tổng chi tháng ${month}`} value={fmtVND(expense)} sub={`${txs.filter((t) => t.type === 'expense').length} giao dịch chi`} />
          <StatCard label="Lãi bán hàng" value={fmtVND(profit)} sub="Doanh thu − Giá vốn" />
          <StatCard label="Thuế khoán TT88" value={fmtVND(tax.total)} sub={`VAT ${fmtVND(tax.vat)} + TNCN ${fmtVND(tax.tncn)}`} />
        </div>
      </GlassCard>

      <GlassCard title={`Lãi theo sản phẩm — tháng ${month}`}>
        {byProduct.length === 0 ? <p className="muted">Tháng này chưa có đơn bán hàng nào từ kho.</p> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Sản phẩm</th><th>SL bán</th><th>Doanh thu</th><th>Giá vốn</th><th>Lãi</th></tr></thead>
              <tbody>
                {byProduct.map((r) => (
                  <tr key={r.name}><td>{r.name}</td><td>{r.qty}</td><td>{fmtVND(r.revenue)}</td><td>{fmtVND(r.cost)}</td><td><b style={{ color: '#34c759' }}>{fmtVND(r.profit)}</b></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard title={`Thu / chi theo danh mục — tháng ${month}`}>
        {byCategory.length === 0 ? <p className="muted">Chưa có dữ liệu.</p> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Danh mục</th><th>Thu</th><th>Chi</th><th>Chênh lệch</th></tr></thead>
              <tbody>
                {byCategory.map((r) => (
                  <tr key={r.name}><td>{r.name}</td><td>{fmtVND(r.income)}</td><td>{fmtVND(r.expense)}</td><td>{fmtVND(r.income - r.expense)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard title="Thu / chi theo tháng">
        {monthly.length === 0 ? <p className="muted">Chưa có dữ liệu.</p> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Tháng</th><th>Thu</th><th>Chi</th><th>Lãi bán hàng</th><th>Số GD</th></tr></thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.month}><td>{m.month}</td><td>{fmtVND(m.income)}</td><td>{fmtVND(m.expense)}</td><td>{fmtVND(m.profit)}</td><td>{m.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard title={`Chi tiết giao dịch — tháng ${month} (${txs.length} giao dịch)`}>
        {txs.length === 0 ? <p className="muted">Tháng này chưa có giao dịch nào.</p> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Ngày</th><th>Loại</th><th>Danh mục</th><th>Sản phẩm</th><th>Số tiền</th><th>Lãi</th><th>Ví</th></tr></thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id}>
                    <td>{fmtDate(t.date)}</td>
                    <td>{t.type === 'income' ? 'Thu' : t.type === 'expense' ? 'Chi' : 'Chuyển ví'}</td>
                    <td>{catName(t.category_id)}</td>
                    <td>{productName(t)}{t.quantity && t.quantity > 1 ? ` ×${t.quantity}` : ''}</td>
                    <td>{fmtVND(t.amount)}</td>
                    <td>{t.profit ? fmtVND(t.profit) : '—'}</td>
                    <td>{walletName(t.wallet_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </AppShell>
  );
}
