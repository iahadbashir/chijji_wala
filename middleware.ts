// ============================================================
// HXD — Next.js Middleware
// middleware.ts
//
// Protects admin routes - redirects to login if not authenticated.
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'hxd-admin-session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for login page and public assets
  if (
    pathname === '/admin/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    !pathname.startsWith('/admin')
  ) {
    return NextResponse.next();
  }

  // Check for admin session cookie
  const session = request.cookies.get(SESSION_COOKIE_NAME);

  if (!session || !session.value) {
    // Redirect to login
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Session exists, allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
  ],
};
