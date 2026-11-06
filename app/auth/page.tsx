'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { localResetPassword, localSignIn, localSignUp, getSessionUser, setSessionUser } from '@/lib/auth';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo';
import { ensureLocalState } from '@/lib/data';
import { Field } from '@/components/GlassCard';

type Mode = 'login' | 'register' | 'forgot';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [withDemo, setWithDemo] = useState(true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const cloud = isSupabaseConfigured();

  function goDashboard() { location.href = '/dashboard'; }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (mode === 'register' && password !== confirm) { setMsg('Mật khẩu nhập lại không khớp.'); return; }
    if (password.length < 6) { setMsg('Mật khẩu phải có ít nhất 6 ký tự.'); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        if (cloud) {
          const sb = createClient();
          if (!sb) throw new Error('Chưa cấu hình Supabase.');
          const { error } = await sb.auth.resetPasswordForEmail(email.trim());
          setMsg(error ? `Lỗi: ${error.message}` : 'Đã gửi link đặt lại mật khẩu về email (cần cấu hình Site URL ở Supabase).');
        } else {
          const err = await localResetPassword(email, password);
          setMsg(err ?? 'Đã đặt lại mật khẩu mới. Hãy đăng nhập lại bằng mật khẩu mới.');
          if (!err) setMode('login');
        }
        return;
      }
      if (cloud) {
        const sb = createClient();
        if (!sb) throw new Error('Chưa cấu hình Supabase.');
        if (mode === 'register') {
          const { error } = await sb.auth.signUp({
            email: email.trim(), password,
            options: { data: { full_name: name.trim() } },
          });
          if (error) setMsg(`Lỗi đăng ký: ${error.message}`);
          else setMsg('Đăng ký thành công. Kiểm tra email để xác nhận (tắt Confirm email ở Supabase lúc test để đăng nhập nhanh).');
        } else {
          const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
          if (error) setMsg(`Sai email/mật khẩu: ${error.message}`);
          else goDashboard();
        }
        return;
      }
      // Bản local (chưa có Supabase).
      if (mode === 'register') {
        const err = await localSignUp(name, email, password);
        if (err) { setMsg(err); return; }
        const user = getSessionUser();
        if (user) ensureLocalState(user, withDemo);
        setMsg('Đăng ký thành công. Đang chuyển tới Dashboard…');
        goDashboard();
      } else {
        const { user, error } = await localSignIn(email, password);
        if (error || !user) { setMsg(error ?? 'Đăng nhập thất bại.'); return; }
        ensureLocalState(user, user.email === DEMO_EMAIL ? true : withDemo);
        goDashboard();
      }
    } finally { setBusy(false); }
  }

  async function demoLogin() {
    setBusy(true);
    try {
      if (cloud) {
        const sb = createClient();
        if (sb) {
          const { error } = await sb.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
          if (!error) { goDashboard(); return; }
          setMsg('Tài khoản demo chưa có trên Supabase — hãy đăng ký tài khoản thật.');
          return;
        }
      }
      const { user, error } = await localSignIn(DEMO_EMAIL, DEMO_PASSWORD);
      if (error || !user) { setMsg(error ?? 'Không vào được tài khoản demo.'); return; }
      ensureLocalState(user, true);
      goDashboard();
    } finally { setBusy(false); }
  }

  const titles: Record<Mode, string> = {
    login: 'Đăng nhập', register: 'Đăng ký tài khoản', forgot: 'Quên mật khẩu',
  };

  return (
    <main className="glass" style={{ maxWidth: 520, margin: '40px auto' }}>
      <h1>{titles[mode]}</h1>
      <p className="muted">
        {cloud
          ? 'Đang dùng Supabase Auth thật (Email).'
          : 'Chưa cấu hình Supabase — đang dùng đăng nhập local (demo). Điền .env.local để dùng Supabase Auth thật.'}
      </p>
      <form onSubmit={submit} className="form-grid">
        {mode === 'register' ? (
          <Field label="Họ tên">
            <input placeholder="VD: Nguyễn Văn A" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        ) : null}
        <Field label="Email">
          <input placeholder="email@vidu.vn" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label={mode === 'forgot' ? 'Mật khẩu mới' : 'Mật khẩu (tối thiểu 6 ký tự)'}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="••••••••" type={showPw ? 'text' : 'password'}
              value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            />
            <button type="button" className="btn-ghost" onClick={() => setShowPw((s) => !s)}>
              {showPw ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </Field>
        {mode === 'register' ? (
          <Field label="Nhập lại mật khẩu">
            <input placeholder="••••••••" type={showPw ? 'text' : 'password'} value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
          </Field>
        ) : null}
        {mode === 'register' && !cloud ? (
          <label className="check-row">
            <input type="checkbox" checked={withDemo} onChange={(e) => setWithDemo(e.target.checked)} />
            Nạp sẵn dữ liệu mẫu hộ kinh doanh để trải nghiệm
          </label>
        ) : null}
        {msg ? <p className={msg.startsWith('Lỗi') || msg.startsWith('Sai') ? 'error' : ''}>{msg}</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? 'Đang xử lý…' : titles[mode]}
        </button>
      </form>
      <div className="flex-row" style={{ marginTop: 12 }}>
        <button type="button" className="btn-secondary" onClick={demoLogin} disabled={busy}>
          Vào ngay bằng tài khoản demo
        </button>
      </div>
      <p style={{ marginTop: 16, lineHeight: 1.9 }}>
        {mode !== 'login' ? (
          <Link href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setMsg(''); }}>Đã có tài khoản? Đăng nhập</Link>
        ) : null}
        {mode !== 'register' ? (
          <><br /><Link href="#" onClick={(e) => { e.preventDefault(); setMode('register'); setMsg(''); }}>Chưa có tài khoản? Đăng ký</Link></>
        ) : null}
        {mode !== 'forgot' ? (
          <><br /><Link href="#" onClick={(e) => { e.preventDefault(); setMode('forgot'); setMsg(''); }}>Quên mật khẩu?</Link></>
        ) : null}
        <br /><Link href="/">← Về trang chủ</Link>
      </p>
      <p className="muted" style={{ fontSize: 13 }}>
        Tài khoản demo: {DEMO_EMAIL} / {DEMO_PASSWORD} — chỉ ở bản demo, không có trong Supabase.
      </p>
    </main>
  );
}
