# Quản lý tài chính — Source code đầy đủ (v2.1)

Web + APK + iOS • Cá nhân / Hộ kinh doanh–Gia đình / Team–DN nhỏ • Chế độ kế toán tách biệt phương pháp ước tính thuế • Kho hàng tính lãi • iOS 27 Liquid Glass (dark mode)

Bản v2 viết lại đầy đủ từng trang, không còn stub: Dashboard, Kho hàng, Thuế, Báo cáo (xuất CSV/Excel thật), Cài đặt, Auth. Kiểm tra bằng `npm run typecheck` (tsc --noEmit) phải ra 0 lỗi.

## 1. Chạy local (10 phút)
```bash
cp .env.example .env.local
# Điền NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY từ Supabase > Project Settings > API
# SUPABASE_SERVICE_ROLE_KEY chỉ dùng ở server, KHÔNG commit lên GitHub public
npm install
npm run dev
# Mở http://localhost:3000
```
Chưa có Supabase vẫn chạy được bản local: đăng nhập demo `demo@quanlytaichinh.vn / 123456`
(dữ liệu mẫu hộ kinh doanh: 4 ví tổng 176.610.000đ, 12 giao dịch, 7 sản phẩm kho).
Khi deploy hãy đăng ký tài khoản thật qua Supabase Auth (Email/Google).

## 2. Tạo Supabase (theo file PDF hướng dẫn 16 trang)
1. Tạo Project, Region **Singapore**, lưu Project URL + anon key + service_role key.
2. Authentication > Providers > Email: bật **Enable email provider**. Lúc test tắt **Confirm email** để đăng nhập nhanh, dùng thật bật lại.
3. Authentication > URL Configuration: Site URL = domain Vercel sau Bước 3 (VD: `https://quan-ly-tai-chinh-sage.vercel.app/`). **Redirect URLs phải chứa đúng domain đang chạy** — thêm `https://quan-ly-tai-chinh-sage.vercel.app/**` và `https://quan-ly-tai-chinh-sage.vercel.app/auth`. Nếu Site URL và Redirect URL lệch nhau (VD: Site là `...-sage.vercel.app` mà Redirect chỉ có `quanlytaichinh.vercel.app`) thì link xác thực / đổi mật khẩu sẽ không quay về đúng app.
4. SQL Editor: dán toàn bộ `supabase/schema.sql` → Run. Đủ 16 bảng + RLS cho cả 16 bảng + trigger trừ/cộng tồn kho (chặn âm kho) + hàm `tax88()`.

### 2.1. Khắc phục lỗi Confirm email / đăng nhập (v2.1)
**Triệu chứng user gặp:** bật Confirm email thì không nhận được mail xác thực, đăng ký lại báo `User already registered`, đăng nhập báo `Invalid login credentials` dù mật khẩu đúng, đổi mật khẩu xong vẫn không vào được.

**Nguyên nhân:** tài khoản đã tạo thành công nhưng **chưa bấm link xác thực** nên Supabase chặn đăng nhập — không phải sai mật khẩu. Mail của Supabase Free (SMTP mặc định) gửi chậm, hay vào **Spam / Thư rác / Promotions**, có khi không tới. Đổi mật khẩu cũng không mở được tài khoản chưa confirm.

**Cách sửa (theo thứ tự):**
1. **Tắt Confirm email lúc test:** Supabase > Authentication > Providers > Email > tắt **Confirm email** > Save. Dùng thật thì bật lại sau.
2. **Xác nhận tài khoản đã có sẵn:** Supabase > Authentication > Users > tìm email > `...` > **Confirm user** (hoặc Delete user đó rồi đăng ký lại).
3. **Sửa Redirect URLs** cho khớp domain thật như mục 2.3 ở trên, rồi Save changes.
4. **Trong app (v2.1 đã sửa):** đăng ký trùng email sẽ hiện “Email này đã đăng ký rồi…” kèm nút **Gửi lại mail xác thực**; đăng nhập tài khoản chưa confirm sẽ hiện “Tài khoản chưa xác thực email…” kèm nút gửi lại mail, thay vì báo chung là sai mật khẩu. Nút này gọi `supabase.auth.resend({ type: 'signup', email })`.
5. **Quên mật khẩu:** app dùng `resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth' })` nên link luôn quay về đúng domain đang chạy. Kiểm tra cả Spam, bấm link trong vòng 1 giờ, đặt mật khẩu mới rồi đăng nhập lại bằng mật khẩu mới.
6. **Lâu dài:** nếu cần mail xác thực tin cậy hơn, cấu hình SMTP riêng ở Authentication > Emails > SMTP Settings (VD: Gmail App Password) thay vì SMTP mặc định của Supabase.

## 3. Deploy Vercel
```bash
git init && git add . && git commit -m "init"
# Tạo repo GitHub Private, push lên đó
```
Vercel > Add New Project > Import repo GitHub > Framework: Next.js > Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
Deploy → domain `https://quanlytaichinh.vercel.app` (tên có thể khác nếu đã có người dùng, lấy đúng domain Vercel cấp).

