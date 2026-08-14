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

  if (!st) return <main className="page text-slate-400">Loading resident portal…</main>;

  const room = st.room_assignments?.find((x: any) => !x.moved_out_at)?.rooms?.room_number;

  return (
    <div className="min-h-screen flex flex-col bg-navy-900 text-slate-100">
      <header className="w-full bg-navy-850/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-decoration-none">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-lg">
              R
            </div>
            <div>
              <span className="font-bold text-lg text-slate-100 block leading-none">Roomly</span>
              <span className="text-xs text-slate-400 block mt-0.5">Resident Portal</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="page">
        <span className="text-indigo-400 font-bold text-xs uppercase tracking-wider block">RESIDENT PORTAL</span>
        <h1 className="text-3xl font-bold text-slate-100 mt-1">Hi, {st.full_name.split(' ')[0]} 👋</h1>

        <section className="card mt-4">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Your Room Assignment</span>
          <p className="text-2xl font-bold text-slate-100">{room ? `Room ${room}` : 'Room not assigned'}</p>
        </section>

        <section className="card mt-4">
          <span className="text-xs font-semibold text-slate-400 block mb-2">Rent &amp; Dues Status</span>
          {st.rent_payments?.length ? (
            <div className="space-y-2">
              {st.rent_payments.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center text-xs p-2.5 rounded bg-navy-850 border border-slate-800">
                  <div>
                    <span className="font-semibold text-slate-200">{p.period}</span>
                    <span className="text-slate-400 ml-2">Due: {p.due_date}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-200">₹{p.amount_paid} / ₹{p.amount_due}</span>
                    <span className={`badge ml-2 ${p.status === 'paid' ? 'badge-paid' : 'badge-due'}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-xs italic">No rent payment is due right now.</p>
          )}
        </section>

        <form id="complaint" action={raise} className="card mt-4">
          <span className="text-xs font-semibold text-slate-400 block mb-2">Raise a Complaint</span>
          <textarea className="mt-1" name="description" placeholder="Describe the issue in your room or hostel..." required rows={3} />
          <div className="mt-2">
            <label className="label">Attach Photo (Optional)</label>
            <input name="photo" type="file" accept="image/*" className="text-xs" />
          </div>
          <button className="btn mt-3 text-sm" disabled={loading}>
            {loading ? 'Submitting…' : 'Send Complaint'}
          </button>
        </form>

        <section className="mt-6">
          <h3 className="font-bold text-slate-100 text-base mb-3">Your Logged Complaints</h3>
          {complaints.length === 0 ? (
            <p className="text-slate-400 text-xs italic">No complaints logged.</p>
          ) : (
            <div className="space-y-2">
              {complaints.map(c => (
                <div className="card flex justify-between items-center text-xs" key={c.id}>
                  <span className="text-slate-200 font-medium">{c.description}</span>
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
