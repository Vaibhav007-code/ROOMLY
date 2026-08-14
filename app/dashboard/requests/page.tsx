'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { getErrorMessage } from '@/lib/errorMessages';

type ApproveStep = null | 'saving' | 'done';

export default function Requests() {
  const s = supabaseBrowser();
  const [items, setItems] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [terms, setTerms] = useState<Record<string, any>>({});
  const [approveState, setApproveState] = useState<Record<string, ApproveStep>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingWa, setPendingWa] = useState<Record<string, string>>({});

  const load = async () => {
    const q = await s
      .from('pending_admissions')
      .select('*,hostels(name)')
      .is('reviewed_at', null)
      .is('rejected_at', null);
    setItems(q.data || []);

    const r = await s.from('rooms').select('id,room_number,bed_capacity,hostel_id,rent_amount');
    const availability = await Promise.all(
      (r.data || []).map(async x => {
        const { data: av } = await s.rpc('available_beds', { room: x.id });
        const availableCount = typeof av === 'number' ? av : x.bed_capacity;
        return { ...x, available: availableCount };
      })
    );
    setRooms(availability);
  };

  useEffect(() => { load(); }, []);

  async function approve(x: any) {
    const t = terms[x.id] || {};
    if (!t.room) return setErrors(v => ({ ...v, [x.id]: 'Choose an available room before approving.' }));

    setErrors(v => ({ ...v, [x.id]: '' }));
    setApproveState(v => ({ ...v, [x.id]: 'saving' }));

    const res = await fetch('/api/admissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        pendingId: x.id,
        roomId: t.room,
        deposit: t.deposit || 0,
        depositDuration: 0,
        contractDuration: t.contractDuration || 11,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setApproveState(v => ({ ...v, [x.id]: null }));
      return setErrors(v => ({ ...v, [x.id]: getErrorMessage(data.error) }));
    }

    // Prepare WhatsApp link but don't auto-open — owner must tap it
    if (data.contractUrl) {
      try {
        const waUrl = buildWhatsAppLink(x.whatsapp_number || x.phone, 'contract', {
          name: x.full_name,
          hostelName: x.hostels?.name,
          contractUrl: data.contractUrl,
          deposit: t.deposit || 0,
          duration: t.contractDuration || 11,
        });
        setPendingWa(v => ({ ...v, [x.id]: waUrl }));
      } catch (e) { /* ignore */ }
    }

    setApproveState(v => ({ ...v, [x.id]: 'done' }));
    load();
  }

  async function reject(x: any) {
    const reason = prompt('Optional rejection reason') || '';
    const { error } = await s.rpc('reject_admission', { p_pending: x.id, p_reason: reason });
    if (error) alert(getErrorMessage(error));
    else load();
  }

  const set = (id: string, key: string, value: any) =>
    setTerms(v => ({ ...v, [id]: { ...v[id], [key]: value } }));

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>New Applications</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--charcoal)' }}>
          Review QR self-registration requests, configure lease terms, and assign residents to available rooms.
        </p>
      </div>

      {items.length === 0 && (
        <div className="empty-state">
          No pending admission requests. Share your hostel QR code to receive self-applications.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map(x => {
          const t = terms[x.id] || {};
          const hostelRooms = rooms.filter(r => r.hostel_id === x.hostel_id && r.available > 0);
          const step = approveState[x.id];
          const isSaving = step === 'saving';
          const isDone = step === 'done';

          return (
            <div className="card" key={x.id}>
              {/* Applicant header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--fog)', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 className="text-clamp" style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>
                    {x.full_name}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--charcoal)', margin: '3px 0 0' }}>
                    📞 {x.phone} · 🏢 {x.hostels?.name}
                    {x.email && ` · ${x.email}`}
                  </p>
                  {x.aadhaar_number && (
                    <p style={{ fontSize: 12, color: 'var(--charcoal)', margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                      Aadhaar: {x.aadhaar_number}
                    </p>
                  )}
                </div>
                <span className="badge badge-pending" style={{ flexShrink: 0, marginLeft: 8 }}>Pending</span>
              </div>

              {/* Lease terms — only show if not done */}
              {!isDone && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,220px),1fr))', gap: 12 }}>
                  <div>
                    <label className="label">Security Deposit (₹)</label>
                    <input type="number" placeholder="5000" onChange={e => set(x.id, 'deposit', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Contract Duration (Months)</label>
                    <input type="number" defaultValue="11" placeholder="11" onChange={e => set(x.id, 'contractDuration', e.target.value)} />
                  </div>
                  <div style={{ gridColumn: 'span 1' }}>
                    <label className="label">Assign Available Room *</label>
                    <select value={t.room || ''} onChange={e => set(x.id, 'room', e.target.value)}>
                      <option value="">Choose Available Room</option>
                      {hostelRooms.map(r => (
                        <option value={r.id} key={r.id}>
                          Room {r.room_number} — {r.available} free / {r.bed_capacity} total
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Feedback */}
              {errors[x.id] && (
                <div className="banner error" style={{ marginTop: 12 }}>{errors[x.id]}</div>
              )}

              {isDone && (
                <div className="banner success" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ flex: 1 }}>✓ Approved &amp; contract generated.</span>
                  {pendingWa[x.id] && (
                    <a
                      href={pendingWa[x.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn signal btn-sm"
                      style={{ textDecoration: 'none' }}
                    >
                      💬 Send Contract on WhatsApp
                    </a>
                  )}
                </div>
              )}

              {/* Actions */}
              {!isDone && (
                <div className="btn-row" style={{ marginTop: 16, borderTop: '1px solid var(--fog)', paddingTop: 12 }}>
                  <button className="btn" onClick={() => approve(x)} disabled={isSaving}>
                    {isSaving && <span className="spinner light" />}
                    {isSaving ? 'Saving…' : 'Approve & Generate Contract'}
                  </button>
                  <button className="btn danger" onClick={() => reject(x)} disabled={isSaving}>
                    Reject Application
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
