'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppData } from '@/lib/data';
import { setSessionUser, hasPin, verifyPin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { BUSINESS_TYPE_LABELS, WORKSPACE_MODE_LABELS } from '@/lib/types';
import { inferBusinessType } from '@/lib/tax-config';
import { usePreferences } from '@/lib/preferences';

const NAV = [
  { href: '/dashboard', label: 'Tổng quan', icon: '🏠' },
  { href: '/kho', label: 'Kho hàng', icon: '📦' },
  { href: '/thue', label: 'Thuế', icon: '🧾' },
  { href: '/bao-cao', label: 'Báo cáo', icon: '📊' },
  { href: '/cai-dat', label: 'Cài đặt', icon: '⚙️' },
];

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`page-skeleton-block ${className}`} />;
}

function SkeletonSection({ rows = 3 }: { rows?: number }) {
  return (
    <section className="glass page-skeleton-section" aria-hidden="true">
      <div className="page-skeleton-section-heading">
        <SkeletonBlock className="page-skeleton-title" />
        <SkeletonBlock className="page-skeleton-action" />
      </div>
      <div className="page-skeleton-rows">
        {Array.from({ length: rows }, (_, index) => (
          <div className="page-skeleton-row" key={index}>
            <SkeletonBlock className="page-skeleton-row-main" />
            <SkeletonBlock className="page-skeleton-row-value" />
          </div>
        ))}
      </div>
    </section>
  );
}

function PageLoadingSkeleton({ pathname }: { pathname: string }) {
  if (pathname === '/dashboard' || pathname === '/') {
    return (
      <>
        <section className="page-skeleton-balance" aria-hidden="true">
          <SkeletonBlock className="page-skeleton-balance-label" />
          <SkeletonBlock className="page-skeleton-balance-total" />
          <div className="page-skeleton-balance-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonBlock className="page-skeleton-balance-stat" key={index} />
            ))}
          </div>
        </section>
        <div className="page-skeleton-quick-actions" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock className="page-skeleton-quick-action" key={index} />
          ))}
        </div>
        <SkeletonSection rows={3} />
        <SkeletonSection rows={4} />
        <SkeletonSection rows={3} />
      </>
    );
  }

  const sectionRows: Record<string, number[]> = {
    '/kho': [4, 4],
    '/thue': [3, 4, 3],
    '/bao-cao': [2, 4, 3, 3, 4],
    '/cai-dat': [3, 3, 4, 3, 3],
  };
  return (
    <>
      <SkeletonBlock className="page-skeleton-page-title" />
      {(sectionRows[pathname] ?? [3, 4, 3]).map((rows, index) => (
        <SkeletonSection rows={rows} key={index} />
      ))}
    </>
  );
}

