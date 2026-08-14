'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { normalisePhone } from '@/lib/whatsapp';
import { getErrorMessage } from '@/lib/errorMessages';
import Link from 'next/link';

export default function Register({ params }: { params: { hostelId: string } }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(f: FormData) {
    setNote('');
    try {
      normalisePhone(String(f.get('phone') || ''));
      if (f.get('whatsapp')) normalisePhone(String(f.get('whatsapp')));
    } catch (e) {
      return setNote(getErrorMessage(e));
    }

    // Aadhaar validation (12 digits, optional)
    const aadhaar = String(f.get('aadhaar') || '').replace(/\s/g, '');
    if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
      return setNote('Aadhaar number must be exactly 12 digits.');
    }

    setLoading(true);
    const { error } = await supabaseBrowser().rpc('submit_admission', {
      p_hostel: params.hostelId,
      p_name: f.get('name'),
      p_email: f.get('email'),
      p_phone: f.get('phone'),
      p_whatsapp: f.get('whatsapp'),
      p_aadhaar: aadhaar || null,
    });
    setLoading(false);

    if (error) {
      setNote(getErrorMessage(error));
    } else {
      setDone(true);
    }
  }

  return (
    <div className="register-page">
      {/* Header */}
      <header className="register-header">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'var(--signal)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--ink)'
          }}>R</div>
          <div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--ink)', display: 'block', lineHeight: 1 }}>Roomly</span>
            <span style={{ fontSize: 12, color: 'var(--charcoal)', display: 'block', marginTop: 2 }}>Resident Registration</span>
          </div>
        </Link>
      </header>

      {/* Form area */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px 80px' }}>
        <div className="card" style={{ width: '100%', maxWidth: 440 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--signal)', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22
              }}>✓</div>
              <h1 style={{ fontSize: 22, marginBottom: 8 }}>Application Received!</h1>
              <p style={{ color: 'var(--charcoal)', fontSize: 14 }}>
                The hostel manager will review your details and contact you shortly.
              </p>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 24, marginBottom: 4, textAlign: 'center' }}>Apply for a Room</h1>
              <p style={{ fontSize: 13, color: 'var(--charcoal)', textAlign: 'center', marginBottom: 24 }}>
                Your details go directly to the hostel manager.
              </p>

              <form action={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">Full Name *</label>
                  <input name="name" placeholder="John Doe" required />
                </div>

                <div>
                  <label className="label">Phone Number *</label>
                  <input name="phone" placeholder="9876543210" inputMode="tel" required />
                </div>

                <div>
                  <label className="label">WhatsApp Number</label>
                  <input name="whatsapp" placeholder="Leave blank if same as phone" inputMode="tel" />
                </div>

                <div>
                  <label className="label">Email Address (Optional)</label>
                  <input name="email" type="email" placeholder="john@example.com" />
                </div>

                <div>
                  <label className="label">Aadhaar Number (Optional)</label>
                  <input
                    name="aadhaar"
                    placeholder="12-digit Aadhaar"
                    maxLength={12}
                    inputMode="numeric"
                    pattern="\d{12}"
                  />
                </div>

                {note && (
                  <div className={`banner ${note.includes('digits') || note.includes('Invalid') ? 'error' : 'error'}`}>
                    {note}
                  </div>
                )}

                <button type="submit" className="btn" disabled={loading} style={{ marginTop: 8 }}>
                  {loading && <span className="spinner light" />}
                  {loading ? 'Submitting…' : 'Send Application'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
