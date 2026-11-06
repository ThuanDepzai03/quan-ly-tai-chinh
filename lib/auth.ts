// Xác thực bản LOCAL (demo / chưa có Supabase).
// Mật khẩu lưu dạng băm SHA-256 + salt trong localStorage — CHỈ dùng cho bản demo.
// Bản deploy thật dùng Supabase Auth (xem app/auth/page.tsx).
import type { AppUser } from './types';
import { DEMO_EMAIL, DEMO_PASSWORD } from './demo';

const USERS_KEY = 'qltc-v2-users';
const SESSION_KEY = 'qltc-v2-session';

interface StoredUser extends AppUser { pwHash: string; salt: string; }

function readUsers(): StoredUser[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') as StoredUser[]; }
  catch { return []; }
}
function writeUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function hashPassword(pw: string, salt: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}::${pw}`));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0;
  const s = `${salt}::${pw}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return `fnv-${h}`;
}

export function getSessionUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch { return null; }
}
export function setSessionUser(user: AppUser | null): void {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

/** Đăng ký local. Trả về lỗi (chuỗi) hoặc null khi thành công. */
export async function localSignUp(name: string, email: string, password: string): Promise<string | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  const users = readUsers();
  if (users.some((u) => u.email === cleanEmail) || cleanEmail === DEMO_EMAIL) return 'Email này đã được đăng ký.';
  const salt = Math.random().toString(36).slice(2);
  const user: StoredUser = {
    id: `u-${Date.now().toString(36)}`, email: cleanEmail, name: name.trim() || cleanEmail,
    pwHash: await hashPassword(password, salt), salt,
  };
  users.push(user);
  writeUsers(users);
  setSessionUser({ id: user.id, email: user.email, name: user.name });
  return null;
}

/** Đăng nhập local. Trả về { user } hoặc { error }. */
export async function localSignIn(email: string, password: string): Promise<{ user?: AppUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === DEMO_EMAIL) {
    if (password !== DEMO_PASSWORD) return { error: 'Email hoặc mật khẩu không đúng.' };
    const user: AppUser = { id: 'u-demo', email: DEMO_EMAIL, name: 'Người dùng Demo' };
    setSessionUser(user);
    return { user };
  }
  const found = readUsers().find((u) => u.email === cleanEmail);
  if (!found) return { error: 'Email hoặc mật khẩu không đúng.' };
  const hash = await hashPassword(password, found.salt);
  if (hash !== found.pwHash) return { error: 'Email hoặc mật khẩu không đúng.' };
  const user: AppUser = { id: found.id, email: found.email, name: found.name };
  setSessionUser(user);
  return { user };
}

/** Quên mật khẩu local: đặt lại mật khẩu mới cho email đã đăng ký. */
export async function localResetPassword(email: string, newPassword: string): Promise<string | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (newPassword.length < 6) return 'Mật khẩu mới phải có ít nhất 6 ký tự.';
  if (cleanEmail === DEMO_EMAIL) return 'Tài khoản demo không đổi được mật khẩu.';
  const users = readUsers();
  const idx = users.findIndex((u) => u.email === cleanEmail);
  if (idx < 0) return 'Email này chưa đăng ký tài khoản.';
  const salt = Math.random().toString(36).slice(2);
  users[idx].salt = salt;
  users[idx].pwHash = await hashPassword(newPassword, salt);
  writeUsers(users);
  return null;
}

/** Đổi mật khẩu local (cần mật khẩu cũ). */
export async function localChangePassword(user: AppUser, oldPw: string, newPw: string): Promise<string | null> {
  if (newPw.length < 6) return 'Mật khẩu mới phải có ít nhất 6 ký tự.';
  if (user.email === DEMO_EMAIL) return 'Tài khoản demo không đổi được mật khẩu.';
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx < 0) return 'Không tìm thấy tài khoản.';
  const hash = await hashPassword(oldPw, users[idx].salt);
  if (hash !== users[idx].pwHash) return 'Mật khẩu cũ không đúng.';
  const salt = Math.random().toString(36).slice(2);
  users[idx].salt = salt;
  users[idx].pwHash = await hashPassword(newPw, salt);
  writeUsers(users);
  return null;
}

/** Đổi tên hiển thị local. */
export function localRename(user: AppUser, newName: string): AppUser {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) { users[idx].name = newName.trim(); writeUsers(users); }
  const updated: AppUser = { ...user, name: newName.trim() };
  setSessionUser(updated);
  return updated;
}

/** Xóa tài khoản local (cần mật khẩu đúng). */
export async function localDeleteAccount(user: AppUser, password: string): Promise<string | null> {
  if (user.email === DEMO_EMAIL) return 'Tài khoản demo không xóa được.';
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx < 0) return 'Không tìm thấy tài khoản.';
  const hash = await hashPassword(password, users[idx].salt);
  if (hash !== users[idx].pwHash) return 'Mật khẩu không đúng.';
  users.splice(idx, 1);
  writeUsers(users);
  setSessionUser(null);
  return null;
}
