'use client';

import { usePreferences } from '@/lib/preferences';

export default function SiteFooter() {
  const { t } = usePreferences();
  return (
    <footer className="site-footer">
      <a
        className="author-link"
        href="https://www.facebook.com/Theplay.Hacker.ss/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t('Tác giả')} Thuận`}
      >
        <span>{t('Tác giả')}</span>
        <strong>Thuận</strong>
        <span className="author-sparkle" aria-hidden="true">✦</span>
      </a>
    </footer>
  );
}
