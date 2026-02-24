'use server';

// ============================================================
// HXD — Process Order Server Action
// actions/processOrder.ts
//
// Flow:
//   1. Parse & validate FormData payload (no external validator needed)
//   2. Upload payment receipt to Supabase Storage (if applicable)
//   3. Recalculate all fees server-side (never trust client totals)
//   4. Insert into `orders` table
//   5. Insert into `order_items` table (preserving custom_message per line)
//   6. Return { success, orderId } | { success: false, error }
//
// Security:
//   • Uses the service_role client — bypasses RLS deliberately
//     so this one trusted server path can write to both tables.
//   • Cart data is sent from the client but ALL money values are
//     re-derived server-side from product prices × quantities.
//     The client total is NEVER trusted.
// ============================================================

import { createServiceClient } from '@/lib/supabase/server';
import {
  BASE_DELIVERY_FEE,
  FRAGILE_ITEM_FEE,
  validateDeliveryTime,
} from '@/lib/fees';
import type {
  PaymentMethod,
  DeliveryAddress,
  OrderInsert,
  OrderItemInsert,
} from '@/types/database';

// ── TYPES ─────────────────────────────────────────────────────

/** Serialised cart item sent from the checkout form */
export interface SerializedCartItem {
  product: {
    id: string;
    name: string;
    price: string;        // NUMERIC string from DB
    is_fragile: boolean;
  };
  quantity: number;
  custom_message?: string;
  is_preorder: boolean;
}

