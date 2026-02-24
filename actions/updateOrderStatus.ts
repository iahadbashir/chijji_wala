'use server';

// ============================================================
// HXD — Update Order Status Server Action
// actions/updateOrderStatus.ts
// ============================================================

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import type { OrderStatus, UUID } from '@/types/database';

export const ADMIN_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded',
];

export type UpdateStatusResult =
  | { success: true }
  | { success: false; error: string };

export async function updateOrderStatus(
  orderId: UUID,
  newStatus: OrderStatus,
): Promise<UpdateStatusResult> {
  if (!ADMIN_STATUSES.includes(newStatus)) {
    return { success: false, error: 'Invalid status.' };
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId);

  if (error) {
    console.error(`[updateOrderStatus] Failed for order ${orderId}:`, error);
    return { success: false, error: 'Failed to update status. Try again.' };
  }

  // Revalidate the admin dashboard so the next request reflects the change
  revalidatePath('/admin/orders');

  return { success: true };
}
