// ============================================================
// HXD — Next.js Middleware
// middleware.ts
//
// Security features:
//   1. Admin route protection (session cookie validation)
//   2. Rate limiting (10 req/min per IP for API/actions)
//   3. 429 response when limit exceeded
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'hxd-admin-session';

// ── RATE LIMITING ──────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp (ms)
}

// In-memory store (note: resets on server restart, use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function getRateLimitKey(request: NextRequest): string {
  // Prioritize real IP from headers, fall back to direct connection IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0] || realIp || request.ip || 'unknown';
  
  return `ratelimit:${ip}`;
}

function isRateLimited(request: NextRequest): boolean {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // No entry or window expired → create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  // Increment count
  entry.count += 1;

  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return true; // Rate limit exceeded
  }

  rateLimitStore.set(key, entry);
  return false;
}

// Clean up expired entries every 5 minutes to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// ── MIDDLEWARE ─────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Rate Limiting ───────────────────────────────────────
  // Apply to API routes and Server Actions (POST requests to /)
  const isApiRoute = pathname.startsWith('/api/');
  const isServerAction = request.method === 'POST' && !pathname.startsWith('/_next');

  if (isApiRoute || isServerAction) {
    if (isRateLimited(request)) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again in 1 minute.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }
  }

  // ── 2. Admin Route Protection ──────────────────────────────
  // Skip middleware for public routes
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
    '/api/:path*',
    // Match all POST requests (Server Actions)
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
