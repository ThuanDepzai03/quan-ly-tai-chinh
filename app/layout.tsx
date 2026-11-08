import './globals.css';
import type { Metadata, Viewport } from 'next';
import { AppDataProvider } from '@/lib/data';
import { PreferencesProvider } from '@/lib/preferences';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Quản lý tài chính',
  description: 'Cá nhân / Hộ kinh doanh / Team – DN nhỏ • TT88/2021 • Kho hàng tính lãi • iOS 27 Liquid Glass',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="light">
      <body>
        <PreferencesProvider>
          <AppDataProvider>
            <div className="page-container">{children}</div>
            <SiteFooter />
          </AppDataProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
