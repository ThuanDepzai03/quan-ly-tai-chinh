'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import GlassCard, { Field, Modal } from '@/components/GlassCard';
import TransactionForm from '@/components/TransactionForm';
import WalletForm from '@/components/WalletForm';
import { useAppData } from '@/lib/data';
import { fmtDate, fmtVND, monthISO } from '@/lib/utils';
import { WALLET_TYPE_LABELS } from '@/lib/types';
import type { Debt, Goal, TxType, Wallet } from '@/lib/types';

export default function Dashboard() {
  const router = useRouter();
  const data = useAppData();
  const { state } = data;
  const [showTx, setShowTx] = useState(false);
  const [txType, setTxType] = useState<TxType>('income');
  const [showWallet, setShowWallet] = useState(false);
  const [editWallet, setEditWallet] = useState<Wallet | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<string | null>(null);
  const [goalEditor, setGoalEditor] = useState<Goal | 'new' | null>(null);
  const [goalContribution, setGoalContribution] = useState<Goal | null>(null);
  const [debtEditor, setDebtEditor] = useState<Debt | 'new' | null>(null);
  const [debtPayment, setDebtPayment] = useState<Debt | null>(null);

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

      <div className="flex-row" style={{ alignItems: 'stretch' }}>
        <GlassCard title="Nợ / Cho vay" action={
          <button className="btn-small" disabled={!data.currentWorkspace} onClick={() => setDebtEditor('new')}>
            + Thêm khoản nợ
          </button>
        }>
          {debts.length === 0 ? <p className="muted">Không có khoản nợ nào.</p> : (
            <div className="row-list">
              {debts.map((d) => (
                <div key={d.id} className="row-item">
                  <div style={{ flex: 1 }}>
                    <b>{d.name}</b>
                    <div className="sub">{d.kind === 'borrow' ? 'Mình đi vay · Đã trả' : 'Mình cho vay / khách nợ · Đã thu'}
                      {d.due_date ? ` · Hạn ${fmtDate(d.due_date)}` : ''}
                    </div>
                    <div>{fmtVND(d.paid)} / {fmtVND(d.amount)} <span className="sub">· Còn {fmtVND(Math.max(0, d.amount - d.paid))}</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {d.paid < d.amount ? (
                      <button className="btn-small" onClick={() => setDebtPayment(d)}>
                        {d.kind === 'borrow' ? 'Ghi trả nợ' : 'Ghi thu nợ'}
                      </button>
                    ) : null}
                    <button className="btn-ghost btn-small" onClick={() => setDebtEditor(d)}>Sửa</button>
                    <button className="btn-ghost btn-small" onClick={() => {
                      if (confirm(`Xóa khoản "${d.name}"?`)) data.deleteDebt(d.id);
                    }}>Xóa</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="muted" style={{ fontSize: 12 }}>Theo dõi công nợ, không tự động cộng/trừ số dư ví.</p>
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
          debt={debtEditor === 'new' ? null : debtEditor}
          onClose={() => setDebtEditor(null)}
          onSaved={() => setDebtEditor(null)}
        />
      ) : null}
      {debtPayment ? (
        <AmountActionModal
          title={`${debtPayment.kind === 'borrow' ? 'Ghi trả nợ' : 'Ghi thu nợ'}: ${debtPayment.name}`}
          actionLabel={debtPayment.kind === 'borrow' ? 'Xác nhận đã trả' : 'Xác nhận đã thu'}
          maxAmount={Math.max(0, debtPayment.amount - debtPayment.paid)}
          onClose={() => setDebtPayment(null)}
          onSubmit={(amount) => data.payDebt(debtPayment.id, amount)}
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

function DebtFormModal({ debt, onClose, onSaved }: {
  debt: Debt | null; onClose: () => void; onSaved: () => void;
}) {
  const data = useAppData();
  const [name, setName] = useState(debt?.name ?? '');
  const [kind, setKind] = useState<Debt['kind']>(debt?.kind ?? 'borrow');
  const [amount, setAmount] = useState(debt ? String(debt.amount) : '');
  const [paid, setPaid] = useState(debt ? String(debt.paid) : '0');
  const [dueDate, setDueDate] = useState(debt?.due_date ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const amountValue = Number(amount);
    const paidValue = Number(paid);
    if (!name.trim()) { setError('Vui lòng nhập tên khoản nợ hoặc đối tác.'); return; }
    if (!Number.isFinite(amountValue) || amountValue <= 0) { setError('Tổng số tiền phải lớn hơn 0.'); return; }
    if (!Number.isFinite(paidValue) || paidValue < 0 || paidValue > amountValue) {
      setError('Số đã trả/thu phải từ 0 đến tổng số tiền.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await data.saveDebt({
        id: debt?.id, name: name.trim(), kind,
        amount: amountValue, paid: paidValue, due_date: dueDate || null,
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
        <Field label="Đã trả / đã thu (đ)">
          <input type="number" min={0} value={paid} onChange={(event) => setPaid(event.target.value)} required />
        </Field>
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

function AmountActionModal({ title, actionLabel, maxAmount, onClose, onSubmit }: {
  title: string;
  actionLabel: string;
  maxAmount?: number;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<string | null>;
}) {
  const [amount, setAmount] = useState('');
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
      const result = await onSubmit(value);
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
        {error ? <p className="error">{error}</p> : null}
        <div className="flex-row">
          <button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : actionLabel}</button>
          <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        </div>
      </form>
    </Modal>
  );
}
