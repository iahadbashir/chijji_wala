// ============================================================
// HXD Quick-Commerce — Cart Store
// store/useCartStore.ts
//
// Architecture note — Line-item identity:
//   A cart "line item" is uniquely identified by the composite key:
//     cartItemId = `${product.id}::${custom_message ?? ''}`
//
//   This means:
//     • Same product  + same message  → quantity is incremented (merged)
//     • Same product  + diff message  → a NEW independent line item
//     • Same product  + no message    → merged under the '' message bucket
//
//   This satisfies the business rule where
//   "Chocolate Cake – Happy Birthday" and
//   "Chocolate Cake – Congratulations" must appear as separate receipt lines
//   and be fulfilled separately by the kitchen.
//
// Mixed-availability carts:
//   When a cart contains BOTH is_preorder:false items ("instant") AND
//   is_preorder:true items ("pre-order") it MUST be split into two
//   separate orders before checkout. The hasMixedAvailability selector
//   detects this state and splitCartIntoTwo() produces the two arrays
//   ready for dual-order submission.
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Product, UUID } from '@/types/database';

// ── TYPES ─────────────────────────────────────────────────────

/**
 * A single line item in the cart.
 *
 * @property cartItemId     - Composite key: `${product.id}::${custom_message ?? ''}`.
 *                            This is the stable identity used by all mutations.
 * @property product        - Full product snapshot captured at "Add to Cart" time.
 *                            We snapshot rather than reference so that a price change
 *                            mid-session doesn't silently alter the basket total.
 * @property quantity       - How many units of *this exact line item* are in the cart.
 * @property custom_message - The personalised text (cake message, card note, etc.).
 *                            Optional; only relevant when product.requires_custom_text === true.
 * @property is_fragile     - Copied from product.is_fragile at add-time.
 *                            Stored here so fee selectors never re-derive from the product snapshot.
 * @property is_preorder    - TRUE when the item was added via the "Pre-order for Later" CTA,
 *                            i.e. the product was outside its time window at add-time.
 *                            When ANY cart item has this flag the checkout must collect a
 *                            requested_delivery_time before the order can be placed.
 */
export interface CartItem {
  cartItemId: string;
  product: Product;
  quantity: number;
  custom_message?: string;
  is_fragile: boolean;
  is_preorder: boolean;
}

/** Payload accepted by addItem — the store derives cartItemId internally */
export interface AddItemPayload {
  product: Product;
  quantity?: number;          // defaults to 1
  custom_message?: string;    // required when product.requires_custom_text === true
  is_preorder?: boolean;      // TRUE when added via "Pre-order for Later" CTA
}

/** Payload for updating quantity of an existing line item */
export interface UpdateQuantityPayload {
  cartItemId: string;
  quantity: number;           // setting to 0 is equivalent to removeItem
}

// ── STORE SHAPE ───────────────────────────────────────────────

interface CartState {
  /** Ordered array of line items. Order reflects insertion sequence. */
  items: CartItem[];
}

interface CartActions {
  /**
   * Add a product to the cart.
   *
   * Identity rule:
   *   cartItemId = `${product.id}::${custom_message ?? ''}`
   *
   *   • If a line item with the same cartItemId already exists → increment its quantity.
   *   • If no match is found → push a new CartItem to the array.
   *
   * This guarantees that two calls with the same product but different
   * custom_message values produce two independent line items, while
   * duplicate calls (same product + same message) simply stack the quantity.
   */
  addItem: (payload: AddItemPayload) => void;

  /**
   * Remove a line item entirely by its cartItemId.
   * Use this for the "× remove" button per line.
   */
  removeItem: (cartItemId: string) => void;

  /**
   * Overwrite the quantity of a specific line item.
   * Passing quantity ≤ 0 silently removes the item (same as removeItem).
   * Useful for the quantity stepper control in the cart drawer.
   */
  updateQuantity: (payload: UpdateQuantityPayload) => void;

