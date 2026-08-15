'use client';
import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { read, utils } from 'xlsx';
import { getErrorMessage } from '@/lib/errorMessages';

// ── Column aliases: map any reasonable header name → our normalized field ──────
const COL_ALIASES: Record<string, string[]> = {
  full_name:          ['full_name', 'name', 'student_name', 'fullname', 'resident_name', 'student'],
  phone:              ['phone', 'phone_number', 'mobile', 'mobile_number', 'contact', 'cell'],
  email:              ['email', 'email_address', 'mail'],
  whatsapp_number:    ['whatsapp', 'whatsapp_number', 'wa_number'],
  room_number:        ['room_number', 'room', 'room_no', 'room_no.', 'roomno', 'room_id'],
  deposit:            ['deposit', 'security_deposit', 'security', 'advance'],
  contract_duration:  ['contract_duration', 'contract_months', 'duration', 'months', 'tenure'],
  admission_date:     ['admission_date', 'join_date', 'joining_date', 'date_of_joining', 'doj'],
  aadhaar_number:     ['aadhaar', 'aadhaar_number', 'aadhar', 'aadhar_number', 'uid'],
  bed_capacity:       ['bed_capacity', 'beds', 'capacity', 'occupancy'],
  rent_amount:        ['rent', 'rent_amount', 'monthly_rent', 'rent_per_month'],
};

function normalizeHeader(header: string): string {
  const h = String(header).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return h; // keep original if no alias match
}

function normalizeRows(rawRows: any[]): Record<string, any>[] {
  return rawRows.map(row => {
    const out: Record<string, any> = {};
    for (const [rawKey, value] of Object.entries(row)) {
      out[normalizeHeader(rawKey)] = value;
    }
    return out;
  });
}

