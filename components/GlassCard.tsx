import type { ReactNode } from 'react';
import { usePreferences } from '@/lib/preferences';

export default function GlassCard({ title, action, children }: {
  title: string; action?: ReactNode; children: ReactNode;
}) {
  const { t } = usePreferences();
  return (
    <section className="glass" style={{ margin: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{t(title)}</h2>
        {action}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const { t } = usePreferences();
  return (
    <div className="glass" style={{ padding: 16, flex: '1 1 160px' }}>
      <div className="muted" style={{ fontSize: 13 }}>{t(label)}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
      {sub ? <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t(sub)}</div> : null}
    </div>
  );
}

export function Modal({ title, onClose, children, className }: {
  title: string; onClose: () => void; children: ReactNode; className?: string;
}) {
  const { t } = usePreferences();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${className ?? ''}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{t(title)}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label={t('Đóng')}>✕</button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const { t } = usePreferences();
  return (
    <label className="field">
      <span className="field-label">{t(label)}</span>
      {children}
    </label>
  );
}

export function EmptyState({ text }: { text: string }) {
  const { t } = usePreferences();
  return <p className="muted" style={{ padding: '12px 0' }}>{t(text)}</p>;
}
