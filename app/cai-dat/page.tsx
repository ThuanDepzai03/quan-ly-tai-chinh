'use client';
import { useState } from 'react';
import AppShell from '@/components/AppShell';
import GlassCard, { Field, Modal } from '@/components/GlassCard';
import { useAppData } from '@/lib/data';
import { getSessionUser, localChangePassword, localDeleteAccount, localRename, setSessionUser, setPin, removePin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { fmtVND, monthISO } from '@/lib/utils';
import { TAX_CIRCULAR_LABELS, WORKSPACE_MODE_LABELS } from '@/lib/types';
import type { MemberRole, TaxCircular, WorkspaceMode } from '@/lib/types';

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Chủ sở hữu', admin: 'Quản trị', member: 'Thành viên', viewer: 'Chỉ xem',
};

export default function CaiDat() {
  const data = useAppData();
  const { state, currentWorkspace } = data;
  const [wsName, setWsName] = useState('');
  const [wsMode, setWsMode] = useState<WorkspaceMode>('household');
  const [wsCircular, setWsCircular] = useState<TaxCircular>('TT88/2021');
  const [wsVat, setWsVat] = useState('0.01');
  const [wsTncn, setWsTncn] = useState('0.005');
  const [wsTndn, setWsTndn] = useState('0.2');
  const [wsMonBai, setWsMonBai] = useState('1000000');
  const [wsDeduction, setWsDeduction] = useState('11000000');
  const [showWsForm, setShowWsForm] = useState(false);
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [catName, setCatName] = useState('');
  const [catKind, setCatKind] = useState<'income' | 'expense'>('expense');
  const [budgetCat, setBudgetCat] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [pin, setPinInput] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [newName, setNewName] = useState(state?.user?.name ?? '');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [delPw, setDelPw] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<MemberRole>('member');

  const wsId = state?.currentWorkspaceId ?? null;
  const cats = (state?.categories ?? []).filter((c) => c.workspace_id === wsId);
  const members = (state?.members ?? []).filter((m) => m.workspace_id === wsId);
  const monthBudgets = (state?.budgets ?? []).filter((b) => b.workspace_id === wsId && b.month === monthISO());
  const month = monthISO();

  function openWsForm(editId?: string) {
    if (editId && currentWorkspace) {
      setEditingWsId(editId);
      setWsName(currentWorkspace.name);
      setWsMode(currentWorkspace.mode);
      setWsCircular(currentWorkspace.tax_circular);
      setWsVat(String(currentWorkspace.vat_rate));
      setWsTncn(String(currentWorkspace.tncn_rate));
      setWsTndn(String(currentWorkspace.tndn_rate));
      setWsMonBai(String(currentWorkspace.mon_bai));
      setWsDeduction(String(currentWorkspace.tncn_deduction ?? 11000000));
    } else {
      setEditingWsId(null); setWsName(''); setWsMode('household'); setWsCircular('TT88/2021');
      setWsVat('0.01'); setWsTncn('0.005'); setWsTndn('0.2'); setWsMonBai('1000000'); setWsDeduction('11000000');
    }
    setShowWsForm(true);
  }

  function saveWs(e: React.FormEvent) {
    e.preventDefault();
    if (!wsName.trim()) { setMsg('Vui lòng nhập tên không gian.'); return; }
    data.saveWorkspace({
      id: editingWsId ?? undefined, name: wsName.trim(), mode: wsMode, tax_circular: wsCircular,
      vat_rate: Number(wsVat) || 0, tncn_rate: Number(wsTncn) || 0,
      tndn_rate: Number(wsTndn) || 0, mon_bai: Number(wsMonBai) || 0,
      tncn_deduction: Number(wsDeduction) || 0,
    });
    setShowWsForm(false);
    setMsg(editingWsId ? 'Đã cập nhật không gian.' : 'Đã tạo không gian mới và chuyển sang đó.');
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const user = getSessionUser();
    if (!user) return;
    if (newPw.length < 6) { setMsg('Mật khẩu mới phải có ít nhất 6 ký tự.'); return; }
    const sb = createClient();
    if (sb) {
      // Supabase updateUser không kiểm tra mật khẩu cũ — phải đăng nhập lại
      // bằng mật khẩu cũ để xác thực trước, rồi mới đổi. Đổi xong đăng xuất
      // MỌI phiên (scope global) như bản demo, bắt đăng nhập lại.
      const { error: verifyErr } = await sb.auth.signInWithPassword({ email: user.email, password: oldPw });
      if (verifyErr) { setMsg('Mật khẩu cũ không đúng.'); return; }
      const { error } = await sb.auth.updateUser({ password: newPw });
      if (error) { setMsg(`Lỗi: ${error.message}`); return; }
      await sb.auth.signOut({ scope: 'global' });
      setSessionUser(null);
      setMsg('Đã đổi mật khẩu và đăng xuất mọi thiết bị. Hãy đăng nhập lại.');
      location.href = '/auth';
      return;
    }
    const err = await localChangePassword(user, oldPw, newPw);
    setMsg(err ?? 'Đã đổi mật khẩu.');
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
      // Xóa toàn bộ dữ liệu của tài khoản trên Supabase + local, đăng xuất.
      // Lưu ý: bản ghi đăng nhập trong auth.users chỉ xóa được bằng Admin API
      // (service_role) nên cần xóa thêm ở Supabase Dashboard > Authentication
      // > Users nếu muốn xóa hẳn tài khoản đăng nhập.
      const err = await data.deleteAllAccountData();
      if (err) { setMsg(err); return; }
      await sb.auth.signOut();
      setSessionUser(null);
      setMsg('Đã xóa toàn bộ dữ liệu tài khoản. Tài khoản đăng nhập (auth.users) cần xóa thêm ở Supabase Dashboard nếu muốn xóa hẳn.');
      location.href = '/auth';
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

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    const err = await setPin(pin, oldPin || undefined);
    if (err) { setMsg(err); return; }
    setMsg('Đã đặt/đổi mã PIN khóa màn hình (lưu dạng băm). Tải lại trang để kiểm tra.');
    setPinInput(''); setOldPin('');
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
            data.updateTaxSettings({
              tax_circular: currentWorkspace.tax_circular,
              vat_rate: currentWorkspace.vat_rate, tncn_rate: currentWorkspace.tncn_rate,
              tndn_rate: currentWorkspace.tndn_rate, mon_bai: currentWorkspace.mon_bai,
              tncn_deduction: currentWorkspace.tncn_deduction ?? 11000000,
            });
            setMsg('Đã lưu cài đặt thuế (ghi lên Supabase).');
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
            <Field label="Giảm trừ gia cảnh TNCN (đ/tháng)">
              <input type="number" min={0} value={currentWorkspace.tncn_deduction ?? 11000000}
                onChange={(e) => data.updateTaxSettings({ tncn_deduction: Number(e.target.value) || 0 })} />
            </Field>
            <button type="submit">Lưu cài đặt thuế</button>
            <p className="muted" style={{ fontSize: 13 }}>Thay đổi ở đây áp dụng ngay cho trang Thuế và Báo cáo.</p>
          </form>
        </GlassCard>
      ) : null}

      <GlassCard title="Thành viên & phân quyền">
        <form className="form-grid" onSubmit={(e) => {
          e.preventDefault();
          if (!memberEmail.trim()) { setMsg('Nhập email thành viên.'); return; }
          data.saveMember({ email: memberEmail.trim(), name: memberName.trim(), role: memberRole });
          setMsg('Đã thêm thành viên. Lưu ý: ở bản cloud, thành viên chỉ xem được dữ liệu sau khi người đó đăng ký tài khoản Supabase và được gán quyền — email ở đây dùng để nhận diện trong danh sách.');
          setMemberEmail(''); setMemberName('');
        }}>
          <div className="form-row">
            <Field label="Email thành viên">
              <input placeholder="email@vidu.vn" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
            </Field>
            <Field label="Tên hiển thị">
              <input placeholder="VD: Nguyễn Văn A" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
            </Field>
            <Field label="Vai trò">
              <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as MemberRole)}>
                {(Object.keys(ROLE_LABELS) as MemberRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </Field>
          </div>
          <button type="submit">Thêm thành viên</button>
        </form>
        <div className="row-list" style={{ marginTop: 12 }}>
          {members.map((m) => (
            <div key={m.id} className="row-item">
              <span>{m.name ?? m.email ?? m.user_id} <span className="badge">{ROLE_LABELS[m.role]}</span></span>
              {m.role !== 'owner' ? (
                <button className="btn-ghost btn-small" onClick={() => {
                  const err = data.deleteMember(m.id);
                  if (err) setMsg(err); else setMsg('Đã xóa thành viên.');
                }}>Xóa</button>
              ) : null}
            </div>
          ))}
        </div>
      </GlassCard>

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
        <p className="muted" style={{ fontSize: 13 }}>Xóa danh mục thì giao dịch cũ vẫn giữ nguyên, chỉ gỡ liên kết danh mục; ngân sách của danh mục đó cũng bị xóa.</p>
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
        <div className="row-list" style={{ marginTop: 12 }}>
          {monthBudgets.map((b) => (
            <div key={b.id} className="row-item">
              <span>{cats.find((c) => c.id === b.category_id)?.name ?? '—'} — {fmtVND(b.amount)}</span>
              <button className="btn-ghost btn-small" onClick={() => { data.deleteBudget(b.id); setMsg('Đã xóa ngân sách.'); }}>Xóa</button>
            </div>
          ))}
        </div>
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
            <Field label="Mật khẩu cũ">
              <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} required />
            </Field>
            <Field label="Mật khẩu mới (≥ 6 ký tự)">
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
            </Field>
          </div>
          <button type="submit">Đổi mật khẩu</button>
          <p className="muted" style={{ fontSize: 13 }}>Đổi mật khẩu sẽ đăng xuất mọi thiết bị đang đăng nhập.</p>
        </form>
        <form className="form-grid" onSubmit={savePin} style={{ marginTop: 16 }}>
          <div className="form-row">
            <Field label="PIN cũ (để trống nếu chưa đặt PIN)">
              <input type="password" inputMode="numeric" placeholder="VD: 1234" value={oldPin} onChange={(e) => setOldPin(e.target.value)} />
            </Field>
            <Field label="PIN mới (4–6 số)">
              <input type="password" inputMode="numeric" placeholder="VD: 5678" value={pin} onChange={(e) => setPin(e.target.value)} required />
            </Field>
          </div>
          <div className="flex-row">
            <button type="submit">Đặt / Đổi PIN</button>
            <button type="button" className="btn-secondary" onClick={() => { removePin(); setMsg('Đã gỡ mã PIN.'); }}>Gỡ PIN</button>
          </div>
        </form>
        <div className="flex-row" style={{ marginTop: 16 }}>
          <button className="btn-secondary" onClick={signOut}>Đăng xuất</button>
          <button className="btn-danger" onClick={() => setShowDelete(true)}>Xóa tài khoản</button>
        </div>
      </GlassCard>

      <GlassCard title="Dữ liệu mẫu">
        <p className="muted">Nạp dữ liệu mẫu giống bản demo, hoặc xóa toàn bộ dữ liệu hiện tại và bắt đầu lại (giữ nguyên tài khoản đăng nhập). Nạp/xóa ghi thật lên Supabase.</p>
        <div className="flex-row">
          <button className="btn-secondary" onClick={async () => {
            if ((state?.wallets.length ?? 0) > 0 || (state?.transactions.length ?? 0) > 0) {
              if (!confirm('Đã có dữ liệu — nạp dữ liệu mẫu sẽ THAY THẾ toàn bộ dữ liệu hiện tại. Tiếp tục?')) return;
            }
            const err = await data.loadSampleData();
            setMsg(err ?? 'Đã nạp dữ liệu mẫu giống bản demo (4 ví 176.610.000đ, 39 giao dịch, kho hàng, ngân sách, mục tiêu).');
          }}>
            📥 Tải dữ liệu mẫu giống bản demo
          </button>
          <button className="btn-danger" onClick={async () => {
            if (confirm('Xóa TOÀN BỘ dữ liệu và bắt đầu với không gian trống?')) {
              const err = await data.clearSampleData();
              setMsg(err ?? 'Đã xóa dữ liệu mẫu, bắt đầu dùng thật.');
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
            <div className="form-row">
              <Field label="VAT khoán">
                <input type="number" step="0.001" min={0} max={1} value={wsVat} onChange={(e) => setWsVat(e.target.value)} />
              </Field>
              <Field label="TNCN khoán">
                <input type="number" step="0.001" min={0} max={1} value={wsTncn} onChange={(e) => setWsTncn(e.target.value)} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="TNDN">
                <input type="number" step="0.01" min={0} max={1} value={wsTndn} onChange={(e) => setWsTndn(e.target.value)} />
              </Field>
              <Field label="Môn bài / năm (đ)">
                <input type="number" min={0} value={wsMonBai} onChange={(e) => setWsMonBai(e.target.value)} />
              </Field>
            </div>
            <Field label="Giảm trừ gia cảnh TNCN (đ/tháng)">
              <input type="number" min={0} value={wsDeduction} onChange={(e) => setWsDeduction(e.target.value)} />
            </Field>
            <button type="submit">{editingWsId ? 'Lưu thay đổi' : 'Tạo không gian'}</button>
          </form>
        </Modal>
      ) : null}
      {showDelete ? (
        <Modal title="Xóa tài khoản?" onClose={() => setShowDelete(false)}>
          <p>Hành động này xóa toàn bộ dữ liệu của tài khoản trên Supabase và đăng xuất. Nhập mật khẩu để xác nhận (bản local).</p>
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