  /**
   * Remove all items whose product.id matches the given id.
   * This clears ALL message variants of the same product at once.
   * Useful for "Remove all cake items" edge cases.
   */
  removeAllByProductId: (productId: UUID) => void;

  /** Wipe the entire cart (used after successful order placement). */
  clearCart: () => void;
}

// ── DERIVED STATE (SELECTORS) ──────────────────────────────────
//
// Selectors are defined OUTSIDE the store object and accept the store
// state as an argument. This avoids re-creating selector functions on
// every render and keeps them tree-shakeable.
//
// Usage:
//   const subtotal = useCartStore(selectCartSubtotal);
//   const hasFragile = useCartStore(selectContainsFragileItems);

/**
 * Sum of (parsed price × quantity) for every line item.
 * Prices come in as NUMERIC strings from Supabase — we parse here.
 *
 * Returns a number rounded to 2 decimal places.
 */
export const selectCartSubtotal = (state: CartState): number => {
  const raw = state.items.reduce((sum, item) => {
    const unitPrice = parseFloat(item.product.price);
    // Guard against NaN if a malformed product sneaks in
    const safePrice = isNaN(unitPrice) ? 0 : unitPrice;
    return sum + safePrice * item.quantity;
  }, 0);

  // Round to 2dp to avoid floating-point drift (e.g. 10.599999...)
  return Math.round(raw * 100) / 100;
};

/**
 * Returns TRUE if at least one line item in the cart is fragile.
 * When true, the checkout must apply the fragile_item_fee.
 */
export const selectContainsFragileItems = (state: CartState): boolean =>
  state.items.some((item) => item.is_fragile);

/** Total number of individual units across all line items. */
export const selectTotalItemCount = (state: CartState): number =>
  state.items.reduce((count, item) => count + item.quantity, 0);

/** Convenience: all cartItemIds present in the cart. */
export const selectCartItemIds = (state: CartState): string[] =>
  state.items.map((item) => item.cartItemId);

/**
 * Returns TRUE if at least one item was added as a pre-order (outside time window).
 * When true, the checkout must force the user to pick a requested_delivery_time.
 */
export const selectContainsPreorderItems = (state: CartState): boolean =>
  state.items.some((item) => item.is_preorder);

/**
 * MIXED-AVAILABILITY DETECTOR
 *
 * Returns TRUE when the cart simultaneously contains:
 *   • At least one INSTANT item  (is_preorder === false)
 *   • At least one PRE-ORDER item (is_preorder === true)
 *
 * A mixed cart CANNOT be submitted as a single order because:
 *   1. Instant items must be dispatched immediately.
 *   2. Pre-order items are only prepared at the customer's chosen future slot.
 *   Combining them would force ops to hold the instant items until the
 *   bakery/florist is ready — destroying the quick-commerce value proposition.
 *
 * When this returns true the checkout UI must call splitCartIntoTwo() and
 * guide the customer through two sequential order confirmations.
 */
export const selectHasMixedAvailability = (state: CartState): boolean => {
  // Short-circuit: a cart with 0 or 1 item can never be mixed.
  if (state.items.length < 2) return false;

  const hasInstant  = state.items.some((item) => !item.is_preorder);
  const hasPreorder = state.items.some((item) =>  item.is_preorder);

  return hasInstant && hasPreorder;
};

// ── PURE HELPERS ──────────────────────────────────────────────

// ── calcSubtotalForItems ────────────────────────────────────

/**
 * Calculate the subtotal for an arbitrary slice of CartItems.
 *
 * Extracted as a standalone helper so it can be called on either
 * the full cart OR on a split subset (instantItems / preorderItems)
 * without duplicating the rounding logic.
 *
 * @param items - Any array of CartItem (full cart, or a split)
 * @returns     - Number rounded to 2 decimal places
 */
