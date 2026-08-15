'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errorMessages';

export default function Complaints() {
  const s = supabaseBrowser();
  const [items, setItems] = useState<any[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [tab, setTab] = useState<'open' | 'all'>('open');

  const load = async () => {
    const { data: hostelList } = await s.from('hostels').select('id,name');
    setHostels(hostelList || []);

    const { data } = await s
      .from('complaints')
      .select('*,students(full_name,hostels(id,name))')
      .order('created_at', { ascending: false });
    setItems(data || []);
  };

  useEffect(() => { load(); }, []);

  async function toggle(x: any) {
    const resolved = x.status === 'open';
    const { error } = await s
      .from('complaints')
      .update({ status: resolved ? 'resolved' : 'open', resolved_at: resolved ? new Date().toISOString() : null })
      .eq('id', x.id);
    if (error) alert(getErrorMessage(error)); else load();
  }

  const open = items.filter(x => x.status === 'open');
  const shown = tab === 'open' ? open : items;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://roomly-ten-beige.vercel.app';

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Resident Complaints</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--charcoal)' }}>
          Monitor issues and mark them as resolved.
        </p>
      </div>

      {/* Complaint links per hostel */}
      {hostels.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Public Complaint Links</h3>
          <p style={{ fontSize: 13, color: 'var(--charcoal)', margin: '0 0 12px' }}>
            Share these links with residents so they can raise complaints without logging in.
          </p>
          {hostels.map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, minWidth: 120 }}>{h.name}</span>
              <code style={{ fontSize: 11, color: 'var(--charcoal)', background: 'var(--fog)', padding: '3px 8px', borderRadius: 4, flex: 1, wordBreak: 'break-all' }}>
                {siteUrl}/complaint/{h.id}
              </code>
              <button
                className="btn secondary btn-sm"
                style={{ fontSize: 11 }}
                onClick={() => navigator.clipboard.writeText(`${siteUrl}/complaint/${h.id}`).then(() => alert('Copied!'))}
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button className={`btn ${tab === 'open' ? '' : 'secondary'} btn-sm`} onClick={() => setTab('open')}>
          Open ({open.length})
        </button>
        <button className={`btn ${tab === 'all' ? '' : 'secondary'} btn-sm`} onClick={() => setTab('all')}>
          All ({items.length})
        </button>
      </div>

      {shown.length === 0 && (
        <div className="empty-state">
          {tab === 'open' ? 'No open complaints — everything is running smoothly! 🎉' : 'No complaints logged yet.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map(x => {
          const isUnverified = x.submitter_verified === false;
          const hostelName = x.students?.hostels?.name
            || hostels.find(h => h.id === x.hostel_id)?.name
            || '—';

          return (
            <div className="card" key={x.id} style={{ opacity: x.status === 'resolved' ? 0.7 : 1 }}>
              {/* Unverified warning banner */}
              {isUnverified && (
                <div className="banner" style={{
                  marginBottom: 10,
                  background: 'rgba(255,165,0,0.10)',
                  border: '1px solid rgba(255,165,0,0.4)',
                  color: '#ffaa44',
                  fontSize: 12,
                  borderRadius: 6,
                  padding: '6px 10px',
                }}>
                  ⚠️ <strong>Unverified submitter</strong> — phone {x.public_submitter_phone ? `(${x.public_submitter_phone}) ` : ''}not matched to an active resident. Review before acting.
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, borderBottom: '1px solid var(--fog)', paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }} className="text-clamp">
                    {x.students?.full_name || (isUnverified ? `Anonymous (${x.public_submitter_phone || 'unknown'})` : 'Unknown')}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--charcoal)', marginLeft: 8 }}>
                    ({hostelName})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {isUnverified && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,165,0,0.15)', color: '#ffaa44', border: '1px solid rgba(255,165,0,0.3)' }}>
                      Public
                    </span>
                  )}
                  <span className={`badge ${x.status === 'open' ? 'badge-open' : 'badge-resolved'}`}>{x.status}</span>
                </div>
              </div>

              <p style={{ fontSize: 14, margin: '0 0 12px', lineHeight: 1.6 }}>{x.description}</p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>
                  Logged: {new Date(x.created_at).toLocaleDateString('en-IN')}
                </span>
                <button className="btn secondary btn-sm" onClick={() => toggle(x)}>
                  {x.status === 'open' ? 'Mark Resolved ✓' : 'Reopen'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
