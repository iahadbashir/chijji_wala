'use client';

// ============================================================
// HXD — Checkout Page
// app/checkout/page.tsx
//
// Three views managed by `CheckoutView` discriminated union:
//
//   'split-notice'   — Mixed cart detected. Shows the rose-gold
//                      split explanation + two batch cards.
//                      User clicks "Checkout Now" or "Schedule
//                      Pre-order" to advance to the form view.
//
//   'instant-form'   — Standard checkout form scoped to only
//                      the instant (is_preorder=false) items.
//
//   'preorder-form'  — Standard checkout form scoped to only
//                      the pre-order (is_preorder=true) items,
//                      with the delivery slot picker visible.
//
//   'standard-form'  — Normal non-mixed cart; full cart checkout.
//
// Sections inside form views:
//   1. Scoped cart summary (read-only)
//   2. Customer details
//   3. Delivery address
//   4. [Conditional] Fragile-items alert
//   5. [Conditional] Pre-order slot picker
//   6. Payment method selector
//   7. [Conditional] Receipt upload (online_transfer only)
//   8. Fee breakdown
//   9. Submit → processOrder server action
// ============================================================

import React, {
  useState,
  useRef,
  useCallback,
  useTransition,
  useMemo,
  type ChangeEvent,
} from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import {
  useCartStore,
  selectHasMixedAvailability,
  splitCartIntoTwo,
  calcSubtotalForItems,
  type CartItem,
} from '@/store/useCartStore';
import {
  BASE_DELIVERY_FEE,
  FRAGILE_ITEM_FEE,
  PREORDER_WINDOW,
  validateDeliveryTime,
} from '@/lib/fees';
import { formatPrice } from '@/types/database';
import {
  processOrder,
  type SerializedCartItem,
  type ProcessOrderResult,
} from '@/actions/processOrder';

// ── TYPES ─────────────────────────────────────────────────────

type PaymentMethodOption = {
  value: 'cash_on_delivery' | 'online_transfer' | 'card' | 'wallet';
  label: string;
  icon: string;
};

/**
 * Discriminated union driving the top-level render branch.
 *
 * 'split-notice'  — Mixed cart; user has NOT chosen which batch to pay first.
 * 'instant-form'  — User clicked "Checkout Now" on Card A.
 * 'preorder-form' — User clicked "Checkout Pre-order" on Card B.
 * 'standard-form' — Cart has no mixed availability; normal checkout.
 */
type CheckoutView = 'split-notice' | 'instant-form' | 'preorder-form' | 'standard-form';

// ── CONSTANTS ─────────────────────────────────────────────────

const PAYMENT_OPTIONS: PaymentMethodOption[] = [
  { value: 'cash_on_delivery', label: 'Cash on Delivery', icon: '💵' },
  { value: 'online_transfer',  label: 'Bank Transfer',    icon: '🏦' },
  { value: 'card',             label: 'Card Payment',     icon: '💳' },
  { value: 'wallet',           label: 'Wallet',           icon: '📱' },
];

const MAX_RECEIPT_MB = 5;

