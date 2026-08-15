'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import Link from 'next/link';
import { getErrorMessage } from '@/lib/errorMessages';

export default function Student() {
  const s = supabaseBrowser();
  const [st, setSt] = useState<any>();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const u = (await s.auth.getUser()).data.user;
    const { data } = await s
      .from('students')
      .select('*,room_assignments(moved_out_at,rooms(room_number)),rent_payments(*),contracts(*)')
      .eq('auth_user_id', u?.id)
      .single();

    setSt(data);
    if (data) {
      const c = await s.from('complaints').select('*').eq('student_id', data.id).order('created_at', { ascending: false });
      setComplaints(c.data || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function raise(f: FormData) {
    if (!st) return;
    setLoading(true);
    const photo = f.get('photo') as File;
    let photo_path = null;
    if (photo?.size) {
      const u = (await s.auth.getUser()).data.user;
      photo_path = `${u?.id}/${crypto.randomUUID()}-${photo.name}`;
      const x = await s.storage.from('complaint-photos').upload(photo_path, photo);
      if (x.error) {
        setLoading(false);
        return alert(getErrorMessage(x.error));
      }
    }
    const { error } = await s.from('complaints').insert({
      student_id: st.id,
      description: f.get('description'),
      photo_path,
    });
    setLoading(false);
    if (error) {
      alert(getErrorMessage(error));
    } else {
      (document.getElementById('complaint') as HTMLFormElement).reset();
      load();
    }
  }

  if (!st) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--charcoal)', fontSize: 15 }}>Loading resident portal…</p>
    </div>
  );

  const room = st.room_assignments?.find((x: any) => !x.moved_out_at)?.rooms?.room_number;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--cream)', color: 'var(--ink)' }}>
      <header style={{ borderBottom: '1px solid var(--fog)', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(247,247,242,0.92)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18, color: '#16281F' }}>
              R
            </div>
            <div>
              <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 17, color: 'var(--forest-dark)', display: 'block', lineHeight: 1 }}>Roomly</span>
              <span style={{ fontSize: 11, color: 'var(--charcoal)', display: 'block', marginTop: 2 }}>Resident Portal</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="page" style={{ flex: 1, padding: '24px 16px 48px', maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--leaf-end)', display: 'block', marginBottom: 4 }}>
          RESIDENT PORTAL
        </span>
        <h1 style={{ fontSize: 28, margin: 0, color: 'var(--forest-dark)' }}>
          Hi, {st.full_name.split(' ')[0]} 👋
        </h1>

        <section className="card" style={{ marginTop: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', display: 'block', marginBottom: 4 }}>Your Room Assignment</span>
          <p style={{ fontSize: 24, fontFamily: "'Poppins', sans-serif", fontWeight: 700, color: 'var(--forest-dark)', margin: 0 }}>
            {room ? `Room ${room}` : 'Room not assigned'}
          </p>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest-dark)', display: 'block', marginBottom: 12 }}>Rent &amp; Dues Status</span>
          {st.rent_payments?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {st.rent_payments.map((p: any) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '12px 14px', borderRadius: 12, background: 'var(--cream)', border: '1px solid var(--fog)' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.period}</span>
                    <span style={{ color: 'var(--charcoal)', marginLeft: 8, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>Due: {p.due_date}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>₹{p.amount_paid} / ₹{p.amount_due}</span>
                    <span className={`badge ${p.status === 'paid' ? 'badge-paid' : 'badge-due'}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--charcoal)', fontSize: 13, fontStyle: 'italic', margin: 0 }}>No rent payment is due right now.</p>
          )}
        </section>

        <form id="complaint" action={raise} className="card" style={{ marginTop: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest-dark)', display: 'block', marginBottom: 10 }}>Raise a Complaint</span>
          <textarea name="description" placeholder="Describe the issue in your room or hostel..." required rows={3} />
          <div style={{ marginTop: 12 }}>
            <label className="label">Attach Photo (Optional)</label>
            <input name="photo" type="file" accept="image/*" />
          </div>
          <button className="btn" style={{ marginTop: 16, width: '100%' }} disabled={loading}>
            {loading ? 'Submitting…' : 'Send Complaint'}
          </button>
        </form>

        <section style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 16, color: 'var(--forest-dark)', marginBottom: 12 }}>Your Logged Complaints</h3>
          {complaints.length === 0 ? (
            <p style={{ color: 'var(--charcoal)', fontSize: 13, fontStyle: 'italic' }}>No complaints logged.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {complaints.map(c => (
                <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }} key={c.id}>
                  <span style={{ color: 'var(--ink)', fontSize: 14, fontWeight: 500 }}>{c.description}</span>
                  <span className={`badge ${c.status === 'resolved' ? 'badge-resolved' : 'badge-open'}`}>{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
