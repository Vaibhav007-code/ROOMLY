'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { buildWhatsAppLink, normalisePhone } from '@/lib/whatsapp';
import { useSearchParams } from 'next/navigation';
import { getErrorMessage } from '@/lib/errorMessages';

// ─── Move-Out Modal ─────────────────────────────────────────────────────────
type MoveOutTarget = { id: string; full_name: string; room?: string; hostel?: string } | null;

function MoveOutModal({
  target,
  onConfirm,
  onCancel,
}: {
  target: MoveOutTarget;
  onConfirm: (date: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  if (!target) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
          Confirm Move Out
        </h3>
        <p style={{ fontSize: 14, color: 'var(--charcoal)', marginBottom: 16 }}>
          This will mark <strong style={{ color: 'var(--ink)' }}>{target.full_name}</strong> as moved out,
          free up{target.room ? ` Room ${target.room}` : ' their room'}, and remove them from active rent queues.
          <br />
          <span style={{ fontSize: 12 }}>Full history (rent, complaints, contracts) is preserved.</span>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Move-Out Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Reason / Note (optional)</label>
            <input placeholder="e.g. Contract ended, shifted to another city" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 20 }}>
          <button className="btn danger" onClick={() => onConfirm(date, reason)}>Confirm Move Out</button>
          <button className="btn secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Student Detail Drawer ───────────────────────────────────────────────────
function StudentDetailDrawer({
  student,
  onClose,
}: {
  student: any;
  onClose: () => void;
}) {
  if (!student) return null;
  const activeAssignment = student.room_assignments?.find((r: any) => !r.moved_out_at);
  const isActive = student.status === 'active';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--fog)', paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, margin: 0 }}>
              {student.full_name}
            </h3>
            <span className={`badge ${isActive ? 'badge-active' : 'badge-inactive'}`} style={{ marginTop: 4 }}>
              {student.status} Resident
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--charcoal)', cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>

        {/* Contact Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, background: 'var(--fog)', borderRadius: 6, padding: 12 }}>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Phone</span><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 14 }}>{student.phone}</span></div>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>WhatsApp</span><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 14 }}>{student.whatsapp_number || student.phone}</span></div>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Email</span><span style={{ fontSize: 14 }}>{student.email || '—'}</span></div>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Admission</span><span style={{ fontSize: 14 }}>{student.admission_date}</span></div>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Security Deposit</span><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 14 }}>₹{student.security_deposit}</span></div>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Contract</span><span style={{ fontSize: 14 }}>{student.contract_duration_months} months</span></div>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Room</span><span style={{ fontSize: 14 }}>{activeAssignment?.rooms?.room_number || '—'}</span></div>
          {student.aadhaar_number && (
            <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Aadhaar</span><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{student.aadhaar_number}</span></div>
          )}
        </div>

        <button onClick={onClose} className="btn secondary btn-sm" style={{ width: '100%' }}>Close</button>
      </div>
    </div>
  );
}

// ─── Add Student Loading States ──────────────────────────────────────────────
type AddStep = null | 'adding' | 'contract' | 'done';

const ADD_STEPS: Record<NonNullable<AddStep>, string> = {
  adding: 'Adding student…',
  contract: 'Generating contract…',
  done: 'Contract ready — tap to send on WhatsApp',
};

// ─── Main Component ──────────────────────────────────────────────────────────
function StudentsContent() {
  const s = supabaseBrowser();
  const searchParams = useSearchParams();
  const paramHostelId = searchParams.get('hostelId') || '';
  const paramRoomId = searchParams.get('roomId') || '';
  const formRef = useRef<HTMLFormElement>(null);

  const [students, setStudents] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostel, setSelectedHostel] = useState(paramHostelId);
  const [selectedRoom, setSelectedRoom] = useState(paramRoomId);

  const [addStep, setAddStep] = useState<AddStep>(null);
  const [addError, setAddError] = useState('');
  const [pendingWaLink, setPendingWaLink] = useState('');

  const [moveOutTarget, setMoveOutTarget] = useState<MoveOutTarget>(null);
  const [detailStudent, setDetailStudent] = useState<any | null>(null);

  const load = async () => {
    const q = await s
      .from('students')
      .select('*,hostels(name),room_assignments(room_id,moved_in_at,moved_out_at,rooms(room_number))')
      .order('full_name');
    setStudents(q.data || []);

    const h = await s.from('hostels').select('id,name');
    setHostels(h.data || []);

    const r = await s.from('rooms').select('id,room_number,hostel_id,bed_capacity');
    const withAvail = await Promise.all(
      (r.data || []).map(async (x: any) => {
        const { data: av } = await s.rpc('available_beds', { room: x.id });
        const availableCount = typeof av === 'number' ? av : x.bed_capacity;
        return { ...x, available: availableCount };
      })
    );
    setRooms(withAvail);

    if (paramHostelId) setSelectedHostel(paramHostelId);
    if (paramRoomId) setSelectedRoom(paramRoomId);
  };

  useEffect(() => { load(); }, [paramHostelId, paramRoomId]);

  async function add(f: FormData) {
    const phone = String(f.get('phone') || '');
    const whatsapp = String(f.get('whatsapp') || '') || phone;

    try { normalisePhone(phone); } catch (e) { return setAddError(getErrorMessage(e)); }
    try { normalisePhone(whatsapp); } catch (e) { return setAddError(getErrorMessage(e)); }

    // Aadhaar validation (12 digits, optional)
    const aadhaar = String(f.get('aadhaar') || '').replace(/\s/g, '');
    if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
      return setAddError('Aadhaar number must be exactly 12 digits.');
    }

    setAddError('');
    setAddStep('adding');
    setPendingWaLink('');

    const body = {
      action: 'manual',
      name: f.get('name'),
      phone,
      email: f.get('email'),
      whatsapp,
      hostelId: f.get('hostel'),
      roomId: f.get('room'),
      admissionDate: f.get('admissionDate'),
      deposit: f.get('deposit'),
      contractDuration: f.get('contractDuration'),
      aadhaar: aadhaar || undefined,
    };

    const res = await fetch('/api/admissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      setAddStep(null);
      return setAddError(data.error || 'Failed to add student');
    }

    setAddStep('contract');
    await new Promise(r => setTimeout(r, 600)); // brief pause to show "Generating contract…"

    if (data.contractUrl) {
      const hostelObj = hostels.find((x: any) => x.id === body.hostelId);
      try {
        const waUrl = buildWhatsAppLink(whatsapp, 'contract', {
          name: String(body.name),
          hostelName: hostelObj?.name,
          contractUrl: data.contractUrl,
          deposit: Number(body.deposit || 0),
          duration: Number(body.contractDuration || 11),
        });
        setPendingWaLink(waUrl);
      } catch (e) { /* ignore */ }
    }

    setAddStep('done');
    formRef.current?.reset();
    setSelectedHostel(paramHostelId);
    setSelectedRoom(paramRoomId);
    load();
  }

  async function triggerInvite(st: any) {
    const res = await fetch('/api/admissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invite', studentId: st.id }),
    });
    const data = await res.json();
    if (!res.ok) return setAddError(data.error || 'Failed to generate invite');
    try {
      window.open(
        buildWhatsAppLink(st.whatsapp_number || st.phone, 'student_invite', {
          name: st.full_name,
          hostelName: st.hostels?.name,
          inviteUrl: data.inviteUrl,
        }),
        '_blank'
      );
    } catch (e) { /* ignore */ }
  }

  async function triggerContractRegen(st: any) {
    const res = await fetch('/api/admissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate', studentId: st.id }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Failed to regenerate contract');
    try {
      window.open(
        buildWhatsAppLink(st.whatsapp_number || st.phone, 'contract', {
          name: st.full_name,
          hostelName: st.hostels?.name,
          contractUrl: data.contractUrl,
          deposit: st.security_deposit || 0,
          duration: st.contract_duration_months || 11,
        }),
        '_blank'
      );
    } catch (e) { /* ignore */ }
  }

  async function doMoveOut(date: string, reason: string) {
    if (!moveOutTarget) return;
    const { error } = await s.rpc('move_out_student', { p_student: moveOutTarget.id });
    setMoveOutTarget(null);
    if (error) return alert(getErrorMessage(error));
    if (reason) {
      await s.from('complaints').insert({
        student_id: moveOutTarget.id,
        description: `[Move-Out Note — ${date}]: ${reason}`,
      }).then(() => {});
    }
    load();
  }

  function csv() {
    const rows = students.map((x: any) => {
      const activeAssignment = x.room_assignments?.find((r: any) => !r.moved_out_at);
      return {
        full_name: x.full_name,
        phone: x.phone,
        whatsapp_number: x.whatsapp_number,
        email: x.email || '',
        status: x.status,
        admission_date: x.admission_date,
        security_deposit: x.security_deposit,
        contract_duration_months: x.contract_duration_months,
        hostel: x.hostels?.name || '',
        room: activeAssignment?.rooms?.room_number || '',
      };
    });
    const header = Object.keys(rows[0] || {}).join(',');
    const body = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roomly_residents_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const filteredRooms = rooms.filter((r: any) => (!selectedHostel || r.hostel_id === selectedHostel) && r.available > 0);
  const isAdding = addStep !== null && addStep !== 'done';

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Residents Directory</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>Manage active residents, manual admissions, and CSV exports.</p>
        </div>
        <button className="btn secondary btn-sm" onClick={csv} style={{ flexShrink: 0 }}>
          ↓ Export CSV
        </button>
      </div>

      {/* ── Add Resident Form ── */}
      <form ref={formRef} action={add} className="card" style={{ marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Add Resident Manually</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--charcoal)' }}>
          Creates a student record, generates a contract PDF, and prepares a WhatsApp link for you to send.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,240px),1fr))', gap: 12 }}>
          <div>
            <label className="label">Full Name *</label>
            <input name="name" placeholder="Rahul Sharma" required />
          </div>
          <div>
            <label className="label">Phone Number *</label>
            <input name="phone" placeholder="9876543210" required />
          </div>
          <div>
            <label className="label">WhatsApp Number</label>
            <input name="whatsapp" placeholder="Leave blank if same as phone" />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input name="email" type="email" placeholder="rahul@example.com" />
          </div>
          <div>
            <label className="label">Aadhaar Number (optional)</label>
            <input
              name="aadhaar"
              placeholder="12-digit Aadhaar"
              maxLength={12}
              inputMode="numeric"
              pattern="\d{12}"
            />
          </div>

          <div>
            <label className="label">Hostel *</label>
            <select
              name="hostel"
              required
              value={selectedHostel}
              onChange={e => { setSelectedHostel(e.target.value); setSelectedRoom(''); }}
            >
              <option value="">Select Hostel</option>
              {hostels.map((h: any) => (
                <option value={h.id} key={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Available Room *</label>
            <select name="room" required value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}>
              <option value="">Select Available Room</option>
              {filteredRooms.map((r: any) => (
                <option value={r.id} key={r.id}>
                  Room {r.room_number} ({r.bed_capacity - r.available}/{r.bed_capacity} occupied, {r.available} free)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Admission Date</label>
            <input name="admissionDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </div>

          <div>
            <label className="label">Security Deposit (₹)</label>
            <input name="deposit" type="number" defaultValue="5000" required />
          </div>

          <div>
            <label className="label">Contract Duration (Months)</label>
            <input name="contractDuration" type="number" defaultValue="11" required />
          </div>
        </div>

        {/* Loading feedback */}
        {addStep && (
          <div className={`banner ${addStep === 'done' ? 'success' : 'info'}`} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            {isAdding && <span className="spinner" />}
            {addStep !== 'done' ? (
              <span>{ADD_STEPS[addStep]}</span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, width: '100%' }}>
                <span style={{ flex: 1 }}>✓ Resident added &amp; contract generated.</span>
                {pendingWaLink && (
                  <a
                    href={pendingWaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn signal btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    💬 Send Contract on WhatsApp
                  </a>
                )}
                <button type="button" className="btn secondary btn-sm" onClick={() => { setAddStep(null); setPendingWaLink(''); }}>
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}

        {addError && (
          <div className="banner error" style={{ marginTop: 12 }}>{addError}</div>
        )}

        <div style={{ marginTop: 20 }}>
          <button type="submit" className="btn" disabled={isAdding}>
            {isAdding && <span className="spinner light" />}
            {isAdding ? ADD_STEPS[addStep!] : 'Add Resident & Generate Agreement'}
          </button>
        </div>
      </form>

      {/* ── Residents List ── */}
      <div>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>All Residents ({students.length})</h2>

        {students.length === 0 && (
          <div className="empty-state">
            No residents added yet. Use the form above or approve incoming registration requests.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {students.map((x: any) => {
            const activeAssignment = x.room_assignments?.find((r: any) => !r.moved_out_at);
            const isActive = x.status === 'active';
            return (
              <div
                className="card"
                key={x.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  opacity: isActive ? 1 : 0.65,
                }}
              >
                {/* Top: name + badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span
                        className="text-clamp"
                        style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}
                      >
                        {x.full_name}
                      </span>
                      <span className={`badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
                        {x.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--charcoal)', marginTop: 3 }}>
                      📞 {x.phone}{x.email && ` · ${x.email}`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--charcoal)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <span>
                        🏢 <b>{x.hostels?.name}</b>
                      </span>
                      {activeAssignment?.rooms?.room_number ? (
                        <span className="room-tag available" style={{ fontSize: 11 }}>
                          Room {activeAssignment.rooms.room_number}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--charcoal)' }}>{isActive ? 'Unassigned' : '—'}</span>
                      )}
                      <span>Admitted {x.admission_date}</span>
                    </div>
                  </div>
                  <button
                    className="btn secondary btn-sm"
                    onClick={() => setDetailStudent(x)}
                    style={{ flexShrink: 0, fontSize: 12 }}
                  >
                    View Details
                  </button>
                </div>

                {/* Bottom: actions */}
                {isActive && (
                  <div className="btn-row" style={{ borderTop: '1px solid var(--fog)', paddingTop: 10 }}>
                    <button className="btn secondary btn-sm" onClick={() => triggerInvite(x)}>
                      📲 Send Login Link
                    </button>
                    <button className="btn secondary btn-sm" onClick={() => triggerContractRegen(x)}>
                      📄 Contract PDF
                    </button>
                    <button
                      className="btn danger btn-sm"
                      onClick={() => setMoveOutTarget({
                        id: x.id,
                        full_name: x.full_name,
                        room: activeAssignment?.rooms?.room_number,
                        hostel: x.hostels?.name,
                      })}
                    >
                      🚪 Move Out
                    </button>
                  </div>
                )}
                {!isActive && (
                  <p style={{ fontSize: 12, color: 'var(--charcoal)', fontStyle: 'italic', margin: 0 }}>
                    Moved out · History preserved
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <MoveOutModal target={moveOutTarget} onConfirm={doMoveOut} onCancel={() => setMoveOutTarget(null)} />
      {detailStudent && <StudentDetailDrawer student={detailStudent} onClose={() => setDetailStudent(null)} />}
    </div>
  );
}

export default function Students() {
  return (
    <Suspense fallback={<div className="page" style={{ color: 'var(--charcoal)', paddingTop: 80 }}>Loading directory…</div>}>
      <StudentsContent />
    </Suspense>
  );
}
