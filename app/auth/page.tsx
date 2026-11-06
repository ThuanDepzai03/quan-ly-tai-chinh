'use client';
import AuthForm from '@/components/AuthForm';

export default function AuthPage() {
  return (
    <main className="glass" style={{ maxWidth: 520, margin: '40px auto' }}>
      <AuthForm showHomeLink />
    </main>
  );
}