export function calcSubtotalForItems(items: CartItem[]): number {
  const raw = items.reduce((sum, item) => {
    const unitPrice = parseFloat(item.product.price);
    const safePrice = isNaN(unitPrice) ? 0 : unitPrice;
    return sum + safePrice * item.quantity;
  }, 0);
  return Math.round(raw * 100) / 100;
}

// ── SplitCart type ───────────────────────────────────────────

/**
 * The result of splitCartIntoTwo().
 *
 * @property instantItems    - Items fulfillable right now (is_preorder === false).
 *                             These go into Order A, dispatched immediately.
 * @property preorderItems   - Items tied to a future time window (is_preorder === true).
 *                             These go into Order B, dispatched at the delivery slot.
 * @property instantSubtotal  - Product-price sum for instantItems (excludes fees).
 * @property preorderSubtotal - Product-price sum for preorderItems (excludes fees).
 * @property instantHasFragile  - TRUE if any instant item is fragile → apply fragile fee to Order A.
 * @property preorderHasFragile - TRUE if any pre-order item is fragile → apply fragile fee to Order B.
 */
export interface SplitCart {
  instantItems:      CartItem[];
  preorderItems:     CartItem[];
  instantSubtotal:   number;
  preorderSubtotal:  number;
  instantHasFragile:  boolean;
  preorderHasFragile: boolean;
}

// ── splitCartIntoTwo ─────────────────────────────────────────

/**
 * Partition the current cart into two independent order-ready arrays.
 *
 * Should only be called when selectHasMixedAvailability() returns true,
 * but is safe to call on any cart (returns empty arrays when one
 * partition is unused).
 *
 * Design choice — pure function not a Zustand action:
 *   splitCartIntoTwo does NOT mutate the store. It only reads `items`
 *   and returns derived data. The caller decides how to present the
 *   two groups to the customer (side-by-side carts, step wizard, etc.)
 *   and submits two separate calls to processOrder().
 *
 * @param items - Pass `useCartStore.getState().items` or the result of
 *                `useCartStore((s) => s.items)` inside a component.
 * @returns SplitCart - Both partitions plus their subtotals and fragile flags.
 *
 * @example
 *   const items = useCartStore((s) => s.items);
 *   const isMixed = useCartStore(selectHasMixedAvailability);
 *   if (isMixed) {
 *     const { instantItems, preorderItems,
 *             instantSubtotal, preorderSubtotal,
 *             instantHasFragile, preorderHasFragile } = splitCartIntoTwo(items);
 *   }
 */
export function splitCartIntoTwo(items: CartItem[]): SplitCart {
  // Single-pass partition — O(n), no double iteration.
  const instantItems:  CartItem[] = [];
  const preorderItems: CartItem[] = [];

  for (const item of items) {
    if (item.is_preorder) {
      preorderItems.push(item);
    } else {
      instantItems.push(item);
    }
  }

  return {
    instantItems,
    preorderItems,

    // Subtotals calculated separately so each checkout step shows
    // the correct partial amount, not the blended grand total.
    instantSubtotal:  calcSubtotalForItems(instantItems),
    preorderSubtotal: calcSubtotalForItems(preorderItems),

    // Fragile flags are preserved per-partition so the fee logic in
    // processOrder knows whether EACH order triggers a handling charge.
    // (e.g. a fragile cake in the pre-order doesn't affect the instant
    // snack order's fee, and vice-versa.)
    instantHasFragile:  instantItems.some((i)  => i.is_fragile),
    preorderHasFragile: preorderItems.some((i) => i.is_fragile),
  };
}

/**
 * Derive the stable line-item identity key.
 *
 * Rules:
 *   1. Always starts with the product UUID.
 *   2. The custom_message part is lowercased and trimmed so that
 *      "Happy Birthday" and "happy birthday " are treated as the same line.
 *   3. An absent or empty message normalises to '' so that
 *      products without a message are still safely keyed.
 *
 * @example
 *   buildCartItemId('abc-123', 'Happy Birthday') → 'abc-123::happy birthday'
 *   buildCartItemId('abc-123', undefined)         → 'abc-123::'
 */
