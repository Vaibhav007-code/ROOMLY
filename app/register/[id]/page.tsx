'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { normalisePhone } from '@/lib/whatsapp';
import { getErrorMessage } from '@/lib/errorMessages';
import Link from 'next/link';

type Mode = 'choose' | 'admission' | 'complaint';

export default function RegisterUnified({ params }: { params: { id: string } }) {
  const [mode, setMode] = useState<Mode>('choose');
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [loadingHostels, setLoadingHostels] = useState(true);

  // Complaint-specific state
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      const s = supabaseBrowser();

      // 1. Check if params.id is a hostel ID directly
      const { data: singleHostel } = await s
        .from('hostels')
        .select('id,name')
        .eq('id', params.id)
        .maybeSingle();

      if (singleHostel) {
        setHostels([singleHostel]);
        setSelectedHostelId(singleHostel.id);
        setLoadingHostels(false);
        return;
      }

      // 2. Otherwise check if params.id is an owner_id
      const { data: ownerHostels } = await s
        .from('hostels')
        .select('id,name')
        .eq('owner_id', params.id)
        .order('name');

      setHostels(ownerHostels || []);
      if (ownerHostels?.length === 1) setSelectedHostelId(ownerHostels[0].id);
      setLoadingHostels(false);
    })();
  }, [params.id]);

  // ── Admission submit ─────────────────────────────────────────────────────────
  async function submitAdmission(f: FormData) {
    setNote('');
    const phone = String(f.get('phone') || '').trim();
    const hostel = selectedHostelId || String(f.get('hostel') || '');

    if (!hostel) return setNote('Please select a hostel.');

    try { normalisePhone(phone); } catch (e) { return setNote(getErrorMessage(e)); }
    if (f.get('whatsapp')) {
      try { normalisePhone(String(f.get('whatsapp'))); } catch (e) { return setNote(getErrorMessage(e)); }
    }

    const aadhaar = String(f.get('aadhaar') || '').replace(/\s/g, '');
    if (aadhaar && !/^\d{12}$/.test(aadhaar)) return setNote('Aadhaar number must be exactly 12 digits.');

    setLoading(true);
    const { error } = await supabaseBrowser().rpc('submit_admission', {
      p_hostel: hostel,
      p_name: f.get('name'),
      p_email: f.get('email'),
      p_phone: phone,
      p_whatsapp: f.get('whatsapp'),
      p_aadhaar: aadhaar || null,
    });
    setLoading(false);
    if (error) setNote(getErrorMessage(error)); else setDone(true);
  }

  // ── Complaint submit ─────────────────────────────────────────────────────────
  async function submitComplaint(f: FormData) {
    setNote('');
    const phone = String(f.get('phone') || '').trim();
    const text = String(f.get('complaint') || '').trim();
    const hostel = selectedHostelId || String(f.get('hostel') || '');

    if (!hostel) return setNote('Please select a hostel.');
    if (!phone) return setNote('Please enter your phone number.');
    if (!text) return setNote('Please describe your complaint.');

    try { normalisePhone(phone); } catch (e) { return setNote(getErrorMessage(e)); }

    setLoading(true);

    let photoPath: string | null = null;
    if (photoFile) {
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const uploadPath = `public/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabaseBrowser()
        .storage.from('complaint-photos')
        .upload(uploadPath, photoFile, { contentType: photoFile.type });
      if (!upErr) photoPath = uploadPath;
    }

    const { error } = await supabaseBrowser().rpc('submit_public_complaint', {
      p_hostel: hostel,
      p_phone: phone,
      p_text: text,
      p_photo: photoPath,
    });
    setLoading(false);
    if (error) setNote(getErrorMessage(error)); else setDone(true);
  }

  // ── Hostel selector (shared between modes) ───────────────────────────────────
  const hostelSelector = hostels.length > 1 ? (
    <div>
      <label className="label">Select Hostel *</label>
      <select
        name="hostel"
        required
        value={selectedHostelId}
        onChange={e => setSelectedHostelId(e.target.value)}
      >
        <option value="">Choose your hostel…</option>
        {hostels.map(h => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
    </div>
  ) : null;

  const headerSubtitle = mode === 'admission' ? 'Resident Registration'
    : mode === 'complaint' ? 'Resident Complaint'
    : 'Self-Service Portal';

  return (
    <div className="register-page">
      <header className="register-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: '#F5C518',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: '#0A0A0A',
            }}>R</div>
            <div>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: '#F5C518', display: 'block', lineHeight: 1 }}>Roomly</span>
              <span style={{ fontSize: 12, color: 'var(--charcoal)', display: 'block', marginTop: 2 }}>{headerSubtitle}</span>
            </div>
          </Link>
          {mode !== 'choose' && (
            <button
              onClick={() => { setMode('choose'); setDone(false); setNote(''); setSelectedHostelId(hostels.length === 1 ? hostels[0].id : ''); }}
              style={{ background: 'none', border: 'none', color: 'var(--charcoal)', fontSize: 13, cursor: 'pointer', padding: '4px 8px' }}
            >
              ← Back
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px 80px' }}>
        {loadingHostels ? (
          <div style={{ color: 'var(--charcoal)', textAlign: 'center' }}>Loading…</div>
        ) : hostels.length === 0 ? (
          <div className="card" style={{ width: '100%', maxWidth: 440, textAlign: 'center', padding: 32 }}>
            <p style={{ color: 'var(--charcoal)' }}>This registration link is no longer active.</p>
          </div>
        ) : (

          /* ── MODE: Choose ─────────────────────────────────────── */
          mode === 'choose' ? (
            <div className="card" style={{ width: '100%', maxWidth: 440 }}>
              <h1 style={{ fontSize: 22, marginBottom: 6, textAlign: 'center' }}>
                {hostels[0]?.name || 'Hostel'}
                {hostels.length > 1 ? ' & More' : ''}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--charcoal)', textAlign: 'center', marginBottom: 28 }}>
                What would you like to do?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  className="btn"
                  style={{ fontSize: 16, minHeight: 56 }}
                  onClick={() => setMode('admission')}
                >
                  🏠 Apply for a Room
                </button>
                <button
                  className="btn secondary"
                  style={{ fontSize: 16, minHeight: 56 }}
                  onClick={() => setMode('complaint')}
                >
                  💬 Raise a Complaint
                </button>
              </div>
            </div>

          /* ── MODE: Admission ──────────────────────────────────── */
          ) : mode === 'admission' ? (
            <div className="card" style={{ width: '100%', maxWidth: 480 }}>
              {done ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F5C518', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>✓</div>
                  <h1 style={{ fontSize: 22, marginBottom: 8 }}>Application Received!</h1>
                  <p style={{ color: 'var(--charcoal)', fontSize: 14 }}>
                    The hostel manager will review your details and contact you shortly.
                  </p>
                </div>
              ) : (
                <>
                  <h1 style={{ fontSize: 22, marginBottom: 4 }}>Apply for a Room</h1>
                  <p style={{ fontSize: 13, color: 'var(--charcoal)', marginBottom: 20 }}>
                    Your details go directly to the hostel manager.
                  </p>
                  <form action={submitAdmission} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {hostelSelector}
                    <div><label className="label">Full Name *</label><input name="name" placeholder="John Doe" required /></div>
                    <div><label className="label">Phone Number *</label><input name="phone" placeholder="9876543210" inputMode="tel" required /></div>
                    <div><label className="label">WhatsApp Number</label><input name="whatsapp" placeholder="Leave blank if same as phone" inputMode="tel" /></div>
                    <div><label className="label">Email Address (Optional)</label><input name="email" type="email" placeholder="john@example.com" /></div>
                    <div>
                      <label className="label">Aadhaar Number (Optional)</label>
                      <input name="aadhaar" placeholder="12-digit Aadhaar" maxLength={12} inputMode="numeric" pattern="\d{12}" />
                    </div>
                    {note && <div className="banner error">{note}</div>}
                    <button type="submit" className="btn" disabled={loading} style={{ marginTop: 4 }}>
                      {loading && <span className="spinner light" />}
                      {loading ? 'Submitting…' : 'Send Application'}
                    </button>
                  </form>
                </>
              )}
            </div>

          /* ── MODE: Complaint ──────────────────────────────────── */
          ) : (
            <div className="card" style={{ width: '100%', maxWidth: 480 }}>
              {done ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F5C518', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>✓</div>
                  <h1 style={{ fontSize: 22, marginBottom: 8 }}>Complaint Submitted</h1>
                  <p style={{ color: 'var(--charcoal)', fontSize: 14, lineHeight: 1.6 }}>
                    Thank you. The hostel management team has received your complaint and will look into it shortly.
                  </p>
                </div>
              ) : (
                <>
                  <h1 style={{ fontSize: 22, marginBottom: 4 }}>Raise a Complaint</h1>
                  <p style={{ fontSize: 13, color: 'var(--charcoal)', marginBottom: 20 }}>
                    Enter your registered phone number and describe your issue.
                  </p>
                  <form action={submitComplaint} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {hostelSelector}
                    <div>
                      <label className="label">Your Phone Number *</label>
                      <input name="phone" placeholder="9876543210" inputMode="tel" required autoComplete="tel" />
                      <p style={{ fontSize: 11, color: 'var(--charcoal)', marginTop: 4 }}>
                        Must match the number you registered with.
                      </p>
                    </div>
                    <div>
                      <label className="label">Complaint Details *</label>
                      <textarea name="complaint" placeholder="Describe your issue in detail…" rows={5} required style={{ resize: 'vertical' }} />
                    </div>
                    <div>
                      <label className="label">Photo (Optional)</label>
                      <input type="file" accept="image/jpeg,image/png,image/webp" style={{ padding: '8px 0', background: 'none', border: 'none', fontSize: 13 }} onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
                    </div>
                    {note && <div className="banner error">{note}</div>}
                    <button type="submit" className="btn" disabled={loading} style={{ marginTop: 4 }}>
                      {loading && <span className="spinner light" />}
                      {loading ? 'Submitting…' : 'Submit Complaint'}
                    </button>
                  </form>
                </>
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
}
