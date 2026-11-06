import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        // options là CookieOptions của Supabase; dùng any để tránh lệch type giữa các bản next.
        set(name: string, value: string, options: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          try { cookieStore.set(name, value, options); } catch { /* Server Component read-only */ }
        },
        remove(name: string, options: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          try { cookieStore.set(name, '', options); } catch { /* Server Component read-only */ }
        },
      },
    },
  );
}
