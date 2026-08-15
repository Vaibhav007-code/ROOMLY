import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--cream)', color: 'var(--ink)' }}>
      {/* Nav */}
      <header style={{ borderBottom: '1px solid var(--fog)', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(247,247,242,0.92)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 18, color: '#16281F' }}>R</div>
          <div>
            <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: 18, color: 'var(--forest-dark)', display: 'block', lineHeight: 1 }}>Roomly</span>
            <span style={{ fontSize: 11, color: 'var(--charcoal)', display: 'block', marginTop: 2 }}>Hostel management, simplified.</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/login" className="btn secondary btn-sm">Log In</Link>
          <Link href="/signup" className="btn btn-sm">Sign Up</Link>
        </div>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 20px 64px', maxWidth: 760, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'inline-block', background: 'rgba(168, 217, 143, 0.25)', color: 'var(--forest-dark)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 16px', borderRadius: 9999, marginBottom: 24, border: '1px solid rgba(76, 154, 91, 0.3)' }}>
          For Hostel Owners &amp; Managers
        </div>

        <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(32px,7vw,54px)', lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--forest-dark)' }}>
          Hostel management,<br />simplified.
        </h1>

        <p style={{ fontSize: 'clamp(15px,3vw,18px)', color: 'var(--charcoal)', lineHeight: 1.7, maxWidth: 540, margin: '0 0 36px' }}>
          Manage rooms, rent, admissions, WhatsApp reminders, and PDF contracts — all from your phone. Built for Indian hostel owners.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 64 }}>
          <Link href="/signup" className="btn" style={{ padding: '12px 32px', fontSize: 15 }}>Start for Free →</Link>
          <Link href="/login" className="btn secondary" style={{ padding: '12px 32px', fontSize: 15 }}>Log In</Link>
        </div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,210px),1fr))', gap: 16, width: '100%', textAlign: 'left' }}>
          {[
            { icon: '🏢', title: 'Room Tracking', desc: 'Live capacity, floor-wise occupancy, and instant resident transfers.' },
            { icon: '💬', title: 'WhatsApp Built-In', desc: 'One-tap rent reminders, receipts, and contract links via wa.me.' },
            { icon: '📄', title: 'Digital Contracts', desc: 'Auto-generate PDF agreements and QR codes for self-check-in.' },
          ].map(f => (
            <div key={f.title} className="card" style={{ padding: '22px 20px' }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--forest-dark)' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ borderTop: '1px solid var(--fog)', padding: '24px 24px', textAlign: 'center', fontSize: 13, color: 'var(--charcoal)' }}>
        © {new Date().getFullYear()} Roomly. All rights reserved.
      </footer>
    </div>
  );
}
