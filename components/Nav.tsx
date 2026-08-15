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
      {/* ── Desktop top header — only visible at ≥ 768px ── */}
      <header className="nav-header nav-desktop">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Logo box: signal-yellow bg, dark text — always explicit */}
            <div style={{
              width: 34, height: 34,
              background: '#F5C518',       /* --signal */
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18,
              color: '#0A0A0A',            /* always dark on yellow */
              flexShrink: 0,
            }}>R</div>
            <div>
              {/* Brand text: signal-yellow on dark nav bg — both explicit */}
              <span style={{
                fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16,
                color: '#F5C518',          /* --signal, explicit so it can't regress */
                display: 'block', lineHeight: 1.1,
              }}>Roomly</span>
              <span style={{ fontSize: 11, color: '#9A9990', display: 'block', marginTop: 1 }}>
                Hostel management
              </span>
            </div>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 16 }}>
            {links.map(([href, , label]) => (
              <Link key={href} href={href} className={`nav-link ${pathname === href ? 'active' : ''}`}>{label}</Link>
            ))}
          </nav>
        </div>
        <button onClick={handleSignOut} className="btn secondary btn-sm">Sign out</button>
      </header>

      {/* ── Mobile top bar with hamburger — only visible at < 768px ── */}
      <header className="nav-header nav-mobile">
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: '#F5C518',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17,
            color: '#0A0A0A',
          }}>R</div>
          <span style={{
            fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16,
            color: '#F5C518',
          }}>Roomly</span>
        </Link>

        <button
          onClick={() => setOpen(v => !v)}
          style={{
            background: 'none', border: '1px solid #2E2E2C',
            borderRadius: 6, padding: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40,
          }}
          aria-label="Menu"
        >
          {open ? (
            /* Close icon — signal yellow so it's always visible on dark nav */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5C518" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            /* Hamburger — ink color (warm white) on dark nav */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EDECEA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
        </button>

        {/* Dropdown overlay */}
        {open && (
          <div onClick={() => setOpen(false)} style={{
            position: 'fixed', top: 60, bottom: 0, left: 0, right: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              position: 'absolute', top: 0, right: 0, left: 0,
              background: '#1C1C1A',       /* --surface, explicit */
              borderBottom: '1px solid #2E2E2C',
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
                    color: pathname === href ? '#F5C518' : '#EDECEA',
                    fontWeight: pathname === href ? 700 : 500,
                    fontSize: 15,
                    background: pathname === href ? 'rgba(245,197,24,0.08)' : 'none',
                    borderLeft: pathname === href ? '3px solid #F5C518' : '3px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
                  {label}
                </Link>
              ))}
              <div style={{ borderTop: '1px solid #2E2E2C', margin: '8px 0', padding: '8px 24px' }}>
                <button
                  onClick={() => { setOpen(false); handleSignOut(); }}
                  className="btn secondary btn-sm"
                  style={{ width: '100%', color: '#EDECEA' }}
                >
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
