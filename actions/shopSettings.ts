'use server';

// ============================================================
// HXD — Shop Settings Actions
// actions/shopSettings.ts
//
// Server actions for managing shop configuration:
//   - Shop open/closed status
//   - Banner message for announcements
// ============================================================

import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ShopSettings {
  id?: string;
  is_open: boolean;
  banner_message: string | null;
  updated_at?: string;
}

// ── Fetch current settings ────────────────────────────────────

export async function getShopSettings(): Promise<ShopSettings | null> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('shop_settings')
    .select('*')
    .single();

  if (error) {
    console.error('[getShopSettings]', error);
    return null;
  }

  return data as ShopSettings;
}

// ── Update shop status ────────────────────────────────────────

export async function updateShopStatus(isOpen: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();
    
    // Try to update existing row, or insert if none exists
    const { data: existingSettings } = await supabase
      .from('shop_settings')
      .select('id')
      .single();

    if (existingSettings) {
      // Update existing
      const { error } = await supabase
        .from('shop_settings')
        .update({ 
          is_open: isOpen,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSettings.id);

      if (error) {
        console.error('[updateShopStatus] Update error:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('shop_settings')
        .insert({
          is_open: isOpen,
          banner_message: null,
        });

      if (error) {
        console.error('[updateShopStatus] Insert error:', error);
        return { success: false, error: error.message };
      }
    }

    revalidatePath('/admin/dashboard/settings');
    revalidatePath('/');
    
    return { success: true };
  } catch (err) {
    console.error('[updateShopStatus] Unexpected error:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

// ── Update banner message ─────────────────────────────────────

export async function updateBannerMessage(message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();
    
    // Trim and convert empty string to null
    const cleanMessage = message.trim() || null;
    
    // Try to update existing row, or insert if none exists
    const { data: existingSettings } = await supabase
      .from('shop_settings')
      .select('id')
      .single();

    if (existingSettings) {
      // Update existing
      const { error } = await supabase
        .from('shop_settings')
        .update({ 
          banner_message: cleanMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSettings.id);

      if (error) {
        console.error('[updateBannerMessage] Update error:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('shop_settings')
        .insert({
          is_open: true,
          banner_message: cleanMessage,
        });

      if (error) {
        console.error('[updateBannerMessage] Insert error:', error);
        return { success: false, error: error.message };
      }
    }

    revalidatePath('/admin/dashboard/settings');
    revalidatePath('/');
    
    return { success: true };
  } catch (err) {
    console.error('[updateBannerMessage] Unexpected error:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}
