'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import GlassCard, { Field, Modal } from '@/components/GlassCard';
import TransactionForm from '@/components/TransactionForm';
import WalletForm from '@/components/WalletForm';
import { useAppData } from '@/lib/data';
import { fmtDate, fmtVND, monthISO, todayISO } from '@/lib/utils';
import { WALLET_TYPE_LABELS } from '@/lib/types';
import type { Debt, DebtPayment, Goal, TxType, Wallet } from '@/lib/types';
import { fileToBase64 } from '@/lib/receipt';

function getDebtHistoryRows(debt: Debt): Array<{ payment: DebtPayment; balanceAfter: number }> {
  const history = debt.payment_history ?? [];
  const increased = history.filter((event) => event.type === 'increase').reduce((sum, event) => sum + event.amount, 0);
  const paidInHistory = history.filter((event) => event.type !== 'increase').reduce((sum, event) => sum + event.amount, 0);
  let balance = debt.amount - increased - (debt.paid - paidInHistory);
  const chronological = history
    .map((payment, index) => ({ payment, index }))
    .sort((a, b) => a.payment.created_at.localeCompare(b.payment.created_at) || a.index - b.index);
  const rows = chronological.map(({ payment }) => {
    balance += payment.type === 'increase' ? payment.amount : -payment.amount;
    return { payment, balanceAfter: Math.max(0, balance) };
  });
  return rows.reverse();
}

