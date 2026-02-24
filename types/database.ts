// ============================================================
// HXD Quick-Commerce — Strict Database Types
// Auto-maintained alongside: supabase/migrations/001_initial_schema.sql
// ============================================================

// ── ENUMS ────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod =
  | 'cash_on_delivery'
  | 'online_transfer'
  | 'card'
  | 'wallet';

export type ProductCategory =
  | 'snacks'
  | 'noodles'
  | 'cakes'
  | 'flowers'
  | 'beverages'
  | 'other';

// ── SHARED PRIMITIVES ─────────────────────────────────────────

/** ISO 8601 timestamp string returned by Supabase (e.g. "2026-02-24T10:00:00+00:00") */
export type Timestamp = string;

/** TIME WITHOUT TIME ZONE column — stored as "HH:MM:SS" */
export type TimeString = string;

/** UUID v4 string */
export type UUID = string;

// ── ADDRESS JSONB SHAPE ───────────────────────────────────────

export interface DeliveryAddress {
  line1: string;
  line2?: string;
  city: string;
  postal_code?: string;
  /** WGS-84 latitude, for map-pin delivery UX */
  lat?: number;
  /** WGS-84 longitude */
  lng?: number;
}

// ══════════════════════════════════════════════════════════════
//  TABLE ROW TYPES  (what Supabase returns from .select())
// ══════════════════════════════════════════════════════════════

// ── products ─────────────────────────────────────────────────

export interface Product {
  id: UUID;
  name: string;
  description: string | null;
  category: ProductCategory;
  /** Stored as NUMERIC(10,2); Supabase JS client returns it as a string */
  price: string;
  image_url: string | null;

  /** Manual ops toggle — false hides the product from the storefront */
  is_available: boolean;

  /**
   * Start of daily availability window.
   * NULL means the product is available at any time of day.
   * Format: "HH:MM:SS"  (e.g. "10:00:00" for 10 AM)
   */
  available_from: TimeString | null;

  /**
   * End of daily availability window.
   * NULL means the product is available at any time of day.
   * Format: "HH:MM:SS"  (e.g. "23:00:00" for 11 PM)
   */
  available_until: TimeString | null;

  /**
   * TRUE → an extra fragile_item_fee is added to the order total.
   * Typically TRUE for Cakes and Flowers.
   */
  is_fragile: boolean;

  /**
   * TRUE → the checkout UI must surface a custom text input
   * (e.g. "Message on Cake", "Card with Flowers").
   */
  requires_custom_text: boolean;

  created_at: Timestamp;
  updated_at: Timestamp;
}

// ── orders ───────────────────────────────────────────────────

export interface Order {
  id: UUID;
  customer_name: string;
  customer_phone: string;

  /** Parsed JSONB — shape defined by DeliveryAddress */
  address: DeliveryAddress;

  status: OrderStatus;
  payment_method: PaymentMethod;

  /** URL to payment screenshot / receipt (required for online_transfer) */
  payment_receipt_url: string | null;

  /** Sum of (price_at_purchase × quantity) for all items */
  subtotal: string;
  base_delivery_fee: string;
  /** Extra fee added when ≥ 1 item in the basket is fragile */
  fragile_item_fee: string;
  /**
   * GENERATED ALWAYS AS (subtotal + base_delivery_fee + fragile_item_fee)
   * Read-only — never write this column.
   */
  readonly total_amount: string;

  /**
   * TRUE when the order was placed outside the product's time window.
   * The customer has selected a future delivery slot.
   */
  is_preorder: boolean;

  /**
   * The customer-chosen delivery slot for pre-orders.
   * Guaranteed non-null when is_preorder === true (enforced by DB constraint).
   */
  requested_delivery_time: Timestamp | null;

  created_at: Timestamp;
  updated_at: Timestamp;
}

// ── settings (singleton) ────────────────────────────────────

export interface Settings {
  id: UUID;
  /** Always TRUE — enforces the singleton constraint. */
  is_singleton: true;
  /** Flat PKR delivery charge applied to every order. Admin-editable. */
  current_delivery_fee: string;
  /** Extra PKR surcharge for fragile items (cakes/flowers). Admin-editable. */
  current_fragile_fee: string;
  updated_at: Timestamp;
}

export type SettingsUpdate = Pick<Settings, 'current_delivery_fee' | 'current_fragile_fee'>;

// ── order_items ──────────────────────────────────────────────

export interface OrderItem {
  id: UUID;
  order_id: UUID;
  product_id: UUID;
  quantity: number;

  /**
   * Price snapshot captured at purchase time.
   * NEVER re-derive from products.price — prices can change.
   */
  price_at_purchase: string;

  /**
   * Personalised message (e.g. "Happy Birthday Sara! 🎂")
   * Required at app layer when the linked product.requires_custom_text === true.
   */
  custom_message: string | null;

