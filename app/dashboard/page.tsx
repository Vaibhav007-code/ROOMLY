'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';

type Counts = { hostels: number; requests: number; students: number; due: number; complaints: number };

export default function Dashboard() {
  const [c, setC] = useState<Counts | null>(null);

  useEffect(() => {
    const s = supabaseBrowser();
    (async () => {
      const x = await Promise.all([
        s.from('hostels').select('*', { count: 'exact', head: true }),
        s.from('pending_admissions').select('*', { count: 'exact', head: true }).is('reviewed_at', null).is('rejected_at', null),
        s.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        s.from('rent_payments').select('*', { count: 'exact', head: true }).in('status', ['due', 'partial', 'overdue']),
        s.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      setC({ hostels: x[0].count||0, requests: x[1].count||0, students: x[2].count||0, due: x[3].count||0, complaints: x[4].count||0 });
    })();
  }, []);

  if (!c) return (
    <div className="page" style={{ paddingTop: 80, color: 'var(--charcoal)' }}>Loading dashboard…</div>
  );

  const cards = [
    { title: 'New Applications', count: c.requests, href: '/dashboard/requests', action: 'Review →', urgent: c.requests > 0 },
    { title: 'Rent Due', count: c.due, href: '/dashboard/rent', action: 'Collect →', urgent: c.due > 0 },
    { title: 'Open Complaints', count: c.complaints, href: '/dashboard/complaints', action: 'Resolve →', urgent: c.complaints > 0 },
    { title: 'Active Residents', count: c.students, href: '/dashboard/students', action: 'Directory →', urgent: false },
  ];

  return (
    <div className="page">
      <div style={{ marginBottom: 28 }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--charcoal)' }}>
          ROOMLY
        </span>
        <h1 style={{ margin: '4px 0 0' }}>Hostel Overview</h1>
      </div>

      {c.hostels === 0 ? (
        <div className="card card-signal" style={{ padding: 28 }}>
          <h2 style={{ margin: '0 0 8px' }}>Welcome! Add your first hostel</h2>
          <p style={{ color: 'var(--charcoal)', marginBottom: 20 }}>
            Create a hostel building, add rooms, and start accepting residents via QR code.
          </p>
          <Link className="btn" href="/dashboard/hostels">+ Add My First Hostel</Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
            {cards.map(card => (
              <Link
                key={card.title}
                href={card.href}
                style={{ textDecoration: 'none' }}
              >
                <div className="card" style={{ borderColor: card.urgent ? 'var(--ink)' : 'var(--fog)', height: '100%' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--charcoal)', margin: '0 0 8px' }}>
                    {card.title}
                  </p>
                  <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 36, margin: '0 0 12px', fontVariantNumeric: 'tabular-nums', color: card.urgent ? 'var(--signal)' : 'var(--ink)' }}>
                    {card.count}
                  </p>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--signal)' }}>{card.action}</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Quick Actions</h3>
            <div className="btn-row">
              <Link className="btn" href="/dashboard/students">+ Add Resident</Link>
              <Link className="btn secondary" href="/dashboard/hostels">🏢 Rooms & QR</Link>
              <Link className="btn secondary" href="/dashboard/import">📊 Import CSV</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
