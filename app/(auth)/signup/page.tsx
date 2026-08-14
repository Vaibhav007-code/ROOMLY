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
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--fog)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--signal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>R</div>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>Roomly</span>
        </Link>
        <Link href="/login" className="btn secondary btn-sm">Log In</Link>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div className="card" style={{ width: '100%', maxWidth: 420 }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--signal)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>✓</div>
              <h1 style={{ fontSize: 22, marginBottom: 8 }}>Check your email</h1>
              <p style={{ color: 'var(--charcoal)', fontSize: 14, marginBottom: 20 }}>Confirm your account via the link we sent, then sign in.</p>
              <Link href="/login" className="btn">Go to Sign In</Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 22, margin: '0 0 4px', textAlign: 'center' }}>Create owner account</h1>
              <p style={{ fontSize: 13, color: 'var(--charcoal)', textAlign: 'center', marginBottom: 24 }}>Start managing your hostels in under a minute</p>
              <form action={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label className="label">Your full name</label><input name="name" placeholder="John Doe" required /></div>
                <div><label className="label">Business / Hostel name (optional)</label><input name="business" placeholder="Sunrise Stays" /></div>
                <div><label className="label">Email address</label><input name="email" type="email" placeholder="owner@example.com" required /></div>
                <div><label className="label">Password (8+ characters)</label><input name="password" minLength={8} type="password" placeholder="••••••••" required /></div>
                {note && <div className="banner error">{note}</div>}
                <button type="submit" className="btn" disabled={loading} style={{ marginTop: 4 }}>
                  {loading && <span className="spinner light" />}
                  {loading ? 'Creating account…' : 'Create Roomly Account'}
                </button>
              </form>
              <p style={{ fontSize: 12, color: 'var(--charcoal)', textAlign: 'center', marginTop: 20 }}>
                Already have an account? <Link href="/login" style={{ color: 'var(--ink)', fontWeight: 600 }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
