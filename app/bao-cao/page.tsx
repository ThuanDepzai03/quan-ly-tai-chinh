'use client';
import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import GlassCard, { StatCard } from '@/components/GlassCard';
import { useAppData } from '@/lib/data';
import {
  downloadCSV, downloadXLSX, estimateWorkspaceTax, fmtDate, fmtVND, groupByMonth, monthISO,
} from '@/lib/utils';
import { BUSINESS_TYPE_LABELS, TAX_CALCULATION_METHOD_LABELS } from '@/lib/types';
import { defaultTaxMethod, inferBusinessType, TAX_RULES_2026 } from '@/lib/tax-config';

type ChartPeriod = 'week' | 'month' | 'year-month' | 'year-day';
type ChartMetricKey = 'income' | 'expense' | 'salesProfit' | 'net' | 'transfer';
type ChartPoint = {
  key: string;
  label: string;
  axisLabel: string;
  income: number;
  expense: number;
  salesProfit: number;
  net: number;
  transfer: number;
};

const CHART_METRICS: Array<{
  key: ChartMetricKey;
  title: string;
  description: string;
  color: string;
}> = [
  { key: 'income', title: 'Thu nhập', description: 'Chỉ tính giao dịch thu', color: '#34c759' },
  { key: 'expense', title: 'Chi tiêu', description: 'Chỉ tính giao dịch chi', color: '#ff5b67' },
  { key: 'salesProfit', title: 'Lãi bán hàng', description: 'Doanh thu bán hàng trừ giá vốn', color: '#42c7f5' },
  { key: 'net', title: 'Lời / lỗ dòng tiền', description: 'Thu nhập trừ chi tiêu, không gồm chuyển ví', color: '#b18cff' },
  { key: 'transfer', title: 'Chuyển giữa các ví', description: 'Tổng tiền chuyển, mỗi giao dịch chỉ tính một lần', color: '#ffb547' },
];

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function compactVND(value: number): string {
  const amount = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (amount >= 1_000_000_000) return `${sign}${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  if (amount >= 1_000_000) return `${sign}${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (amount >= 1_000) return `${sign}${(amount / 1_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k`;
  return `${sign}${Math.round(amount).toLocaleString('vi-VN')} đ`;
}

function ReportLineChart({
  title, description, color, points, metric, total,
}: {
  title: string;
  description: string;
  color: string;
  points: ChartPoint[];
  metric: ChartMetricKey;
  total: number;
}) {
  const width = 640;
  const height = 236;
  const left = 64;
  const right = 628;
  const top = 18;
  const bottom = 194;
  const values = points.map((point) => point[metric]);
  const lowest = Math.min(0, ...values);
  const highest = Math.max(0, ...values);
  const spread = highest - lowest;
  const padding = spread > 0 ? spread * 0.12 : 1;
  const min = lowest < 0 ? lowest - padding : 0;
  const max = highest > 0 ? highest + padding : (lowest < 0 ? 0 : 1);
  const range = max - min || 1;
  const x = (index: number) => left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * (right - left));
  const y = (value: number) => top + ((max - value) / range) * (bottom - top);
  const line = values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`).join(' ');
  const ticks = points.length <= 12
    ? points.map((_, index) => index)
    : points.map((point, index) => point.axisLabel ? index : -1).filter((index) => index >= 0);

  return (
    <article className="report-chart-card" style={{ borderColor: `${color}55` }}>
      <header className="report-chart-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <strong style={{ color }}>{fmtVND(total)}</strong>
      </header>
      <div className="report-chart-plot">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: ${fmtVND(total)}`}>
          {[0, 1, 2, 3].map((step) => {
            const value = max - (range * step) / 3;
            const lineY = y(value);
            return (
              <g key={step}>
                <line x1={left} x2={right} y1={lineY} y2={lineY} stroke="rgba(255,255,255,.11)" strokeDasharray="3 5" />
                <text x={left - 8} y={lineY + 4} textAnchor="end" fill="#9aa3b2" fontSize="10">{compactVND(value)}</text>
              </g>
            );
          })}
          {min < 0 && max > 0 ? (
            <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.35)" strokeDasharray="5 4" />
          ) : null}
          <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((point, index) => (
            <circle key={point.key} cx={x(index)} cy={y(point[metric])} r={points.length > 100 ? 1.7 : 3.2} fill={color}>
              <title>{`${point.label}: ${fmtVND(point[metric])}`}</title>
            </circle>
          ))}
          {ticks.map((index) => (
            <text key={points[index].key} x={x(index)} y={bottom + 22} textAnchor="middle" fill="#9aa3b2" fontSize="10">
              {points[index].axisLabel || points[index].label}
            </text>
          ))}
        </svg>
      </div>
    </article>
  );
}

