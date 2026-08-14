'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getErrorMessage } from '@/lib/errorMessages';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(f: FormData) {
    setError(''); setLoading(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: String(f.get('email')),
      password: String(f.get('password')),
    });
    setLoading(false);
    if (error) setError(getErrorMessage(error));
    else router.push('/dashboard');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--fog)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--signal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>R</div>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>Roomly</span>
        </Link>
        <Link href="/signup" className="btn secondary btn-sm">Sign Up</Link>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div className="card" style={{ width: '100%', maxWidth: 400 }}>
          <h1 style={{ fontSize: 22, margin: '0 0 4px', textAlign: 'center' }}>Welcome back</h1>
          <p style={{ fontSize: 13, color: 'var(--charcoal)', textAlign: 'center', marginBottom: 24 }}>Sign in to your Roomly dashboard</p>

          <form action={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label className="label">Email address</label><input name="email" type="email" placeholder="owner@example.com" required /></div>
            <div><label className="label">Password</label><input name="password" type="password" placeholder="••••••••" required /></div>
            {error && <div className="banner error">{error}</div>}
            <button type="submit" className="btn" disabled={loading} style={{ marginTop: 4 }}>
              {loading && <span className="spinner light" />}
              {loading ? 'Signing in…' : 'Sign in to Roomly'}
            </button>
          </form>

          <p style={{ fontSize: 12, color: 'var(--charcoal)', textAlign: 'center', marginTop: 20 }}>
            No account? <Link href="/signup" style={{ color: 'var(--ink)', fontWeight: 600 }}>Sign up free</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
