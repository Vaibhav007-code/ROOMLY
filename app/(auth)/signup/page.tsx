'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import Link from 'next/link';
import { getErrorMessage } from '@/lib/errorMessages';

export default function Signup() {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(f: FormData) {
    setLoading(true); setNote('');
    const { error } = await supabaseBrowser().auth.signUp({
      email: String(f.get('email')),
      password: String(f.get('password')),
      options: { data: { role: 'owner', full_name: String(f.get('name')), business_name: String(f.get('business')) } },
    });
    setLoading(false);
    if (error) setNote(getErrorMessage(error));
    else setSuccess(true);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #16281F 0%, #0D1813 100%)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid rgba(168, 217, 143, 0.15)', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 18, color: '#16281F' }}>R</div>
          <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: 18, color: '#F7F7F2' }}>Roomly</span>
        </Link>
        <Link href="/login" className="btn secondary btn-sm" style={{ background: 'rgba(255,255,255,0.12)', color: '#F7F7F2', border: '1px solid rgba(255,255,255,0.2)' }}>Log In</Link>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: 440 }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--primary-gradient)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#16281F', fontWeight: 'bold' }}>✓</div>
              <h1 style={{ fontSize: 24, marginBottom: 8, color: '#F7F7F2' }}>Check your email</h1>
              <p style={{ color: '#A8D98F', fontSize: 14, marginBottom: 20 }}>Confirm your account via the link we sent, then sign in.</p>
              <Link href="/login" className="btn" style={{ width: '100%' }}>Go to Sign In</Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 24, margin: '0 0 6px', textAlign: 'center', color: '#F7F7F2' }}>Create owner account</h1>
              <p style={{ fontSize: 14, color: '#A8D98F', textAlign: 'center', marginBottom: 24 }}>Start managing your hostels in under a minute</p>
              <form action={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label" style={{ color: '#E4E8E1' }}>Your full name</label>
                  <input name="name" placeholder="John Doe" required style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                </div>
                <div>
                  <label className="label" style={{ color: '#E4E8E1' }}>Business / Hostel name (optional)</label>
                  <input name="business" placeholder="Sunrise Stays" style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                </div>
                <div>
                  <label className="label" style={{ color: '#E4E8E1' }}>Email address</label>
                  <input name="email" type="email" placeholder="owner@example.com" required style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                </div>
                <div>
                  <label className="label" style={{ color: '#E4E8E1' }}>Password (8+ characters)</label>
                  <input name="password" minLength={8} type="password" placeholder="••••••••" required style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                </div>
                {note && <div className="banner error">{note}</div>}
                <button type="submit" className="btn" disabled={loading} style={{ marginTop: 8, width: '100%' }}>
                  {loading && <span className="spinner light" />}
                  {loading ? 'Creating account…' : 'Create Roomly Account'}
                </button>
              </form>
              <p style={{ fontSize: 13, color: '#C2CBC5', textAlign: 'center', marginTop: 24 }}>
                Already have an account? <Link href="/login" style={{ color: '#A8D98F', fontWeight: 600 }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
