import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Quản lý tài chính', description: 'Cá nhân / Hộ kinh doanh / Team - TT88/2021, Kho hàng, Thuế' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="vi"><body><div style={{maxWidth:1080,margin:'0 auto',padding:20}}>{children}</div></body></html>);
}
