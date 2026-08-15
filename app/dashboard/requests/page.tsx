'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { getErrorMessage } from '@/lib/errorMessages';

type ApproveStep = null | 'saving' | 'done';
type Tab = 'pending' | 'awaiting_signoff' | 'flagged';

export default function Requests() {
  const s = supabaseBrowser();
  const [items, setItems] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'manager' | null>(null);
  const [terms, setTerms] = useState<Record<string, any>>({});
  const [approveState, setApproveState] = useState<Record<string, ApproveStep>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingWa, setPendingWa] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<Tab>('pending');

  const [queryError, setQueryError] = useState<string | null>(null);

  const load = async () => {
    setQueryError(null);

    // Check current user role
    const { data: { user } } = await s.auth.getUser();
    if (user) {
      const { data: profile } = await s.from('profiles').select('role').eq('id', user.id).single();
      setUserRole(profile?.role || 'owner');
    }

    // Load pending admissions (unreviewed OR reviewed by manager but pending owner signoff OR flagged)
    const q = await s
      .from('pending_admissions')
      .select('*,hostels(name)')
      .is('rejected_at', null)
      .order('requested_at', { ascending: false });

    if (q.error) {
      console.error('[Pending Admissions Query Error]:', q.error);
      setQueryError(getErrorMessage(q.error));
      setItems([]);
    } else {
      setItems(q.data || []);
    }

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

  // Primary Approval (Manager or Owner)
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
        window.open(waUrl, '_blank');
      } catch (e) { /* ignore */ }
    }

    setApproveState(v => ({ ...v, [x.id]: 'done' }));
    load();
  }

  // Owner Final Sign-Off (Audit step)
  async function ownerSignoff(x: any) {
    const { error } = await s.rpc('owner_signoff_admission', { p_pending: x.id });
    if (error) {
      alert(getErrorMessage(error));
    } else {
      load();
    }
  }

  // Owner Flag for Review
  async function flagForReview(x: any) {
    const reason = prompt('Reason for flagging this admission for review:') || '';
    if (!reason.trim()) return;
    const { error } = await s.rpc('flag_admission_for_review', { p_pending: x.id, p_reason: reason });
    if (error) {
      alert(getErrorMessage(error));
    } else {
      load();
    }
  }

  async function reject(x: any) {
    const reason = prompt('Optional rejection reason') || '';
    const { error } = await s.rpc('reject_admission', { p_pending: x.id, p_reason: reason });
    if (error) alert(getErrorMessage(error));
    else load();
  }

  const set = (id: string, key: string, value: any) =>
    setTerms(v => ({ ...v, [id]: { ...v[id], [key]: value } }));

  // Tab filtering
  const pendingItems = items.filter(x => !x.reviewed_at && !x.flag_for_review);
  const awaitingSignoffItems = items.filter(x => x.manager_approved_at && !x.owner_approved_at && !x.flag_for_review);
  const flaggedItems = items.filter(x => x.flag_for_review);

  const currentTabItems =
    activeTab === 'pending' ? pendingItems :
    activeTab === 'awaiting_signoff' ? awaitingSignoffItems : flaggedItems;

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Admission Applications</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--charcoal)' }}>
          {userRole === 'manager'
            ? 'Review and approve resident applications. Activated residents will await owner sign-off.'
            : 'Review self-applications, provide final owner sign-off on manager approvals, or flag items.'}
        </p>
      </div>

      {queryError && (
        <div className="banner error" style={{ marginBottom: 20 }}>
          ⚠️ Could not load applications: {queryError}. Try refreshing the page.
        </div>
      )}

      {/* Workflow Tabs */}
      <div className="btn-row" style={{ marginBottom: 20 }}>
        <button
          className={`btn ${activeTab === 'pending' ? '' : 'secondary'} btn-sm`}
          onClick={() => setActiveTab('pending')}
        >
          New Applications ({pendingItems.length})
        </button>
        <button
          className={`btn ${activeTab === 'awaiting_signoff' ? '' : 'secondary'} btn-sm`}
          onClick={() => setActiveTab('awaiting_signoff')}
        >
          Awaiting Owner Sign-Off ({awaitingSignoffItems.length})
        </button>
        <button
          className={`btn ${activeTab === 'flagged' ? '' : 'secondary'} btn-sm`}
          onClick={() => setActiveTab('flagged')}
        >
          Flagged for Review ({flaggedItems.length})
        </button>
      </div>

      {currentTabItems.length === 0 && (
        <div className="empty-state">
          {activeTab === 'pending' && 'No new pending admission requests.'}
          {activeTab === 'awaiting_signoff' && 'No admissions currently awaiting owner sign-off.'}
          {activeTab === 'flagged' && 'No admissions flagged for review.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {currentTabItems.map(x => {
          const t = terms[x.id] || {};
          const hostelRooms = rooms.filter(r => r.hostel_id === x.hostel_id && r.available > 0);
          const step = approveState[x.id];
          const isSaving = step === 'saving';
          const isDone = step === 'done';

          return (
            <div className="card" key={x.id}>
              {/* Header */}
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
                <div>
                  {x.flag_for_review ? (
                    <span className="badge badge-open" style={{ flexShrink: 0, background: 'rgba(255,100,100,0.15)', color: '#ff6666', border: '1px solid rgba(255,100,100,0.3)' }}>Flagged</span>
                  ) : x.manager_approved_at && !x.owner_approved_at ? (
                    <span className="badge badge-pending" style={{ flexShrink: 0, background: 'rgba(245,197,24,0.15)', color: 'var(--signal)', border: '1px solid rgba(245,197,24,0.3)' }}>Manager Approved</span>
                  ) : x.owner_approved_at ? (
                    <span className="badge badge-resolved" style={{ flexShrink: 0 }}>Fully Signed Off</span>
                  ) : (
                    <span className="badge badge-pending" style={{ flexShrink: 0 }}>Pending</span>
                  )}
                </div>
              </div>

              {/* Status Audit Info */}
              {(x.manager_approved_at || x.flag_reason) && (
                <div style={{ marginBottom: 14, fontSize: 12, background: 'var(--paper)', padding: 10, borderRadius: 6, border: '1px solid var(--fog)' }}>
                  {x.manager_approved_at && (
                    <p style={{ margin: 0, color: 'var(--charcoal)' }}>
                      ✓ <strong>Manager approved</strong> on {new Date(x.manager_approved_at).toLocaleDateString('en-IN')}. Student active &amp; room assigned.
                    </p>
                  )}
                  {x.flag_reason && (
                    <p style={{ margin: '4px 0 0', color: '#ff8080' }}>
                      ⚠️ <strong>Flag reason:</strong> {x.flag_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Lease terms for new pending items */}
              {activeTab === 'pending' && !isDone && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,220px),1fr))', gap: 12, width: '100%' }}>
                  <div style={{ minWidth: 0 }}>
                    <label className="label">Security Deposit (₹)</label>
                    <input type="number" placeholder="5000" onChange={e => set(x.id, 'deposit', e.target.value)} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label className="label">Contract Duration (Months)</label>
                    <input type="number" defaultValue="11" placeholder="11" onChange={e => set(x.id, 'contractDuration', e.target.value)} />
                  </div>
                  <div style={{ minWidth: 0, gridColumn: 'span 1' }}>
                    <label className="label">Assign Available Room *</label>
                    <select value={t.room || ''} onChange={e => set(x.id, 'room', e.target.value)} style={{ width: '100%', maxWidth: '100%' }}>
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

              {/* Actions based on tab & role */}
              <div className="btn-row" style={{ marginTop: 16, borderTop: '1px solid var(--fog)', paddingTop: 12 }}>
                {activeTab === 'pending' && !isDone && (
                  <>
                    <button className="btn" onClick={() => approve(x)} disabled={isSaving}>
                      {isSaving && <span className="spinner light" />}
                      {isSaving ? 'Saving…' : 'Approve & Activate Resident'}
                    </button>
                    <button className="btn danger" onClick={() => reject(x)} disabled={isSaving}>
                      Reject Application
                    </button>
                  </>
                )}

                {activeTab === 'awaiting_signoff' && (
                  <>
                    <button className="btn" onClick={() => ownerSignoff(x)}>
                      ✓ Owner Final Sign-Off
                    </button>
                    <button className="btn secondary" onClick={() => flagForReview(x)}>
                      ⚠️ Flag for Review
                    </button>
                  </>
                )}

                {activeTab === 'flagged' && (
                  <>
                    <button className="btn" onClick={() => ownerSignoff(x)}>
                      ✓ Clear &amp; Sign-Off
                    </button>
                    <button className="btn danger" onClick={() => reject(x)}>
                      Reject &amp; Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
