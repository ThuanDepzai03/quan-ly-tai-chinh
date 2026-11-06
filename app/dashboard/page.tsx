'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import GlassCard, { Modal } from '@/components/GlassCard';
import TransactionForm from '@/components/TransactionForm';
import WalletForm from '@/components/WalletForm';
import { useAppData } from '@/lib/data';
import { fmtDate, fmtVND, monthISO } from '@/lib/utils';
import { WALLET_TYPE_LABELS } from '@/lib/types';
import type { TxType, Wallet } from '@/lib/types';

export default function Dashboard() {
  const router = useRouter();
  const data = useAppData();
  const { state } = data;
  const [showTx, setShowTx] = useState(false);
  const [txType, setTxType] = useState<TxType>('income');
  const [showWallet, setShowWallet] = useState(false);
  const [editWallet, setEditWallet] = useState<Wallet | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<string | null>(null);

  useEffect(() => {
    const openTransaction = () => {
      setTxType('income');
      setShowTx(true);
    };
    window.addEventListener('qltc:add-transaction', openTransaction);
    if (new URLSearchParams(window.location.search).has('add')) {
      openTransaction();
      router.replace('/dashboard', { scroll: false });
    }
    return () => window.removeEventListener('qltc:add-transaction', openTransaction);
  }, [router]);

  function openTransaction(type: TxType) {
    setTxType(type);
    setShowTx(true);
  }

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
  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
  const netCashflow = income - expense;
  const today = new Date().toISOString().slice(0, 10);
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
      <section className="balance-hero">
        <div className="balance-label">Tổng số dư · {wallets.length} ví</div>
        <div className="balance-total">{fmtVND(totalBalance)}</div>
        <div className="balance-breakdown">
          <div><span>↓ Thu tháng này</span><strong>{fmtVND(income)}</strong></div>
          <div><span>↑ Chi tháng này</span><strong>{fmtVND(expense)}</strong></div>
          <div><span>Dòng tiền ròng</span><strong>{netCashflow >= 0 ? '+' : '−'}{fmtVND(Math.abs(netCashflow))}</strong></div>
        </div>
      </section>

      <div className="quick-actions" aria-label="Thêm nhanh giao dịch">
        <button className="quick-action" onClick={() => openTransaction('income')}>
          <span className="quick-action-icon income-icon">↓</span><b>Ghi thu</b>
        </button>
        <button className="quick-action" onClick={() => openTransaction('expense')}>
          <span className="quick-action-icon expense-icon">↑</span><b>Ghi chi</b>
        </button>
        <button className="quick-action" onClick={() => openTransaction('transfer')}>
          <span className="quick-action-icon transfer-icon">⇄</span><b>Chuyển ví</b>
        </button>
        <button className="quick-action" onClick={() => openTransaction('expense')}>
          <span className="quick-action-icon scan-icon">▣</span><b>Quét hóa đơn</b>
        </button>
      </div>

      {reminders.length > 0 ? (
        <section className="dashboard-reminders">
          <h2>Cần chú ý</h2>
          {reminders.map((r) => {
            const overdue = r.next_date < today;
            return (
              <div className="dashboard-reminder" key={r.id}>
                <span className={overdue ? 'reminder-clock overdue' : 'reminder-clock'} aria-hidden="true">◷</span>
                <div>
                  <b>{r.title}{overdue ? ' — quá hạn' : ''}</b>
                  <span>{overdue ? ` (${fmtDate(r.next_date)})` : ` · ${fmtDate(r.next_date)}`}</span>
                </div>
                {r.amount ? <strong>{fmtVND(r.amount)}</strong> : null}
                <button className="btn-ghost btn-small" onClick={() => {
                  let createExpense = false;
                  if (r.amount && r.amount > 0 && wallets.length > 0) {
                    createExpense = confirm(`Đánh dấu "${r.title}" đã xử lý và ghi thêm 1 giao dịch Chi ${fmtVND(r.amount)} vào ví ${wallets[0].name}?\n\nBấm OK = ghi Chi + dời sang kỳ tiếp.\nBấm Hủy = chỉ dời sang kỳ tiếp, không ghi Chi.`);
                  }
                  data.completeReminder(r.id, { createExpense, walletId: wallets[0]?.id ?? null });
                }}>Xong</button>
              </div>
            );
          })}
        </section>
      ) : null}

      <GlassCard title="Ví / Tài khoản" action={
        <button
          className="btn-small"
          disabled={!data.currentWorkspace}
          onClick={() => { setEditWallet(null); setShowWallet(true); }}
        >+ Thêm ví</button>
      }>
        {!data.currentWorkspace ? (
          <p className="muted">
            Cần tạo không gian làm việc trước khi thêm ví. Vào <Link href="/cai-dat">Cài đặt → Tạo không gian mới</Link>.
          </p>
        ) : wallets.length === 0 ? <p className="muted">Chưa có ví nào.</p> : (
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
                    {t.tax_type ? ` • Thuế ${t.tax_type}${t.tax_rate ? ` ${(t.tax_rate * 100).toLocaleString('vi-VN')}%` : ''}` : ''}
                    {t.receipt_image ? ' • 🧾 có hóa đơn' : ''}
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
      </div>

      {showTx && state ? (
        <Modal title="Thêm giao dịch" className="transaction-modal" onClose={() => setShowTx(false)}>
          <TransactionForm key={txType} state={state} initialType={txType} onDone={() => setShowTx(false)} />
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
