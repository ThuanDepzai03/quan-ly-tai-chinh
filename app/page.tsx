import Link from 'next/link';
export default function Home(){
 return(<main>
  <div className="glass"><h1>Quản lý tài chính</h1><p>Cá nhân / Hộ kinh doanh – Gia đình / Team – DN nhỏ • TT88/2021 • Kho hàng tính lãi • iOS 27 Liquid Glass</p>
  <p><Link href="/auth"><button>Đăng nhập / Đăng ký</button></Link> <Link href="/dashboard"><button> Vào Dashboard demo</button></Link></p>
  <p>Tài khoản demo test local: <b>demo@quanlytaichinh.vn / 123456</b> (chỉ dùng ở bản demo, khi deploy Supabase hãy đăng ký tài khoản thật của bạn).</p></div>
  <div className="glass"><h2>Tính năng chính</h2><ul><li>Ví, Thu–Chi–Chuyển ví, Danh mục, Ngân sách, Mục tiêu, Nợ, Nhắc nhở</li><li>Kho hàng: sản phẩm, danh mục hàng, biến thể màu/size, trường tùy chỉnh Màu sắc / IMEI / Serial, giá nhập/bán, Lãi = Doanh thu − Giá vốn</li><li>Thuế TT88/2021: VAT 1% + TNCN 0,5% + môn bài, 7 sổ S1–S7-HKD, xuất Excel/CSV</li><li>3 workspace với Thêm/Sửa/Xóa, đồng bộ cloud, offline-first</li></ul></div>
 </main>);
}