/** Build datetime-local min (30 min from now, floored to window open if needed) */
function buildMinDeliveryTime(): string {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  if (d.getHours() < PREORDER_WINDOW.openHour) {
    d.setHours(PREORDER_WINDOW.openHour, 0, 0, 0);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Build datetime-local max (7 days from now at window close) */
function buildMaxDeliveryTime(): string {
  const farFuture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  farFuture.setHours(PREORDER_WINDOW.closeHour, PREORDER_WINDOW.closeMinute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${farFuture.getFullYear()}-${pad(farFuture.getMonth() + 1)}-${pad(farFuture.getDate())}T${pad(farFuture.getHours())}:${pad(farFuture.getMinutes())}`;
}

// ── SHARED SUB-COMPONENTS ─────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-4">
      {children}
    </h2>
  );
}

function FormField({
  label,
  error,
  children,
  required,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-semibold text-zinc-400">
        {label}
        {required && <span className="ml-1 text-violet-400" aria-hidden>*</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-[11px] text-red-400 leading-snug">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = (hasError?: boolean) =>
  [
    'w-full rounded-xl bg-zinc-800 border px-4 py-3',
    'text-[14px] text-white placeholder:text-zinc-600',
    'outline-none transition-all duration-200',
    hasError
      ? 'border-red-500/70 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
      : 'border-zinc-700/60 focus:border-violet-500/70 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)]',
  ].join(' ');

function CartLineItem({ item }: { item: CartItem }) {
  const unitPrice = parseFloat(item.product.price);
  const lineTotal = isNaN(unitPrice) ? 0 : unitPrice * item.quantity;

  return (
    <div className="flex items-start gap-3 rounded-xl bg-zinc-800/50 border border-zinc-700/40 p-3">
      <div className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-zinc-700">
        <Image
          src={item.product.image_url ?? '/placeholder-product.png'}
          alt={item.product.name}
          fill
          sizes="48px"
          className="object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-semibold text-white leading-snug truncate max-w-[160px]">
            {item.product.name}
          </p>
          <span className="shrink-0 text-[13px] font-bold text-violet-300 tabular-nums">
            {formatPrice(lineTotal.toFixed(2))}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-zinc-500">
            {formatPrice(item.product.price)} × {item.quantity}
          </span>
          {item.is_fragile && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/40 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              <span aria-hidden>🧊</span> Fragile
            </span>
          )}
        </div>
        {item.custom_message && (
          <p className="mt-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 px-2.5 py-1.5 text-[11px] italic text-violet-300 leading-snug">
            <span aria-hidden>✏️ </span>&ldquo;{item.custom_message}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

// ── SPLIT BATCH CARD ──────────────────────────────────────────

interface SplitBatchCardProps {
  variant: 'instant' | 'preorder';
  items: CartItem[];
  subtotal: number;
  hasFragile: boolean;
  onCheckout: () => void;
}

function SplitBatchCard({
  variant,
  items,
  subtotal,
  hasFragile,
  onCheckout,
}: SplitBatchCardProps) {
  const fragileExtra = hasFragile ? FRAGILE_ITEM_FEE : 0;
  const batchTotal   = subtotal + BASE_DELIVERY_FEE + fragileExtra;
  const isInstant    = variant === 'instant';

  const accentBorder = isInstant ? 'border-violet-500/30'  : 'border-blue-500/30';
  const accentGlow   = isInstant
    ? 'shadow-[0_0_24px_rgba(139,92,246,0.12)]'
    : 'shadow-[0_0_24px_rgba(59,130,246,0.12)]';
  const headerGrad   = isInstant
    ? 'from-violet-950/70 via-fuchsia-950/50 to-zinc-900'
    : 'from-blue-950/70 via-indigo-950/50 to-zinc-900';
  const badgeBg      = isInstant
    ? 'bg-violet-500/15 text-violet-300 border-violet-500/25'
    : 'bg-blue-500/15 text-blue-300 border-blue-500/25';
  const orbColor     = isInstant ? 'bg-violet-500/20' : 'bg-blue-500/20';
  const btnGrad      = isInstant
    ? 'from-violet-600 to-fuchsia-500 shadow-[0_4px_20px_rgba(139,92,246,0.4)] hover:from-violet-500 hover:to-fuchsia-400 hover:shadow-[0_4px_28px_rgba(139,92,246,0.6)]'
    : 'from-blue-600 to-indigo-500 shadow-[0_4px_20px_rgba(59,130,246,0.4)] hover:from-blue-500 hover:to-indigo-400 hover:shadow-[0_4px_28px_rgba(59,130,246,0.6)]';
  const totalColor   = isInstant ? 'text-violet-300' : 'text-blue-300';

  const heading   = isInstant ? 'Deliver Now'       : 'Schedule for Later';
  const tagline   = isInstant ? 'Your snacks & instant items' : 'Your pre-ordered treats';
  const badge     = isInstant ? '⚡ Express'         : '🕐 Pre-order';
  const btnLabel  = isInstant ? 'Checkout Now →'     : 'Checkout Pre-order →';

  return (
    <div className={['relative overflow-hidden rounded-2xl border', accentBorder, accentGlow].join(' ')}>
      {/* Card header */}
      <div className={['relative bg-gradient-to-br', headerGrad, 'px-5 pt-5 pb-4'].join(' ')}>
        <div aria-hidden className={['pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full blur-2xl opacity-60', orbColor].join(' ')} />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mb-1">{tagline}</p>
            <h3 className="text-[18px] font-black text-white">{heading}</h3>
          </div>
          <span className={['inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold', badgeBg].join(' ')}>
            {badge}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="bg-zinc-900/80 px-4 py-3 space-y-2">
        {items.map((item) => (
          <CartLineItem key={item.cartItemId} item={item} />
        ))}
      </div>

      {/* Fee summary */}
      <div className="bg-zinc-900/60 border-t border-zinc-800/60 px-5 py-4 space-y-2">
        <div className="flex justify-between text-[12px] text-zinc-500">
          <span>Subtotal</span>
          <span className="text-white font-semibold tabular-nums">{formatPrice(subtotal.toFixed(2))}</span>
        </div>
        <div className="flex justify-between text-[12px] text-zinc-500">
          <span>Delivery</span>
          <span className="text-white font-semibold tabular-nums">{formatPrice(BASE_DELIVERY_FEE.toFixed(2))}</span>
        </div>
        {hasFragile && (
          <div className="flex justify-between text-[12px] text-zinc-500">
            <span className="flex items-center gap-1"><span aria-hidden>🌹</span> Handling</span>
            <span className="text-rose-300 font-semibold tabular-nums">+{formatPrice(FRAGILE_ITEM_FEE.toFixed(2))}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-zinc-800/60">
          <span className="text-[13px] font-bold text-white">This order</span>
          <span className={['text-[17px] font-black tabular-nums', totalColor].join(' ')}>
            {formatPrice(batchTotal.toFixed(2))}
          </span>
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-5 pt-1 bg-zinc-900/60">
        <button
          type="button"
          onClick={onCheckout}
          className={['w-full rounded-xl py-3.5 text-[14px] font-black text-white bg-gradient-to-r transition-all duration-200 active:scale-[0.98]', btnGrad].join(' ')}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
}

// ── SPLIT NOTICE SCREEN ───────────────────────────────────────

interface SplitNoticeScreenProps {
  onInstantCheckout:  () => void;
  onPreorderCheckout: () => void;
}

function SplitNoticeScreen({ onInstantCheckout, onPreorderCheckout }: SplitNoticeScreenProps) {
  const items = useCartStore((s) => s.items);
  const {
    instantItems, preorderItems,
    instantSubtotal, preorderSubtotal,
    instantHasFragile, preorderHasFragile,
  } = useMemo(() => splitCartIntoTwo(items), [items]);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 pt-6 pb-24">

      {/* Rose-gold split alert */}
      <section aria-label="Split order notice">
        <div
          className={[
            'relative overflow-hidden rounded-2xl p-6',
            'bg-gradient-to-br from-rose-950/70 via-orange-950/45 to-amber-950/30',
            'border border-rose-400/25',
            'shadow-[0_0_48px_rgba(251,113,133,0.18)]',
          ].join(' ')}
        >
          {/* Layered ambient glows */}
          <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-rose-400/15 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-amber-400/10 blur-2xl" />

          {/* Title */}
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 shrink-0 rounded-full bg-rose-400/20 border border-rose-400/30 flex items-center justify-center text-xl">
              ✨
            </div>
            <div>
              <p className="text-[15px] font-black text-rose-100 leading-snug">
                We&apos;re splitting your order for perfection
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-400/70">
                Takes just 30 seconds extra
              </p>
            </div>
          </div>

          {/* Explanation */}
          <p className="text-[13px] leading-relaxed text-rose-200/80">
            To ensure your treats arrive{' '}
            <span className="font-bold text-rose-100">perfectly</span> — fresh snacks
            delivered at full speed, and your special pre-ordered items prepared exactly
            when you want them — we need to place two separate deliveries. Tap below to
            checkout each batch.
          </p>

          {/* Legend */}
          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-violet-400" />
              <span className="text-[11px] text-zinc-400">Instant order</span>
            </div>
            <div className="h-px flex-1 bg-zinc-700/60" />
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-[11px] text-zinc-400">Pre-order</span>
            </div>
          </div>
        </div>
      </section>

      {/* Card A: Instant */}
      <section aria-label="Instant delivery batch">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-3">Batch 1 of 2</p>
        <SplitBatchCard
          variant="instant"
          items={instantItems}
          subtotal={instantSubtotal}
          hasFragile={instantHasFragile}
          onCheckout={onInstantCheckout}
        />
      </section>

      {/* Card B: Pre-order */}
      <section aria-label="Pre-order batch">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-3">Batch 2 of 2</p>
        <SplitBatchCard
          variant="preorder"
          items={preorderItems}
          subtotal={preorderSubtotal}
          hasFragile={preorderHasFragile}
          onCheckout={onPreorderCheckout}
        />
      </section>

      <p className="text-center text-[11px] text-zinc-600 pb-2">
        Both orders use the same address &amp; payment method you&apos;ll enter next.
      </p>
    </div>
  );
}

// ── CHECKOUT FORM ─────────────────────────────────────────────
// Shared by standard-form, instant-form, and preorder-form views.

interface CheckoutFormProps {
  items:           CartItem[];
  isPreorderBatch: boolean;
  view:            CheckoutView;
  onSuccess:       (orderId: string) => void;
  onBack:          () => void;
  totalItemCount:  number;
}

function CheckoutForm({
  items,
  isPreorderBatch,
  view,
  onSuccess,
}: CheckoutFormProps) {
  const clearCart = useCartStore((s) => s.clearCart);

  const batchHasFragile = useMemo(() => items.some((i) => i.is_fragile), [items]);
  const subtotal        = useMemo(() => calcSubtotalForItems(items), [items]);
  const fragileExtra    = batchHasFragile ? FRAGILE_ITEM_FEE : 0;
  const grandTotal      = subtotal + BASE_DELIVERY_FEE + fragileExtra;

  // Form state
  const [customerName,      setCustomerName]      = useState('');
  const [customerPhone,     setCustomerPhone]     = useState('');
  const [addressLine1,      setAddressLine1]      = useState('');
  const [addressLine2,      setAddressLine2]      = useState('');
  const [addressCity,       setAddressCity]       = useState('');
  const [paymentMethod,     setPaymentMethod]     = useState<PaymentMethodOption['value'] | ''>('');
  const [deliveryTime,      setDeliveryTime]      = useState('');
  const [deliveryTimeError, setDeliveryTimeError] = useState('');
  const [receiptFile,       setReceiptFile]       = useState<File | null>(null);
  const [receiptPreview,    setReceiptPreview]    = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const [isPending,   startTransition] = useTransition();
  const [serverError, setServerError]  = useState('');
  const [fieldErrors, setFieldErrors]  = useState<Record<string, string>>({});

  const handleReceiptChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_RECEIPT_MB * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, payment_receipt: `File must be under ${MAX_RECEIPT_MB} MB.` }));
      return;
    }
    setReceiptFile(file);
    setFieldErrors((prev) => { const n = { ...prev }; delete n.payment_receipt; return n; });
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  }, []);

  const handleDeliveryTimeChange = useCallback((val: string) => {
    setDeliveryTime(val);
    setDeliveryTimeError(validateDeliveryTime(val) ?? '');
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPreorderBatch && deliveryTimeError) return;

    const serializedItems: SerializedCartItem[] = items.map((item) => ({
      product: {
        id:         item.product.id,
        name:       item.product.name,
        price:      item.product.price,
        is_fragile: item.product.is_fragile,
      },
      quantity:       item.quantity,
      custom_message: item.custom_message,
      is_preorder:    item.is_preorder,
    }));

    const fd = new FormData();
    fd.append('customer_name',  customerName);
    fd.append('customer_phone', customerPhone);
    fd.append('address_line1',  addressLine1);
    fd.append('address_line2',  addressLine2);
    fd.append('address_city',   addressCity);
    fd.append('payment_method', paymentMethod);
    fd.append('cart_items',     JSON.stringify(serializedItems));
    if (deliveryTime) fd.append('requested_delivery_time', deliveryTime);
    if (receiptFile)  fd.append('payment_receipt', receiptFile);

    startTransition(async () => {
      const result: ProcessOrderResult = await processOrder(fd);
      if (result.success) {
        clearCart();
        onSuccess(result.orderId!);
      } else {
        setServerError(result.error ?? 'Something went wrong.');
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }, [
    items, customerName, customerPhone,
    addressLine1, addressLine2, addressCity,
    paymentMethod, deliveryTime, deliveryTimeError,
    receiptFile, isPreorderBatch, clearCart, onSuccess,
  ]);

  // UX copy
  const batchLabel =
    view === 'instant-form'  ? 'Batch 1 of 2 — Deliver Now' :
    view === 'preorder-form' ? 'Batch 2 of 2 — Pre-order'  : null;

  const submitDisabled =
    isPending || (isPreorderBatch && (!!deliveryTimeError || !deliveryTime));

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mx-auto max-w-lg space-y-8 px-4 pt-6 pb-24">

        {/* Batch context strip (only for split flows) */}
        {batchLabel && (
          <div
            className={[
              'flex items-center gap-3 rounded-xl border px-4 py-3',
              view === 'instant-form'
                ? 'border-violet-500/25 bg-violet-500/[0.08]'
                : 'border-blue-500/25 bg-blue-500/[0.08]',
            ].join(' ')}
          >
            <span className="text-lg" aria-hidden>{view === 'instant-form' ? '⚡' : '🕐'}</span>
            <div>
              <p className={['text-[11px] font-bold uppercase tracking-[0.12em]', view === 'instant-form' ? 'text-violet-400' : 'text-blue-400'].join(' ')}>
                {batchLabel}
              </p>
              <p className="text-[12px] text-zinc-400">
                {items.length} item{items.length !== 1 ? 's' : ''} · {formatPrice(subtotal.toFixed(2))} subtotal
              </p>
            </div>
          </div>
        )}

        {/* Global error */}
        {serverError && (
          <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-950/40 px-5 py-4 text-[13px] text-red-300">
            <p className="font-bold">Something went wrong 😕</p>
            <p className="mt-1 text-red-400">{serverError}</p>
          </div>
        )}

        {/* 1. Cart summary */}
        <section aria-labelledby="cart-heading">
          <SectionHeading>
            {view === 'standard-form' ? 'Your Order' : 'Items in this order'}
          </SectionHeading>
          <div className="space-y-2.5">
            {items.map((item) => (
              <CartLineItem key={item.cartItemId} item={item} />
            ))}
          </div>
        </section>

        {/* 2. Fragile alert */}
        {batchHasFragile && (
          <section aria-label="Fragile item handling notice">
            <div
              className={[
                'relative overflow-hidden rounded-2xl p-5',
                'bg-gradient-to-br from-rose-950/60 via-orange-950/40 to-amber-950/30',
                'border border-rose-400/25 shadow-[0_0_32px_rgba(251,113,133,0.12)]',
              ].join(' ')}
            >
              <div aria-hidden className="pointer-events-none absolute -top-6 -right-6 h-28 w-28 rounded-full bg-rose-400/15 blur-2xl" />
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5" aria-hidden>🌹</span>
                <div className="space-y-1">
                  <p className="text-[14px] font-black text-rose-200 leading-snug">Delicate items detected</p>
                  <p className="text-[12px] leading-relaxed text-rose-300/80">
                    Your order contains cakes or flowers. We&apos;ve assigned a careful-handling rider and added a{' '}
                    <span className="font-bold text-rose-200">handling fee of {formatPrice(FRAGILE_ITEM_FEE.toFixed(2))}</span>{' '}
                    to make sure they arrive in perfect condition 💛
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 3. Pre-order slot picker */}
        {isPreorderBatch && (
          <section>
            <SectionHeading>Schedule Delivery</SectionHeading>
            <div className="mb-4 rounded-xl bg-blue-950/40 border border-blue-500/25 px-4 py-3">
              <p className="text-[12px] text-blue-300 leading-relaxed">
                <span className="font-bold text-blue-200">🕐 Choose your delivery slot.</span>{' '}
                Any time between <span className="font-semibold text-blue-100">10:00 AM – 11:00 PM</span>, at least 30 min from now.
              </p>
            </div>
            <FormField label="Requested Delivery Time" error={deliveryTimeError || fieldErrors.requested_delivery_time} required>
              <input
                type="datetime-local"
                value={deliveryTime}
                min={buildMinDeliveryTime()}
                max={buildMaxDeliveryTime()}
                onChange={(e) => handleDeliveryTimeChange(e.target.value)}
                required={isPreorderBatch}
                aria-required="true"
                className={[inputCls(!!(deliveryTimeError || fieldErrors.requested_delivery_time)), '[color-scheme:dark]'].join(' ')}
              />
            </FormField>
          </section>
        )}

        {/* 4. Customer details */}
        <section>
          <SectionHeading>Contact Info</SectionHeading>
          <div className="space-y-4">
            <FormField label="Full Name" error={fieldErrors.customer_name} required>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Sara Ahmed" autoComplete="name" required className={inputCls(!!fieldErrors.customer_name)} />
            </FormField>
            <FormField label="Mobile Number" error={fieldErrors.customer_phone} required>
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0312 3456789" autoComplete="tel" required inputMode="tel"
                className={inputCls(!!fieldErrors.customer_phone)} />
            </FormField>
          </div>
        </section>

        {/* 5. Delivery address */}
        <section>
          <SectionHeading>Delivery Address</SectionHeading>
          <div className="space-y-4">
            <FormField label="Street Address" error={fieldErrors.address_line1} required>
              <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="House 12, Street 5, Block B" autoComplete="address-line1"
                required className={inputCls(!!fieldErrors.address_line1)} />
            </FormField>
            <FormField label="Apartment / Floor (optional)" error={fieldErrors.address_line2}>
              <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Flat 3, 2nd Floor" autoComplete="address-line2" className={inputCls(false)} />
            </FormField>
            <FormField label="City" error={fieldErrors.address_city} required>
              <input type="text" value={addressCity} onChange={(e) => setAddressCity(e.target.value)}
                placeholder="Lahore" autoComplete="address-level2" required
                className={inputCls(!!fieldErrors.address_city)} />
            </FormField>
          </div>
        </section>

        {/* 6. Payment method */}
        <section>
          <SectionHeading>Payment Method</SectionHeading>
          {fieldErrors.payment_method && (
            <p role="alert" className="mb-3 text-[11px] text-red-400">{fieldErrors.payment_method}</p>
          )}
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
            {PAYMENT_OPTIONS.map((opt) => {
              const selected = paymentMethod === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPaymentMethod(opt.value)}
                  className={[
                    'flex items-center gap-3 rounded-xl border px-4 py-3.5',
                    'text-[13px] font-semibold text-left transition-all duration-200',
                    selected
                      ? 'border-violet-500/70 bg-violet-500/15 text-white shadow-[0_0_16px_rgba(139,92,246,0.2)]'
                      : 'border-zinc-700/60 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200',
                  ].join(' ')}
                >
                  <span className="text-xl" aria-hidden>{opt.icon}</span>
                  <span className="leading-snug">{opt.label}</span>
                  {selected && (
                    <span className="ml-auto h-4 w-4 shrink-0 rounded-full bg-violet-500 flex items-center justify-center" aria-hidden>
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 7. Receipt upload (bank transfer only) */}
        {paymentMethod === 'online_transfer' && (
          <section>
            <SectionHeading>Payment Receipt</SectionHeading>
            <div className="space-y-3">
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                Transfer the exact amount and upload your screenshot. Orders are confirmed after verification.
              </p>
              <button
                type="button"
                onClick={() => receiptInputRef.current?.click()}
                className={[
                  'w-full rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-all duration-200',
                  fieldErrors.payment_receipt
                    ? 'border-red-500/50 bg-red-950/20'
                    : receiptFile
                      ? 'border-violet-500/50 bg-violet-500/5'
                      : 'border-zinc-700/60 bg-zinc-800/30 hover:border-zinc-500 hover:bg-zinc-800/60',
                ].join(' ')}
                aria-label="Upload payment receipt"
              >
                {receiptPreview ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-36 h-24 rounded-lg overflow-hidden">
                      <Image src={receiptPreview} alt="Receipt preview" fill className="object-cover" />
                    </div>
                    <p className="text-[12px] text-violet-300 font-semibold">{receiptFile?.name}</p>
                    <p className="text-[11px] text-zinc-500">Tap to change</p>
                  </div>
                ) : receiptFile ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-3xl" aria-hidden>📄</span>
                    <p className="text-[12px] text-violet-300 font-semibold">{receiptFile.name}</p>
                    <p className="text-[11px] text-zinc-500">Tap to change</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl" aria-hidden>📸</span>
                    <p className="text-[13px] font-semibold text-zinc-300">Upload Screenshot</p>
                    <p className="text-[11px] text-zinc-500">JPG, PNG, WebP or PDF · Max 5 MB</p>
                  </div>
                )}
              </button>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleReceiptChange}
                className="sr-only"
                aria-label="Payment receipt file input"
              />
              {fieldErrors.payment_receipt && (
                <p role="alert" className="text-[11px] text-red-400">{fieldErrors.payment_receipt}</p>
              )}
            </div>
          </section>
        )}

        {/* 8. Fee breakdown */}
        <section aria-label="Order total breakdown" className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 space-y-3">
            <div className="flex justify-between text-[13px] text-zinc-400">
              <span>Subtotal</span>
              <span className="font-semibold text-white tabular-nums">{formatPrice(subtotal.toFixed(2))}</span>
            </div>
            <div className="flex justify-between text-[13px] text-zinc-400">
              <span>Delivery Fee</span>
              <span className="font-semibold text-white tabular-nums">{formatPrice(BASE_DELIVERY_FEE.toFixed(2))}</span>
            </div>
            {batchHasFragile && (
              <div className="flex justify-between text-[13px] text-zinc-400">
                <span className="flex items-center gap-1.5"><span aria-hidden>🌹</span> Handling Fee</span>
                <span className="font-semibold text-rose-300 tabular-nums">+{formatPrice(FRAGILE_ITEM_FEE.toFixed(2))}</span>
              </div>
            )}
            <div className="pt-3 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-[15px] font-bold text-white">Total</span>
              <span className="text-xl font-black tabular-nums bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                {formatPrice(grandTotal.toFixed(2))}
              </span>
            </div>
          </div>
        </section>

        {/* 9. Submit */}
        <button
          type="submit"
          disabled={submitDisabled}
          aria-disabled={submitDisabled}
          className={[
            'w-full rounded-2xl py-4 text-[15px] font-black tracking-wide transition-all duration-200',
            isPending
              ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              : submitDisabled
                ? 'bg-zinc-800 border border-zinc-600/50 text-zinc-500 cursor-not-allowed'
                : [
                    'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white',
                    'shadow-[0_4px_24px_rgba(139,92,246,0.4)]',
                    'hover:shadow-[0_4px_32px_rgba(139,92,246,0.65)]',
                    'hover:from-violet-500 hover:to-fuchsia-400 active:scale-[0.98]',
                  ].join(' '),
          ].join(' ')}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Placing your order…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span aria-hidden>{isPreorderBatch ? '🕐' : '✨'}</span>
              {isPreorderBatch
                ? `Confirm Pre-order — ${formatPrice(grandTotal.toFixed(2))}`
                : `Place Order — ${formatPrice(grandTotal.toFixed(2))}`
              }
            </span>
          )}
        </button>

        <p className="text-center text-[11px] text-zinc-600 pb-2">
          By placing an order you agree to our Terms &amp; Conditions.
        </p>
      </div>
    </form>
  );
}

// ── PAGE HEADER ───────────────────────────────────────────────

interface PageHeaderProps {
  view:           CheckoutView;
  totalItemCount: number;
  onBack:         () => void;
}

function PageHeader({ view, totalItemCount, onBack }: PageHeaderProps) {
  const headingMap: Record<CheckoutView, string> = {
    'split-notice':  'Split Order',
    'instant-form':  'Deliver Now',
    'preorder-form': 'Pre-order',
    'standard-form': 'Checkout',
  };

  return (
    <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/60">
      <div className="mx-auto flex max-w-lg items-center gap-4 px-4 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-lg font-black tracking-tight">{headingMap[view]}</h1>
        <span className="ml-auto text-sm text-zinc-500">
          {totalItemCount} item{totalItemCount !== 1 ? 's' : ''}
        </span>
      </div>
    </header>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────

export default function CheckoutPage() {
  const router         = useRouter();
  const items          = useCartStore((s) => s.items);
  const isMixed        = useCartStore(selectHasMixedAvailability);
  const totalItemCount = items.reduce((c, i) => c + i.quantity, 0);

  // Initialise to the correct starting view
  const [view, setView] = useState<CheckoutView>(() =>
    isMixed ? 'split-notice' : 'standard-form',
  );

  // Memoised split (re-computes only when items change)
  const split = useMemo(() => splitCartIntoTwo(items), [items]);

  // Navigation
  const handleBack = useCallback(() => {
    if (view === 'split-notice' || view === 'standard-form') {
      router.back();
    } else {
      setView('split-notice');
    }
  }, [view, router]);

  const handleSuccess = useCallback((orderId: string) => {
    router.push(`/order-confirmation?id=${orderId}`);
  }, [router]);

  // Empty cart guard
  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-6 px-4">
        <p className="text-4xl" aria-hidden>🛒</p>
        <p className="text-xl font-bold text-white">Your cart is empty</p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white hover:bg-violet-500 transition-colors"
        >
          Browse Products
        </button>
      </main>
    );
  }

  // Items and preorder flag for the active form view
  const formItems =
    view === 'instant-form'  ? split.instantItems  :
    view === 'preorder-form' ? split.preorderItems :
    items;

  const isPreorderBatch =
    view === 'preorder-form' ||
    (view === 'standard-form' && items.some((i) => i.is_preorder));

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <PageHeader view={view} totalItemCount={totalItemCount} onBack={handleBack} />

      {view === 'split-notice' ? (
        <SplitNoticeScreen
          onInstantCheckout={()  => setView('instant-form')}
          onPreorderCheckout={() => setView('preorder-form')}
        />
      ) : (
        <CheckoutForm
          key={view}          /* reset form state when switching batches */
          items={formItems}
          isPreorderBatch={isPreorderBatch}
          view={view}
          onSuccess={handleSuccess}
          onBack={handleBack}
          totalItemCount={totalItemCount}
        />
      )}
    </main>
  );
}
