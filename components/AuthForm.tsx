'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import {
  createClient,
  isSupabaseConfigured,
  translateAuthError,
  resendConfirmationEmail,
  sendPasswordResetEmail,
} from '@/lib/supabase/client';
import { localResetPassword, localSignIn, localSignUp, getSessionUser, setSessionUser, syncSessionUserFromSupabase } from '@/lib/auth';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo';
import { ensureLocalState, seedCloudDemoData } from '@/lib/data';
import { Field } from '@/components/GlassCard';

type Mode = 'login' | 'register' | 'forgot';

/** Form Đăng nhập / Đăng ký / Quên mật khẩu dùng chung cho trang chủ (/) và trang /auth. */
export default function AuthForm({ showHomeLink = false }: { showHomeLink?: boolean }) {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [withDemo, setWithDemo] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgKind, setMsgKind] = useState<'error' | 'info' | ''>('');
  const [busy, setBusy] = useState(false);
  // Hiện nút "Gửi lại mail xác thực" khi tài khoản đã đăng ký / chưa confirm.
  const [showResend, setShowResend] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const cloud = isSupabaseConfigured();

  // Chuyển sang Dashboard. localStorage.setItem là đồng bộ nên key session
  // đã được ghi xong trước khi trình duyệt tải lại trang /dashboard.
  function goDashboard() { location.href = '/dashboard'; }

  /**
   * Lưu phiên Supabase vào key session DUY NHẤT của app (qltc-v2-session).
   * BẮT BUỘC gọi sau mọi lần signIn / signUp / demo login thành công,
   * TRƯỚC khi chuyển sang /dashboard.
   * Lỗi 06/11/2026: trước đây code chỉ gọi goDashboard() ngay sau khi
   * Supabase trả về thành công (log "Login request completed" 200) mà
   * không ghi key này, nên dashboard đọc localStorage không thấy user và
   * luôn hiện "Bạn chưa đăng nhập".
   * Lấy lại session bằng getSession() để chắc chắn có session thật (không
   * tin hoàn toàn vào data trả về của signIn/signUp), fallback sang user
   * vừa trả về nếu getSession() chưa kịp có. Trả về false khi không lấy
   * được session/user nào — khi đó KHÔNG chuyển trang, báo lỗi rõ ràng.
   */
  async function persistCloudSession(sb: SupabaseClient, fallbackUser: SupabaseUser | null = null): Promise<boolean> {
    const { data: { session } } = await sb.auth.getSession();
    const sbUser = session?.user ?? fallbackUser;
    if (!sbUser) return false;
    const user = syncSessionUserFromSupabase(sbUser);
    if (!user) return false;
    ensureLocalState(user, user.email === DEMO_EMAIL ? true : withDemo);
    return true;
  }

  function setError(text: string) { setMsg(text); setMsgKind('error'); }
  function setInfo(text: string) { setMsg(text); setMsgKind('info'); }

  /** Gửi lại mail xác thực — dùng chung cho form đăng ký và đăng nhập. */
  async function handleResend() {
    setResendMsg('');
    if (!cloud) { setResendMsg('Bản local không dùng mail xác thực.'); return; }
    const sb = createClient();
    if (!sb) { setResendMsg('Chưa cấu hình Supabase.'); return; }
    setBusy(true);
    try {
      const r = await resendConfirmationEmail(sb, email);
      setResendMsg(r.message);
    } finally { setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(''); setMsgKind(''); setResendMsg(''); setShowResend(false);
    if (mode === 'register' && password !== confirm) { setError('Mật khẩu nhập lại không khớp.'); return; }
    if (password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự.'); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        if (cloud) {
          const sb = createClient();
          if (!sb) throw new Error('Chưa cấu hình Supabase.');
          // redirectTo = domain hiện tại (window.location.origin + '/auth'),
          // không hard-code domain cũ — tránh lệch Site URL / Redirect URL.
          const r = await sendPasswordResetEmail(sb, email);
          if (r.ok) { setInfo(r.message); setMode('login'); }
          else setError(r.message);
        } else {
          const err = await localResetPassword(email, password);
          if (err) setError(err);
          else { setInfo('Đã đặt lại mật khẩu mới. Hãy đăng nhập lại bằng mật khẩu mới.'); setMode('login'); }
        }
        return;
      }
      if (cloud) {
        const sb = createClient();
        if (!sb) throw new Error('Chưa cấu hình Supabase.');
        if (mode === 'register') {
          const { data, error } = await sb.auth.signUp({
            email: email.trim(), password,
            options: { data: { full_name: name.trim() } },
          });
          if (error) {
            const t = translateAuthError(error);
            setError(t.message);
            // Đã đăng ký rồi / chưa confirm đều cho gửi lại mail xác thực.
            if (t.kind === 'already-registered' || t.kind === 'not-confirmed') setShowResend(true);
            return;
          }
          // Supabase có thể trả về user nhưng chưa có session khi Confirm email BẬT.
          if (!data.session) {
            setInfo('Đăng ký thành công. Tài khoản cần xác thực email mới đăng nhập được — kiểm tra hộp thư (cả Spam / Promotions) rồi bấm link xác thực. Lúc test, bạn có thể tắt "Confirm email" ở Supabase > Authentication > Providers > Email để đăng nhập ngay.');
            setShowResend(true);
            return;
          }
          // Có session rồi: PHẢI lưu vào key qltc-v2-session trước khi chuyển trang.
          if (!(await persistCloudSession(sb, data.session.user))) {
            setError('Đăng ký thành công nhưng chưa lấy được phiên đăng nhập. Hãy đăng nhập lại bằng email và mật khẩu vừa đăng ký.');
            setMode('login');
            return;
          }
          // Đăng ký cloud + chọn nạp dữ liệu mẫu: ghi mẫu thật lên Supabase
          // ngay (trước v5, ô chọn mẫu chỉ hiện ở bản local nên đăng ký cloud
          // luôn ra workspace trống dù đã tick).
          if (withDemo) {
            const appUser = getSessionUser();
            if (appUser) {
              const seedErr = await seedCloudDemoData(sb, appUser);
              if (seedErr) setInfo(`Đăng ký thành công nhưng ${seedErr} Bạn vẫn có thể bấm "Tải dữ liệu mẫu" trong Dashboard.`);
            }
          }
          setInfo('Đăng ký thành công. Đang chuyển tới Dashboard…');
          goDashboard();
        } else {
          const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
          if (error) {
            const t = translateAuthError(error);
            setError(t.message);
            // Chưa confirm thì hiện nút gửi lại mail, KHÔNG báo chung là sai mật khẩu.
            if (t.kind === 'not-confirmed' || t.kind === 'invalid-login') setShowResend(true);
            return;
          }
          // Đăng nhập Supabase thành công: PHẢI lưu vào key qltc-v2-session
          // trước khi chuyển trang (xem persistCloudSession).
          if (!(await persistCloudSession(sb, data.user))) {
            setError('Đăng nhập thành công nhưng chưa lấy được phiên đăng nhập. Hãy thử đăng nhập lại.');
            return;
          }
          goDashboard();
        }
        return;
      }
      // Bản local (chưa có Supabase).
      if (mode === 'register') {
        const err = await localSignUp(name, email, password);
        if (err) { setError(err); return; }
        const user = getSessionUser();
        if (user) ensureLocalState(user, withDemo);
        setInfo('Đăng ký thành công. Đang chuyển tới Dashboard…');
        goDashboard();
      } else {
        const { user, error } = await localSignIn(email, password);
        if (error || !user) { setError(error ?? 'Đăng nhập thất bại.'); return; }
        ensureLocalState(user, user.email === DEMO_EMAIL ? true : withDemo);
        goDashboard();
      }
    } finally { setBusy(false); }
  }

  const titles: Record<Mode, string> = {
    login: 'Đăng nhập', register: 'Đăng ký tài khoản', forgot: 'Quên mật khẩu',
  };

  return (
    <div>
      <h1>{titles[mode]}</h1>
      {/* <p className="muted">
        {cloud
          ? 'Đang dùng Supabase Auth thật (Email).'
          : 'Chưa cấu hình Supabase — đang dùng đăng nhập local (demo). Điền .env.local để dùng Supabase Auth thật.'}
      </p> */}

      {/* {cloud ? (
        <div
          style={{
            background: 'rgba(255, 193, 7, 0.12)', border: '1px solid rgba(255, 193, 7, 0.4)',
            borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.6, marginBottom: 12,
          }}
        >
          <strong>Lưu ý về xác thực email (Supabase):</strong> nếu bạn đang bật{' '}
          <strong>Confirm email</strong> ở Supabase thì đăng ký xong <strong>phải bấm link trong mail mới đăng nhập được</strong>.
          Mail của Supabase Free hay vào <strong>Spam / Thư rác / Promotions</strong> và có thể tới chậm vài phút.
          Lúc test, nên <strong>tắt Confirm email</strong> (Authentication &gt; Providers &gt; Email) để đăng ký xong đăng nhập ngay.
          Nếu đăng nhập báo sai mật khẩu dù bạn gõ đúng, rất có thể tài khoản <strong>chưa xác thực email</strong> — bấm nút “Gửi lại mail xác thực” bên dưới, hoặc vào Supabase &gt; Authentication &gt; Users &gt; chọn user &gt; Confirm user thủ công.
        </div>
      ) : null} */}

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
        {mode === 'register' ? (
          <label className="check-row">
            <input type="checkbox" checked={withDemo} onChange={(e) => setWithDemo(e.target.checked)} />
            Nạp sẵn dữ liệu mẫu hộ kinh doanh để trải nghiệm (không tick = workspace trống)
          </label>
        ) : null}
        {msg ? <p className={msgKind === 'error' ? 'error' : ''}>{msg}</p> : null}
        {showResend && cloud ? (
          <div>
            <button type="button" className="btn-secondary" onClick={handleResend} disabled={busy}>
              {busy ? 'Đang gửi…' : 'Gửi lại mail xác thực'}
            </button>
            {resendMsg ? <p style={{ fontSize: 13, marginTop: 8 }}>{resendMsg}</p> : null}
            <p className="muted" style={{ fontSize: 13 }}>
              Không thấy mail? Kiểm tra Spam / Promotions, hoặc nhờ admin vào Supabase &gt; Authentication &gt; Users &gt; Confirm user thủ công.
            </p>
          </div>
        ) : null}
        <button type="submit" disabled={busy}>
          {busy ? 'Đang xử lý…' : titles[mode]}
        </button>
      </form>
      {mode === 'login' ? (
        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%', marginTop: 12 }}
          onClick={() => { setMode('register'); setMsg(''); setShowResend(false); setResendMsg(''); }}
          disabled={busy}
        >
          Chưa có tài khoản? Đăng ký ngay
        </button>
      ) : null}
      <p style={{ marginTop: 16, lineHeight: 1.9 }}>
        {mode !== 'login' ? (
          <Link href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setMsg(''); setShowResend(false); }}>Đã có tài khoản? Đăng nhập</Link>
        ) : null}
        {mode !== 'forgot' ? (
          <><br /><Link href="#" onClick={(e) => { e.preventDefault(); setMode('forgot'); setMsg(''); setShowResend(false); }}>Quên mật khẩu?</Link></>
        ) : null}
        {showHomeLink ? (<><br /><Link href="/">← Về trang chủ</Link></>) : null}
      </p>
      <p className="muted" style={{ fontSize: 13 }}>
        Trang web được phát triển bởi <a href="https://www.facebook.com/Theplay.Hacker.ss/" target="_blank" rel="noopener noreferrer">Thuận</a> — Tham gia nhóm phát triển đa ngành tại  <a href="https://discord.gg/GDCm4WaR9" target="_blank" rel="noopener noreferrer">Discord</a>
      </p>
    </div>
  );
}