/** Khung chung cho các trang đã đăng nhập: header, chuyển workspace, menu. */
export default function AppShell({ children }: { children: ReactNode }) {
  const { state, loading, switchWorkspace, currentWorkspace, syncError, clearSyncError, retryLoad } = useAppData();
  const { t } = usePreferences();
  const pathname = usePathname();
  const router = useRouter();
  const [pinLocked, setPinLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const canPullRefresh = Boolean(state && !pinLocked);

  useEffect(() => {
    if (!canPullRefresh) return;
    const resetPull = () => {
      pullStartY.current = null;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (loading || event.touches.length !== 1 || window.scrollY > 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, select, textarea, button, a, [contenteditable="true"], .modal')) return;
      pullStartY.current = event.touches[0].clientY;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (pullStartY.current === null || event.touches.length !== 1 || window.scrollY > 0) return;
      const delta = event.touches[0].clientY - pullStartY.current;
      if (delta <= 0) return;
      event.preventDefault();
      const distance = Math.min(110, delta * 0.8);
      pullDistanceRef.current = distance;
      setPullDistance(distance);
    };
    const onTouchEnd = () => {
      if (pullStartY.current === null) return;
      const shouldRefresh = pullDistanceRef.current >= 72 && !loading;
      resetPull();
      if (shouldRefresh) retryLoad();
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', resetPull, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', resetPull);
    };
  }, [canPullRefresh, loading, retryLoad]);

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
    else setPinErr(t('Mã PIN không đúng.'));
  }

  if (pinLocked) {
    return (
      <main className="glass" style={{ maxWidth: 420, margin: '80px auto' }}>
        <h1>🔒 {t('App đã khóa')}</h1>
        <p className="muted">{t('Nhập mã PIN để mở khóa.')}</p>
        <form onSubmit={unlock} className="form-grid">
          <input type="password" inputMode="numeric" placeholder={t('Mã PIN')} value={pinInput}
            onChange={(e) => setPinInput(e.target.value)} autoFocus />
          {pinErr ? <p className="error">{pinErr}</p> : null}
          <button type="submit">{t('Mở khóa')}</button>
        </form>
      </main>
    );
  }

  if (loading) {
    return (
      <div className="app-shell page-skeleton" role="status" aria-label={t('Đang tải dữ liệu')} aria-busy="true">
        <header className="app-header page-skeleton-header" aria-hidden="true">
          <div className="page-skeleton-brand">
            <SkeletonBlock className="page-skeleton-brand-name" />
            <SkeletonBlock className="page-skeleton-user" />
          </div>
          <div className="page-skeleton-header-actions">
            <SkeletonBlock className="page-skeleton-workspace" />
            <SkeletonBlock className="page-skeleton-signout" />
          </div>
        </header>
        <PageLoadingSkeleton pathname={pathname} />
        <nav className="tabbar page-skeleton-tabbar" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonBlock className="page-skeleton-tab" key={index} />
          ))}
        </nav>
        <div className="tabbar-spacer" aria-hidden="true" />
      </div>
    );
  }
  if (!state && syncError) {
    return (
      <main className="glass" role="alert">
        <h1>{t('Không tải được dữ liệu')}</h1>
        <p className="error">{t(syncError)}</p>
        <div className="flex-row">
          <button type="button" onClick={retryLoad}>{t('Thử tải lại')}</button>
          <Link href="/auth"><button type="button" className="btn-secondary">{t('Đăng nhập lại')}</button></Link>
        </div>
      </main>
    );
  }
  if (!state || !state.user) {
    return (
      <main className="glass">
        <h1>{t('Bạn chưa đăng nhập')}</h1>
        <p className="muted">{t('Vui lòng đăng nhập để xem dữ liệu của bạn.')}</p>
        <p><Link href="/auth"><button>{t('Đăng nhập / Đăng ký')}</button></Link></p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      {pullDistance > 0 ? (
        <div className="pull-refresh-indicator" role="status" aria-live="polite">
          <span className={pullDistance >= 72 ? 'pull-refresh-icon pull-refresh-ready' : 'pull-refresh-icon'}
            style={{ transform: `rotate(${Math.min(180, pullDistance * 2)}deg)` }} aria-hidden="true">↓</span>
          <span>{pullDistance >= 72 ? t('Thả để làm mới') : t('Kéo xuống để làm mới')}</span>
        </div>
      ) : null}
      <header className="app-header">
        <div>
          <Link href="/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong style={{ fontSize: 20 }}>💰 {t('Quản lý tài chính')}</strong>
          </Link>
          <div className="muted" style={{ fontSize: 13 }}>
            {state.user.name} • {state.user.email}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            aria-label={t('Không gian làm việc')}
            value={state.currentWorkspaceId ?? ''}
            onChange={(e) => switchWorkspace(e.target.value)}
            style={{ width: 'auto', minWidth: 180 }}
          >
            {state.workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name} — {t(WORKSPACE_MODE_LABELS[w.mode])}</option>
            ))}
          </select>
          <button className="btn-ghost" onClick={signOut}>{t('Đăng xuất')}</button>
        </div>
      </header>
      {currentWorkspace ? (
        <p className="muted" style={{ margin: '4px 0 12px' }}>
          {t('Không gian')}: <b style={{ color: 'var(--text)' }}>{currentWorkspace.name}</b>
          {' '}• {t('Loại hình tính thuế')}: {t(BUSINESS_TYPE_LABELS[currentWorkspace.business_type ?? inferBusinessType(currentWorkspace.mode)])}
        </p>
      ) : null}
      {syncError ? (
        <div className="sync-error" role="alert">
          <span>{t(syncError)}</span>
          <button type="button" className="btn-secondary btn-small" onClick={retryLoad}>
            {t('Tải lại dữ liệu')}
          </button>
          <button type="button" className="btn-ghost btn-small" onClick={clearSyncError} aria-label={t('Đóng thông báo lỗi')}>
            {t('Đóng')}
          </button>
        </div>
      ) : null}
      {children}
      <nav className="tabbar" aria-label={t('Điều hướng chính')}>
        {NAV.slice(0, 2).map((n) => (
          <Link key={n.href} href={n.href} className={pathname === n.href ? 'tab-active' : ''}>
            <span className="tab-icon" aria-hidden="true">{n.icon}</span>
            <span className="tab-label">{t(n.label)}</span>
          </Link>
        ))}
        <button
          type="button"
          className="tabbar-add"
          aria-label={t('Thêm giao dịch')}
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
            <span className="tab-label">{t(n.label)}</span>
          </Link>
        ))}
      </nav>
      <div className="tabbar-spacer" aria-hidden="true" />
    </div>
  );
}
