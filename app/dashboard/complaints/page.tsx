'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errorMessages';

export default function Complaints() {
  const s = supabaseBrowser();
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<'open'|'all'>('open');

  const load = async () => {
    const { data } = await s.from('complaints').select('*,students(full_name,hostels(name))').order('created_at', { ascending: false });
    setItems(data || []);
  };

  useEffect(() => { load(); }, []);

  async function toggle(x: any) {
    const resolved = x.status === 'open';
    const { error } = await s.from('complaints').update({ status: resolved ? 'resolved' : 'open', resolved_at: resolved ? new Date().toISOString() : null }).eq('id', x.id);
    if (error) alert(getErrorMessage(error)); else load();
  }

  const open = items.filter(x => x.status === 'open');
  const shown = tab === 'open' ? open : items;

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Resident Complaints</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--charcoal)' }}>Monitor issues and mark them as resolved.</p>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button className={`btn ${tab==='open' ? '' : 'secondary'} btn-sm`} onClick={() => setTab('open')}>Open ({open.length})</button>
        <button className={`btn ${tab==='all' ? '' : 'secondary'} btn-sm`} onClick={() => setTab('all')}>All ({items.length})</button>
      </div>

      {shown.length === 0 && (
        <div className="empty-state">
          {tab === 'open' ? 'No open complaints — everything is running smoothly! 🎉' : 'No complaints logged yet.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map(x => (
          <div className="card" key={x.id} style={{ opacity: x.status === 'resolved' ? 0.7 : 1 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, borderBottom: '1px solid var(--fog)', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }} className="text-clamp">{x.students?.full_name}</span>
                <span style={{ fontSize: 12, color: 'var(--charcoal)', marginLeft: 8 }}>({x.students?.hostels?.name})</span>
              </div>
              <span className={`badge ${x.status === 'open' ? 'badge-open' : 'badge-resolved'}`}>{x.status}</span>
            </div>
            <p style={{ fontSize: 14, margin: '0 0 12px', lineHeight: 1.6 }}>{x.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>Logged: {new Date(x.created_at).toLocaleDateString()}</span>
              <button className="btn secondary btn-sm" onClick={() => toggle(x)}>
                {x.status === 'open' ? 'Mark Resolved ✓' : 'Reopen'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
