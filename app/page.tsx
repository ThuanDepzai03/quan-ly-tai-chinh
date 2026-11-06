'use client';
import Link from 'next/link';
import AuthForm from '@/components/AuthForm';

const FEATURES = [
  { icon: '💰', text: 'Ví, Thu–Chi–Chuyển ví, Danh mục, Ngân sách, Mục tiêu, Nợ, Nhắc nhở' },
  { icon: '📦', text: 'Kho hàng: biến thể màu/size, Màu sắc / IMEI / Serial, giá nhập/bán — Lãi = Doanh thu − Giá vốn' },
  { icon: '🧾', text: 'Thuế TT88/2021: VAT 1% + TNCN 0,5% + môn bài, 7 sổ S1–S7-HKD, xuất Excel/CSV' },
  { icon: '👥', text: '3 workspace Cá nhân / Hộ kinh doanh / Team — Thêm/Sửa/Xóa, đồng bộ cloud, offline-first' },
  { icon: '🔐', text: 'Đăng ký/Đăng nhập, quên mật khẩu, đổi mật khẩu, khóa PIN, phân quyền thành viên' },
];

export default function Home() {
  return (
    <div className="home">
      <div className="home-blobs" aria-hidden="true">
        <span className="blob blob-1" />
        <span className="blob blob-2" />
        <span className="blob blob-3" />
        <span className="blob blob-4" />
      </div>

      <header className="home-hero">
        <div className="home-logo">💰</div>
        <h1 className="home-title">Quản lý tài chính</h1>
        <p className="home-tagline">
          Cá nhân / Hộ kinh doanh – Gia đình / Team – DN nhỏ • TT88/2021 • Kho hàng tính lãi • iOS 27 Liquid Glass
        </p>
      </header>

      <div className="home-grid">
        <div className="glass home-auth">
          <AuthForm />
          <p style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/dashboard">Vào Dashboard →</Link>
          </p>
        </div>

        <section className="glass home-features">
          <h2>Tính năng chính</h2>
          <ul className="feature-list">
            {FEATURES.map((f) => (
              <li key={f.text}>
                <span className="feature-icon">{f.icon}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
          <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
            Tài khoản demo: <b style={{ color: 'var(--text)' }}>demo@quanlytaichinh.vn / 123456</b> — chỉ dùng ở bản demo.
          </p>
        </section>
      </div>
    </div>
  );
}
