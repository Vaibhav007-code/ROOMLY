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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #16281F 0%, #0D1813 100%)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid rgba(168, 217, 143, 0.15)', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 18, color: '#16281F' }}>R</div>
          <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: 18, color: '#F7F7F2' }}>Roomly</span>
        </Link>
        <Link href="/signup" className="btn secondary btn-sm" style={{ background: 'rgba(255,255,255,0.12)', color: '#F7F7F2', border: '1px solid rgba(255,255,255,0.2)' }}>Sign Up</Link>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, margin: '0 0 6px', textAlign: 'center', color: '#F7F7F2' }}>Welcome back</h1>
          <p style={{ fontSize: 14, color: '#A8D98F', textAlign: 'center', marginBottom: 24 }}>Sign in to your Roomly dashboard</p>

          <form action={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label" style={{ color: '#E4E8E1' }}>Email address</label>
              <input name="email" type="email" placeholder="owner@example.com" required style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
            </div>
            <div>
              <label className="label" style={{ color: '#E4E8E1' }}>Password</label>
              <input name="password" type="password" placeholder="••••••••" required style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
            </div>
            {error && <div className="banner error">{error}</div>}
            <button type="submit" className="btn" disabled={loading} style={{ marginTop: 8, width: '100%' }}>
              {loading && <span className="spinner light" />}
              {loading ? 'Signing in…' : 'Sign in to Roomly'}
            </button>
          </form>

          <p style={{ fontSize: 13, color: '#C2CBC5', textAlign: 'center', marginTop: 24 }}>
            No account? <Link href="/signup" style={{ color: '#A8D98F', fontWeight: 600 }}>Sign up free</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
