'use client';
import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { read, utils } from 'xlsx';
import { getErrorMessage } from '@/lib/errorMessages';

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
      const r = await s.from('rooms').select('id,room_number,hostel_id');
      setRooms(r.data || []);
    })();
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedHostel) return alert('Please choose a hostel first');
    setUploading(true);
    setLog(['Reading spreadsheet file...']);

    try {
      const buffer = await file.arrayBuffer();
      const wb = read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = utils.sheet_to_json(ws);

      setLog(v => [...v, `Found ${rows.length} rows to import.`]);

      const hostelRooms = rooms.filter(r => r.hostel_id === selectedHostel);
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row.full_name || row.name || row.Name || '').trim();
        const phone = String(row.phone || row.Phone || '').trim();
        const roomNum = String(row.room_number || row.room || row.Room || '').trim();

        if (!name || !phone) {
          setLog(v => [...v, `⚠️ Row ${i + 1}: Skipped (Missing name or phone)`]);
          errorCount++;
          continue;
        }

        const roomObj = hostelRooms.find(r => String(r.room_number) === roomNum);

        const res = await fetch('/api/admissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'manual',
            name,
            phone,
            email: row.email || '',
            whatsapp: row.whatsapp || phone,
            hostelId: selectedHostel,
            roomId: roomObj?.id || hostelRooms[0]?.id,
            deposit: Number(row.deposit || 0),
            contractDuration: Number(row.contractDuration || 11),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          const userFriendlyError = getErrorMessage(data.error);
          setLog(v => [...v, `❌ Row ${i + 1} (${name}): ${userFriendlyError}`]);
          errorCount++;
        } else {
          setLog(v => [...v, `✅ Row ${i + 1} (${name}): Imported successfully`]);
          successCount++;
        }
      }

      setLog(v => [...v, `\n🎉 Import Complete! ${successCount} imported, ${errorCount} failed.`]);
    } catch (err) {
      setLog(v => [...v, `❌ File Error: ${getErrorMessage(err)}`]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Bulk Import Residents</h1>
        <p className="text-slate-400 text-sm mt-1">
          Import resident lists directly from CSV or Excel spreadsheets (.xlsx, .csv).
        </p>
      </div>

      <div className="card mb-6">
        <label className="label">Target Hostel for Import *</label>
        <select
          className="max-w-md"
          value={selectedHostel}
          onChange={e => setSelectedHostel(e.target.value)}
        >
          {hostels.map(h => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>

        <div className="mt-4 p-4 border border-dashed border-slate-700 rounded-xl bg-navy-850 text-center">
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFile}
            disabled={uploading}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="btn cursor-pointer inline-flex text-sm">
            {uploading ? 'Processing File...' : '📁 Select Excel / CSV File'}
          </label>
          <p className="text-xs text-slate-400 mt-2">
            Expected columns: <code className="text-indigo-400 font-mono">full_name, phone, room_number, email, deposit</code>
          </p>
        </div>
      </div>

      {log.length > 0 && (
        <div className="card bg-navy-850 border-slate-800 font-mono text-xs text-slate-300 space-y-1 max-h-96 overflow-y-auto">
          {log.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
