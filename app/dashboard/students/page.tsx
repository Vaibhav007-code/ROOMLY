'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { buildWhatsAppLink, normalisePhone } from '@/lib/whatsapp';
import { useSearchParams, useRouter } from 'next/navigation';
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
        <p style={{ fontSize: 14, color: 'var(--charcoal)', marginBottom: 16, lineHeight: 1.5 }}>
          Are you sure? This will mark <strong style={{ color: 'var(--ink)' }}>{target.full_name}</strong> as moved out,
          free up{target.room ? ` Room ${target.room}` : ' their room'}, and remove them from active rent queues.
          <br />
          <span style={{ fontSize: 12, color: 'var(--signal)' }}>Full history (rent, complaints, contracts) will be preserved in Former Residents.</span>
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

// ─── Student Detail Drawer with Complete Action Cards Grid ────────────────────
function StudentDetailDrawer({
  student,
  rooms,
  onClose,
  onInvite,
  onContract,
  onReminder,
  onMoveOut,
  onUpdateDepositStatus,
}: {
  student: any;
  rooms: any[];
  onClose: () => void;
  onInvite: (st: any) => void;
  onContract: (st: any) => void;
  onReminder: (st: any) => void;
  onMoveOut: (st: any) => void;
  onUpdateDepositStatus: (stId: string, status: string, notes: string) => void;
}) {
  const router = useRouter();
  const s = supabaseBrowser();
  const [transferRoomId, setTransferRoomId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  // Deposit tracking state (Section 5)
  const [depStatus, setDepStatus] = useState(student?.deposit_status || 'pending');
  const [depNotes, setDepNotes] = useState(student?.deposit_notes || '');

  if (!student) return null;
  const activeAssignment = student.room_assignments?.find((r: any) => !r.moved_out_at);
  const isActive = student.status === 'active';

  // Room transfer handler
  async function handleTransfer() {
    if (!transferRoomId) return alert('Please choose a room to transfer to');
    setTransferring(true);
    const { error } = await s.rpc('assign_room', { p_student: student.id, p_room: transferRoomId });
    setTransferring(false);
    if (error) {
      alert(getErrorMessage(error));
    } else {
      alert('Room transferred successfully!');
      onClose();
      window.location.reload();
    }
  }

  // Calculate duration of stay
  function calculateStayDuration() {
    const start = new Date(student.admission_date);
    const end = student.moved_out_at ? new Date(student.moved_out_at) : new Date();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const remainingDays = diffDays % 30;
    return `${months > 0 ? `${months} month${months > 1 ? 's' : ''} ` : ''}${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--fog)', paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, margin: 0 }}>
              {student.full_name}
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span className={`badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
                {student.status} Resident
              </span>
              <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>
                🏢 {student.hostels?.name}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--charcoal)', cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>

        {/* Contact & Tenancy Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, background: 'var(--fog)', borderRadius: 6, padding: 12 }}>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Phone</span><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 13 }}>{student.phone}</span></div>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>WhatsApp</span><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 13 }}>{student.whatsapp_number || student.phone}</span></div>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Admission Date</span><span style={{ fontSize: 13 }}>{student.admission_date}</span></div>
          <div>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Stay Duration</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--signal)' }}>{calculateStayDuration()}</span>
          </div>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Security Deposit</span><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 13 }}>₹{student.security_deposit}</span></div>
          <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Current Room</span><span style={{ fontSize: 13, fontWeight: 600 }}>{activeAssignment?.rooms?.room_number || '—'}</span></div>
          {student.aadhaar_number && (
            <div style={{ gridColumn: 'span 2' }}><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Aadhaar</span><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{student.aadhaar_number}</span></div>
          )}
        </div>

        {/* ──────────────────────────────────────────────────────────────────────────
           SECTION 4: Complete Resident Action Cards Grid (6 Actions)
           ────────────────────────────────────────────────────────────────────────── */}
        {isActive && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)' }}>
              Quick Actions Grid
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {/* 1. Collect Rent Card */}
              <div
                onClick={() => { onClose(); router.push(`/dashboard/rent?studentId=${student.id}`); }}
                style={{
                  background: 'var(--paper)', border: '1px solid var(--fog)', borderRadius: 8, padding: 12, cursor: 'pointer',
                }}
                className="action-card"
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>💳</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Collect Rent</div>
                <div style={{ fontSize: 11, color: 'var(--charcoal)', marginTop: 2 }}>Record payment &amp; issue receipt</div>
              </div>

              {/* 2. Send Rent Reminder Card */}
              <div
                onClick={() => onReminder(student)}
                style={{
                  background: 'var(--paper)', border: '1px solid var(--fog)', borderRadius: 8, padding: 12, cursor: 'pointer',
                }}
                className="action-card"
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>🔔</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Rent Reminder</div>
                <div style={{ fontSize: 11, color: 'var(--charcoal)', marginTop: 2 }}>Send WhatsApp payment nudge</div>
              </div>

              {/* 3. Transfer Room Card */}
              <div
                onClick={() => setShowTransfer(!showTransfer)}
                style={{
                  background: 'var(--paper)', border: showTransfer ? '1px solid var(--signal)' : '1px solid var(--fog)', borderRadius: 8, padding: 12, cursor: 'pointer',
                }}
                className="action-card"
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>🔄</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Transfer Room</div>
                <div style={{ fontSize: 11, color: 'var(--charcoal)', marginTop: 2 }}>Re-assign to another room</div>
              </div>

              {/* 4. Share Login Link Card */}
              <div
                onClick={() => onInvite(student)}
                style={{
                  background: 'var(--paper)', border: '1px solid var(--fog)', borderRadius: 8, padding: 12, cursor: 'pointer',
                }}
                className="action-card"
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>📲</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Share Login Link</div>
                <div style={{ fontSize: 11, color: 'var(--charcoal)', marginTop: 2 }}>WhatsApp resident setup code</div>
              </div>

              {/* 5. Tenancy Agreement Card */}
              <div
                onClick={() => onContract(student)}
                style={{
                  background: 'var(--paper)', border: '1px solid var(--fog)', borderRadius: 8, padding: 12, cursor: 'pointer',
                }}
                className="action-card"
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>📄</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Tenancy Agreement</div>
                <div style={{ fontSize: 11, color: 'var(--charcoal)', marginTop: 2 }}>PDF contract &amp; WhatsApp link</div>
              </div>

              {/* 6. Mark as Moved Out Card */}
              <div
                onClick={() => { onClose(); onMoveOut(student); }}
                style={{
                  background: 'var(--paper)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 8, padding: 12, cursor: 'pointer',
                }}
                className="action-card"
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>🚪</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#ff6666' }}>Mark as Moved Out</div>
                <div style={{ fontSize: 11, color: 'var(--charcoal)', marginTop: 2 }}>Free room &amp; archive record</div>
              </div>
            </div>

            {/* Inline Room Transfer Selector */}
            {showTransfer && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--paper)', border: '1px solid var(--signal)', borderRadius: 8 }}>
                <label className="label">Select New Room</label>
                <select value={transferRoomId} onChange={e => setTransferRoomId(e.target.value)} style={{ marginBottom: 8 }}>
                  <option value="">Choose Room…</option>
                  {rooms.filter(r => r.hostel_id === student.hostel_id && r.available > 0).map(r => (
                    <option key={r.id} value={r.id}>Room {r.room_number} ({r.available} beds free)</option>
                  ))}
                </select>
                <div className="btn-row">
                  <button className="btn btn-sm" onClick={handleTransfer} disabled={transferring}>
                    {transferring ? 'Transferring…' : 'Confirm Transfer'}
                  </button>
                  <button className="btn secondary btn-sm" onClick={() => setShowTransfer(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────────────
           SECTION 5: Former Resident Deposit Refund Tracker
           ────────────────────────────────────────────────────────────────────────── */}
        {!isActive && (
          <div style={{ marginBottom: 20, padding: 14, background: 'var(--paper)', border: '1px solid var(--fog)', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--signal)' }}>
              💰 Deposit Settlement Tracker
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="label">Security Deposit Refund Status</label>
                <select value={depStatus} onChange={e => { setDepStatus(e.target.value); onUpdateDepositStatus(student.id, e.target.value, depNotes); }}>
                  <option value="pending">⏳ Pending Settlement</option>
                  <option value="returned">✅ Returned to Resident</option>
                  <option value="forfeited">❌ Forfeited (Damage/Dues)</option>
                </select>
              </div>
              <div>
                <label className="label">Settlement Notes</label>
                <input
                  placeholder="e.g. ₹5,000 returned via UPI on 15 Aug; ₹500 deducted for key repair"
                  value={depNotes}
                  onChange={e => setDepNotes(e.target.value)}
                  onBlur={() => onUpdateDepositStatus(student.id, depStatus, depNotes)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="btn-row">
          <button onClick={onClose} className="btn secondary btn-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
function StudentsContent() {
  const s = supabaseBrowser();
  const searchParams = useSearchParams();
  const paramHostelId = searchParams.get('hostelId') || '';
  const paramRoomId = searchParams.get('roomId') || '';
  const formRef = useRef<HTMLFormElement>(null);

  const [activeTab, setActiveTab] = useState<'active' | 'former'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostel, setSelectedHostel] = useState(paramHostelId);
  const [selectedRoom, setSelectedRoom] = useState(paramRoomId);

  const [addStep, setAddStep] = useState<any>(null);
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

  async function updateDepositStatus(stId: string, status: string, notes: string) {
    const { error } = await s.from('students').update({ deposit_status: status, deposit_notes: notes }).eq('id', stId);
    if (error) alert(getErrorMessage(error)); else load();
  }

  async function add(f: FormData) {
    const phone = String(f.get('phone') || '');
    const whatsapp = String(f.get('whatsapp') || '') || phone;

    try { normalisePhone(phone); } catch (e) { return setAddError(getErrorMessage(e)); }
    try { normalisePhone(whatsapp); } catch (e) { return setAddError(getErrorMessage(e)); }

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
    await new Promise(r => setTimeout(r, 600));

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

  async function triggerReminder(st: any) {
    const activeAssignment = st.room_assignments?.find((r: any) => !r.moved_out_at);
    try {
      window.open(
        buildWhatsAppLink(st.whatsapp_number || st.phone, 'rent_reminder', {
          name: st.full_name,
          hostelName: st.hostels?.name,
          amount: st.rent_amount || 5000,
          room: activeAssignment?.rooms?.room_number || 'As assigned',
          dueDate: 'the 5th of this month',
        }),
        '_blank'
      );
    } catch (e) {
      alert(getErrorMessage(e));
    }
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
    const targetList = activeTab === 'active' ? activeStudents : formerStudents;
    const rows = targetList.map((x: any) => {
      const activeAssignment = x.room_assignments?.find((r: any) => !r.moved_out_at);
      return {
        full_name: x.full_name,
        phone: x.phone,
        whatsapp_number: x.whatsapp_number,
        email: x.email || '',
        status: x.status,
        admission_date: x.admission_date,
        moved_out_at: x.moved_out_at || '',
        security_deposit: x.security_deposit,
        deposit_status: x.deposit_status || 'pending',
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
    a.download = `roomly_${activeTab}_residents_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const activeStudents = students.filter(x => x.status === 'active');
  const formerStudents = students.filter(x => x.status === 'inactive');

  const currentList = (activeTab === 'active' ? activeStudents : formerStudents).filter(x =>
    !searchTerm ||
    x.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    x.phone.includes(searchTerm) ||
    x.hostels?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRooms = rooms.filter((r: any) => (!selectedHostel || r.hostel_id === selectedHostel) && r.available > 0);
  const isAdding = addStep !== null && addStep !== 'done';

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Residents Directory</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--charcoal)' }}>
            Manage active residents, track former resident deposit refunds, and export CSV reports.
          </p>
        </div>
        <button className="btn secondary btn-sm" onClick={csv} style={{ flexShrink: 0 }}>
          ↓ Export CSV
        </button>
      </div>

      {/* Tabs & Search Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div className="btn-row">
          <button
            className={`btn ${activeTab === 'active' ? '' : 'secondary'} btn-sm`}
            onClick={() => setActiveTab('active')}
          >
            Active Residents ({activeStudents.length})
          </button>
          <button
            className={`btn ${activeTab === 'former' ? '' : 'secondary'} btn-sm`}
            onClick={() => setActiveTab('former')}
          >
            Former Residents ({formerStudents.length})
          </button>
        </div>

        <input
          type="text"
          placeholder="🔍 Search resident by name, phone, hostel…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: 280, padding: '8px 12px', fontSize: 13 }}
        />
      </div>

      {/* ── Add Resident Form (Active Tab Only) ── */}
      {activeTab === 'active' && (
        <form ref={formRef} action={add} className="card" style={{ marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Add Resident Manually</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--charcoal)' }}>
            Creates a student record, generates a contract PDF, and prepares a WhatsApp link for you to send.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,240px),1fr))', gap: 12 }}>
            <div><label className="label">Full Name *</label><input name="name" placeholder="Rahul Sharma" required /></div>
            <div><label className="label">Phone Number *</label><input name="phone" placeholder="9876543210" required /></div>
            <div><label className="label">WhatsApp Number</label><input name="whatsapp" placeholder="Leave blank if same as phone" /></div>
            <div><label className="label">Email Address</label><input name="email" type="email" placeholder="rahul@example.com" /></div>
            <div><label className="label">Aadhaar Number (optional)</label><input name="aadhaar" placeholder="12-digit Aadhaar" maxLength={12} inputMode="numeric" pattern="\d{12}" /></div>
            <div>
              <label className="label">Hostel *</label>
              <select name="hostel" required value={selectedHostel} onChange={e => { setSelectedHostel(e.target.value); setSelectedRoom(''); }}>
                <option value="">Select Hostel</option>
                {hostels.map((h: any) => (<option value={h.id} key={h.id}>{h.name}</option>))}
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
            <div><label className="label">Admission Date</label><input name="admissionDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
            <div><label className="label">Security Deposit (₹)</label><input name="deposit" type="number" defaultValue="5000" required /></div>
            <div><label className="label">Contract Duration (Months)</label><input name="contractDuration" type="number" defaultValue="11" required /></div>
          </div>

          {addStep && (
            <div className={`banner ${addStep === 'done' ? 'success' : 'info'}`} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              {addStep !== 'done' && <span className="spinner" />}
              {addStep === 'done' ? (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, width: '100%' }}>
                  <span style={{ flex: 1 }}>✓ Resident added &amp; contract generated.</span>
                  {pendingWaLink && (
                    <a href={pendingWaLink} target="_blank" rel="noopener noreferrer" className="btn signal btn-sm" style={{ textDecoration: 'none' }}>
                      💬 Send Contract on WhatsApp
                    </a>
                  )}
                  <button type="button" className="btn secondary btn-sm" onClick={() => { setAddStep(null); setPendingWaLink(''); }}>Dismiss</button>
                </div>
              ) : (
                <span>Processing…</span>
              )}
            </div>
          )}

          {addError && <div className="banner error" style={{ marginTop: 12 }}>{addError}</div>}

          <div style={{ marginTop: 20 }}>
            <button type="submit" className="btn" disabled={isAdding}>
              {isAdding && <span className="spinner light" />}
              {isAdding ? 'Processing…' : 'Add Resident & Generate Agreement'}
            </button>
          </div>
        </form>
      )}

      {/* ── Residents List ── */}
      <div>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>
          {activeTab === 'active' ? `Active Residents (${currentList.length})` : `Former Residents (${currentList.length})`}
        </h2>

        {currentList.length === 0 && (
          <div className="empty-state">
            {activeTab === 'active'
              ? 'No active residents found matching your query.'
              : 'No former residents recorded.'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {currentList.map((x: any) => {
            const activeAssignment = x.room_assignments?.find((r: any) => !r.moved_out_at);
            const isActive = x.status === 'active';

            return (
              <div className="card" key={x.id} style={{ opacity: isActive ? 1 : 0.85 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span className="text-clamp" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>
                        {x.full_name}
                      </span>
                      <span className={`badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
                        {x.status}
                      </span>
                      {!isActive && (
                        <span className="badge" style={{
                          background: x.deposit_status === 'returned' ? 'rgba(74,222,128,0.15)' : x.deposit_status === 'forfeited' ? 'rgba(255,100,100,0.15)' : 'rgba(245,197,24,0.15)',
                          color: x.deposit_status === 'returned' ? '#4ade80' : x.deposit_status === 'forfeited' ? '#ff6666' : 'var(--signal)',
                        }}>
                          Deposit: {x.deposit_status || 'pending'}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--charcoal)', marginTop: 3 }}>
                      📞 {x.phone}{x.email && ` · ${x.email}`}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--charcoal)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      <span>🏢 <b>{x.hostels?.name}</b></span>
                      {isActive && activeAssignment?.rooms?.room_number && (
                        <span className="room-tag available" style={{ fontSize: 11 }}>Room {activeAssignment.rooms.room_number}</span>
                      )}
                      <span>Joined {x.admission_date}</span>
                      {!isActive && x.moved_out_at && (
                        <span>Left {new Date(x.moved_out_at).toLocaleDateString('en-IN')}</span>
                      )}
                    </div>
                  </div>

                  <button className="btn secondary btn-sm" onClick={() => setDetailStudent(x)} style={{ flexShrink: 0, fontSize: 12 }}>
                    View &amp; Manage →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <MoveOutModal target={moveOutTarget} onConfirm={doMoveOut} onCancel={() => setMoveOutTarget(null)} />
      {detailStudent && (
        <StudentDetailDrawer
          student={detailStudent}
          rooms={rooms}
          onClose={() => setDetailStudent(null)}
          onInvite={triggerInvite}
          onContract={triggerContractRegen}
          onReminder={triggerReminder}
          onMoveOut={st => setMoveOutTarget({ id: st.id, full_name: st.full_name, room: st.room_assignments?.find((r: any) => !r.moved_out_at)?.rooms?.room_number, hostel: st.hostels?.name })}
          onUpdateDepositStatus={updateDepositStatus}
        />
      )}
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
