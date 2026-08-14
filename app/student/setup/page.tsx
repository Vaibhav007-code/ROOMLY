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
    <form action={setup} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
      <div><label className="label">Email address</label><input name="email" type="email" placeholder="you@example.com" required /></div>
      <div><label className="label">Password (8+ characters)</label><input name="password" type="password" minLength={8} placeholder="••••••••" required /></div>
      {note && <div className="banner error">{note}</div>}
      <button className="btn" disabled={loading} style={{ marginTop: 4 }}>
        {loading && <span className="spinner light" />}
        {loading ? 'Creating account…' : 'Create Resident Account'}
      </button>
    </form>
  );
}

export default function StudentSetup() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--fog)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--signal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>R</div>
          <div>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--ink)', display: 'block', lineHeight: 1 }}>Roomly</span>
            <span style={{ fontSize: 11, color: 'var(--charcoal)', display: 'block' }}>Resident Setup</span>
          </div>
        </Link>
      </header>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div className="card" style={{ width: '100%', maxWidth: 400 }}>
          <h1 style={{ fontSize: 22, margin: '0 0 4px', textAlign: 'center' }}>Set up your resident login</h1>
          <p style={{ fontSize: 13, color: 'var(--charcoal)', textAlign: 'center', margin: 0 }}>
            Create an account to view your room, rent, and complaints.
          </p>
          <Suspense fallback={<p style={{ color: 'var(--charcoal)', fontSize: 14, marginTop: 16, textAlign: 'center' }}>Loading…</p>}>
            <SetupForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
