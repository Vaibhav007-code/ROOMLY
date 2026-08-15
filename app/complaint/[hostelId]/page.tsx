'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { normalisePhone } from '@/lib/whatsapp';
import { getErrorMessage } from '@/lib/errorMessages';
import Link from 'next/link';

export default function PublicComplaint({ params }: { params: { hostelId: string } }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(f: FormData) {
    setNote('');
    const phone = String(f.get('phone') || '').trim();
    const text = String(f.get('complaint') || '').trim();
    const room = String(f.get('room') || '').trim();

    if (!phone) return setNote('Please enter your phone number.');
    if (!text) return setNote('Please describe your complaint.');

    try {
      normalisePhone(phone);
    } catch (e) {
      return setNote(getErrorMessage(e));
    }

    setLoading(true);
    const photoPath: string | null = null;

    const { error } = await supabaseBrowser().rpc('submit_public_complaint', {
      p_hostel: params.hostelId,
      p_phone: phone,
      p_text: text,
      p_photo: photoPath,
      p_room: room || null,
    });

    setLoading(false);

    if (error) {
      setNote(getErrorMessage(error));
    } else {
      setDone(true);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #16281F 0%, #0D1813 100%)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid rgba(168, 217, 143, 0.15)', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'var(--primary-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18, color: '#16281F',
          }}>R</div>
          <div>
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 17, color: '#F7F7F2', display: 'block', lineHeight: 1 }}>Roomly</span>
            <span style={{ fontSize: 12, color: '#A8D98F', display: 'block', marginTop: 2 }}>Resident Complaint</span>
          </div>
        </Link>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px 80px' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: 480 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--primary-gradient)', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, color: '#16281F', fontWeight: 'bold'
              }}>✓</div>
              <h1 style={{ fontSize: 24, marginBottom: 8, color: '#F7F7F2' }}>Complaint Submitted</h1>
              <p style={{ color: '#A8D98F', fontSize: 14, lineHeight: 1.6 }}>
                Thank you. The hostel management team has received your complaint and will look into it shortly.
              </p>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 24, marginBottom: 4, color: '#F7F7F2' }}>Raise a Complaint</h1>
              <p style={{ fontSize: 13, color: '#A8D98F', marginBottom: 24, lineHeight: 1.5 }}>
                Enter your registered phone number and describe your issue. No login required.
              </p>

              <form action={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="label" style={{ color: '#E4E8E1' }}>Your Phone Number *</label>
                  <input
                    name="phone"
                    placeholder="9876543210"
                    inputMode="tel"
                    required
                    autoComplete="tel"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }}
                  />
                  <p style={{ fontSize: 11, color: '#C2CBC5', marginTop: 4 }}>
                    Must match the number you registered with. Used to link your complaint to your resident record.
                  </p>
                </div>

                <div>
                  <label className="label" style={{ color: '#E4E8E1' }}>Room Number (Optional)</label>
                  <input
                    name="room"
                    placeholder="e.g. 102 or B-204"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }}
                  />
                  <p style={{ fontSize: 11, color: '#C2CBC5', marginTop: 4 }}>
                    Helps management verify your identity and locate your room quickly.
                  </p>
                </div>

                <div>
                  <label className="label" style={{ color: '#E4E8E1' }}>Complaint Details *</label>
                  <textarea
                    name="complaint"
                    placeholder="Describe your issue in detail — e.g. water leakage in Room 204 since Monday morning..."
                    rows={5}
                    required
                    style={{ resize: 'vertical', background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }}
                  />
                </div>

                {note && (
                  <div className="banner error">{note}</div>
                )}

                <button type="submit" className="btn" disabled={loading} style={{ marginTop: 8, width: '100%' }}>
                  {loading && <span className="spinner light" />}
                  {loading ? 'Submitting…' : 'Submit Complaint'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
