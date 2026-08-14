import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--paper)', color: 'var(--ink)' }}>
      {/* Nav */}
      <header style={{ borderBottom: '1px solid var(--fog)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(250,250,248,0.92)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--signal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>R</div>
          <div>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--ink)', display: 'block', lineHeight: 1 }}>Roomly</span>
            <span style={{ fontSize: 11, color: 'var(--charcoal)', display: 'block' }}>Hostel management, simplified.</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/login" className="btn secondary btn-sm">Log In</Link>
          <Link href="/signup" className="btn btn-sm">Sign Up</Link>
        </div>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 20px 64px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'inline-block', background: 'var(--signal)', color: 'var(--ink)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 14px', borderRadius: 100, marginBottom: 24 }}>
          For Hostel Owners
        </div>

        <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(28px,7vw,52px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          Hostel management,<br />simplified.
        </h1>

        <p style={{ fontSize: 'clamp(15px,3vw,18px)', color: 'var(--charcoal)', lineHeight: 1.7, maxWidth: 520, margin: '0 0 36px' }}>
          Manage rooms, rent, admissions, WhatsApp reminders, and PDF contracts — all from your phone. Built for Indian hostel owners.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 64 }}>
          <Link href="/signup" className="btn" style={{ padding: '12px 28px', fontSize: 15 }}>Start for Free →</Link>
          <Link href="/login" className="btn secondary" style={{ padding: '12px 28px', fontSize: 15 }}>Log In</Link>
        </div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,200px),1fr))', gap: 12, width: '100%', textAlign: 'left' }}>
          {[
            { icon: '🏷️', title: 'Room Tracking', desc: 'Live capacity, floor-wise occupancy, and instant resident transfers.' },
            { icon: '💬', title: 'WhatsApp Built-In', desc: 'One-tap rent reminders, receipts, and contract links via wa.me.' },
            { icon: '📄', title: 'Digital Contracts', desc: 'Auto-generate PDF agreements and QR codes for self-check-in.' },
          ].map(f => (
            <div key={f.title} className="card" style={{ padding: '18px 16px' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
              <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ borderTop: '1px solid var(--fog)', padding: '20px 24px', textAlign: 'center', fontSize: 13, color: 'var(--charcoal)' }}>
        © {new Date().getFullYear()} Roomly. All rights reserved.
      </footer>
    </div>
  );
}
