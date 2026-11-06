'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppData } from '@/lib/data';
import { setSessionUser, hasPin, verifyPin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { BUSINESS_TYPE_LABELS, WORKSPACE_MODE_LABELS } from '@/lib/types';
import { inferBusinessType } from '@/lib/tax-config';

const NAV = [
  { href: '/dashboard', label: 'Tổng quan', icon: '🏠' },
  { href: '/kho', label: 'Kho hàng', icon: '📦' },
  { href: '/thue', label: 'Thuế', icon: '🧾' },
  { href: '/bao-cao', label: 'Báo cáo', icon: '📊' },
  { href: '/cai-dat', label: 'Cài đặt', icon: '⚙️' },
];

/** Khung chung cho các trang đã đăng nhập: header, chuyển workspace, menu. */
export default function AppShell({ children }: { children: ReactNode }) {
  const { state, loading, switchWorkspace, currentWorkspace, syncError, clearSyncError, retryLoad } = useAppData();
  const pathname = usePathname();
  const router = useRouter();
  const [pinLocked, setPinLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinErr, setPinErr] = useState('');

  useEffect(() => {
    if (hasPin()) setPinLocked(true);
  }, []);

  async function signOut() {
    const sb = createClient();
    if (sb) await sb.auth.signOut();
    setSessionUser(null);
    location.href = '/auth';
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (await verifyPin(pinInput)) { setPinLocked(false); setPinErr(''); }
    else setPinErr('Mã PIN không đúng.');
  }

  if (pinLocked) {
    return (
      <main className="glass" style={{ maxWidth: 420, margin: '80px auto' }}>
        <h1>🔒 App đã khóa</h1>
        <p className="muted">Nhập mã PIN để mở khóa.</p>
        <form onSubmit={unlock} className="form-grid">
          <input type="password" inputMode="numeric" placeholder="Mã PIN" value={pinInput}
            onChange={(e) => setPinInput(e.target.value)} autoFocus />
          {pinErr ? <p className="error">{pinErr}</p> : null}
          <button type="submit">Mở khóa</button>
        </form>
      </main>
    );
  }

  if (loading) return <main className="glass" role="status"><p>Đang tải dữ liệu…</p></main>;
  if (!state && syncError) {
    return (
      <main className="glass" role="alert">
        <h1>Không tải được dữ liệu</h1>
        <p className="error">{syncError}</p>
        <div className="flex-row">
          <button type="button" onClick={retryLoad}>Thử tải lại</button>
          <Link href="/auth"><button type="button" className="btn-secondary">Đăng nhập lại</button></Link>
        </div>
      </main>
    );
  }
  if (!state || !state.user) {
    return (
      <main className="glass">
        <h1>Bạn chưa đăng nhập</h1>
        <p className="muted">Vui lòng đăng nhập để xem dữ liệu của bạn.</p>
        <p><Link href="/auth"><button>Đăng nhập / Đăng ký</button></Link></p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <Link href="/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong style={{ fontSize: 20 }}>💰 Quản lý tài chính</strong>
          </Link>
          <div className="muted" style={{ fontSize: 13 }}>
            {state.user.name} • {state.user.email}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            aria-label="Không gian làm việc"
            value={state.currentWorkspaceId ?? ''}
            onChange={(e) => switchWorkspace(e.target.value)}
            style={{ width: 'auto', minWidth: 180 }}
          >
            {state.workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name} — {WORKSPACE_MODE_LABELS[w.mode]}</option>
            ))}
          </select>
          <button className="btn-ghost" onClick={signOut}>Đăng xuất</button>
        </div>
      </header>
      {currentWorkspace ? (
        <p className="muted" style={{ margin: '4px 0 12px' }}>
          Không gian: <b style={{ color: 'var(--text)' }}>{currentWorkspace.name}</b>
          {' '}• Loại hình tính thuế: {BUSINESS_TYPE_LABELS[currentWorkspace.business_type ?? inferBusinessType(currentWorkspace.mode)]}
        </p>
      ) : null}
      {syncError ? (
        <div className="sync-error" role="alert">
          <span>{syncError}</span>
          <button type="button" className="btn-secondary btn-small" onClick={retryLoad}>
            Tải lại dữ liệu
          </button>
          <button type="button" className="btn-ghost btn-small" onClick={clearSyncError} aria-label="Đóng thông báo lỗi">
            Đóng
          </button>
        </div>
      ) : null}
      {children}
      {/* Tab bar nổi ở dưới kiểu iOS 27 Liquid Glass — giống bản demo trên Muse. */}
      <nav className="tabbar" aria-label="Điều hướng chính">
        {NAV.slice(0, 2).map((n) => (
          <Link key={n.href} href={n.href} className={pathname === n.href ? 'tab-active' : ''}>
            <span className="tab-icon" aria-hidden="true">{n.icon}</span>
            <span className="tab-label">{n.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className="tabbar-add"
          aria-label="Thêm giao dịch"
          onClick={() => {
            if (pathname === '/dashboard') {
              window.dispatchEvent(new Event('qltc:add-transaction'));
            } else {
              router.push('/dashboard?add=1');
            }
          }}
        >+</button>
        {NAV.slice(2).map((n) => (
          <Link key={n.href} href={n.href} className={pathname === n.href ? 'tab-active' : ''}>
            <span className="tab-icon" aria-hidden="true">{n.icon}</span>
            <span className="tab-label">{n.label}</span>
          </Link>
        ))}
      </nav>
      <div className="tabbar-spacer" aria-hidden="true" />
    </div>
  );
}