Test nhanh: đăng ký 1 tài khoản → tạo workspace → bán 5 ốp lưng iPhone 15 (Đen) → kiểm tra doanh thu 445.000đ, lãi 270.000đ ở trang Kho hàng / Báo cáo. Trang Thuế ước tính VAT và phương pháp thuế thu nhập riêng theo cấu hình workspace; các số mặc định chỉ là tham khảo, cần đối chiếu cơ quan thuế.

## 4. Build APK (Android) / iOS
```bash
npm run build
npx cap add android   # lần đầu
npx cap sync
npx cap open android  # mở Android Studio → Build APK / App Bundle, ký keystore để lên Play Store
npx cap add ios       # cần máy Mac + Xcode
npx cap open ios      # ký Apple Developer ($99/năm) để lên App Store / TestFlight
```
`capacitor.config.ts` đã có `appId: vn.quanlytaichinh` và `server.url: https://quanlytaichinh.vercel.app`. Chỉ dùng cá nhân trên iPhone: mở web trên Safari > Chia sẻ > Thêm vào Màn hình chính, không cần Mac.

## 5. Cấu trúc code
```
app/
  page.tsx            Trang chủ
  auth/page.tsx       Đăng ký / Đăng nhập / Quên mật khẩu (Supabase Auth, fallback local)
  dashboard/page.tsx  Tổng quan: số dư, thu/chi tháng, lãi, thuế, ví, giao dịch, ngân sách, mục tiêu, nợ, nhắc nhở
  kho/page.tsx        Kho hàng: tìm/lọc, thêm/sửa/xóa sản phẩm, biến thể + IMEI, nhập kho, bán hàng tính lãi
  thue/page.tsx       Ước tính VAT + phương pháp thuế thu nhập cấu hình riêng; theo dõi sổ nộp thuế và mẫu sổ TT88 S1–S7-HKD
  bao-cao/page.tsx    Báo cáo theo tháng: lãi theo sản phẩm, thu/chi theo danh mục, theo tháng, xuất CSV + Excel thật
  cai-dat/page.tsx    Không gian Thêm/Sửa/Xóa, cài đặt thuế, danh mục, ngân sách, tài khoản, PIN, xóa dữ liệu mẫu
components/
  GlassCard.tsx       GlassCard, StatCard, Modal, Field, EmptyState
  AppShell.tsx        Header + chuyển workspace + menu + khóa PIN
  TransactionForm.tsx Form Thu/Chi/Chuyển ví, bán hàng từ kho (chọn biến thể + IMEI, xem lãi live)
  WalletForm.tsx      Form Thêm/Sửa ví
  ProductForm.tsx     Form Thêm/Sửa sản phẩm: biến thể, trường tùy chỉnh (Màu sắc/IMEI/Serial/Bảo hành…)
lib/
  types.ts            16 kiểu dữ liệu khớp schema.sql
  utils.ts            fmtVND, profitOf, tax88, TNCN lũy tiến, TNDN, môn bài, downloadCSV, downloadXLSX
  demo.ts             Dữ liệu mẫu hộ kinh doanh (seedDemoState / emptyState)
  auth.ts             Đăng nhập local (SHA-256 + salt) — chỉ bản demo
  data.ts             useAppData(): đọc/ghi Supabase khi có cấu hình, localStorage khi chưa có;
                      bán hàng tự trừ tồn + tính lãi, xóa giao dịch hoàn tồn, nhập kho ghi Chi
  supabase/client.ts  createBrowserClient (trả null khi chưa cấu hình env)
  supabase/server.ts  createServerClient cho Server Components
                      (chưa dùng trong luồng hiện tại; Auth hoạt động qua browser client)
supabase/schema.sql   16 bảng + RLS + trigger + hàm tax88()
```

## 6. Bảo mật
- Không commit `.env.local`, không đưa `service_role` key vào code client/GitHub public.
- Mật khẩu/PIN bản local lưu dạng băm SHA-256 + salt; bản deploy dùng Supabase Auth.
- RLS bật cho cả 16 bảng, chỉ thành viên workspace mới đọc/ghi được dữ liệu của workspace đó.

## 7. v5 — thống nhất với bản demo (06/11/2026)
Bản v5 đối chiếu đủ 54 actions của bản demo trên Muse (xem bảng trong
báo cáo bàn giao): thêm thành viên + phân quyền, xóa ngân sách, ảnh sản
phẩm, đính kèm/quét hóa đơn, đánh dấu thuế trên giao dịch, PIN lưu dạng
băm, đổi mật khẩu Supabase (kiểm tra mật khẩu cũ + đăng xuất mọi phiên),
xóa tài khoản (xóa toàn bộ dữ liệu Supabase), đăng ký cloud được chọn
nạp dữ liệu mẫu, nạp riêng kho mẫu, nhắc nhở hoàn thành có tạo giao dịch
Chi + dời kỳ. Mọi thay đổi state ở chế độ cloud đều đồng bộ full-state
lên Supabase (trước đây ví/kho/mục tiêu/nợ/nhắc nhở chỉ lưu local).
Chạy lại `supabase/schema.sql` trong SQL Editor để thêm các cột mới
(transactions.to_wallet_id, transactions.receipt_image, products.image,
workspaces.tncn_deduction) — file dùng IF NOT EXISTS nên chạy lại an toàn.
