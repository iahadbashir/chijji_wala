// ============================================================
// HXD — Admin Authentication Utilities
// lib/auth.ts
//
// Simple password-based authentication for admin dashboard.
// Uses cookies to maintain session.
// ============================================================

import { cookies } from 'next/headers';

// Admin credentials (in production, use env variables and proper hashing)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'chijji2024';
const SESSION_COOKIE_NAME = 'hxd-admin-session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'hxd-secret-key-change-in-production';

/**
 * Verify admin password
 */
export function verifyAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

/**
 * Create admin session (set cookie)
 */
export async function createAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  
  // Create a simple session token (timestamp + secret)
  const sessionToken = Buffer.from(
    `${Date.now()}-${SESSION_SECRET}`
  ).toString('base64');

  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

/**
 * Check if user has valid admin session
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!session || !session.value) {
    return false;
  }

  // Basic validation (in production, use JWT or more robust session management)
  try {
    const decoded = Buffer.from(session.value, 'base64').toString();
    return decoded.includes(SESSION_SECRET);
  } catch {
    return false;
  }
}

/**
 * Clear admin session (logout)
 */
export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
