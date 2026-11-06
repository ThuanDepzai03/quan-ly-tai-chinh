'use client';
import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import GlassCard, { Modal, StatCard } from '@/components/GlassCard';
import TransactionForm from '@/components/TransactionForm';
import WalletForm from '@/components/WalletForm';
import { useAppData } from '@/lib/data';
import { fmtDate, fmtVND, monthISO, tax88 } from '@/lib/utils';
import { WALLET_TYPE_LABELS } from '@/lib/types';
import type { Wallet } from '@/lib/types';

export default function Dashboard() {
  const data = useAppData();
  const { state } = data;
  const [showTx, setShowTx] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [editWallet, setEditWallet] = useState<Wallet | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<string | null>(null);

  const wsId = state?.currentWorkspaceId ?? null;
  const wallets = useMemo(
    () => (state?.wallets ?? []).filter((w) => w.workspace_id === wsId), [state, wsId]);
  const txs = useMemo(
    () => (state?.transactions ?? []).filter((t) => t.workspace_id === wsId)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
    [state, wsId]);
  const month = monthISO();
  const monthTxs = useMemo(
    () => (state?.transactions ?? []).filter((t) => t.workspace_id === wsId && t.date.startsWith(month)),
    [state, wsId, month]);
  const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const profit = monthTxs.reduce((s, t) => s + (t.profit ?? 0), 0);
  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
  const tax = tax88(income);
  const budgets = useMemo(
    () => (state?.budgets ?? []).filter((b) => b.workspace_id === wsId && b.month === month),
    [state, wsId, month]);
  const goals = useMemo(
    () => (state?.goals ?? []).filter((g) => g.workspace_id === wsId), [state, wsId]);
  const debts = useMemo(
    () => (state?.debts ?? []).filter((d) => d.workspace_id === wsId), [state, wsId]);
  const reminders = useMemo(
    () => (state?.reminders ?? []).filter((r) => r.workspace_id === wsId)
      .sort((a, b) => a.next_date.localeCompare(b.next_date)).slice(0, 5),
    [state, wsId]);
  const catName = (id?: string | null) =>
    state?.categories.find((c) => c.id === id)?.name ?? '—';
  const walletName = (id: string) =>
    state?.wallets.find((w) => w.id === id)?.name ?? '—';

  return (
    <AppShell>
      <div className="flex-row">
        <StatCard label="Tổng số dư" value={fmtVND(totalBalance)} sub={`${wallets.length} ví`} />
        <StatCard label={`Thu tháng ${month}`} value={fmtVND(income)} sub="Theo giao dịch đã ghi" />
        <StatCard label={`Chi tháng ${month}`} value={fmtVND(expense)} sub="Theo giao dịch đã ghi" />
        <StatCard label="Lãi bán hàng tháng này" value={fmtVND(profit)} sub="Doanh thu − Giá vốn" />
        <StatCard label="Thuế TT88 ước tính" value={fmtVND(tax.total)} sub={`VAT ${fmtVND(tax.vat)} + TNCN ${fmtVND(tax.tncn)}`} />
      </div>

      <GlassCard title="Ví / Tài khoản" action={
        <button className="btn-small" onClick={() => { setEditWallet(null); setShowWallet(true); }}>+ Thêm ví</button>
      }>
        {wallets.length === 0 ? <p className="muted">Chưa có ví nào.</p> : (
          <div className="row-list">
            {wallets.map((w) => (
              <div key={w.id} className="row-item">
                <div><b>{w.name}</b><div className="sub">{WALLET_TYPE_LABELS[w.type]}</div></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <b>{fmtVND(w.balance)}</b>
                  <button className="btn-ghost btn-small" onClick={() => { setEditWallet(w); setShowWallet(true); }}>Sửa</button>
                  <button className="btn-ghost btn-small" onClick={() => {
                    if (confirm(`Xóa ví "${w.name}" và toàn bộ giao dịch của ví này?`)) data.deleteWallet(w.id);
                  }}>Xóa</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard title="Giao dịch gần đây" action={
        <button className="btn-small" onClick={() => setShowTx(true)}>+ Thêm giao dịch</button>
      }>
        {txs.length === 0 ? <p className="muted">Chưa có giao dịch — bấm “Thêm giao dịch” để ghi Thu/Chi đầu tiên.</p> : (
          <div className="row-list">
            {txs.map((t) => (
              <div key={t.id} className="row-item">
                <div>
                  <b style={{ color: t.type === 'income' ? '#34c759' : t.type === 'expense' ? '#ff3b30' : '#0a84ff' }}>
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '⇄'} {fmtVND(t.amount)}
                  </b>
                  <div className="sub">
                    {fmtDate(t.date)} • {catName(t.category_id)} • {walletName(t.wallet_id)}
                    {t.profit ? ` • Lãi ${fmtVND(t.profit)}` : ''}{t.note ? ` • ${t.note}` : ''}
                  </div>
                </div>
                <button className="btn-ghost btn-small" onClick={() => setConfirmDeleteTx(t.id)}>Xóa</button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <div className="flex-row" style={{ alignItems: 'stretch' }}>
        <GlassCard title={`Ngân sách tháng ${month}`}>
          {budgets.length === 0 ? <p className="muted">Chưa đặt ngân sách tháng này. Đặt ở trang Cài đặt → Ngân sách.</p> : (
            <div className="row-list">
              {budgets.map((b) => {
                const spent = monthTxs
                  .filter((t) => t.type === 'expense' && t.category_id === b.category_id)
                  .reduce((s, t) => s + t.amount, 0);
                const pct = b.amount > 0 ? Math.min(100, Math.round((spent / b.amount) * 100)) : 0;
                return (
                  <div key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{catName(b.category_id)}</span>
                      <span>{fmtVND(spent)} / {fmtVND(b.amount)} ({pct}%)</span>
                    </div>
                    <div className={`progress ${spent > b.amount ? 'over' : ''}`}><div style={{ width: `${pct}%` }} /></div>
                    {spent > b.amount ? <p className="error">Vượt ngân sách {fmtVND(spent - b.amount)}!</p> : null}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
        <GlassCard title="Mục tiêu tiết kiệm">
          {goals.length === 0 ? <p className="muted">Chưa có mục tiêu.</p> : (
            <div className="row-list">
              {goals.map((g) => {
                const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
                return (
                  <div key={g.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{g.name}</span><span>{fmtVND(g.saved)} / {fmtVND(g.target)}</span>
                    </div>
                    <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="flex-row" style={{ alignItems: 'stretch' }}>
        <GlassCard title="Nợ / Cho vay">
          {debts.length === 0 ? <p className="muted">Không có khoản nợ nào.</p> : (
            <div className="row-list">
              {debts.map((d) => (
                <div key={d.id} className="row-item">
                  <div><b>{d.name}</b><div className="sub">{d.kind === 'borrow' ? 'Đi vay' : 'Cho vay / Khách nợ'} • Hạn: {d.due_date ? fmtDate(d.due_date) : '—'}</div></div>
                  <span>{fmtVND(d.paid)} / {fmtVND(d.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
        <GlassCard title="Nhắc nhở sắp tới">
          {reminders.length === 0 ? <p className="muted">Không có nhắc nhở.</p> : (
            <div className="row-list">
              {reminders.map((r) => (
                <div key={r.id} className="row-item">
                  <div><b>{r.title}</b><div className="sub">{fmtDate(r.next_date)} • {r.frequency}</div></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{r.amount ? fmtVND(r.amount) : ''}</span>
                    <button className="btn-ghost btn-small" onClick={() => data.completeReminder(r.id)}>Xong</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {showTx && state ? (
        <Modal title="Thêm giao dịch" onClose={() => setShowTx(false)}>
          <TransactionForm state={state} onDone={() => setShowTx(false)} />
        </Modal>
      ) : null}
      {showWallet ? (
        <Modal title={editWallet ? 'Sửa ví' : 'Thêm ví / tài khoản'} onClose={() => setShowWallet(false)}>
          <WalletForm editing={editWallet} onDone={() => setShowWallet(false)} />
        </Modal>
      ) : null}
      {confirmDeleteTx ? (
        <Modal title="Xóa giao dịch?" onClose={() => setConfirmDeleteTx(null)}>
          <p>Giao dịch bán hàng bị xóa sẽ hoàn lại tồn kho và số dư ví. Bạn chắc chắn muốn xóa?</p>
          <div className="flex-row">
            <button className="btn-danger" onClick={() => { data.deleteTransaction(confirmDeleteTx); setConfirmDeleteTx(null); }}>Xóa giao dịch</button>
            <button className="btn-secondary" onClick={() => setConfirmDeleteTx(null)}>Hủy</button>
          </div>
        </Modal>
      ) : null}
    </AppShell>
  );
}
