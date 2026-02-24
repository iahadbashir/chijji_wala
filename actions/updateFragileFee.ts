'use server';

// ============================================================
// HXD — Update Fragile Fee Server Action
// actions/updateFragileFee.ts
//
// Writes the admin-set fragile surcharge to the singleton
// settings row. The Server Action is the only write path —
// client code never touches the DB directly.
// ============================================================

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';

export type UpdateFragileFeeResult =
  | { success: true;  updatedFee: number }
  | { success: false; error: string };

/**
 * Fetch the current fragile fee from the singleton settings row.
 * Called server-side to seed the initial value into the component.
 *
 * Returns the fee as a number, or the static fallback (100) if the
 * settings table is not yet seeded.
 */
export async function getSettings(): Promise<{
  current_delivery_fee: number;
  current_fragile_fee: number;
}> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('settings')
    .select('current_delivery_fee, current_fragile_fee')
    .single();

  if (error || !data) {
    // Graceful fallback to the compile-time constants
    return { current_delivery_fee: 150, current_fragile_fee: 100 };
  }

  const settings = data as { current_delivery_fee: string; current_fragile_fee: string };

  return {
    current_delivery_fee: parseFloat(settings.current_delivery_fee),
    current_fragile_fee:  parseFloat(settings.current_fragile_fee),
  };
}

/**
 * Overwrite the fragile item surcharge in the singleton settings row.
 *
 * Validation rules:
 *   • Must be a finite number
 *   • Must be ≥ 0  (zero is valid — disables the surcharge)
 *   • Maximum 9999.99 (NUMERIC(10,2) ceiling for sanity)
 */
export async function updateFragileFee(
  newFee: number,
): Promise<UpdateFragileFeeResult> {
  // ── Server-side validation ───────────────────────────────────
  if (!Number.isFinite(newFee)) {
    return { success: false, error: 'Fee must be a valid number.' };
  }
  if (newFee < 0) {
    return { success: false, error: 'Fee cannot be negative.' };
  }
  if (newFee > 9_999.99) {
    return { success: false, error: 'Fee cannot exceed Rs. 9,999.99.' };
  }

  const supabase = createServiceClient();

  // Update the singleton row (identified by is_singleton = TRUE).
  // We never reference it by ID to avoid hardcoding the UUID.
  const { error } = await supabase
    .from('settings')
    // @ts-expect-error - Supabase type inference issue
    .update({ current_fragile_fee: newFee.toFixed(2) })
    .eq('is_singleton', true);

  if (error) {
    console.error('[updateFragileFee] DB write failed:', error);
    return {
      success: false,
      error: 'Database update failed. Please try again.',
    };
  }

  // Revalidate any page that displays the fee to the customer or ops team
  revalidatePath('/admin/orders');
  revalidatePath('/checkout');

  return { success: true, updatedFee: newFee };
}
