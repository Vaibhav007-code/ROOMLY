'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { QRCodeCanvas } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { getErrorMessage } from '@/lib/errorMessages';

type EditRoom = { id: string; room_number: string; bed_capacity: number; is_ac: boolean; rent_amount: number } | null;
type MoveOutInfo = { id: string; full_name: string; room?: string } | null;

export default function Hostels() {
  const s = supabaseBrowser();
  const router = useRouter();
  const [hostels, setHostels] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>();
  const [ownerId, setOwnerId] = useState<string>('');
  const [roomData, setRoomData] = useState<Record<string, { total: number; occupied: number; available: number; students: any[] }>>({});
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentDetails, setStudentDetails] = useState<{ rentPayments: any[]; complaints: any[] }>({ rentPayments: [], complaints: [] });
  const [availableRoomsList, setAvailableRoomsList] = useState<any[]>([]);
  const [targetMoveRoom, setTargetMoveRoom] = useState('');
  const [moveOutInfo, setMoveOutInfo] = useState<MoveOutInfo>(null);
  const [moveOutDate, setMoveOutDate] = useState(new Date().toISOString().slice(0, 10));
  const [moveOutReason, setMoveOutReason] = useState('');
  const [editRoom, setEditRoom] = useState<EditRoom>(null);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = async () => {
    const { data: { user } } = await s.auth.getUser();
    if (user) setOwnerId(user.id);

    const { data: hostelList } = await s.from('hostels').select('*,rooms(*)').order('created_at');
    setHostels(hostelList || []);
    setSelected((v: any) => v || hostelList?.[0]);
    const { data: activeAssignments } = await s.from('room_assignments').select('id,room_id,student_id,students(*)').is('moved_out_at', null);
    const allRooms = (hostelList || []).flatMap((h: any) => h.rooms || []);
    const rMap: Record<string, { total: number; occupied: number; available: number; students: any[] }> = {};
    await Promise.all(allRooms.map(async (r: any) => {
      const { data: av } = await s.rpc('available_beds', { room: r.id });
      const availableCount = typeof av === 'number' ? av : r.bed_capacity;
      const occupants = (activeAssignments || []).filter((a: any) => a.room_id === r.id && a.students).map((a: any) => a.students);
      rMap[r.id] = { total: r.bed_capacity, occupied: Math.max(0, r.bed_capacity - availableCount), available: Math.max(0, availableCount), students: occupants };
    }));
    setRoomData(rMap);
    const availList: any[] = [];
    allRooms.forEach((r: any) => { const info = rMap[r.id]; if (info && info.available > 0) availList.push({ ...r, available: info.available }); });
    setAvailableRoomsList(availList);
  };

  useEffect(() => { load(); }, []);

  const openStudentDetail = async (student: any) => {
    setSelectedStudent(student);
    const [rentRes, compRes] = await Promise.all([
      s.from('rent_payments').select('*').eq('student_id', student.id).order('due_date', { ascending: false }),
      s.from('complaints').select('*').eq('student_id', student.id).order('created_at', { ascending: false }),
    ]);
    setStudentDetails({ rentPayments: rentRes.data || [], complaints: compRes.data || [] });
  };

  async function addHostel(f: FormData) {
    const u = (await s.auth.getUser()).data.user;
    const { error } = await s.from('hostels').insert({ owner_id: u?.id, name: f.get('name'), address: f.get('address') });
    if (error) alert(getErrorMessage(error)); else load();
  }

  async function deleteHostel(h: any) {
    if (!confirm(`Delete hostel "${h.name}"? All active students must be moved out first.`)) return;
    const { error } = await s.rpc('delete_hostel_safely', { p_hostel: h.id });
    if (error) alert(getErrorMessage(error)); else load();
  }

  async function addRoom(f: FormData) {
    if (!selected) return;
    const n = Number(f.get('floor'));
    let { data: floor } = await s.from('floors').select('id').eq('hostel_id', selected.id).eq('number', n).maybeSingle();
    if (!floor) {
      const x = await s.from('floors').insert({ hostel_id: selected.id, number: n }).select().single();
      if (x.error) return alert(getErrorMessage(x.error));
      floor = x.data;
    }
    const { error } = await s.from('rooms').insert({ hostel_id: selected.id, floor_id: floor?.id, room_number: f.get('room'), bed_capacity: Number(f.get('beds')), is_ac: f.get('ac') === 'on', rent_amount: Number(f.get('rent')) });
    if (error) alert(getErrorMessage(error)); else load();
  }

  async function saveEditRoom() {
    if (!editRoom) return;
    setEditError(''); setEditSaving(true);
    const { error } = await s.rpc('update_room', {
      p_room: editRoom.id,
      p_room_number: editRoom.room_number,
      p_bed_capacity: editRoom.bed_capacity,
      p_is_ac: editRoom.is_ac,
      p_rent_amount: editRoom.rent_amount,
    });
    setEditSaving(false);
    if (error) { setEditError(getErrorMessage(error)); }
    else { setEditRoom(null); load(); }
  }

  const handleCollectRent = async () => {
    if (!selectedStudent) return;
    const latestPayment = studentDetails.rentPayments.find(p => p.status !== 'paid');
    if (!latestPayment) return alert('No pending rent payments.');
    const dueAmount = Number(latestPayment.amount_due) - Number(latestPayment.amount_paid);
    const amountStr = prompt(`Enter collected amount (Due: ₹${dueAmount}):`, String(dueAmount));
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0) return alert('Enter a valid amount');
    const { error } = await s.rpc('record_rent_payment', { p_payment: latestPayment.id, p_amount: amount });
    if (error) return alert(getErrorMessage(error));
    const hostel = hostels.find(h => h.id === selectedStudent.hostel_id);
    try { window.open(buildWhatsAppLink(selectedStudent.whatsapp_number || selectedStudent.phone, 'rent_receipt', { name: selectedStudent.full_name, amount, hostelName: hostel?.name }), '_blank'); } catch {}
    openStudentDetail(selectedStudent); load();
  };

  const handleSendReminder = () => {
    if (!selectedStudent) return;
    const latestPayment = studentDetails.rentPayments.find(p => p.status !== 'paid');
    const hostel = hostels.find(h => h.id === selectedStudent.hostel_id);
    const dueAmount = latestPayment ? Number(latestPayment.amount_due) - Number(latestPayment.amount_paid) : 0;
    try { window.open(buildWhatsAppLink(selectedStudent.whatsapp_number || selectedStudent.phone, 'rent_reminder', { name: selectedStudent.full_name, amount: dueAmount, dueDate: latestPayment?.due_date || 'Today', hostelName: hostel?.name }), '_blank'); } catch (e) { alert(getErrorMessage(e)); }
  };

  const handleMoveRoom = async () => {
    if (!selectedStudent || !targetMoveRoom) return alert('Select a room to transfer to');
    const { error } = await s.rpc('assign_room', { p_student: selectedStudent.id, p_room: targetMoveRoom });
    if (error) alert(getErrorMessage(error));
    else { alert(`Transferred ${selectedStudent.full_name} to new room.`); setSelectedStudent(null); load(); }
  };

  const confirmMoveOut = (student: any) => {
    const allRooms = hostels.flatMap((h: any) => h.rooms || []);
    const room = allRooms.find((r: any) => roomData[r.id]?.students?.some((st: any) => st.id === student.id));
    setMoveOutInfo({ id: student.id, full_name: student.full_name, room: room?.room_number });
    setMoveOutDate(new Date().toISOString().slice(0, 10)); setMoveOutReason('');
  };

  const doMoveOut = async () => {
    if (!moveOutInfo) return;
    const { error } = await s.rpc('move_out_student', { p_student: moveOutInfo.id });
    if (error) { alert(getErrorMessage(error)); return; }
    if (moveOutReason) await s.from('complaints').insert({ student_id: moveOutInfo.id, description: `[Move-Out — ${moveOutDate}]: ${moveOutReason}` });
    setMoveOutInfo(null); setSelectedStudent(null); load();
  };

  const selectedHostel = hostels.find((h: any) => h.id === selected?.id) || selected;

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Hostels & Rooms</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--charcoal)' }}>Manage buildings, rooms, and resident transfers.</p>
      </div>

      {/* Hostel tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
        {hostels.map((h: any) => (
          <button key={h.id} onClick={() => setSelected(h)} className={`btn btn-sm ${selected?.id === h.id ? '' : 'secondary'}`}>
            🏢 {h.name}
          </button>
        ))}
      </div>

      {/* Add hostel */}
      <form action={addHostel} className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Add New Hostel</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,220px),1fr))', gap: 10 }}>
          <div><label className="label">Building Name *</label><input name="name" placeholder="e.g. Sunrise Hostel" required /></div>
          <div><label className="label">Address</label><input name="address" placeholder="Street, City" /></div>
        </div>
        <button className="btn" style={{ marginTop: 12 }}>Add Hostel</button>
      </form>

      {selectedHostel && (
        <>
          {/* Hostel header */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>{selectedHostel.name}</h2>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--charcoal)' }}>{selectedHostel.address || 'No address recorded'}</p>
            </div>
            <button className="btn danger btn-sm" onClick={() => deleteHostel(selectedHostel)}>Delete Hostel</button>
          </div>

          {/* QR card — owner-scoped, shown once (not per-hostel) */}
          {selectedHostel === (hostels[0]) && ownerId && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Your Shared QR Code</h3>
              <p style={{ fontSize: 13, color: 'var(--charcoal)', margin: '0 0 12px', lineHeight: 1.5 }}>
                One QR for all your hostels — residents can apply for a room <strong>or</strong> raise a complaint.
                Hostel selection is part of the form.
              </p>
              <div style={{ background: '#fff', padding: 12, borderRadius: 8, display: 'inline-block', marginBottom: 10 }}>
                <QRCodeCanvas
                  value={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://roomly-ten-beige.vercel.app'}/register/${ownerId}`}
                  size={140}
                />
              </div>
              <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--charcoal)', wordBreak: 'break-all', margin: '0 0 10px' }}>
                {`${process.env.NEXT_PUBLIC_SITE_URL || 'https://roomly-ten-beige.vercel.app'}/register/${ownerId}`}
              </p>
              <button
                className="btn secondary btn-sm"
                style={{ fontSize: 12 }}
                onClick={() => {
                  const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://roomly-ten-beige.vercel.app'}/register/${ownerId}`;
                  navigator.clipboard.writeText(url).then(() => alert('Link copied!'));
                }}
              >
                📋 Copy Link
              </button>
            </div>
          )}

          {/* Rooms */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Rooms & Occupancy</h3>
            </div>

            {(selectedHostel.rooms || []).length === 0 && (
              <div className="empty-state" style={{ marginBottom: 0 }}>No rooms yet. Add one below.</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))', gap: 12 }}>
              {(selectedHostel.rooms || []).map((r: any) => {
                const info = roomData[r.id] || { total: r.bed_capacity, occupied: 0, available: r.bed_capacity, students: [] };
                const tagClass = info.available === 0 ? 'occupied' : info.occupied > 0 ? 'partial' : 'available';
                return (
                  <div key={r.id} className="card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`room-tag ${tagClass}`}>Room {r.room_number}</span>
                        {r.is_ac && <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--fog)', color: 'var(--charcoal)', padding: '2px 7px', borderRadius: 4 }}>AC</span>}
                      </div>
                      <button
                        onClick={() => setEditRoom({ id: r.id, room_number: r.room_number, bed_capacity: r.bed_capacity, is_ac: r.is_ac, rent_amount: r.rent_amount })}
                        style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: 'var(--charcoal)', padding: 4 }}
                        title="Edit room"
                      >✏️</button>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--charcoal)', margin: '0 0 8px', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{r.rent_amount}/mo · {info.occupied}/{info.total} beds occupied
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {info.students.length === 0
                        ? <span style={{ fontSize: 12, color: 'var(--charcoal)', fontStyle: 'italic' }}>Unoccupied</span>
                        : info.students.map((st: any) => (
                          <button key={st.id} onClick={() => openStudentDetail(st)}
                            style={{ fontSize: 12, padding: '3px 10px', border: '1px solid var(--fog)', borderRadius: 4, background: 'var(--paper)', cursor: 'pointer', fontWeight: 600 }}>
                            {st.full_name}
                          </button>
                        ))
                      }
                    </div>
                    {info.available > 0 && (
                      <button className="btn secondary btn-sm" style={{ width: '100%', fontSize: 12 }}
                        onClick={() => router.push(`/dashboard/students?hostelId=${selectedHostel.id}&roomId=${r.id}`)}>
                        + Add Student to Room
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add room form */}
          <form action={addRoom} className="card">
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Add Room to {selectedHostel.name}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,160px),1fr))', gap: 10 }}>
              <div><label className="label">Room No.</label><input name="room" placeholder="101" required /></div>
              <div><label className="label">Floor</label><input name="floor" type="number" defaultValue="1" required /></div>
              <div><label className="label">Bed Capacity</label><input name="beds" type="number" min="1" defaultValue="2" required /></div>
              <div><label className="label">Rent (₹/mo)</label><input name="rent" type="number" min="0" placeholder="5000" required /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" name="ac" style={{ width: 16, height: 16 }} />
              Air Conditioned (AC)
            </label>
            <button className="btn" style={{ marginTop: 14 }}>Add Room</button>
          </form>
        </>
      )}

      {/* Edit Room Modal */}
      {editRoom && (
        <div className="modal-overlay" onClick={() => { setEditRoom(null); setEditError(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Edit Room {editRoom.room_number}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Room Number</label>
                <input value={editRoom.room_number} onChange={e => setEditRoom(v => v && ({ ...v, room_number: e.target.value }))} /></div>
              <div><label className="label">Bed Capacity</label>
                <input type="number" min="1" value={editRoom.bed_capacity} onChange={e => setEditRoom(v => v && ({ ...v, bed_capacity: Number(e.target.value) }))} /></div>
              <div><label className="label">Rent (₹/month)</label>
                <input type="number" min="0" value={editRoom.rent_amount} onChange={e => setEditRoom(v => v && ({ ...v, rent_amount: Number(e.target.value) }))} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={editRoom.is_ac} onChange={e => setEditRoom(v => v && ({ ...v, is_ac: e.target.checked }))} style={{ width: 16, height: 16 }} />
                Air Conditioned (AC)
              </label>
            </div>
            {editError && <div className="banner error" style={{ marginTop: 12 }}>{editError}</div>}
            <div className="btn-row" style={{ marginTop: 20 }}>
              <button className="btn" onClick={saveEditRoom} disabled={editSaving}>
                {editSaving && <span className="spinner light" />}
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button className="btn secondary" onClick={() => { setEditRoom(null); setEditError(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--fog)', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 19 }}>{selectedStudent.full_name}</h3>
                <span className="badge badge-active" style={{ marginTop: 4 }}>Active Resident</span>
              </div>
              <button onClick={() => setSelectedStudent(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--charcoal)', padding: '0 4px' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--fog)', borderRadius: 6, padding: 12, marginBottom: 14, fontSize: 13 }}>
              <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Phone</span><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{selectedStudent.phone}</span></div>
              <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Security Deposit</span><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>₹{selectedStudent.security_deposit}</span></div>
              <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Contract</span><span>{selectedStudent.contract_duration_months} months</span></div>
              <div><span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', display: 'block' }}>Admitted</span><span>{selectedStudent.admission_date}</span></div>
            </div>

            <div style={{ borderTop: '1px solid var(--fog)', borderBottom: '1px solid var(--fog)', padding: '12px 0', marginBottom: 14 }}>
              <div className="btn-row">
                <button onClick={handleCollectRent} className="btn btn-sm">💰 Collect Rent</button>
                <button onClick={handleSendReminder} className="btn secondary btn-sm">💬 Send Reminder</button>
                <button onClick={() => confirmMoveOut(selectedStudent)} className="btn danger btn-sm">🚪 Move Out</button>
              </div>
              <div style={{ marginTop: 12 }}>
                <label className="label">Transfer to Room</label>
                <div className="btn-row">
                  <select style={{ flex: 1 }} value={targetMoveRoom} onChange={e => setTargetMoveRoom(e.target.value)}>
                    <option value="">Choose available room</option>
                    {availableRoomsList.map((r: any) => (
                      <option key={r.id} value={r.id}>Room {r.room_number} — {r.available} free</option>
                    ))}
                  </select>
                  <button onClick={handleMoveRoom} className="btn secondary btn-sm">Reassign</button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', marginBottom: 8 }}>Rent Records</p>
              {studentDetails.rentPayments.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--charcoal)' }}>No records yet.</p>
                : studentDetails.rentPayments.slice(0, 6).map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--fog)' }}>
                    <span>{p.period} · Due {p.due_date}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>₹{p.amount_paid}/₹{p.amount_due} <span className={`badge ${p.status === 'paid' ? 'badge-paid' : 'badge-due'}`}>{p.status}</span></span>
                  </div>
                ))
              }
            </div>

            <button onClick={() => setSelectedStudent(null)} className="btn secondary btn-sm" style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {/* Move Out Modal */}
      {moveOutInfo && (
        <div className="modal-overlay" onClick={() => setMoveOutInfo(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>Confirm Move Out</h3>
            <p style={{ fontSize: 14, color: 'var(--charcoal)', marginBottom: 16 }}>
              This will mark <strong style={{ color: 'var(--ink)' }}>{moveOutInfo.full_name}</strong> as moved out{moveOutInfo.room ? `, freeing Room ${moveOutInfo.room}` : ''}. Full history is preserved.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Move-Out Date</label><input type="date" value={moveOutDate} onChange={e => setMoveOutDate(e.target.value)} /></div>
              <div><label className="label">Reason / Note (optional)</label><input placeholder="e.g. Contract ended" value={moveOutReason} onChange={e => setMoveOutReason(e.target.value)} /></div>
            </div>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <button className="btn danger" onClick={doMoveOut}>Confirm Move Out</button>
              <button className="btn secondary" onClick={() => setMoveOutInfo(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