export default function BaoCao() {
  const data = useAppData();
  const { state, currentWorkspace } = data;
  const [month, setMonth] = useState(monthISO());
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('month');
  const [chartOffset, setChartOffset] = useState(0);

  const wsId = state?.currentWorkspaceId ?? null;
  const allTxs = useMemo(
    () => (state?.transactions ?? []).filter((t) => t.workspace_id === wsId),
    [state, wsId]);
  const chartPoints = useMemo(() => {
    const today = new Date();
    const points: ChartPoint[] = [];
    if (chartPeriod === 'week') {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + chartOffset * 7);
      for (let day = 0; day < 7; day += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + day);
        points.push({
          key: isoDate(date),
          label: fmtDate(isoDate(date)),
          axisLabel: day === 6 ? 'CN' : `T${day + 2}`,
          income: 0, expense: 0, salesProfit: 0, net: 0, transfer: 0,
        });
      }
    } else if (chartPeriod === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth() + chartOffset, 1);
      const monthDays = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= monthDays; day += 1) {
        const date = new Date(start.getFullYear(), start.getMonth(), day);
        points.push({
          key: isoDate(date),
          label: fmtDate(isoDate(date)),
          axisLabel: day === 1 || (day - 1) % 7 === 0 ? String(day) : '',
          income: 0, expense: 0, salesProfit: 0, net: 0, transfer: 0,
        });
      }
    } else {
      const year = today.getFullYear() + chartOffset;
      if (chartPeriod === 'year-month') {
        for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
          const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
          points.push({
            key, label: `${String(monthIndex + 1).padStart(2, '0')}/${year}`, axisLabel: `T${monthIndex + 1}`,
            income: 0, expense: 0, salesProfit: 0, net: 0, transfer: 0,
          });
        }
      } else {
        const daysInYear = new Date(year + 1, 0, 0).getDate();
        for (let day = 0; day < daysInYear; day += 1) {
          const date = new Date(year, 0, day + 1);
          const iso = isoDate(date);
          points.push({
            key: iso,
            label: fmtDate(iso),
            axisLabel: date.getDate() === 1 ? `T${date.getMonth() + 1}` : '',
            income: 0, expense: 0, salesProfit: 0, net: 0, transfer: 0,
          });
        }
      }
    }

    const pointByKey = new Map(points.map((point) => [point.key, point]));
    for (const transaction of allTxs) {
      const key = chartPeriod === 'year-month' ? transaction.date.slice(0, 7) : transaction.date.slice(0, 10);
      const point = pointByKey.get(key);
      if (!point) continue;
      if (transaction.type === 'income') {
        point.income += transaction.amount;
        point.salesProfit += transaction.profit ?? 0;
        point.net += transaction.amount;
      } else if (transaction.type === 'expense') {
        point.expense += transaction.amount;
        point.net -= transaction.amount;
      } else {
        point.transfer += transaction.amount;
      }
    }
    return points;
  }, [allTxs, chartOffset, chartPeriod]);

  const chartPeriodLabel = useMemo(() => {
    if (chartPoints.length === 0) return '';
    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    if (chartPeriod === 'week') return `${first.label} – ${last.label}`;
    if (chartPeriod === 'month') {
      const [year, monthIndex] = first.key.split('-');
      return `${monthIndex}/${year}`;
    }
    if (chartPeriod === 'year-month' || chartPeriod === 'year-day') return first.key.slice(0, 4);
    return '';
  }, [chartPeriod, chartPoints]);

  const chartTotals = useMemo(() => {
    const totals: Record<ChartMetricKey, number> = {
      income: 0, expense: 0, salesProfit: 0, net: 0, transfer: 0,
    };
    for (const point of chartPoints) {
      for (const metric of Object.keys(totals) as ChartMetricKey[]) totals[metric] += point[metric];
    }
    return totals;
  }, [chartPoints]);
  const transferRoutes = useMemo(() => {
    const visibleKeys = new Set(chartPoints.map((point) => point.key));
    const routes = new Map<string, { id: string; label: string; amount: number; count: number }>();
    for (const transaction of allTxs) {
      if (transaction.type !== 'transfer') continue;
      const periodKey = chartPeriod === 'year-month' ? transaction.date.slice(0, 7) : transaction.date.slice(0, 10);
      if (!visibleKeys.has(periodKey)) continue;
      const routeKey = `${transaction.wallet_id}->${transaction.to_wallet_id ?? ''}`;
      const from = state?.wallets.find((wallet) => wallet.id === transaction.wallet_id)?.name ?? 'Ví nguồn';
      const to = state?.wallets.find((wallet) => wallet.id === transaction.to_wallet_id)?.name ?? 'Ví đích';
      const route = routes.get(routeKey) ?? { id: routeKey, label: `${from} → ${to}`, amount: 0, count: 0 };
      route.amount += transaction.amount;
      route.count += 1;
      routes.set(routeKey, route);
    }
    return Array.from(routes.values()).sort((a, b) => b.amount - a.amount);
  }, [allTxs, chartPeriod, chartPoints, state?.wallets]);
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
  const businessType = currentWorkspace?.business_type
    ?? (currentWorkspace ? inferBusinessType(currentWorkspace.mode) : 'household_business');
  const businessSector = currentWorkspace?.business_sector ?? 'goods';
  const annualRevenue = allTxs.filter((t) => t.type === 'income' && t.date.startsWith(String(new Date().getFullYear())))
    .reduce((sum, t) => sum + t.amount, 0);
  const taxMethod = defaultTaxMethod(businessType, annualRevenue);
  const tax = estimateWorkspaceTax({
    businessType,
    businessSector,
    method: taxMethod,
    revenue: income,
    annualRevenue,
    vatRate: currentWorkspace?.vat_rate ?? TAX_RULES_2026.enterprise.defaultVatRate,
    monthlyDeduction: currentWorkspace?.tncn_deduction ?? TAX_RULES_2026.personalIncome.monthlyDeduction,
  });
  const fmtTaxAmount = (value: number | null) => value === null ? 'Chưa đủ dữ liệu' : fmtVND(value);

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

  async function exportXLSX() {
    await downloadXLSX(`bao-cao-${month}.xlsx`, [
      { name: 'Tong hop', rows: [{
        'Tháng': month, 'Tổng thu': income, 'Tổng chi': expense, 'Lãi bán hàng': profit,
        'Thông tư kế toán': currentWorkspace?.tax_circular ?? 'TT88/2021',
        'Loại hình chủ thể': BUSINESS_TYPE_LABELS[businessType],
        'Phương pháp thuế thu nhập': TAX_CALCULATION_METHOD_LABELS[taxMethod],
        'VAT ước tính': tax.vat, 'TNCN ước tính': tax.tncn,
        'TNDN ước tính': tax.tndn, 'Tổng thuế ước tính': tax.total,
      }] },
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
          <StatCard label={`Thuế ước tính · ${TAX_CALCULATION_METHOD_LABELS[tax.method]}`} value={fmtTaxAmount(tax.total)} sub={`${tax.incomeTaxLabel}: ${fmtTaxAmount(tax.incomeTax)}. Lợi nhuận tính thuế cần nhập tại mục Thuế.`} />
        </div>
      </GlassCard>

      <GlassCard title={`Biểu đồ thu chi & dòng tiền — ${chartPeriodLabel}`} action={
        <div className="report-chart-controls">
          <div className="report-period-buttons" role="group" aria-label="Khoảng thời gian biểu đồ">
            {([
              ['week', 'Tuần'],
              ['month', 'Tháng'],
              ['year-month', 'Năm · tháng'],
              ['year-day', 'Năm · ngày'],
            ] as Array<[ChartPeriod, string]>).map(([period, label]) => (
              <button
                key={period}
                type="button"
                className={`btn-small ${chartPeriod === period ? '' : 'btn-ghost'}`}
                aria-pressed={chartPeriod === period}
                onClick={() => { setChartPeriod(period); setChartOffset(0); }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="report-period-nav">
            <button type="button" className="btn-ghost btn-small" aria-label="Khoảng thời gian trước" onClick={() => setChartOffset((offset) => offset - 1)}>‹</button>
            <span>{chartPeriodLabel}</span>
            <button type="button" className="btn-ghost btn-small" aria-label="Khoảng thời gian sau" disabled={chartOffset >= 0} onClick={() => setChartOffset((offset) => Math.min(0, offset + 1))}>›</button>
          </div>
        </div>
      }>
        <div className="report-chart-grid">
          {CHART_METRICS.map((metric) => (
            <ReportLineChart
              key={metric.key}
              title={metric.title}
              description={metric.description}
              color={metric.color}
              points={chartPoints}
              metric={metric.key}
              total={chartTotals[metric.key]}
            />
          ))}
        </div>
        <div className="report-transfer-routes">
          <strong>Luồng chuyển ví trong khoảng thời gian này</strong>
          {transferRoutes.length === 0 ? <p className="muted">Chưa có giao dịch chuyển ví.</p> : (
            <ul>
              {transferRoutes.map((route) => (
                <li key={route.id}>
                  <span>{route.label}<small>{route.count} giao dịch</small></span>
                  <b>{fmtVND(route.amount)}</b>
                </li>
              ))}
            </ul>
          )}
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
