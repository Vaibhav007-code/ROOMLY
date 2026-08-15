'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errorMessages';

export default function Managers() {
  const s = supabaseBrowser();
  const [hostels, setHostels] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selectedHostels, setSelectedHostels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    const { data: h } = await s.from('hostels').select('id,name');
    setHostels(h || []);

    const { data: mh } = await s
      .from('manager_hostels')
      .select('manager_id,hostel_id,hostels(name),profiles:manager_id(full_name,role)');
    setManagers(mh || []);
  };

  useEffect(() => { load(); }, []);

  function toggleHostel(id: string) {
    setSelectedHostels(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function addManager(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setError('Email is required');
    if (selectedHostels.length === 0) return setError('Select at least one hostel');
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      // Call the server API to create/invite the manager
      const res = await fetch('/api/managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || email.trim(),
          hostelIds: selectedHostels,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add manager');

      setSuccess(`Manager ${email} has been invited and assigned to ${selectedHostels.length} hostel(s).`);
      setEmail('');
      setName('');
      setSelectedHostels([]);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(managerId: string, hostelId: string) {
    if (!confirm('Remove this manager from this hostel?')) return;
    const { error: err } = await s
      .from('manager_hostels')
      .delete()
      .eq('manager_id', managerId)
      .eq('hostel_id', hostelId);
    if (err) alert(getErrorMessage(err));
    else load();
  }

  // Group managers by manager_id
  const grouped = managers.reduce((acc: Record<string, any>, row: any) => {
    const mid = row.manager_id;
    if (!acc[mid]) {
      acc[mid] = {
        id: mid,
        name: row.profiles?.full_name || 'Unknown',
        hostels: [],
      };
    }
    acc[mid].hostels.push({ id: row.hostel_id, name: row.hostels?.name || '—' });
    return acc;
  }, {});

  const managerList = Object.values(grouped) as any[];

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Manage Team</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--charcoal)' }}>
          Invite managers and assign them to specific hostels. Managers can approve admissions and manage residents within their assigned hostels.
        </p>
      </div>

      {/* Add Manager Form */}
      <form onSubmit={addManager} className="card" style={{ marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Invite a Manager</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--charcoal)' }}>
          The manager will receive an email invite to set up their Roomly account. They will only see and manage the hostels you assign below.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,240px),1fr))', gap: 12 }}>
          <div>
            <label className="label">Manager Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Suresh Kumar" />
          </div>
          <div>
            <label className="label">Manager Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="manager@example.com" required />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="label">Assign to Hostels *</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {hostels.map(h => (
              <button
                key={h.id}
                type="button"
                onClick={() => toggleHostel(h.id)}
                className={`btn ${selectedHostels.includes(h.id) ? '' : 'secondary'} btn-sm`}
                style={{ fontSize: 12 }}
              >
                {selectedHostels.includes(h.id) ? '✓ ' : ''}{h.name}
              </button>
            ))}
            {hostels.length === 0 && (
              <span style={{ fontSize: 13, color: 'var(--charcoal)' }}>No hostels found — create one first.</span>
            )}
          </div>
        </div>

        {error && <div className="banner error" style={{ marginTop: 12 }}>{error}</div>}
        {success && <div className="banner success" style={{ marginTop: 12 }}>{success}</div>}

        <div style={{ marginTop: 16 }}>
          <button type="submit" className="btn" disabled={saving}>
            {saving && <span className="spinner light" />}
            {saving ? 'Inviting…' : 'Send Invite & Assign'}
          </button>
        </div>
      </form>

      {/* Existing Managers */}
      <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Current Managers ({managerList.length})</h2>

      {managerList.length === 0 && (
        <div className="empty-state">No managers assigned yet. Invite your first manager above.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {managerList.map((mgr: any) => (
          <div className="card" key={mgr.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>
                  {mgr.name}
                </span>
                <div style={{ fontSize: 12, color: 'var(--charcoal)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {mgr.hostels.map((h: any) => (
                    <span key={h.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span className="room-tag available" style={{ fontSize: 11 }}>🏢 {h.name}</span>
                      <button
                        onClick={() => removeAssignment(mgr.id, h.id)}
                        style={{
                          background: 'none', border: 'none', color: '#ff6666', fontSize: 13,
                          cursor: 'pointer', padding: '0 2px', lineHeight: 1,
                        }}
                        title="Remove from this hostel"
                      >×</button>
                    </span>
                  ))}
                </div>
              </div>
              <span className="badge badge-active">manager</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
