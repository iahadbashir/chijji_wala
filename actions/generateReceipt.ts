// ============================================================
// HXD — Generate Receipt Utilities
// actions/generateReceipt.ts
//
// Utility functions for receipt generation and sharing.
// These are NOT Server Actions - they're pure utility functions
// that can be used on both client and server.
// ============================================================

import type { OrderWithItems } from '@/types/database';

export interface ReceiptData {
  order: OrderWithItems;
  shortId: string;
}

/**
 * Build a WhatsApp share URL with the receipt image attached.
 * 
 * Note: WhatsApp Web API doesn't support image attachments directly.
 * On mobile, we use navigator.share() which DOES support files.
 * This function returns the text-only deep link as a fallback.
 */
export function buildWhatsAppShareUrl(shortId: string): string {
  const message = `Oye Chijji! 👋 Here is your receipt for Order #${shortId}. Your treats are on the way! 🎂✨`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Build a tracking URL for the QR code.
 * Points to the order confirmation page with the full order ID.
 */
export function buildTrackingUrl(orderId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/order-confirmation?id=${orderId}`;
}