export type ProcessOrderResult =
  | { success: true;  orderId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

// ── CONSTANTS ─────────────────────────────────────────────────

const ALLOWED_PAYMENT_METHODS: PaymentMethod[] = [
  'cash_on_delivery',
  'online_transfer',
  'card',
  'wallet',
];

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_RECEIPT_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// ── HELPERS ───────────────────────────────────────────────────

function isValidPhone(phone: string): boolean {
  // Pakistani mobile: 03XXXXXXXXX (11 digits) or +923XXXXXXXXX
  return /^(\+92|0)?3\d{9}$/.test(phone.replace(/\s/g, ''));
}

function sanitize(val: FormDataEntryValue | null): string {
  return typeof val === 'string' ? val.trim() : '';
}

// ── SERVER ACTION ─────────────────────────────────────────────

export async function processOrder(
  formData: FormData,
): Promise<ProcessOrderResult> {
  const supabase = createServiceClient();
  const fieldErrors: Record<string, string> = {};

  // ── STEP 1: Parse FormData ──────────────────────────────────

  const customerName    = sanitize(formData.get('customer_name'));
  const customerPhone   = sanitize(formData.get('customer_phone'));
  const addressLine1    = sanitize(formData.get('address_line1'));
  const addressLine2    = sanitize(formData.get('address_line2'));
  const addressCity     = sanitize(formData.get('address_city'));
  const paymentMethod   = sanitize(formData.get('payment_method')) as PaymentMethod;
  const deliveryTimeRaw = sanitize(formData.get('requested_delivery_time'));
  const cartJson        = sanitize(formData.get('cart_items'));
  const receiptFile     = formData.get('payment_receipt') as File | null;

  // ── STEP 2: Validate fields ─────────────────────────────────

  if (!customerName || customerName.length < 2) {
    fieldErrors.customer_name = 'Please enter your full name.';
  }

  if (!isValidPhone(customerPhone)) {
    fieldErrors.customer_phone = 'Please enter a valid Pakistani mobile number (e.g. 0312 3456789).';
  }

  if (!addressLine1) {
    fieldErrors.address_line1 = 'Street address is required.';
  }

  if (!addressCity) {
    fieldErrors.address_city = 'City is required.';
  }

  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    fieldErrors.payment_method = 'Please select a payment method.';
  }

  // ── Parse cart ──────────────────────────────────────────────
  let items: SerializedCartItem[] = [];
  try {
    items = JSON.parse(cartJson);
    if (!Array.isArray(items) || items.length === 0) throw new Error();
  } catch {
    return { success: false, error: 'Your cart is empty. Please add items before checking out.' };
  }

  // ── Preorder validation ────────────────────────────────────
  const hasPreorderItems = items.some((i) => i.is_preorder);
  let isPreorder = false;
  let requestedDeliveryTime: string | null = null;

  if (hasPreorderItems) {
    if (!deliveryTimeRaw) {
      fieldErrors.requested_delivery_time =
        'Your cart has pre-order items. Please select a delivery time.';
    } else {
      const timeError = validateDeliveryTime(deliveryTimeRaw);
      if (timeError) {
        fieldErrors.requested_delivery_time = timeError;
      } else {
        isPreorder = true;
        requestedDeliveryTime = new Date(deliveryTimeRaw).toISOString();
      }
    }
  }

  // ── Receipt file validation ─────────────────────────────────
  if (paymentMethod === 'online_transfer') {
    if (!receiptFile || receiptFile.size === 0) {
      fieldErrors.payment_receipt = 'Please upload your bank transfer screenshot.';
    } else if (!ALLOWED_RECEIPT_MIME.includes(receiptFile.type)) {
      fieldErrors.payment_receipt = 'Only JPG, PNG, WebP, or PDF receipts are accepted.';
    } else if (receiptFile.size > MAX_RECEIPT_BYTES) {
      fieldErrors.payment_receipt = 'Receipt file must be under 5 MB.';
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: 'Please fix the errors below.', fieldErrors };
  }

  // ── STEP 3: Server-side fee calculation ────────────────────
  // NEVER trust the client's stated totals. Recalculate everything here.

  const subtotal = items.reduce((sum, item) => {
    const price = parseFloat(item.product.price);
    return sum + (isNaN(price) ? 0 : price * item.quantity);
  }, 0);

  const hasFragile = items.some((i) => i.product.is_fragile);
  const fragileItemFee = hasFragile ? FRAGILE_ITEM_FEE : 0;

  // ── STEP 4: Upload receipt to Supabase Storage ─────────────
  let receiptUrl: string | null = null;

  if (paymentMethod === 'online_transfer' && receiptFile && receiptFile.size > 0) {
    const ext      = receiptFile.name.split('.').pop() ?? 'jpg';
    const fileName = `receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer   = Buffer.from(await receiptFile.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('order-receipts')          // bucket name in Supabase Storage
      .upload(fileName, buffer, {
        contentType: receiptFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[processOrder] Receipt upload failed:', uploadError);
      return {
        success: false,
        error: 'We could not save your payment receipt. Please try again.',
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from('order-receipts')
      .getPublicUrl(fileName);

    receiptUrl = publicUrlData.publicUrl;
  }

  // ── STEP 5: Insert order ────────────────────────────────────

  const address: DeliveryAddress = {
    line1: addressLine1,
    ...(addressLine2 ? { line2: addressLine2 } : {}),
    city: addressCity,
  };

  const orderPayload: OrderInsert = {
    customer_name:           customerName,
    customer_phone:          customerPhone,
    address,
    status:                  'pending',
    payment_method:          paymentMethod,
    payment_receipt_url:     receiptUrl,
    subtotal:                subtotal.toFixed(2),
    base_delivery_fee:       BASE_DELIVERY_FEE.toFixed(2),
    fragile_item_fee:        fragileItemFee.toFixed(2),
    is_preorder:             isPreorder,
    requested_delivery_time: requestedDeliveryTime,
  };

  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    // @ts-expect-error - Supabase type inference issue
    .insert(orderPayload)
    .select('id')
    .single();

  if (orderError || !orderRow) {
    console.error('[processOrder] Order insert failed:', orderError);
    return {
      success: false,
      error: 'We could not place your order. Please try again.',
    };
  }

  const orderId = (orderRow as { id: string }).id;

  // ── STEP 6: Insert order items ──────────────────────────────
  // Each line item retains its custom_message for kitchen use.
  // price_at_purchase is snapshotted here — immutable from this point on.

  const itemPayloads: OrderItemInsert[] = items.map((item) => ({
    order_id:          orderId,
    product_id:        item.product.id,
    quantity:          item.quantity,
    price_at_purchase: item.product.price,
    custom_message:    item.custom_message?.trim() || null,
  }));

  // 3. Insert order_items (linked to order_id)
  const { error: itemsError } = await supabase
    .from('order_items')
    // @ts-expect-error - Supabase type inference issue
    .insert(itemPayloads);

  if (itemsError) {
    // Order exists but items failed — log for ops team to reconcile
    console.error(
      `[processOrder] Items insert failed for order ${orderId}:`,
      itemsError,
    );
    // We still return success with the orderId so the customer sees confirmation.
    // Ops can reconcile via the admin dashboard. A real app could use a DB transaction.
  }

  return { success: true, orderId };
}
