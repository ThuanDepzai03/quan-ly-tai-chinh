'use client';
import { useState } from 'react';
import AppShell from '@/components/AppShell';
import GlassCard, { Field, Modal } from '@/components/GlassCard';
import { useAppData } from '@/lib/data';
import { getSessionUser, localChangePassword, localDeleteAccount, localRename, setSessionUser, setPin, removePin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { fmtVND, monthISO } from '@/lib/utils';
import { ACCOUNTING_REGIMES, BUSINESS_SECTOR_LABELS, BUSINESS_TYPE_LABELS, TAX_CALCULATION_METHOD_LABELS, TAX_CIRCULAR_LABELS, WORKSPACE_MODE_LABELS } from '@/lib/types';
import type { BusinessSector, BusinessType, MemberRole, TaxCircular, WorkspaceMode } from '@/lib/types';
import { defaultTaxMethod, inferBusinessType, taxMethodOptions, TAX_RULES_2026 } from '@/lib/tax-config';
import { usePreferences } from '@/lib/preferences';

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Chủ sở hữu', admin: 'Quản trị', member: 'Thành viên', viewer: 'Chỉ xem',
};

export default function CaiDat() {
  const data = useAppData();
  const { theme, language, error: preferencesError, setTheme, setLanguage, t } = usePreferences();
  const { state, currentWorkspace } = data;
  const [wsName, setWsName] = useState('');
  const [wsMode, setWsMode] = useState<WorkspaceMode>('household');
  const [wsBusinessType, setWsBusinessType] = useState<BusinessType>('household_business');
  const [wsBusinessSector, setWsBusinessSector] = useState<BusinessSector>('goods');
  const [wsCircular, setWsCircular] = useState<TaxCircular>('TT152/2025');
  const [wsVat, setWsVat] = useState('0.1');
  const [wsDeduction, setWsDeduction] = useState(String(TAX_RULES_2026.personalIncome.monthlyDeduction));
  const [showWsForm, setShowWsForm] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
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
  const annualRevenue = (state?.transactions ?? [])
    .filter((tx) => tx.workspace_id === wsId && tx.type === 'income' && tx.date.startsWith(String(new Date().getFullYear())))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const activeBusinessType = currentWorkspace?.business_type
    ?? (currentWorkspace ? inferBusinessType(currentWorkspace.mode) : 'household_business');
  const activeTaxMethods = taxMethodOptions(activeBusinessType, annualRevenue);
  const activeTaxMethod = currentWorkspace?.tax_method && activeTaxMethods.includes(currentWorkspace.tax_method)
    ? currentWorkspace.tax_method
    : defaultTaxMethod(activeBusinessType, annualRevenue);

  function openWsForm(editId?: string) {
    if (editId && currentWorkspace) {
      setEditingWsId(editId);
      setWsName(currentWorkspace.name);
      setWsMode(currentWorkspace.mode);
      setWsBusinessType(currentWorkspace.business_type ?? inferBusinessType(currentWorkspace.mode));
      setWsBusinessSector(currentWorkspace.business_sector ?? 'goods');
      setWsCircular(currentWorkspace.tax_circular);
      setWsVat(String(currentWorkspace.vat_rate));
      setWsDeduction(String(currentWorkspace.tncn_deduction ?? TAX_RULES_2026.personalIncome.monthlyDeduction));
    } else {
      setEditingWsId(null); setWsName(''); setWsMode('household');
      setWsBusinessType('household_business'); setWsBusinessSector('goods');
      setWsCircular('TT152/2025'); setWsVat('0.1');
      setWsDeduction(String(TAX_RULES_2026.personalIncome.monthlyDeduction));
    }
    setShowWsForm(true);
  }

  async function saveWs(e: React.FormEvent) {
    e.preventDefault();
    if (!wsName.trim()) { setMsg('Vui lòng nhập tên không gian.'); return; }
    setSavingWorkspace(true);
    try {
      const error = await data.saveWorkspace({
        id: editingWsId ?? undefined, name: wsName.trim(), mode: wsMode,
        business_type: wsBusinessType, business_sector: wsBusinessSector, tax_circular: wsCircular,
        vat_rate: Number(wsVat) || 0.1, tncn_rate: 0,
        tndn_rate: 0.2,
        tncn_deduction: Number(wsDeduction) || 0,
      });
      if (error) { setMsg(error); return; }
      setShowWsForm(false);
      setMsg(editingWsId ? 'Đã cập nhật không gian.' : 'Đã tạo và lưu không gian mới.');
    } catch (error) {
      setMsg(`Không kết nối được Supabase để lưu không gian: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSavingWorkspace(false);
    }
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
      {msg ? <p className="glass" style={{ padding: '12px 20px' }}>{t(msg)}</p> : null}

      <GlassCard title={t('Cài đặt giao diện')}>
        <p className="muted">{t('Tùy chỉnh giao diện và ngôn ngữ của ứng dụng trên thiết bị này.')}</p>
        <div className="form-row">
          <Field label={t('Giao diện')}>
            <select value={theme} onChange={(event) => setTheme(event.target.value as 'light' | 'dark')}>
              <option value="light">{t('Sáng')}</option>
              <option value="dark">{t('Tối')}</option>
            </select>
          </Field>
          <Field label={t('Ngôn ngữ')}>
            <select value={language} onChange={(event) => setLanguage(event.target.value as 'vi' | 'en')}>
              <option value="vi">{t('Tiếng Việt')}</option>
              <option value="en">{t('Tiếng Anh')}</option>
            </select>
          </Field>
        </div>
        {preferencesError ? <p className="error">{preferencesError}</p> : null}
      </GlassCard>

      <GlassCard title="Không gian làm việc" action={
        <button className="btn-small" onClick={() => openWsForm()}>{t('+ Tạo không gian mới')}</button>
      }>
        <div className="row-list">
          {(state?.workspaces ?? []).map((w) => (
            <div key={w.id} className="row-item">
              <div>
                <b>{w.name}</b>{w.id === wsId ? ' ★' : ''}
                <div className="sub">{t(WORKSPACE_MODE_LABELS[w.mode])} • {t(BUSINESS_TYPE_LABELS[w.business_type ?? inferBusinessType(w.mode)])} • {t(TAX_CIRCULAR_LABELS[w.tax_circular])}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {w.id !== wsId ? (
                  <button className="btn-ghost btn-small" onClick={() => data.switchWorkspace(w.id)}>{t('Chuyển sang')}</button>
                ) : null}
                <button className="btn-ghost btn-small" onClick={() => openWsForm(w.id)}>{t('Sửa')}</button>
                <button className="btn-ghost btn-small" onClick={() => {
                  const err = data.deleteWorkspace(w.id);
                  if (err) setMsg(err); else setMsg('Đã xóa không gian.');
                }}>{t('Xóa')}</button>
              </div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          {t('Mỗi không gian có ví, giao dịch, kho hàng và thuế riêng. Xóa không gian sẽ xóa toàn bộ dữ liệu bên trong.')}
        </p>
      </GlassCard>

      {currentWorkspace ? (
        <GlassCard title="Cài đặt thuế cho không gian hiện tại">
          <form className="form-grid" onSubmit={(e) => {
            e.preventDefault();
            data.updateTaxSettings({
              tax_circular: currentWorkspace.tax_circular,
              business_type: activeBusinessType,
              business_sector: currentWorkspace.business_sector ?? 'goods',
              tax_method: activeTaxMethod,
              vat_rate: currentWorkspace.vat_rate,
              tncn_deduction: currentWorkspace.tncn_deduction ?? TAX_RULES_2026.personalIncome.monthlyDeduction,
            });
            setMsg('Đã lưu cài đặt thuế (ghi lên Supabase).');
          }}>
            <Field label="Loại hình chủ thể tính thuế">
              <select value={activeBusinessType} onChange={(e) => {
                const businessType = e.target.value as BusinessType;
                const businessSector = businessType === 'household_business' ? 'goods' : 'other';
                data.updateTaxSettings({
                  business_type: businessType,
                  business_sector: businessSector,
                  tax_method: defaultTaxMethod(businessType, annualRevenue),
                  ...(businessType === 'enterprise' && currentWorkspace.vat_rate === 0.01 ? { vat_rate: 0.1 } : {}),
                });
              }}>
                {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((type) => (
                  <option key={type} value={type}>{t(BUSINESS_TYPE_LABELS[type])}</option>
                ))}
              </select>
            </Field>
            {activeBusinessType === 'household_business' ? (
              <Field label="Nhóm hoạt động kinh doanh">
                <select value={currentWorkspace.business_sector ?? 'goods'} onChange={(e) => {
                  data.updateTaxSettings({ business_sector: e.target.value as BusinessSector });
                }}>
                  {(Object.keys(BUSINESS_SECTOR_LABELS) as BusinessSector[]).map((sector) => (
                    <option key={sector} value={sector}>{t(BUSINESS_SECTOR_LABELS[sector])}</option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Chế độ kế toán / thông tư tham chiếu">
              <select value={currentWorkspace.tax_circular} onChange={(e) => {
                data.updateTaxSettings({ tax_circular: e.target.value as TaxCircular });
              }}>
                {ACCOUNTING_REGIMES.map((c) => (
                  <option key={c} value={c}>{t(TAX_CIRCULAR_LABELS[c])}</option>
                ))}
              </select>
            </Field>
            <Field label="Phương pháp ước tính thuế thu nhập (tự xác định theo chủ thể/ngưỡng)">
              <select value={activeTaxMethod} disabled>
                {activeTaxMethods.map((method) => (
                  <option key={method} value={method}>{t(TAX_CALCULATION_METHOD_LABELS[method])}</option>
                ))}
              </select>
            </Field>
            {activeBusinessType === 'enterprise' ? (
              <Field label="Tỷ lệ VAT đầu ra ước tính (theo nhóm hàng/dịch vụ)">
                <input type="number" step="0.01" min={0} max={1} value={currentWorkspace.vat_rate}
                  onChange={(e) => data.updateTaxSettings({ vat_rate: Number(e.target.value) || 0 })} />
              </Field>
            ) : null}
            {activeBusinessType === 'individual' ? (
              <Field label="Giảm trừ bản thân TNCN (đ/tháng)">
                <input type="number" min={0} value={currentWorkspace.tncn_deduction ?? TAX_RULES_2026.personalIncome.monthlyDeduction}
                  onChange={(e) => data.updateTaxSettings({ tncn_deduction: Number(e.target.value) || 0 })} />
              </Field>
            ) : null}
            <button type="submit">{t('Lưu cài đặt thuế')}</button>
            <p className="muted" style={{ fontSize: 13 }}>
              {t('Loại hình chủ thể độc lập với chế độ kế toán. Thuế hộ kinh doanh áp dụng tỷ lệ theo nhóm ngành và ngưỡng doanh thu; doanh nghiệp áp dụng TNDN theo lợi nhuận tính thuế, không lấy doanh thu thay lợi nhuận. Quy tắc tham chiếu được tách tại cấu hình thuế 2026.')}
            </p>
          </form>
        </GlassCard>
      ) : null}

      <GlassCard title="Thành viên & phân quyền">
        <form className="form-grid" onSubmit={async (e) => {
          e.preventDefault();
          if (!memberEmail.trim()) { setMsg('Nhập email thành viên.'); return; }
          const error = await data.saveMember({ email: memberEmail.trim(), name: memberName.trim(), role: memberRole });
          if (error) { setMsg(error); return; }
          setMsg('Đã thêm thành viên. Thành viên chỉ xem được dữ liệu sau khi người đó đăng ký tài khoản Supabase và được gán quyền — email ở đây dùng để nhận diện trong danh sách.');
          setMemberEmail(''); setMemberName('');
        }}>
          <div className="form-row">
            <Field label="Email thành viên">
              <input placeholder="email@vidu.vn" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
            </Field>
            <Field label="Tên hiển thị">
              <input placeholder={t('VD: Nguyễn Văn A')} value={memberName} onChange={(e) => setMemberName(e.target.value)} />
            </Field>
            <Field label="Vai trò">
              <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as MemberRole)}>
                {(Object.keys(ROLE_LABELS) as MemberRole[]).map((r) => (
                  <option key={r} value={r}>{t(ROLE_LABELS[r])}</option>
                ))}
              </select>
            </Field>
          </div>
          <button type="submit">{t('Thêm thành viên')}</button>
        </form>
        <div className="row-list" style={{ marginTop: 12 }}>
          {members.map((m) => (
            <div key={m.id} className="row-item">
              <span>{m.name ?? m.email ?? m.user_id} <span className="badge">{t(ROLE_LABELS[m.role])}</span></span>
              {m.role !== 'owner' ? (
                <button className="btn-ghost btn-small" onClick={() => {
                  const err = data.deleteMember(m.id);
                  if (err) setMsg(err); else setMsg('Đã xóa thành viên.');
                }}>{t('Xóa')}</button>
              ) : null}
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard title="Danh mục thu / chi">
        <form className="form-grid" onSubmit={async (e) => {
          e.preventDefault();
          if (!catName.trim()) return;
          const error = await data.saveCategory({ name: catName.trim(), kind: catKind, color: '#0a84ff', icon: catKind === 'income' ? '💰' : '💸' });
          if (error) { setMsg(error); return; }
          setMsg('Đã thêm danh mục.');
          setCatName('');
        }}>
          <div className="form-row">
            <Field label="Tên danh mục mới">
              <input placeholder={t('VD: Tiền điện, Bán sỉ')} value={catName} onChange={(e) => setCatName(e.target.value)} />
            </Field>
            <Field label="Loại">
              <select value={catKind} onChange={(e) => setCatKind(e.target.value as 'income' | 'expense')}>
                <option value="income">{t('Thu')}</option><option value="expense">{t('Chi')}</option>
              </select>
            </Field>
          </div>
          <button type="submit">{t('Thêm danh mục')}</button>
        </form>
        <div className="row-list" style={{ marginTop: 12 }}>
          {cats.map((c) => (
            <div key={c.id} className="row-item">
              <span>{c.icon} {c.name} <span className="badge">{t(c.kind === 'income' ? 'Thu' : 'Chi')}</span></span>
              <button className="btn-ghost btn-small" onClick={() => data.deleteCategory(c.id)}>{t('Xóa')}</button>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13 }}>{t('Xóa danh mục thì giao dịch cũ vẫn giữ nguyên, chỉ gỡ liên kết danh mục; ngân sách của danh mục đó cũng bị xóa.')}</p>
      </GlassCard>

      <GlassCard title={`${t('Ngân sách tháng')} ${month}`}>
        <form className="form-grid" onSubmit={async (e) => {
          e.preventDefault();
          if (!budgetCat || !budgetAmount) { setMsg('Chọn danh mục và nhập số tiền ngân sách.'); return; }
          const error = await data.saveBudget(budgetCat, month, Number(budgetAmount) || 0);
          if (error) { setMsg(error); return; }
          setMsg(`Đã đặt ngân sách ${fmtVND(Number(budgetAmount) || 0)} cho tháng ${month}.`);
          setBudgetAmount('');
        }}>
          <div className="form-row">
            <Field label="Danh mục chi">
              <select value={budgetCat} onChange={(e) => setBudgetCat(e.target.value)}>
                <option value="">— {t('Chọn danh mục')} —</option>
                {cats.filter((c) => c.kind === 'expense').map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </Field>
            <Field label="Hạn mức (đ)">
              <input type="number" min={0} value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} />
            </Field>
          </div>
          <button type="submit">{t('Lưu ngân sách')}</button>
        </form>
        <div className="row-list" style={{ marginTop: 12 }}>
          {monthBudgets.map((b) => (
            <div key={b.id} className="row-item">
              <span>{cats.find((c) => c.id === b.category_id)?.name ?? '—'} — {fmtVND(b.amount)}</span>
              <button className="btn-ghost btn-small" onClick={() => { data.deleteBudget(b.id); setMsg('Đã xóa ngân sách.'); }}>{t('Xóa')}</button>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard title="Tài khoản">
        <form className="form-grid" onSubmit={renameProfile}>
          <Field label="Họ tên hiển thị">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </Field>
          <button type="submit">{t('Đổi tên')}</button>
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
          <button type="submit">{t('Đổi mật khẩu')}</button>
          <p className="muted" style={{ fontSize: 13 }}>{t('Đổi mật khẩu sẽ đăng xuất mọi thiết bị đang đăng nhập.')}</p>
        </form>
        <form className="form-grid" onSubmit={savePin} style={{ marginTop: 16 }}>
          <div className="form-row">
            <Field label="PIN cũ (để trống nếu chưa đặt PIN)">
              <input type="password" inputMode="numeric" placeholder={t('VD: 1234')} value={oldPin} onChange={(e) => setOldPin(e.target.value)} />
            </Field>
            <Field label="PIN mới (4–6 số)">
              <input type="password" inputMode="numeric" placeholder={t('VD: 5678')} value={pin} onChange={(e) => setPin(e.target.value)} required />
            </Field>
          </div>
          <div className="flex-row">
            <button type="submit">{t('Đặt / Đổi PIN')}</button>
            <button type="button" className="btn-secondary" onClick={() => { removePin(); setMsg('Đã gỡ mã PIN.'); }}>{t('Gỡ PIN')}</button>
          </div>
        </form>
        <div className="flex-row" style={{ marginTop: 16 }}>
          <button className="btn-secondary" onClick={signOut}>{t('Đăng xuất')}</button>
          <button className="btn-danger" onClick={() => setShowDelete(true)}>{t('Xóa tài khoản')}</button>
        </div>
      </GlassCard>

      {showWsForm ? (
        <Modal title={t(editingWsId ? 'Sửa không gian' : 'Tạo không gian mới')} onClose={() => setShowWsForm(false)}>
          <form onSubmit={saveWs} className="form-grid">
            <Field label="Tên không gian">
              <input placeholder={t('VD: Shop 2, Gia đình, Công ty')} value={wsName} onChange={(e) => setWsName(e.target.value)} required />
            </Field>
            <Field label="Chế độ">
              <select value={wsMode} onChange={(e) => setWsMode(e.target.value as WorkspaceMode)}>
                {(Object.keys(WORKSPACE_MODE_LABELS) as WorkspaceMode[]).map((m) => (
                  <option key={m} value={m}>{t(WORKSPACE_MODE_LABELS[m])}</option>
                ))}
              </select>
            </Field>
            <Field label="Loại hình chủ thể tính thuế">
              <select value={wsBusinessType} onChange={(e) => {
                const businessType = e.target.value as BusinessType;
                setWsBusinessType(businessType);
                setWsBusinessSector(businessType === 'household_business' ? 'goods' : 'other');
                if (businessType === 'enterprise') setWsVat('0.1');
              }}>
                {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((type) => (
                  <option key={type} value={type}>{t(BUSINESS_TYPE_LABELS[type])}</option>
                ))}
              </select>
            </Field>
            {wsBusinessType === 'household_business' ? (
              <Field label="Nhóm hoạt động kinh doanh">
                <select value={wsBusinessSector} onChange={(e) => setWsBusinessSector(e.target.value as BusinessSector)}>
                  {(Object.keys(BUSINESS_SECTOR_LABELS) as BusinessSector[]).map((sector) => (
                    <option key={sector} value={sector}>{t(BUSINESS_SECTOR_LABELS[sector])}</option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Chế độ kế toán / thông tư tham chiếu">
              <select value={wsCircular} onChange={(e) => setWsCircular(e.target.value as TaxCircular)}>
                {ACCOUNTING_REGIMES.map((c) => (
                  <option key={c} value={c}>{t(TAX_CIRCULAR_LABELS[c])}</option>
                ))}
              </select>
            </Field>
            {wsBusinessType === 'enterprise' ? (
              <Field label="Tỷ lệ VAT đầu ra ước tính (theo nhóm hàng/dịch vụ)">
                <input type="number" step="0.01" min={0} max={1} value={wsVat} onChange={(e) => setWsVat(e.target.value)} />
              </Field>
            ) : null}
            {wsBusinessType === 'individual' ? (
              <Field label="Giảm trừ bản thân TNCN (đ/tháng)">
                <input type="number" min={0} value={wsDeduction} onChange={(e) => setWsDeduction(e.target.value)} />
              </Field>
            ) : null}
            <button type="submit" disabled={savingWorkspace}>
              {savingWorkspace ? t('Đang lưu…') : editingWsId ? t('Lưu thay đổi') : t('Tạo không gian')}
            </button>
          </form>
        </Modal>
      ) : null}
      {showDelete ? (
        <Modal title="Xóa tài khoản?" onClose={() => setShowDelete(false)}>
          <p>{t('Hành động này xóa toàn bộ dữ liệu của tài khoản trên Supabase và đăng xuất. Nhập mật khẩu để xác nhận (bản local).')}</p>
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); deleteAccount(); }}>
            <Field label="Nhập mật khẩu để xác nhận">
              <input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} required />
            </Field>
            <button type="submit" className="btn-danger">{t('Xác nhận xóa tài khoản')}</button>
          </form>
        </Modal>
      ) : null}
    </AppShell>
  );
}
