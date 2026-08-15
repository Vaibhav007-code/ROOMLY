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

  useEffect(() => {
    (async () => {
      const s = supabaseBrowser();

      // Attempt 1: Call SECURITY DEFINER RPC to bypass RLS safely for unauthenticated users
      const { data: rpcData, error: rpcError } = await s.rpc('get_public_hostel_info', { p_id: params.id });

      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        setHostels(rpcData);
        if (rpcData.length === 1) setSelectedHostelId(rpcData[0].id);
        setLoadingHostels(false);
        return;
      }

      // Fallback: Direct table queries (for existing sessions or migration compatibility)
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

  async function submitComplaint(f: FormData) {
    setNote('');
    const phone = String(f.get('phone') || '').trim();
    const text = String(f.get('complaint') || '').trim();
    const room = String(f.get('room') || '').trim();
    const hostel = selectedHostelId || String(f.get('hostel') || '');

    if (!hostel) return setNote('Please select a hostel.');
    if (!phone) return setNote('Please enter your phone number.');
    if (!text) return setNote('Please describe your complaint.');

    try { normalisePhone(phone); } catch (e) { return setNote(getErrorMessage(e)); }

    setLoading(true);
    const photoPath: string | null = null;

    const { error } = await supabaseBrowser().rpc('submit_public_complaint', {
      p_hostel: hostel,
      p_phone: phone,
      p_text: text,
      p_photo: photoPath,
      p_room: room || null,
    });
    setLoading(false);
    if (error) setNote(getErrorMessage(error)); else setDone(true);
  }

  const hostelSelector = hostels.length > 1 ? (
    <div>
      <label className="label" style={{ color: '#E4E8E1' }}>Select Hostel *</label>
      <select
        name="hostel"
        required
        value={selectedHostelId}
        onChange={e => setSelectedHostelId(e.target.value)}
        style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }}
      >
        <option value="" style={{ background: '#16281F', color: '#FFF' }}>Choose your hostel…</option>
        {hostels.map(h => (
          <option key={h.id} value={h.id} style={{ background: '#16281F', color: '#FFF' }}>{h.name}</option>
        ))}
      </select>
    </div>
  ) : null;

  const headerSubtitle = mode === 'admission' ? 'Resident Registration'
    : mode === 'complaint' ? 'Resident Complaint'
    : 'Self-Service Portal';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #16281F 0%, #0D1813 100%)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid rgba(168, 217, 143, 0.15)', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'var(--primary-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18, color: '#16281F',
            }}>R</div>
            <div>
              <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 17, color: '#F7F7F2', display: 'block', lineHeight: 1 }}>Roomly</span>
              <span style={{ fontSize: 12, color: '#A8D98F', display: 'block', marginTop: 2 }}>{headerSubtitle}</span>
            </div>
          </Link>
          {mode !== 'choose' && (
            <button
              onClick={() => { setMode('choose'); setDone(false); setNote(''); setSelectedHostelId(hostels.length === 1 ? hostels[0].id : ''); }}
              style={{ background: 'none', border: 'none', color: '#A8D98F', fontSize: 13, cursor: 'pointer', padding: '4px 8px' }}
            >
              ← Back
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px 80px' }}>
        {loadingHostels ? (
          <div style={{ color: '#A8D98F', textAlign: 'center' }}>Loading…</div>
        ) : hostels.length === 0 ? (
          <div className="glass-card" style={{ width: '100%', maxWidth: 440, textAlign: 'center', padding: 32 }}>
            <h3 style={{ fontSize: 20, color: '#F7F7F2', marginBottom: 8 }}>No Active Hostels Found</h3>
            <p style={{ color: '#A8D98F', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              There are no registered hostels associated with this link yet. Please contact your hostel management team for assistance.
            </p>
          </div>
        ) : (
          mode === 'choose' ? (
            <div className="glass-card" style={{ width: '100%', maxWidth: 440 }}>
              <h1 style={{ fontSize: 24, marginBottom: 6, textAlign: 'center', color: '#F7F7F2' }}>
                {hostels[0]?.name || 'Hostel'}
                {hostels.length > 1 ? ' & More' : ''}
              </h1>
              <p style={{ fontSize: 14, color: '#A8D98F', textAlign: 'center', marginBottom: 28 }}>
                What would you like to do?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <button
                  className="btn"
                  style={{ fontSize: 16, minHeight: 52 }}
                  onClick={() => setMode('admission')}
                >
                  🏠 Apply for a Room
                </button>
                <button
                  className="btn secondary"
                  style={{ fontSize: 16, minHeight: 52, background: 'rgba(255,255,255,0.12)', color: '#F7F7F2' }}
                  onClick={() => setMode('complaint')}
                >
                  💬 Raise a Complaint
                </button>
              </div>
            </div>
          ) : mode === 'admission' ? (
            <div className="glass-card" style={{ width: '100%', maxWidth: 480 }}>
              {done ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--primary-gradient)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#16281F', fontWeight: 'bold' }}>✓</div>
                  <h1 style={{ fontSize: 24, marginBottom: 8, color: '#F7F7F2' }}>Application Received!</h1>
                  <p style={{ color: '#A8D98F', fontSize: 14 }}>
                    The hostel manager will review your details and contact you shortly.
                  </p>
                </div>
              ) : (
                <>
                  <h1 style={{ fontSize: 24, marginBottom: 4, color: '#F7F7F2' }}>Apply for a Room</h1>
                  <p style={{ fontSize: 13, color: '#A8D98F', marginBottom: 20 }}>
                    Your details go directly to the hostel manager.
                  </p>
                  <form action={submitAdmission} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {hostelSelector}
                    <div>
                      <label className="label" style={{ color: '#E4E8E1' }}>Full Name *</label>
                      <input name="name" placeholder="John Doe" required style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                    </div>
                    <div>
                      <label className="label" style={{ color: '#E4E8E1' }}>Phone Number *</label>
                      <input name="phone" placeholder="9876543210" inputMode="tel" required style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                    </div>
                    <div>
                      <label className="label" style={{ color: '#E4E8E1' }}>WhatsApp Number</label>
                      <input name="whatsapp" placeholder="Leave blank if same as phone" inputMode="tel" style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                    </div>
                    <div>
                      <label className="label" style={{ color: '#E4E8E1' }}>Email Address (Optional)</label>
                      <input name="email" type="email" placeholder="john@example.com" style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                    </div>
                    <div>
                      <label className="label" style={{ color: '#E4E8E1' }}>Aadhaar Number (Optional)</label>
                      <input name="aadhaar" placeholder="12-digit Aadhaar" maxLength={12} inputMode="numeric" pattern="\d{12}" style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                    </div>
                    {note && <div className="banner error">{note}</div>}
                    <button type="submit" className="btn" disabled={loading} style={{ marginTop: 8, width: '100%' }}>
                      {loading && <span className="spinner light" />}
                      {loading ? 'Submitting…' : 'Send Application'}
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            <div className="glass-card" style={{ width: '100%', maxWidth: 480 }}>
              {done ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-gradient)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#16281F', fontWeight: 'bold' }}>✓</div>
                  <h1 style={{ fontSize: 24, marginBottom: 8, color: '#F7F7F2' }}>Complaint Submitted</h1>
                  <p style={{ color: '#A8D98F', fontSize: 14, lineHeight: 1.6 }}>
                    Thank you. The hostel management team has received your complaint and will look into it shortly.
                  </p>
                </div>
              ) : (
                <>
                  <h1 style={{ fontSize: 24, marginBottom: 4, color: '#F7F7F2' }}>Raise a Complaint</h1>
                  <p style={{ fontSize: 13, color: '#A8D98F', marginBottom: 20 }}>
                    Enter your registered phone number and describe your issue.
                  </p>
                  <form action={submitComplaint} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {hostelSelector}
                    <div>
                      <label className="label" style={{ color: '#E4E8E1' }}>Your Phone Number *</label>
                      <input name="phone" placeholder="9876543210" inputMode="tel" required autoComplete="tel" style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                      <p style={{ fontSize: 11, color: '#C2CBC5', marginTop: 4 }}>
                        Must match the number you registered with.
                      </p>
                    </div>
                    <div>
                      <label className="label" style={{ color: '#E4E8E1' }}>Room Number (Optional)</label>
                      <input name="room" placeholder="e.g. 102 or B-204" style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                      <p style={{ fontSize: 11, color: '#C2CBC5', marginTop: 4 }}>
                        Helps management verify your identity and locate your room quickly.
                      </p>
                    </div>
                    <div>
                      <label className="label" style={{ color: '#E4E8E1' }}>Complaint Details *</label>
                      <textarea name="complaint" placeholder="Describe your issue in detail…" rows={5} required style={{ resize: 'vertical', background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(168, 217, 143, 0.3)' }} />
                    </div>
                    {note && <div className="banner error">{note}</div>}
                    <button type="submit" className="btn" disabled={loading} style={{ marginTop: 8, width: '100%' }}>
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
