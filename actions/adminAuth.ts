'use server';

// ============================================================
// HXD — Admin Authentication Actions
// actions/adminAuth.ts
//
// Security updates:
//   - bcrypt.compare() instead of plaintext password check
//   - Password hash stored in env var (ADMIN_PASSWORD_HASH)
//   - Timing-safe comparison
// ============================================================

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { createAdminSession, clearAdminSession } from '@/lib/auth';

export type AuthResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Admin login action with bcrypt verification
 */
export async function loginAdmin(password: string): Promise<AuthResult> {
  if (!password) {
    return { success: false, error: 'Password is required' };
  }

  // Check if using bcrypt hash (new) or plaintext (legacy)
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const plaintextPassword = process.env.ADMIN_PASSWORD;

  let isValid = false;

  if (passwordHash) {
    // New: bcrypt verification
    try {
      isValid = await bcrypt.compare(password, passwordHash);
    } catch (error) {
      console.error('[loginAdmin] bcrypt error:', error);
      return { success: false, error: 'Authentication error' };
    }
  } else if (plaintextPassword) {
    // Legacy: plaintext comparison (for backward compatibility)
    console.warn('[loginAdmin] Using plaintext password - please migrate to ADMIN_PASSWORD_HASH');
    isValid = password === plaintextPassword;
  } else {
    console.error('[loginAdmin] Neither ADMIN_PASSWORD_HASH nor ADMIN_PASSWORD is set');
    return { success: false, error: 'Server configuration error' };
  }

  if (!isValid) {
    // Add artificial delay to prevent timing attacks
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: false, error: 'Invalid password' };
  }

  await createAdminSession();
  
  return { success: true };
}

/**
 * Admin logout action
 */
export async function logoutAdmin(): Promise<void> {
  await clearAdminSession();
  redirect('/admin/login');
}
