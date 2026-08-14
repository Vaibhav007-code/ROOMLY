import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: { headers: req.headers } });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await sb.auth.getUser();
  const path = req.nextUrl.pathname;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // Fast role check directly from user metadata without extra database round-trip
  const role = user.user_metadata?.role || 'owner';

  if (path.startsWith('/dashboard') && role === 'student') {
    const url = req.nextUrl.clone();
    url.pathname = '/student';
    return NextResponse.redirect(url);
  }

  if (path.startsWith('/student') && role === 'owner') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = { matcher: ['/dashboard/:path*', '/student', '/student/:path*'] };
