'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppData } from '@/lib/data';
import { setSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { WORKSPACE_MODE_LABELS } from '@/lib/types';

const NAV = [
  { href: '/dashboard', label: 'Tổng quan' },
  { href: '/kho', label: 'Kho hàng' },
  { href: '/thue', label: 'Thuế' },
  { href: '/bao-cao', label: 'Báo cáo' },
  { href: '/cai-dat', label: 'Cài đặt' },
];

/** Khung chung cho các trang đã đăng nhập: header, chuyển workspace, menu. */
export default function AppShell({ children }: { children: ReactNode }) {
  const { state, loading, switchWorkspace, currentWorkspace } = useAppData();
  const pathname = usePathname();
  const [pinLocked, setPinLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinErr, setPinErr] = useState('');

  useEffect(() => {
    const pin = localStorage.getItem('qltc-v2-pin');
    if (pin) setPinLocked(true);
  }, []);

  async function signOut() {
    const sb = createClient();
    if (sb) await sb.auth.signOut();
    setSessionUser(null);
    location.href = '/auth';
  }

  function unlock(e: React.FormEvent) {
    e.preventDefault();
    const pin = localStorage.getItem('qltc-v2-pin') ?? '';
    if (pinInput === pin) { setPinLocked(false); setPinErr(''); }
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

  if (loading) return <main className="glass"><p>Đang tải dữ liệu…</p></main>;
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
    <div>
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
          {' '}• Chế độ thuế: {currentWorkspace.tax_circular}
        </p>
      ) : null}
      <nav className="tabbar">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={pathname === n.href ? 'tab-active' : ''}>{n.label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