export function buildCartItemId(productId: UUID, custom_message?: string): string {
  const normalised = (custom_message ?? '').trim().toLowerCase();
  return `${productId}::${normalised}`;
}

// ── STORE ─────────────────────────────────────────────────────

type CartStore = CartState & CartActions;

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      // ── Initial state ──────────────────────────────────────
      items: [],

      // ── addItem ────────────────────────────────────────────
      addItem: (payload: AddItemPayload) => {
        const { product, quantity = 1, custom_message } = payload;
        const incomingId = buildCartItemId(product.id, custom_message);

        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) => item.cartItemId === incomingId,
          );

          if (existingIndex !== -1) {
            // ── MERGE PATH ─────────────────────────────────
            // A line item with the exact same product + message already exists.
            // Increment its quantity rather than duplicating the entry.
            const updated = [...state.items];
            updated[existingIndex] = {
              ...updated[existingIndex],
              quantity: updated[existingIndex].quantity + quantity,
            };
            return { items: updated };
          }

          // ── NEW LINE ITEM PATH ───────────────────────────
          // Either a new product, OR the same product with a DIFFERENT message.
          // We always push a new CartItem so the two messages remain independent
          // line items (distinct receipt rows, distinct kitchen tickets).
          const newItem: CartItem = {
            cartItemId: incomingId,
            product,                         // snapshot — immune to later price edits
            quantity,
            custom_message: custom_message?.trim() || undefined,
            is_fragile: product.is_fragile,  // denormalised for fast selector access
            is_preorder: payload.is_preorder ?? false,
          };

          return { items: [...state.items, newItem] };
        });
      },

      // ── removeItem ─────────────────────────────────────────
      removeItem: (cartItemId: string) =>
        set((state) => ({
          items: state.items.filter((item) => item.cartItemId !== cartItemId),
        })),

      // ── updateQuantity ─────────────────────────────────────
      updateQuantity: ({ cartItemId, quantity }: UpdateQuantityPayload) =>
        set((state) => {
          // Treat quantity ≤ 0 as a remove to keep UI logic simple
          if (quantity <= 0) {
            return {
              items: state.items.filter((item) => item.cartItemId !== cartItemId),
            };
          }

          return {
            items: state.items.map((item) =>
              item.cartItemId === cartItemId ? { ...item, quantity } : item,
            ),
          };
        }),

      // ── removeAllByProductId ───────────────────────────────
      removeAllByProductId: (productId: UUID) =>
        set((state) => ({
          items: state.items.filter((item) => item.product.id !== productId),
        })),

      // ── clearCart ──────────────────────────────────────────
      clearCart: () => set({ items: [] }),
    }),

    // ── PERSIST CONFIG ────────────────────────────────────────
    {
      name: 'hxd-cart',                              // localStorage key
      storage: createJSONStorage(() => localStorage),

      /**
       * Partial persistence: we only serialise `items`.
       * Action functions are re-attached by Zustand on every mount,
       * so there is no need (or benefit) to persist them.
       */
      partialize: (state) => ({ items: state.items }),

      /**
       * Version bump strategy:
       *   Increment `version` whenever the CartItem shape changes in a
       *   breaking way (e.g. renaming a field). Zustand will discard the
       *   stale localStorage data and start with an empty cart instead of
       *   crashing on a schema mismatch.
       */
      version: 1,

      /**
       * Migration function: called when the persisted version < current version.
       * Add cases here as the schema evolves.
       */
      migrate: (persistedState, oldVersion) => {
        // v0 → v1: cartItemId was not present; rebuild from product.id
        if (oldVersion === 0) {
          const old = persistedState as { items: Omit<CartItem, 'cartItemId'>[] };
          return {
            items: old.items.map((item) => ({
              ...item,
              cartItemId: buildCartItemId(item.product.id, item.custom_message),
            })),
          } satisfies CartState;
        }

        return persistedState as CartState;
      },
    },
  ),
);
