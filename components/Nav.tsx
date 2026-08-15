'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { useState, useEffect } from 'react';

const links: [string, string, string][] = [
  ['/dashboard',           '⊞',  'Overview'],
  ['/dashboard/hostels',   '🏢', 'Rooms'],
  ['/dashboard/requests',  '📋', 'Requests'],
  ['/dashboard/students',  '👤', 'Residents'],
  ['/dashboard/rent',      '₹',  'Rent'],
  ['/dashboard/complaints','💬', 'Issues'],
  ['/dashboard/managers',  '👥', 'Team'],
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadRole() {
      const s = supabaseBrowser();
      const { data: { user } } = await s.auth.getUser();
      if (user) {
        const { data: profile } = await s.from('profiles').select('role').eq('id', user.id).maybeSingle();
        setRole(profile?.role || null);
      }
    }
    loadRole();
  }, []);

  const handleSignOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.push('/login');
  };

  const visibleLinks = links.filter(([href]) => href !== '/dashboard/managers' || role === 'owner');

  return (
    <>
      {/* ── Desktop top header — only visible at ≥ 768px ── */}
      <header className="nav-header nav-desktop">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Logo box: leaf gradient bg, forest dark text */}
            <div style={{
              width: 34, height: 34,
              background: 'linear-gradient(135deg, #A8D98F, #4C9A5B)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18,
              color: '#16281F',
              flexShrink: 0,
            }}>R</div>
            <div>
              <span style={{
                fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 16,
                color: '#F7F7F2',
                display: 'block', lineHeight: 1.1,
              }}>Roomly</span>
              <span style={{ fontSize: 11, color: '#A8D98F', display: 'block', marginTop: 1 }}>
                Hostel management
              </span>
            </div>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 20 }}>
            {visibleLinks.map(([href, , label]) => (
              <Link key={href} href={href} className={`nav-link ${pathname === href ? 'active' : ''}`}>{label}</Link>
            ))}
          </nav>
        </div>
        <button onClick={handleSignOut} className="btn secondary btn-sm" style={{ background: 'rgba(255,255,255,0.12)', color: '#F7F7F2', border: '1px solid rgba(255,255,255,0.2)' }}>
          Sign out
        </button>
      </header>

      {/* ── Mobile top bar with hamburger — only visible at < 768px ── */}
      <header className="nav-header nav-mobile">
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #A8D98F, #4C9A5B)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 17,
            color: '#16281F',
          }}>R</div>
          <span style={{
            fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 16,
            color: '#F7F7F2',
          }}>Roomly</span>
        </Link>

        <button
          onClick={() => setOpen(v => !v)}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 9999, padding: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40,
          }}
          aria-label="Menu"
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A8D98F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F7F7F2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
        </button>

        {/* Dropdown overlay */}
        {open && (
          <div onClick={() => setOpen(false)} style={{
            position: 'fixed', top: 64, bottom: 0, left: 0, right: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              position: 'absolute', top: 0, right: 0, left: 0,
              background: '#16281F',
              borderBottom: '1px solid rgba(168, 217, 143, 0.2)',
              padding: '8px 0',
            }}>
              {visibleLinks.map(([href, icon, label]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 24px',
                    textDecoration: 'none',
                    color: pathname === href ? '#16281F' : '#F7F7F2',
                    fontWeight: pathname === href ? 700 : 500,
                    fontSize: 15,
                    background: pathname === href ? '#A8D98F' : 'none',
                    borderRadius: pathname === href ? '9999px' : 0,
                    margin: pathname === href ? '4px 16px' : '0',
                  }}
                >
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
                  {label}
                </Link>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '8px 0', padding: '8px 24px' }}>
                <button
                  onClick={() => { setOpen(false); handleSignOut(); }}
                  className="btn secondary btn-sm"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.15)', color: '#F7F7F2' }}
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
