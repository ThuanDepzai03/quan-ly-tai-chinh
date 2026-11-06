import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export const isSupabaseConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Client Supabase cho browser. Trả về null khi chưa cấu hình env (chạy bản local). */
export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
}

// ---------------------------------------------------------------------------
// Phân loại lỗi Auth Supabase — sửa lỗi user gặp ngày 06/11/2026:
// Bật "Confirm email" thì mail xác thực (SMTP Free) hay vào Spam / không tới,
// tài khoản đã tạo nhưng chưa confirm nên đăng nhập báo "Invalid login
// credentials" dù mật khẩu đúng, đăng ký lại báo "User already registered".
// Các hàm dưới đây nhận diện đúng từng trường hợp để UI báo tiếng Việt rõ
// ràng thay vì báo chung chung là "sai mật khẩu".
// ---------------------------------------------------------------------------

function errText(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message?: unknown }).message ?? '');
  }
  return String(err);
}

/** Email này đã đăng ký rồi (signUp trả về). */
export function isAlreadyRegistered(err: unknown): boolean {
  const m = errText(err).toLowerCase();
  return m.includes('already registered') || m.includes('user already exists');
}

/**
 * Tài khoản chưa xác thực email.
 * Supabase trả về "Email not confirmed" (mã lỗi email_not_confirmed) khi
 * Confirm email đang BẬT và user chưa bấm link trong mail. Trường hợp này
 * KHÔNG phải sai mật khẩu — mật khẩu vẫn đúng, chỉ bị chặn vì chưa confirm.
 */
export function isEmailNotConfirmed(err: unknown): boolean {
  const m = errText(err).toLowerCase();
  return (
    m.includes('email not confirmed') ||
    m.includes('email_not_confirmed') ||
    m.includes('not confirmed') ||
    m.includes('chưa xác thực') ||
    m.includes('chưa xác nhận')
  );
}

/** Sai email hoặc sai mật khẩu thật sự (user đã confirm rồi mà vẫn sai). */
export function isInvalidLogin(err: unknown): boolean {
  const m = errText(err).toLowerCase();
  return m.includes('invalid login credentials') || m.includes('invalid login');
}

/**
 * Dịch lỗi Auth Supabase sang tiếng Việt, phân biệt rõ 3 trường hợp user
 * hay nhầm lẫn với nhau. Trả về { message, kind }.
 */
export function translateAuthError(err: unknown): {
  message: string;
  kind: 'already-registered' | 'not-confirmed' | 'invalid-login' | 'other';
} {
  if (isAlreadyRegistered(err)) {
    return {
      kind: 'already-registered',
      message:
        'Email này đã đăng ký rồi. Hãy đăng nhập bằng mật khẩu đã đặt lúc đăng ký, hoặc bấm "Gửi lại mail xác thực" bên dưới nếu chưa nhận được mail.',
    };
  }
  if (isEmailNotConfirmed(err)) {
    return {
      kind: 'not-confirmed',
      message:
        'Tài khoản chưa xác thực email nên Supabase chặn đăng nhập (mật khẩu của bạn vẫn đúng). Hãy kiểm tra hộp thư — cả Spam / Thư rác / Promotions — rồi bấm link xác thực, hoặc bấm "Gửi lại mail xác thực" bên dưới.',
    };
  }
  if (isInvalidLogin(err)) {
    return {
      kind: 'invalid-login',
      message:
        'Sai email hoặc mật khẩu. Nếu bạn vừa đăng ký và chưa xác thực email, hãy bấm "Gửi lại mail xác thực" bên dưới thay vì đổi mật khẩu liên tục — đổi mật khẩu không mở được tài khoản chưa confirm.',
    };
  }
  const raw = errText(err);
  return {
    kind: 'other',
    message: raw ? `Lỗi: ${raw}` : 'Đã xảy ra lỗi. Vui lòng thử lại.',
  };
}

/**
 * Gửi lại mail xác thực cho email chưa confirm.
 * Dùng supabase.auth.resend({ type: 'signup', email }).
 * Lưu ý: SMTP Free của Supabase gửi chậm, hay vào Spam/Promotions và có
 * giới hạn số mail/giờ. Nếu không nhận được mail sau vài phút, hãy:
 *  1. Kiểm tra Spam / Promotions / Quảng cáo.
 *  2. Vào Supabase Dashboard > Authentication > Users > chọn user > Confirm user thủ công.
 *  3. Lúc test, tắt "Confirm email" ở Authentication > Providers > Email để
 *     đăng ký xong đăng nhập ngay, không cần chờ mail.
 */
export async function resendConfirmationEmail(
  sb: SupabaseClient,
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const clean = email.trim().toLowerCase();
  if (!clean) return { ok: false, message: 'Vui lòng nhập email trước.' };
  const { error } = await sb.auth.resend({ type: 'signup', email: clean });
  if (error) {
    // resend cũng có thể báo already confirmed / không tìm thấy user — dịch rõ.
    if (errText(error).toLowerCase().includes('already confirmed')) {
      return {
        ok: true,
        message: 'Email này đã được xác thực rồi. Hãy đăng nhập bằng mật khẩu đã đặt.',
      };
    }
    return { ok: false, message: `Không gửi được mail xác thực: ${errText(error)}` };
  }
  return {
    ok: true,
    message:
      'Đã gửi lại mail xác thực. Kiểm tra hộp thư — cả Spam / Thư rác / Promotions — rồi bấm link trong mail, sau đó đăng nhập lại.',
  };
}

/**
 * Gửi mail quên mật khẩu. redirectTo phải là domain Vercel THẬT đang chạy
 * (window.location.origin), KHÔNG hard-code domain cũ — trước đây code dùng
 * resetPasswordForEmail(email) không truyền redirectTo nên Supabase dùng Site
 * URL mặc định, dễ lệch với domain deploy thực tế (VD: site chạy ở
 * quan-ly-tai-chinh-sage.vercel.app nhưng Redirect URL chỉ có
 * quanlytaichinh.vercel.app) khiến link đổi mật khẩu không quay về đúng app.
 */
export async function sendPasswordResetEmail(
  sb: SupabaseClient,
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const clean = email.trim().toLowerCase();
  if (!clean) return { ok: false, message: 'Vui lòng nhập email trước.' };
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth`
      : undefined;
  const { error } = await sb.auth.resetPasswordForEmail(clean, {
    redirectTo,
  });
  if (error) {
    return { ok: false, message: `Không gửi được mail đặt lại mật khẩu: ${errText(error)}` };
  }
  return {
    ok: true,
    message:
      'Đã gửi link đặt lại mật khẩu về email (kiểm tra cả Spam). Bấm link trong vòng 1 giờ, đặt mật khẩu mới rồi đăng nhập lại bằng mật khẩu mới đó.',
  };
}
