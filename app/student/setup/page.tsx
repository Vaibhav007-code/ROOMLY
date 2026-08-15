'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errorMessages';
import Link from 'next/link';

function SetupForm() {
  const code = useSearchParams().get('code') || '';
  const router = useRouter();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function setup(f: FormData) {
    if (!code) return setNote('Invite code is missing. Ask the owner to resend it.');
    setLoading(true);
    const s = supabaseBrowser();
    const { data, error } = await s.auth.signUp({
      email: String(f.get('email')),
      password: String(f.get('password')),
      options: { data: { role: 'student' } },
    });
    if (error || !data.user) { setLoading(false); return setNote(getErrorMessage(error || 'Could not create login')); }
    const r = await fetch('/api/student-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    const body = await r.json();
    setLoading(false);
    if (!r.ok) return setNote(getErrorMessage(body.error || 'Could not link resident profile'));
    router.push('/student');
  }

  return (
    <form action={setup} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
      <div>
        <label className="label" style={{ color: '#E4E8E1' }}>Email address</label>
        <input name="email" type="email" placeholder="you@example.com" required style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
      </div>
      <div>
        <label className="label" style={{ color: '#E4E8E1' }}>Password (8+ characters)</label>
        <input name="password" type="password" minLength={8} placeholder="••••••••" required style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
      </div>
      {note && <div className="banner error">{note}</div>}
      <button className="btn" disabled={loading} style={{ marginTop: 8, width: '100%' }}>
        {loading && <span className="spinner light" />}
        {loading ? 'Creating account…' : 'Create Resident Account'}
      </button>
    </form>
  );
}

export default function StudentSetup() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #16281F 0%, #0D1813 100%)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid rgba(168, 217, 143, 0.15)', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18, color: '#16281F' }}>R</div>
          <div>
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 17, color: '#F7F7F2', display: 'block', lineHeight: 1 }}>Roomly</span>
            <span style={{ fontSize: 12, color: '#A8D98F', display: 'block', marginTop: 2 }}>Resident Setup</span>
          </div>
        </Link>
      </header>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, margin: '0 0 6px', textAlign: 'center', color: '#F7F7F2' }}>Set up your resident login</h1>
          <p style={{ fontSize: 14, color: '#A8D98F', textAlign: 'center', margin: 0 }}>
            Create an account to view your room, rent, and complaints.
          </p>
          <Suspense fallback={<p style={{ color: '#A8D98F', fontSize: 14, marginTop: 16, textAlign: 'center' }}>Loading…</p>}>
            <SetupForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