export default function ImportPage() {
  const s = supabaseBrowser();
  const [hostels, setHostels] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedHostel, setSelectedHostel] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const h = await s.from('hostels').select('id,name');
      setHostels(h.data || []);
      if (h.data?.[0]) setSelectedHostel(h.data[0].id);
      const r = await s.from('rooms').select('id,room_number,hostel_id,bed_capacity,rent_amount');
      setRooms(r.data || []);
    })();
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedHostel) return alert('Please choose a hostel first');
    setUploading(true);
    setLog(['📂 Reading spreadsheet…']);

    try {
      const buffer = await file.arrayBuffer();
      const wb = read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[] = utils.sheet_to_json(ws, { defval: '' });

      setLog(v => [...v, `Found ${rawRows.length} data rows. Normalizing column headers…`]);

      // STEP 1: Normalize headers — format-agnostic
      const rows = normalizeRows(rawRows);

      setLog(v => [...v, `Detected columns: ${Object.keys(rows[0] || {}).join(', ')}`]);

      // STEP 2: Collect rooms needed + auto-create missing ones
      const hostelRooms = rooms.filter(r => r.hostel_id === selectedHostel);
      const roomMap: Record<string, string> = {}; // room_number → id
      hostelRooms.forEach(r => { roomMap[String(r.room_number)] = r.id; });

      // Find all unique room numbers in the sheet that don't exist yet
      const needsCreate: Record<string, { rent: number; beds: number }> = {};
      for (const row of rows) {
        const roomNum = String(row.room_number || '').trim();
        if (roomNum && !roomMap[roomNum]) {
          if (!needsCreate[roomNum]) {
            needsCreate[roomNum] = {
              rent: Number(row.rent_amount) || 0,
              beds: 1,
            };
          }
          // Multiple rows with same room → infer bed capacity from row count
          needsCreate[roomNum].beds = Math.max(needsCreate[roomNum].beds, 1);
        }
      }

      // Count rows per room to estimate bed capacity
      const roomRowCount: Record<string, number> = {};
      for (const row of rows) {
        const rn = String(row.room_number || '').trim();
        if (rn) roomRowCount[rn] = (roomRowCount[rn] || 0) + 1;
      }
      for (const [rn, info] of Object.entries(needsCreate)) {
        info.beds = Math.max(info.beds, roomRowCount[rn] || 1);
      }

      // Auto-create missing rooms
      const autoCreatedRooms: string[] = [];
      if (Object.keys(needsCreate).length > 0) {
        setLog(v => [...v, `🔧 Auto-creating ${Object.keys(needsCreate).length} missing room(s)…`]);
        for (const [roomNum, info] of Object.entries(needsCreate)) {
          // Get/create floor 1 as default
          let { data: floor } = await s.from('floors').select('id').eq('hostel_id', selectedHostel).eq('number', 1).maybeSingle();
          if (!floor) {
            const { data: newFloor } = await s.from('floors').insert({ hostel_id: selectedHostel, number: 1 }).select().single();
            floor = newFloor;
          }
          const { data: newRoom, error: roomErr } = await s.from('rooms').insert({
            hostel_id: selectedHostel,
            floor_id: floor?.id,
            room_number: roomNum,
            bed_capacity: info.beds,
            is_ac: false,
            rent_amount: info.rent || 0,
          }).select('id').single();

          if (roomErr) {
            setLog(v => [...v, `⚠️ Could not auto-create room ${roomNum}: ${getErrorMessage(roomErr)}`]);
          } else if (newRoom) {
            roomMap[roomNum] = newRoom.id;
            autoCreatedRooms.push(roomNum);
          }
        }
        if (autoCreatedRooms.length) {
          setLog(v => [...v, `✅ Auto-created rooms: ${autoCreatedRooms.join(', ')} (bed capacity estimated from sheet; review rent/AC settings)`]);
        }
      }

      // STEP 3: Import rows
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row.full_name || '').trim();
        const phone = String(row.phone || '').trim();
        const roomNum = String(row.room_number || '').trim();

        if (!name || !phone) {
          setLog(v => [...v, `⚠️ Row ${i + 1}: Skipped — missing name or phone`]);
          errorCount++;
          continue;
        }

        const roomId = roomNum ? roomMap[roomNum] : undefined;
        const fallbackRoomId = !roomId ? (hostelRooms[0]?.id || Object.values(roomMap)[0]) : undefined;

        const res = await fetch('/api/admissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'manual',
            name,
            phone,
            email: String(row.email || ''),
            whatsapp: String(row.whatsapp_number || row.phone || phone),
            hostelId: selectedHostel,
            roomId: roomId || fallbackRoomId,
            admissionDate: row.admission_date || null,
            deposit: Number(row.deposit) || 0,
            contractDuration: Number(row.contract_duration) || 11,
            aadhaar: String(row.aadhaar_number || '').trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setLog(v => [...v, `❌ Row ${i + 1} (${name}): ${getErrorMessage(data.error)}`]);
          errorCount++;
        } else {
          setLog(v => [...v, `✅ Row ${i + 1} (${name}): Imported → Room ${roomNum || '(unassigned)'}`]);
          successCount++;
        }
      }

      const summaryParts = [`🎉 Import complete: ${successCount} imported, ${errorCount} failed.`];
      if (autoCreatedRooms.length) {
        summaryParts.push(`⚠️ ${autoCreatedRooms.length} rooms auto-created — review bed capacity and rent in Rooms tab.`);
      }
      setLog(v => [...v, '', ...summaryParts]);
    } catch (err) {
      setLog(v => [...v, `❌ File Error: ${getErrorMessage(err)}`]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Bulk Import Residents</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--charcoal)' }}>
          Import from CSV or Excel (.xlsx). Any column order, any header naming — we normalize automatically.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <label className="label">Target Hostel for Import *</label>
        <select value={selectedHostel} onChange={e => setSelectedHostel(e.target.value)} style={{ maxWidth: 360, marginBottom: 16 }}>
          {hostels.map(h => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>

        <div style={{ border: '2px dashed var(--fog)', borderRadius: 16, background: 'var(--cream)', textAlign: 'center', padding: 32 }}>
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFile}
            disabled={uploading}
            style={{ display: 'none' }}
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="btn" style={{ cursor: 'pointer', display: 'inline-flex' }}>
            {uploading ? 'Processing…' : '📁 Select Excel / CSV File'}
          </label>
          <p style={{ fontSize: 13, color: 'var(--charcoal)', marginTop: 14, lineHeight: 1.6 }}>
            Accepted columns (any order, any capitalization):<br />
            <code style={{ fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--leaf-end)', fontSize: 12 }}>
              full_name · phone · room_number · email · deposit · contract_duration · aadhaar
            </code><br />
            <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>Missing rooms are auto-created with defaults. Review after import.</span>
          </p>
        </div>
      </div>

      {log.length > 0 && (
        <div className="card" style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7, maxHeight: 400, overflowY: 'auto' }}>
          {log.map((line, idx) => (
            <div key={idx} style={{
              color: line.startsWith('✅') ? '#2F5233' :
                     line.startsWith('❌') ? '#B5533C' :
                     line.startsWith('⚠️') ? 'var(--amber)' :
                     line.startsWith('🎉') ? 'var(--forest-dark)' :
                     'var(--charcoal)',
              fontWeight: line.startsWith('🎉') ? 700 : 500
            }}>
              {line || '\u00a0'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
