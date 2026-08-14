'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { getErrorMessage } from '@/lib/errorMessages';

export default function Rent() {
  const s = supabaseBrowser();
  const [payments, setPayments] = useState<any[]>([]);
  const [tab, setTab] = useState<'due'|'all'>('due');

  const load = async () => {
    const { data } = await s
      .from('rent_payments')
      .select('*,students(full_name,phone,whatsapp_number,hostels(name))')
      .order('due_date');
    setPayments(data || []);
  };

  useEffect(() => { load(); }, []);

  async function paid(p: any) {
    const due = Number(p.amount_due) - Number(p.amount_paid);
    const str = prompt(`Enter collected amount (Due: ₹${due}):`, String(due));
    if (!str) return;
    const amount = Number(str);
    if (!amount || amount <= 0) return alert('Enter a valid amount');
    const { error } = await s.rpc('record_rent_payment', { p_payment: p.id, p_amount: amount });
    if (error) return alert(getErrorMessage(error));
    try {
      window.open(buildWhatsAppLink(p.students.whatsapp_number || p.students.phone, 'rent_receipt', {
        name: p.students.full_name, amount, hostelName: p.students.hostels?.name,
      }), '_blank');
    } catch {}
    load();
  }

  function remind(p: any) {
    try {
      window.open(buildWhatsAppLink(p.students.whatsapp_number || p.students.phone, 'rent_reminder', {
        name: p.students.full_name,
        amount: Number(p.amount_due) - Number(p.amount_paid),
        dueDate: p.due_date,
        hostelName: p.students.hostels?.name,
      }), '_blank');
    } catch (e) { alert(getErrorMessage(e)); }
  }

  async function generate() {
    const period = new Date(); period.setDate(1);
    const { data, error } = await s.rpc('generate_rent_period', { p_period: period.toISOString().slice(0,10), p_due_date: null });
    if (error) alert(getErrorMessage(error));
    else { alert(`${data} rent row(s) generated.`); load(); }
  }

  const due = payments.filter(p => p.status !== 'paid');
  const shown = tab === 'due' ? due : payments;

  return (
    <div className="page">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Rent Collection</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--charcoal)', fontSize: 14 }}>
            Track dues, record payments, send WhatsApp receipts.
          </p>
        </div>
        <button className="btn" onClick={generate} style={{ flexShrink: 0 }}>⚡ Generate Month</button>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div className="card" style={{ padding: '14px 16px' }}>
          <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', margin: '0 0 4px' }}>Pending / Overdue</p>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{due.length}</p>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', margin: '0 0 4px' }}>Total Records</p>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{payments.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button className={`btn ${tab==='due' ? '' : 'secondary'} btn-sm`} onClick={() => setTab('due')}>Pending ({due.length})</button>
        <button className={`btn ${tab==='all' ? '' : 'secondary'} btn-sm`} onClick={() => setTab('all')}>All Records</button>
      </div>

      {shown.length === 0 && (
        <div className="empty-state">
          {tab === 'due' ? 'All residents are up to date! 🎉' : 'No rent records. Click "Generate Month" above.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.map(p => {
          const remaining = Number(p.amount_due) - Number(p.amount_paid);
          const days = Math.max(0, Math.floor((Date.now() - new Date(p.due_date).getTime()) / 864e5));
          const isPaid = p.status === 'paid';
          return (
            <div className="card" key={p.id} style={{ opacity: isPaid ? 0.7 : 1 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15 }} className="text-clamp">
                      {p.students?.full_name}
                    </span>
                    <span className={`badge ${isPaid ? 'badge-paid' : p.status==='partial' ? 'badge-pending' : 'badge-due'}`}>
                      {p.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--charcoal)', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                    {p.period} · ₹{p.amount_paid} / ₹{p.amount_due}
                    {!isPaid && days > 0 && <span style={{ marginLeft: 6 }}>· {days}d overdue</span>}
                  </p>
                </div>
                <div className="btn-row">
                  {!isPaid && (
                    <button className="btn btn-sm" onClick={() => paid(p)}>💰 Collect</button>
                  )}
                  <button className="btn secondary btn-sm" onClick={() => remind(p)}>💬 Remind</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
