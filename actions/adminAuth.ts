'use server';

// ============================================================
// HXD — Admin Authentication Actions
// actions/adminAuth.ts
// ============================================================

import { redirect } from 'next/navigation';
import { verifyAdminPassword, createAdminSession, clearAdminSession } from '@/lib/auth';

export type AuthResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Admin login action
 */
export async function loginAdmin(password: string): Promise<AuthResult> {
  if (!password) {
    return { success: false, error: 'Password is required' };
  }

  const isValid = verifyAdminPassword(password);

  if (!isValid) {
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
