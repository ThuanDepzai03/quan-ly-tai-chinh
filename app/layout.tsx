import './globals.css';
import type { Metadata, Viewport } from 'next';
import { AppDataProvider } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Quản lý tài chính',
  description: 'Cá nhân / Hộ kinh doanh / Team – DN nhỏ • TT88/2021 • Kho hàng tính lãi • iOS 27 Liquid Glass',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AppDataProvider>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 16px 64px' }}>{children}</div>
          <footer className="site-footer">
            <a
              className="author-link"
              href="https://www.facebook.com/Theplay.Hacker.ss/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Tác giả Theplay trên Facebook"
            >
              <span>Tác giả</span>
              <strong>Theplay</strong>
              <span className="author-sparkle" aria-hidden="true">✦</span>
            </a>
          </footer>
        </AppDataProvider>
      </body>
    </html>
  );
}
