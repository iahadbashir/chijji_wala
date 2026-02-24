// ============================================================
// HXD — Business Fee Constants
// lib/fees.ts
//
// Single source of truth for all delivery fee logic.
// If fees change, update here only — both the UI and Server
// Action import from this file.
// ============================================================

/** Standard flat delivery fee (PKR) applied to every order */
export const BASE_DELIVERY_FEE = 150;

/**
 * Extra fee (PKR) added when the basket contains ≥ 1 fragile item.
 * Covers special packaging + careful-handling rider instructions.
 */
export const FRAGILE_ITEM_FEE = 100;

/**
 * Pre-order constraints: customers must book within this operating window.
 * Values match the products.available_from / available_until columns
 * for cakes/flowers (the only categories that need pre-ordering).
 *
 * Used by both the DateTimePicker validator and the Server Action.
 */
export const PREORDER_WINDOW = {
  openHour: 10,    // 10:00 AM
  openMinute: 0,
  closeHour: 23,   // 11:00 PM
  closeMinute: 0,
} as const;

/** Minimum lead-time (ms) a pre-order must be in the future */
export const PREORDER_MIN_LEAD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Validate that a requested delivery timestamp satisfies all pre-order rules:
 *   1. Must be at least PREORDER_MIN_LEAD_MS in the future
 *   2. Must fall within [PREORDER_WINDOW.openHour, PREORDER_WINDOW.closeHour]
 *
 * Returns null on success, or an error string to show the user.
 */
export function validateDeliveryTime(
  isoString: string,
  now: Date = new Date(),
): string | null {
  const requested = new Date(isoString);

  if (isNaN(requested.getTime())) {
    return 'Please select a valid delivery time.';
  }

  const minAllowed = new Date(now.getTime() + PREORDER_MIN_LEAD_MS);
  if (requested < minAllowed) {
    return 'Delivery time must be at least 30 minutes from now.';
  }

  const h = requested.getHours();
  const m = requested.getMinutes();
  const totalMins = h * 60 + m;
  const openMins  = PREORDER_WINDOW.openHour  * 60 + PREORDER_WINDOW.openMinute;
  const closeMins = PREORDER_WINDOW.closeHour * 60 + PREORDER_WINDOW.closeMinute;

  if (totalMins < openMins || totalMins > closeMins) {
    return `Delivery is only available between 10:00 AM and 11:00 PM.`;
  }

  return null;
}