export default function Dashboard() {
  const router = useRouter();
  const data = useAppData();
  const { state } = data;
  const [showTx, setShowTx] = useState(false);
  const [txType, setTxType] = useState<TxType>('income');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showAllWallets, setShowAllWallets] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [editWallet, setEditWallet] = useState<Wallet | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<string | null>(null);
  const [goalEditor, setGoalEditor] = useState<Goal | 'new' | null>(null);
  const [goalContribution, setGoalContribution] = useState<Goal | null>(null);
  const [debtEditor, setDebtEditor] = useState<Debt | 'new-borrow' | 'new-lend' | null>(null);
  const [debtPayment, setDebtPayment] = useState<Debt | null>(null);
  const [debtIncrease, setDebtIncrease] = useState<Debt | null>(null);

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
      .sort((a, b) => b.date.localeCompare(a.date)),
    [state, wsId]);
  const displayedTransactions = showAllTransactions ? txs : txs.slice(0, 5);
  const displayedWallets = showAllWallets ? wallets : wallets.slice(0, 5);
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

  function renderDebtTable(kind: Debt['kind']) {
    const rows = debts.filter((debt) => debt.kind === kind);
    const total = rows.reduce((sum, debt) => sum + debt.amount, 0);
    const paid = rows.reduce((sum, debt) => sum + debt.paid, 0);
    const remaining = Math.max(0, total - paid);
    const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    const isBorrow = kind === 'borrow';

    return (
      <GlassCard
        key={kind}
        title={isBorrow ? 'Nợ phải trả' : 'Cho vay / Khách nợ'}
        action={
          <button className="btn-small" disabled={!data.currentWorkspace}
            onClick={() => setDebtEditor(isBorrow ? 'new-borrow' : 'new-lend')}>
            {isBorrow ? '+ Thêm khoản nợ' : '+ Thêm khoản cho vay'}
          </button>
        }
      >
        {rows.length === 0 ? (
          <p className="muted">{isBorrow ? 'Chưa có khoản nợ phải trả.' : 'Chưa có khoản cho vay / khách nợ.'}</p>
        ) : (
          <div className="row-list">
            {rows.map((d) => (
              <div key={d.id} className="row-item debt-row">
                <div className="debt-row-main">
                <div className="debt-row-info">
                  <b>{d.name}</b>
                  <div className="sub">
                    {d.start_date ? `Từ ${fmtDate(d.start_date)}` : 'Chưa ghi ngày bắt đầu'}
                    {d.due_date ? ` · Hạn ${fmtDate(d.due_date)}` : ''}
                  </div>
                  <div>{fmtVND(d.paid)} / {fmtVND(d.amount)} đã {isBorrow ? 'trả' : 'thu'}</div>
                  {d.payment_history?.length ? (
                    <details style={{ marginTop: 6 }}>
                      <summary className="muted" style={{ cursor: 'pointer' }}>
                        Lịch sử phát sinh ({d.payment_history.length})
                      </summary>
                      <div className="row-list debt-history-list" style={{ marginTop: 6 }}>
                        {getDebtHistoryRows(d).map(({ payment, balanceAfter }) => {
                          const isIncrease = payment.type === 'increase';
                          return (
                            <div key={payment.id} className={`debt-history-item ${isIncrease ? 'debt-history-increase' : 'debt-history-payment'}`}>
                              <div>
                                <b>{isIncrease ? '+ ' : '− '}{fmtVND(payment.amount)} · {isIncrease ? 'Tăng nợ' : isBorrow ? 'Đã trả' : 'Đã thu'}</b>
                                <div className="sub">
                                  {new Date(payment.created_at).toLocaleString('vi-VN')}
                                  {payment.note ? ` · ${payment.note}` : ' · Không có ghi chú'}
                                </div>
                              </div>
                              <b className="debt-history-balance">{fmtVND(balanceAfter)}</b>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  ) : d.paid > 0 ? (
                    <div className="sub">Số đã ghi trước đây; chưa có lịch sử chi tiết.</div>
                  ) : null}
                  <div className="debt-balance-summary">
                    Còn {isBorrow ? 'nợ' : 'phải thu'} <b>{fmtVND(Math.max(0, d.amount - d.paid))}</b>
                    {d.payment_history?.length ? (() => {
                      const changes = d.payment_history.reduce((totals, event) => {
                        if (event.type === 'increase') totals.increased += event.amount;
                        else totals.paid += event.amount;
                        return totals;
                      }, { increased: 0, paid: 0 });
                      const net = changes.increased - changes.paid;
                      return <span className="debt-net-change"> · Phát sinh ròng: {net > 0 ? '+' : net < 0 ? '−' : ''}{fmtVND(Math.abs(net))}</span>;
                    })() : null}
                  </div>
                </div>
                <div className="debt-row-actions">
                  <button className="btn-ghost btn-small debt-action-increase" onClick={() => setDebtIncrease(d)}>
                    + Thêm nợ
                  </button>
                  {d.paid < d.amount ? (
                    <button className="btn-small debt-action-payment" onClick={() => setDebtPayment(d)}>
                      {isBorrow ? 'Ghi trả nợ' : 'Ghi thu nợ'}
                    </button>
                  ) : null}
                  <button className="btn-ghost btn-small" onClick={() => setDebtEditor(d)}>Sửa</button>
                  <button className="btn-ghost btn-small" onClick={() => {
                    if (confirm(`Xóa khoản "${d.name}"?`)) data.deleteDebt(d.id);
                  }}>Xóa</button>
                </div>
                </div>
                <DebtImageSlot debt={d} />
              </div>
            ))}
          </div>
        )}
        <div className={`debt-progress-summary ${isBorrow ? 'debt-progress-borrow' : 'debt-progress-lend'}`}>
          <div className="debt-progress-totals">
            <span>Tổng <b>{fmtVND(total)}</b></span>
            <span>Đã {isBorrow ? 'trả' : 'thu'} <b>{fmtVND(paid)}</b></span>
            <span>Còn <b>{fmtVND(remaining)}</b></span>
            <b className="debt-progress-percent">{progress}%</b>
          </div>
          <div className="debt-milestone-track" role="img"
            aria-label={`Đã ${isBorrow ? 'trả' : 'thu'} ${progress}%`}>
            <div className="debt-milestone-fill" style={{ width: `${progress}%` }} />
            {[25, 50, 75, 100].map((milestone) => (
              <span key={milestone}
                className={`debt-milestone ${progress >= milestone ? 'reached' : ''}`}
                style={{ left: `${milestone}%` }} title={`${milestone}%`} />
            ))}
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          Theo dõi công nợ, không tự động cộng/trừ số dư ví.
        </p>
      </GlassCard>
    );
  }

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
            {displayedWallets.map((w) => (
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
        {wallets.length > 5 ? (
          <button className="btn-ghost btn-small list-expand-button" onClick={() => setShowAllWallets((shown) => !shown)}>
            {showAllWallets ? 'Thu gọn' : `Xem thêm (${wallets.length - 5})`}
          </button>
        ) : null}
      </GlassCard>

      <GlassCard title="Giao dịch gần đây" action={
        <button className="btn-small" onClick={() => setShowTx(true)}>+ Thêm giao dịch</button>
      }>
        {txs.length === 0 ? <p className="muted">Chưa có giao dịch — bấm “Thêm giao dịch” để ghi Thu/Chi đầu tiên.</p> : (
          <div className="row-list">
            {displayedTransactions.map((t) => (
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
        {txs.length > 5 ? (
          <button className="btn-ghost btn-small list-expand-button" onClick={() => setShowAllTransactions((shown) => !shown)}>
            {showAllTransactions ? 'Thu gọn' : `Xem thêm (${txs.length - 5})`}
          </button>
        ) : null}
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
        <GlassCard title="Mục tiêu tiết kiệm" action={
          <button className="btn-small" disabled={!data.currentWorkspace} onClick={() => setGoalEditor('new')}>
            + Thêm mục tiêu
          </button>
        }>
          {goals.length === 0 ? <p className="muted">Chưa có mục tiêu.</p> : (
            <div className="row-list">
              {goals.map((g) => {
                const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
                return (
                  <div key={g.id} className="row-item" style={{ alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span><b>{g.name}</b>{g.deadline ? <span className="sub"> · Hạn {fmtDate(g.deadline)}</span> : null}</span>
                        <span>{fmtVND(g.saved)} / {fmtVND(g.target)}</span>
                      </div>
                      <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                      <div className="sub">{pct}% hoàn thành</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn-small" onClick={() => setGoalContribution(g)}>Góp tiền</button>
                      <button className="btn-ghost btn-small" onClick={() => setGoalEditor(g)}>Sửa</button>
                      <button className="btn-ghost btn-small" onClick={() => {
                        if (confirm(`Xóa mục tiêu "${g.name}"?`)) data.deleteGoal(g.id);
                      }}>Xóa</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="muted" style={{ fontSize: 12 }}>Ghi nhận tiến độ tiết kiệm, không tự động thay đổi số dư ví.</p>
        </GlassCard>
      </div>

      <div className="debt-sections">
        {renderDebtTable('borrow')}
        {renderDebtTable('lend')}
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
      {goalEditor ? (
        <GoalFormModal
          goal={goalEditor === 'new' ? null : goalEditor}
          onClose={() => setGoalEditor(null)}
          onSaved={() => setGoalEditor(null)}
        />
      ) : null}
      {goalContribution ? (
        <AmountActionModal
          title={`Góp tiền: ${goalContribution.name}`}
          actionLabel="Ghi nhận góp tiền"
          onClose={() => setGoalContribution(null)}
          onSubmit={(amount) => data.contributeGoal(goalContribution.id, amount)}
        />
      ) : null}
      {debtEditor ? (
        <DebtFormModal
          debt={typeof debtEditor === 'string' ? null : debtEditor}
          initialKind={debtEditor === 'new-lend' ? 'lend' : 'borrow'}
          onClose={() => setDebtEditor(null)}
          onSaved={() => setDebtEditor(null)}
        />
      ) : null}
      {debtPayment ? (
        <AmountActionModal
          title={`${debtPayment.kind === 'borrow' ? 'Ghi trả nợ' : 'Ghi thu nợ'}: ${debtPayment.name}`}
          actionLabel={debtPayment.kind === 'borrow' ? 'Xác nhận đã trả' : 'Xác nhận đã thu'}
          maxAmount={Math.max(0, debtPayment.amount - debtPayment.paid)}
          noteLabel="Ghi chú (không bắt buộc)"
          onClose={() => setDebtPayment(null)}
          onSubmit={(amount, note) => data.payDebt(debtPayment.id, amount, note)}
        />
      ) : null}
      {debtIncrease ? (
        <AmountActionModal
          title={`Thêm nợ cho ${debtIncrease.name}`}
          actionLabel="Ghi nhận nợ tăng"
          noteLabel="Ghi chú (không bắt buộc)"
          onClose={() => setDebtIncrease(null)}
          onSubmit={(amount, note) => data.increaseDebt(debtIncrease.id, amount, note)}
        />
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

function GoalFormModal({ goal, onClose, onSaved }: {
  goal: Goal | null; onClose: () => void; onSaved: () => void;
}) {
  const data = useAppData();
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? String(goal.target) : '');
  const [saved, setSaved] = useState(goal ? String(goal.saved) : '0');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const targetValue = Number(target);
    const savedValue = Number(saved);
    if (!name.trim()) { setError('Vui lòng nhập tên mục tiêu.'); return; }
    if (!Number.isFinite(targetValue) || targetValue <= 0) { setError('Số tiền mục tiêu phải lớn hơn 0.'); return; }
    if (!Number.isFinite(savedValue) || savedValue < 0) { setError('Số tiền đã tiết kiệm không hợp lệ.'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await data.saveGoal({
        id: goal?.id, name: name.trim(), target: targetValue,
        saved: savedValue, deadline: deadline || null,
      });
      if (result) { setError(result); return; }
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={goal ? 'Sửa mục tiêu tiết kiệm' : 'Thêm mục tiêu tiết kiệm'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Tên mục tiêu">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="VD: Quỹ dự phòng" required />
        </Field>
        <Field label="Số tiền cần đạt (đ)">
          <input type="number" min={1} value={target} onChange={(event) => setTarget(event.target.value)} required />
        </Field>
        <Field label="Đã tiết kiệm (đ)">
          <input type="number" min={0} value={saved} onChange={(event) => setSaved(event.target.value)} required />
        </Field>
        <Field label="Hạn hoàn thành (không bắt buộc)">
          <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
        </Field>
        {error ? <p className="error">{error}</p> : null}
        <div className="flex-row">
          <button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : goal ? 'Lưu thay đổi' : 'Tạo mục tiêu'}</button>
          <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        </div>
      </form>
    </Modal>
  );
}

function DebtImageSlot({ debt }: { debt: Debt }) {
  const data = useAppData();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  async function saveImage(image: string | null) {
    setSaving(true);
    setError('');
    try {
      const result = await data.saveDebt({
        ...debt,
        image,
      });
      if (result) setError(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await saveImage(await fileToBase64(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  function closeViewer() {
    setViewing(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function changeZoom(nextZoom: number) {
    setZoom(Math.min(5, Math.max(1, nextZoom)));
    if (nextZoom <= 1) setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    if (!viewing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeViewer();
      if (event.key === '+' || event.key === '=') changeZoom(zoom + 0.25);
      if (event.key === '-') changeZoom(zoom - 0.25);
      if (event.key === '0') changeZoom(1);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewing, zoom]);

  return (
    <div className="debt-image-column">
      {debt.image ? (
        <button type="button" className={`debt-image-slot has-image ${saving ? 'is-saving' : ''}`}
          onClick={() => setViewing(true)} aria-label={`Xem ảnh ${debt.name}`}>
          <img src={debt.image} alt="" />
        </button>
      ) : (
        <label className={`debt-image-slot ${saving ? 'is-saving' : ''}`}>
          <span className="debt-image-placeholder">
            <b aria-hidden="true">+</b>
            <span>Thêm ảnh</span>
          </span>
          <input type="file" accept="image/jpeg,image/png" disabled={saving}
            aria-label={`Thêm ảnh cho ${debt.name}`} onChange={handleImageChange} />
        </label>
      )}
      {debt.image ? (
        <div className="debt-image-actions">
          <label className="debt-image-remove">
            Thay ảnh
            <input type="file" accept="image/jpeg,image/png" disabled={saving}
              aria-label={`Thay ảnh cho ${debt.name}`} onChange={handleImageChange} />
          </label>
          <button className="debt-image-remove" disabled={saving} onClick={() => void saveImage(null)}>
            Gỡ
          </button>
        </div>
      ) : null}
      {error ? <span className="debt-image-error" role="alert">{error}</span> : null}
      {viewing && debt.image ? (
        createPortal(<div className="debt-image-viewer" role="dialog" aria-modal="true" aria-label={`Xem ảnh: ${debt.name}`}
          onClick={closeViewer}>
          <div className="debt-image-viewer-toolbar" onClick={(event) => event.stopPropagation()}>
            <span>{debt.name}</span>
            <div className="debt-image-zoom-controls" aria-label="Điều khiển thu phóng">
              <button onClick={() => changeZoom(zoom - 0.25)} disabled={zoom <= 1} aria-label="Thu nhỏ">−</button>
              <button className="debt-image-zoom-level" onClick={() => changeZoom(1)} aria-label="Đặt lại kích thước">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={() => changeZoom(zoom + 0.25)} disabled={zoom >= 5} aria-label="Phóng to">+</button>
              <button className="debt-image-viewer-close" onClick={closeViewer} aria-label="Đóng">✕</button>
            </div>
          </div>
          <div className={`debt-image-viewer-stage ${zoom > 1 ? 'is-zoomed' : ''}`}
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => {
              event.preventDefault();
              changeZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
            }}
            onPointerDown={(event) => {
              if (zoom <= 1) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
            }}
            onPointerMove={(event) => {
              if (!dragStart.current) return;
              setPan({
                x: dragStart.current.panX + event.clientX - dragStart.current.x,
                y: dragStart.current.panY + event.clientY - dragStart.current.y,
              });
            }}
            onPointerUp={() => { dragStart.current = null; }}
            onPointerCancel={() => { dragStart.current = null; }}>
            <img src={debt.image} alt={`Ảnh đính kèm cho ${debt.name}`}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} />
          </div>
          <span className="debt-image-viewer-hint">Lăn chuột để thu phóng · Kéo ảnh khi đã phóng lớn · Esc để đóng</span>
        </div>, document.body)
      ) : null}
    </div>
  );
}

function DebtFormModal({ debt, initialKind, onClose, onSaved }: {
  debt: Debt | null; initialKind: Debt['kind']; onClose: () => void; onSaved: () => void;
}) {
  const data = useAppData();
  const [name, setName] = useState(debt?.name ?? '');
  const [kind, setKind] = useState<Debt['kind']>(debt?.kind ?? initialKind);
  const [amount, setAmount] = useState(debt ? String(debt.amount) : '');
  const [startDate, setStartDate] = useState(debt?.start_date ?? todayISO());
  const [dueDate, setDueDate] = useState(debt?.due_date ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const amountValue = Number(amount);
    if (!name.trim()) { setError('Vui lòng nhập tên khoản nợ hoặc đối tác.'); return; }
    if (!Number.isFinite(amountValue) || amountValue <= 0) { setError('Tổng số tiền phải lớn hơn 0.'); return; }
    if (debt && amountValue < debt.paid) {
      setError(`Tổng số tiền không thể thấp hơn số đã trả/thu (${fmtVND(debt.paid)}).`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await data.saveDebt({
        id: debt?.id, name: name.trim(), kind,
        amount: amountValue, paid: debt?.paid ?? 0,
        start_date: startDate || null, due_date: dueDate || null,
      });
      if (result) { setError(result); return; }
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={debt ? 'Sửa khoản nợ / cho vay' : 'Thêm khoản nợ / cho vay'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Tên khoản nợ / đối tác">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="VD: Vay ngân hàng, Khách hàng A" required />
        </Field>
        <Field label="Loại khoản">
          <select value={kind} onChange={(event) => setKind(event.target.value as Debt['kind'])}>
            <option value="borrow">Mình đi vay (theo dõi số đã trả)</option>
            <option value="lend">Mình cho vay / khách nợ (theo dõi số đã thu)</option>
          </select>
        </Field>
        <Field label="Tổng số tiền (đ)">
          <input type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </Field>
        <Field label="Ngày bắt đầu khoản nợ">
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </Field>
        {debt ? (
          <p className="muted">Đã ghi nhận: <b>{fmtVND(debt.paid)}</b>. Dùng nút ghi trả/thu ở danh sách để lưu từng lần kèm ngày giờ và ghi chú.</p>
        ) : null}
        <Field label="Ngày đến hạn (không bắt buộc)">
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
        <p className="muted" style={{ fontSize: 12 }}>Thông tin này chỉ theo dõi công nợ, không tự động thay đổi số dư ví.</p>
        {error ? <p className="error">{error}</p> : null}
        <div className="flex-row">
          <button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : debt ? 'Lưu thay đổi' : 'Tạo khoản'}</button>
          <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        </div>
      </form>
    </Modal>
  );
}

function AmountActionModal({ title, actionLabel, maxAmount, noteLabel, onClose, onSubmit }: {
  title: string;
  actionLabel: string;
  maxAmount?: number;
  noteLabel?: string;
  onClose: () => void;
  onSubmit: (amount: number, note?: string) => Promise<string | null>;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setError('Số tiền phải lớn hơn 0.'); return; }
    if (maxAmount !== undefined && value > maxAmount) {
      setError(`Số tiền không được vượt quá ${fmtVND(maxAmount)}.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await onSubmit(value, note);
      if (result) { setError(result); return; }
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        {maxAmount !== undefined ? <p className="muted">Còn lại: <b>{fmtVND(maxAmount)}</b></p> : null}
        <Field label="Số tiền (đ)">
          <input type="number" min={1} max={maxAmount} value={amount} onChange={(event) => setAmount(event.target.value)} required autoFocus />
        </Field>
        {noteLabel ? (
          <Field label={noteLabel}>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="VD: Chuyển khoản, thu tiền mặt…" />
          </Field>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="flex-row">
          <button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : actionLabel}</button>
          <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        </div>
      </form>
    </Modal>
  );
}
