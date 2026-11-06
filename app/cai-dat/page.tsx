'use client';
import { useState } from 'react';
import AppShell from '@/components/AppShell';
import GlassCard, { Field, Modal } from '@/components/GlassCard';
import { useAppData } from '@/lib/data';
import { getSessionUser, localChangePassword, localDeleteAccount, localRename, setSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { fmtVND, monthISO } from '@/lib/utils';
import { TAX_CIRCULAR_LABELS, WORKSPACE_MODE_LABELS } from '@/lib/types';
import type { TaxCircular, WorkspaceMode } from '@/lib/types';

export default function CaiDat() {
  const data = useAppData();
  const { state, currentWorkspace } = data;
  const [wsName, setWsName] = useState('');
  const [wsMode, setWsMode] = useState<WorkspaceMode>('household');
  const [wsCircular, setWsCircular] = useState<TaxCircular>('TT88/2021');
  const [showWsForm, setShowWsForm] = useState(false);
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [catName, setCatName] = useState('');
  const [catKind, setCatKind] = useState<'income' | 'expense'>('expense');
  const [budgetCat, setBudgetCat] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [pin, setPin] = useState('');
  const [newName, setNewName] = useState(state?.user?.name ?? '');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [delPw, setDelPw] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const wsId = state?.currentWorkspaceId ?? null;
  const cats = (state?.categories ?? []).filter((c) => c.workspace_id === wsId);
  const month = monthISO();

  function openWsForm(editId?: string) {
    if (editId && currentWorkspace) {
      setEditingWsId(editId);
      setWsName(currentWorkspace.name);
      setWsMode(currentWorkspace.mode);
      setWsCircular(currentWorkspace.tax_circular);
    } else {
      setEditingWsId(null); setWsName(''); setWsMode('household'); setWsCircular('TT88/2021');
    }
    setShowWsForm(true);
  }

  function saveWs(e: React.FormEvent) {
    e.preventDefault();
    if (!wsName.trim()) { setMsg('Vui lòng nhập tên không gian.'); return; }
    data.saveWorkspace({ id: editingWsId ?? undefined, name: wsName.trim(), mode: wsMode, tax_circular: wsCircular });
    setShowWsForm(false);
    setMsg(editingWsId ? 'Đã cập nhật không gian.' : 'Đã tạo không gian mới và chuyển sang đó.');
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const user = getSessionUser();
    if (!user) return;
    const sb = createClient();
    if (sb) {
      const { error } = await sb.auth.updateUser({ password: newPw });
      setMsg(error ? `Lỗi: ${error.message}` : 'Đã đổi mật khẩu (Supabase).');
    } else {
      const err = await localChangePassword(user, oldPw, newPw);
      setMsg(err ?? 'Đã đổi mật khẩu.');
    }
    setOldPw(''); setNewPw('');
  }

  async function renameProfile(e: React.FormEvent) {
    e.preventDefault();
    const user = getSessionUser();
    if (!user || !newName.trim()) return;
    const sb = createClient();
    if (sb) {
      await sb.auth.updateUser({ data: { full_name: newName.trim() } });
      setMsg('Đã đổi tên (Supabase).');
    } else {
      localRename(user, newName.trim());
      setMsg('Đã đổi tên.');
    }
    location.reload();
  }

  async function deleteAccount() {
    const user = getSessionUser();
    if (!user) return;
    const sb = createClient();
    if (sb) {
      setMsg('Xóa tài khoản Supabase: vào Supabase Dashboard > Authentication > Users để xóa, hoặc liên hệ quản trị.');
      return;
    }
    const err = await localDeleteAccount(user, delPw);
    if (err) { setMsg(err); return; }
    if (state?.user) { localStorage.removeItem(`qltc-v2-state-${user.id}`); }
    location.href = '/auth';
  }

  async function signOut() {
    const sb = createClient();
    if (sb) await sb.auth.signOut();
    setSessionUser(null);
    location.href = '/auth';
  }

  return (
    <AppShell>
      {msg ? <p className="glass" style={{ padding: '12px 20px' }}>{msg}</p> : null}

      <GlassCard title="Không gian làm việc" action={
        <button className="btn-small" onClick={() => openWsForm()}>+ Tạo không gian mới</button>
      }>
        <div className="row-list">
          {(state?.workspaces ?? []).map((w) => (
            <div key={w.id} className="row-item">
              <div>
                <b>{w.name}</b>{w.id === wsId ? ' ★' : ''}
                <div className="sub">{WORKSPACE_MODE_LABELS[w.mode]} • {TAX_CIRCULAR_LABELS[w.tax_circular]}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {w.id !== wsId ? (
                  <button className="btn-ghost btn-small" onClick={() => data.switchWorkspace(w.id)}>Chuyển sang</button>
                ) : null}
                <button className="btn-ghost btn-small" onClick={() => openWsForm(w.id)}>Sửa</button>
                <button className="btn-ghost btn-small" onClick={() => {
                  const err = data.deleteWorkspace(w.id);
                  if (err) setMsg(err); else setMsg('Đã xóa không gian.');
                }}>Xóa</button>
              </div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Mỗi không gian có ví, giao dịch, kho hàng và thuế riêng. Xóa không gian sẽ xóa toàn bộ dữ liệu bên trong.
        </p>
      </GlassCard>

      {currentWorkspace ? (
        <GlassCard title="Cài đặt thuế cho không gian hiện tại">
          <form className="form-grid" onSubmit={(e) => {
            e.preventDefault();
            data.updateTaxSettings({ tax_circular: currentWorkspace.tax_circular });
            setMsg('Đã lưu cài đặt thuế.');
          }}>
            <Field label="Thông tư áp dụng">
              <select value={currentWorkspace.tax_circular} onChange={(e) => {
                data.updateTaxSettings({ tax_circular: e.target.value as TaxCircular });
              }}>
                {(Object.keys(TAX_CIRCULAR_LABELS) as TaxCircular[]).map((c) => (
                  <option key={c} value={c}>{TAX_CIRCULAR_LABELS[c]}</option>
                ))}
              </select>
            </Field>
            <div className="form-row">
              <Field label="Thuế suất VAT khoán">
                <input type="number" step="0.001" min={0} max={1} value={currentWorkspace.vat_rate}
                  onChange={(e) => data.updateTaxSettings({ vat_rate: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Thuế suất TNCN khoán">
                <input type="number" step="0.001" min={0} max={1} value={currentWorkspace.tncn_rate}
                  onChange={(e) => data.updateTaxSettings({ tncn_rate: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Thuế suất TNDN">
                <input type="number" step="0.01" min={0} max={1} value={currentWorkspace.tndn_rate}
                  onChange={(e) => data.updateTaxSettings({ tndn_rate: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Môn bài / năm (đ)">
                <input type="number" min={0} value={currentWorkspace.mon_bai}
                  onChange={(e) => data.updateTaxSettings({ mon_bai: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>Thay đổi ở đây áp dụng ngay cho trang Thuế và Báo cáo.</p>
          </form>
        </GlassCard>
      ) : null}

      <GlassCard title="Danh mục thu / chi">
        <form className="form-grid" onSubmit={(e) => {
          e.preventDefault();
          if (!catName.trim()) return;
          data.saveCategory({ name: catName.trim(), kind: catKind, color: '#0a84ff', icon: catKind === 'income' ? '💰' : '💸' });
          setCatName('');
        }}>
          <div className="form-row">
            <Field label="Tên danh mục mới">
              <input placeholder="VD: Tiền điện, Bán sỉ" value={catName} onChange={(e) => setCatName(e.target.value)} />
            </Field>
            <Field label="Loại">
              <select value={catKind} onChange={(e) => setCatKind(e.target.value as 'income' | 'expense')}>
                <option value="income">Thu</option><option value="expense">Chi</option>
              </select>
            </Field>
          </div>
          <button type="submit">Thêm danh mục</button>
        </form>
        <div className="row-list" style={{ marginTop: 12 }}>
          {cats.map((c) => (
            <div key={c.id} className="row-item">
              <span>{c.icon} {c.name} <span className="badge">{c.kind === 'income' ? 'Thu' : 'Chi'}</span></span>
              <button className="btn-ghost btn-small" onClick={() => data.deleteCategory(c.id)}>Xóa</button>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard title={`Ngân sách tháng ${month}`}>
        <form className="form-grid" onSubmit={(e) => {
          e.preventDefault();
          if (!budgetCat || !budgetAmount) { setMsg('Chọn danh mục và nhập số tiền ngân sách.'); return; }
          data.saveBudget(budgetCat, month, Number(budgetAmount) || 0);
          setMsg(`Đã đặt ngân sách ${fmtVND(Number(budgetAmount) || 0)} cho tháng ${month}.`);
          setBudgetAmount('');
        }}>
          <div className="form-row">
            <Field label="Danh mục chi">
              <select value={budgetCat} onChange={(e) => setBudgetCat(e.target.value)}>
                <option value="">— Chọn danh mục —</option>
                {cats.filter((c) => c.kind === 'expense').map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </Field>
            <Field label="Hạn mức (đ)">
              <input type="number" min={0} value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} />
            </Field>
          </div>
          <button type="submit">Lưu ngân sách</button>
        </form>
      </GlassCard>

      <GlassCard title="Tài khoản">
        <form className="form-grid" onSubmit={renameProfile}>
          <Field label="Họ tên hiển thị">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </Field>
          <button type="submit">Đổi tên</button>
        </form>
        <form className="form-grid" onSubmit={changePassword} style={{ marginTop: 16 }}>
          <div className="form-row">
            <Field label="Mật khẩu cũ (bản local)">
              <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
            </Field>
            <Field label="Mật khẩu mới (≥ 6 ký tự)">
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </Field>
          </div>
          <button type="submit">Đổi mật khẩu</button>
        </form>
        <form className="form-grid" onSubmit={(e) => {
          e.preventDefault();
          if (!/^\d{4,6}$/.test(pin)) { setMsg('PIN phải là 4–6 chữ số.'); return; }
          localStorage.setItem('qltc-v2-pin', pin);
          setMsg('Đã đặt mã PIN khóa màn hình. Tải lại trang để kiểm tra.');
          setPin('');
        }} style={{ marginTop: 16 }}>
          <Field label="Đặt mã PIN khóa màn hình (4–6 số, để trống phần này nếu muốn gỡ)">
            <input type="password" inputMode="numeric" placeholder="VD: 1234" value={pin} onChange={(e) => setPin(e.target.value)} />
          </Field>
          <div className="flex-row">
            <button type="submit">Đặt PIN</button>
            <button type="button" className="btn-secondary" onClick={() => { localStorage.removeItem('qltc-v2-pin'); setMsg('Đã gỡ mã PIN.'); }}>Gỡ PIN</button>
          </div>
        </form>
        <div className="flex-row" style={{ marginTop: 16 }}>
          <button className="btn-secondary" onClick={signOut}>Đăng xuất</button>
          <button className="btn-danger" onClick={() => setShowDelete(true)}>Xóa tài khoản</button>
        </div>
      </GlassCard>

      <GlassCard title="Dữ liệu mẫu">
        <p className="muted">Xóa toàn bộ dữ liệu hiện tại và bắt đầu lại (giữ nguyên tài khoản đăng nhập).</p>
        <div className="flex-row">
          <button className="btn-secondary" onClick={() => { data.resetData(true); setMsg('Đã nạp lại dữ liệu mẫu hộ kinh doanh.'); }}>
            Nạp lại dữ liệu mẫu
          </button>
          <button className="btn-danger" onClick={() => {
            if (confirm('Xóa TOÀN BỘ dữ liệu và bắt đầu với không gian trống?')) {
              data.resetData(false); setMsg('Đã xóa dữ liệu mẫu, bắt đầu dùng thật.');
            }
          }}>Xóa dữ liệu mẫu — dùng thật</button>
        </div>
      </GlassCard>

      {showWsForm ? (
        <Modal title={editingWsId ? 'Sửa không gian' : 'Tạo không gian mới'} onClose={() => setShowWsForm(false)}>
          <form onSubmit={saveWs} className="form-grid">
            <Field label="Tên không gian">
              <input placeholder="VD: Shop 2, Gia đình, Công ty" value={wsName} onChange={(e) => setWsName(e.target.value)} required />
            </Field>
            <Field label="Chế độ">
              <select value={wsMode} onChange={(e) => setWsMode(e.target.value as WorkspaceMode)}>
                {(Object.keys(WORKSPACE_MODE_LABELS) as WorkspaceMode[]).map((m) => (
                  <option key={m} value={m}>{WORKSPACE_MODE_LABELS[m]}</option>
                ))}
              </select>
            </Field>
            <Field label="Thông tư thuế mặc định">
              <select value={wsCircular} onChange={(e) => setWsCircular(e.target.value as TaxCircular)}>
                {(Object.keys(TAX_CIRCULAR_LABELS) as TaxCircular[]).map((c) => (
                  <option key={c} value={c}>{TAX_CIRCULAR_LABELS[c]}</option>
                ))}
              </select>
            </Field>
            <button type="submit">{editingWsId ? 'Lưu thay đổi' : 'Tạo không gian'}</button>
          </form>
        </Modal>
      ) : null}
      {showDelete ? (
        <Modal title="Xóa tài khoản?" onClose={() => setShowDelete(false)}>
          <p>Hành động này xóa tài khoản đăng nhập. Dữ liệu local của tài khoản cũng bị xóa.</p>
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); deleteAccount(); }}>
            <Field label="Nhập mật khẩu để xác nhận">
              <input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} required />
            </Field>
            <button type="submit" className="btn-danger">Xác nhận xóa tài khoản</button>
          </form>
        </Modal>
      ) : null}
    </AppShell>
  );
}
