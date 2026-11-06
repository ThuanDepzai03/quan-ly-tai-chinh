import Link from 'next/link';
import GlassCard from '@/components/GlassCard';

export default function Home() {
  return (
    <main>
      <div className="glass">
        <h1>💰 Quản lý tài chính</h1>
        <p>
          Cá nhân / Hộ kinh doanh – Gia đình / Team – DN nhỏ • TT88/2021 •
          Kho hàng tính lãi • iOS 27 Liquid Glass
        </p>
        <p className="flex-row">
          <Link href="/auth"><button>Đăng nhập / Đăng ký</button></Link>
          <Link href="/dashboard"><button className="btn-secondary">Vào Dashboard</button></Link>
        </p>
        <p className="muted">
          Tài khoản demo test local: <b style={{ color: 'var(--text)' }}>demo@quanlytaichinh.vn / 123456</b>
          {' '}— chỉ dùng ở bản demo, khi deploy Supabase hãy đăng ký tài khoản thật của bạn.
        </p>
      </div>
      <GlassCard title="Tính năng chính">
        <ul style={{ lineHeight: 1.9, margin: 0 }}>
          <li>Ví, Thu–Chi–Chuyển ví, Danh mục, Ngân sách, Mục tiêu, Nợ, Nhắc nhở</li>
          <li>Kho hàng: sản phẩm, danh mục hàng, biến thể màu/size, trường tùy chỉnh Màu sắc / IMEI / Serial, giá nhập/bán, Lãi = Doanh thu − Giá vốn</li>
          <li>Thuế TT88/2021: VAT 1% + TNCN 0,5% + môn bài, 7 sổ S1–S7-HKD, xuất Excel/CSV</li>
          <li>3 workspace với Thêm/Sửa/Xóa, đồng bộ cloud Supabase, offline-first</li>
          <li>Đăng ký/Đăng nhập, quên mật khẩu, đổi mật khẩu, khóa PIN, phân quyền thành viên</li>
        </ul>
      </GlassCard>
      <GlassCard title="Bắt đầu nhanh (30 phút có cloud riêng)">
        <ol style={{ lineHeight: 1.9, margin: 0 }}>
          <li>Tạo Project Supabase (region Singapore) → bật Auth Email → dán <code>supabase/schema.sql</code> vào SQL Editor.</li>
          <li>Đẩy source code lên GitHub Private → Import trên Vercel → cài 3 biến môi trường trong <code>.env.example</code>.</li>
          <li>Deploy → mở domain Vercel → đăng ký tài khoản thật → dùng trên Web, APK, iOS.</li>
        </ol>
        <p className="muted">Chi tiết từng bước xem file README.md trong source code.</p>
      </GlassCard>
    </main>
  );
}