  created_at: Timestamp;
}

// ══════════════════════════════════════════════════════════════
//  INSERT PAYLOADS  (what you pass to .insert())
// ══════════════════════════════════════════════════════════════

export type ProductInsert = Omit<Product,
  | 'id'
  | 'created_at'
  | 'updated_at'
> & {
  id?: UUID;
  description?: string | null;
  image_url?: string | null;
  is_available?: boolean;
  available_from?: TimeString | null;
  available_until?: TimeString | null;
  is_fragile?: boolean;
  requires_custom_text?: boolean;
};

export type OrderInsert = Omit<Order,
  | 'id'
  | 'total_amount'   // GENERATED column — never inserted
  | 'created_at'
  | 'updated_at'
> & {
  id?: UUID;
  payment_receipt_url?: string | null;
  base_delivery_fee?: string;
  fragile_item_fee?: string;
  is_preorder?: boolean;
  requested_delivery_time?: Timestamp | null;
};

export type OrderItemInsert = Omit<OrderItem,
  | 'id'
  | 'created_at'
> & {
  id?: UUID;
  custom_message?: string | null;
};

// ══════════════════════════════════════════════════════════════
//  UPDATE PAYLOADS  (what you pass to .update())
// ══════════════════════════════════════════════════════════════

export type ProductUpdate = Partial<ProductInsert>;

export type OrderUpdate = Partial<
  Omit<OrderInsert, 'customer_name' | 'customer_phone' | 'address'>
> & {
  status?: OrderStatus;
  payment_receipt_url?: string | null;
};

// Order items are immutable after creation (cancel the order instead).
// No OrderItemUpdate exported intentionally.

// ══════════════════════════════════════════════════════════════
//  SUPABASE DATABASE DEFINITION  (for createClient<Database>())
// ══════════════════════════════════════════════════════════════

export interface Database {
  public: {
    Tables: {
      products: {
        Row: Product;
        Insert: ProductInsert;
        Update: ProductUpdate;
      };
      orders: {
        Row: Order;
        Insert: OrderInsert;
        Update: OrderUpdate;
      };
      order_items: {
        Row: OrderItem;
        Insert: OrderItemInsert;
        Update: never; // immutable
      };
      settings: {
        Row: Settings;
        Insert: never; // singleton seeded by migration — never insert from app code
        Update: SettingsUpdate;
      };
    };

    Enums: {
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      product_category: ProductCategory;
    };

    Functions: Record<string, never>;
  };
}

// ══════════════════════════════════════════════════════════════
//  UTILITY / JOINED TYPES  (common query shapes)
// ══════════════════════════════════════════════════════════════

/** order_items row with the full product record joined */
export interface OrderItemWithProduct extends OrderItem {
  product: Product;
}

/** Full order with all its items (and each item's product) */
export interface OrderWithItems extends Order {
  order_items: OrderItemWithProduct[];
}

/** Storefront product enriched with real-time availability status */
export interface ProductWithAvailability extends Product {
  /**
   * Computed client-side:
   * TRUE when is_available === true AND current time is within [available_from, available_until].
   */
  is_currently_available: boolean;
  /**
   * Computed client-side:
   * TRUE when the product exists but is outside its time window right now
   * → customer should see "Pre-order" CTA instead of "Add to Cart".
   */
  is_preorderable: boolean;
}

// ══════════════════════════════════════════════════════════════
//  HELPER: Numeric string → number  (Supabase NUMERIC quirk)
// ══════════════════════════════════════════════════════════════

/**
 * Supabase JS client returns NUMERIC columns as strings to preserve precision.
 * Use this helper whenever you need arithmetic on prices.
 *
 * @example
 * const total = parsePrice(order.total_amount); // → 349.50
 */
export function parsePrice(value: string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a price string for display (PKR locale as default).
 *
 * @example
 * formatPrice("349.50")  // → "Rs. 349.50"
 */
export function formatPrice(
  value: string | null | undefined,
  currencySymbol = 'Rs.'
): string {
  const amount = parsePrice(value);
  return `${currencySymbol} ${amount.toFixed(2)}`;
}

/**
 * Check whether a product is inside its time window RIGHT NOW.
 * Pass new Date() (or a mocked date) so this stays unit-testable.
 */
export function isProductAvailableNow(
  product: Pick<Product, 'is_available' | 'available_from' | 'available_until'>,
  now: Date = new Date()
): boolean {
  if (!product.is_available) return false;
  if (!product.available_from && !product.available_until) return true;

  const pad = (n: number) => String(n).padStart(2, '0');
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const from  = product.available_from  ?? '00:00:00';
  const until = product.available_until ?? '23:59:59';

  return currentTime >= from && currentTime <= until;
}
