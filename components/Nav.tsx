'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { useState } from 'react';

const links: [string, string, string][] = [
  ['/dashboard',           '⊞',  'Overview'],
  ['/dashboard/hostels',   '🏢', 'Rooms'],
  ['/dashboard/requests',  '📋', 'Requests'],
  ['/dashboard/students',  '👤', 'Residents'],
  ['/dashboard/rent',      '₹',  'Rent'],
  ['/dashboard/complaints','💬', 'Issues'],
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.push('/login');
  };

  return (
    <>
      {/* ── Desktop top header ── */}
      <header className="nav-header" style={{ display: 'none' }} id="nav-desktop">
        <style>{`@media(min-width:768px){#nav-desktop{display:flex!important;}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, background: 'var(--signal)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>R</div>
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--paper)' }}>Roomly</span>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 12 }}>
            {links.map(([href, , label]) => (
              <Link key={href} href={href} className={`nav-link ${pathname === href ? 'active' : ''}`}>{label}</Link>
            ))}
          </nav>
        </div>
        <button onClick={handleSignOut} className="btn secondary btn-sm">Sign out</button>
      </header>

      {/* ── Mobile top bar with hamburger ── */}
      <header className="nav-header" style={{ display: 'flex' }} id="nav-mobile">
        <style>{`@media(min-width:768px){#nav-mobile{display:none!important;}}`}</style>

        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'var(--signal)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>R</div>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--paper)' }}>Roomly</span>
        </Link>

        <button
          onClick={() => setOpen(v => !v)}
          style={{ background: 'none', border: '1px solid var(--fog)', borderRadius: 6, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40 }}
          aria-label="Menu"
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="15" y2="15"/>
              <line x1="15" y1="3" x2="3" y2="15"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="5" x2="16" y2="5"/>
              <line x1="2" y1="9" x2="16" y2="9"/>
              <line x1="2" y1="13" x2="16" y2="13"/>
            </svg>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div onClick={() => setOpen(false)} style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              position: 'absolute', top: 60, right: 0, left: 0,
              background: 'var(--surface)', borderBottom: '1px solid var(--fog)',
              padding: '8px 0',
            }}>
              {links.map(([href, icon, label]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 24px',
                    textDecoration: 'none',
                    color: pathname === href ? 'var(--signal)' : 'var(--ink)',
                    fontWeight: pathname === href ? 700 : 500,
                    fontSize: 15,
                    background: pathname === href ? 'rgba(245,197,24,0.08)' : 'none',
                    borderLeft: pathname === href ? '3px solid var(--signal)' : '3px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
                  {label}
                </Link>
              ))}
              <div style={{ borderTop: '1px solid var(--fog)', margin: '8px 0', padding: '8px 24px' }}>
                <button onClick={() => { setOpen(false); handleSignOut(); }} className="btn secondary btn-sm" style={{ width: '100%', color: 'var(--ink)' }}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
