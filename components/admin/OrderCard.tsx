'use client';

// ============================================================
// HXD — Admin Order Card
// components/admin/OrderCard.tsx
//
// Operational priorities surfaced visually:
//   1. PRE-ORDER BANNER   — top-of-card, impossible to miss
//   2. CUSTOM MESSAGE     — oversized bold text per item, kitchen-ready
//   3. RECEIPT VERIFY     — prominent CTA for online_transfer orders
//   4. STATUS DROPDOWN    — all states reachable with one tap
// ============================================================

import React, { useState, useOptimistic, useTransition } from 'react';
import Image from 'next/image';
import type { OrderWithItems, OrderStatus, OrderItemWithProduct } from '@/types/database';
import { formatPrice } from '@/types/database';
import { updateOrderStatus } from '@/actions/updateOrderStatus';
import { ShareReceiptButton } from './ShareReceiptButton';

// ── ADMIN STATUSES ────────────────────────────────────────────

/** All statuses available in the admin dropdown */
const ADMIN_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded',
];

// ── STATUS META ───────────────────────────────────────────────

interface StatusMeta {
  label: string;
  icon: string;
  /** Tailwind colour tokens used on the badge + option */
  color: string;
  bg: string;
  border: string;
}

const STATUS_META: Record<OrderStatus, StatusMeta> = {
  pending: {
    label: 'Pending',
    icon: '🟡',
    color: 'text-yellow-300',
    bg: 'bg-yellow-900/30',
    border: 'border-yellow-500/40',
  },
  confirmed: {
    label: 'Confirmed',
    icon: '🔵',
    color: 'text-blue-300',
    bg: 'bg-blue-900/30',
    border: 'border-blue-500/40',
  },
  preparing: {
    label: 'Purchasing from Bakery',
    icon: '🧁',
    color: 'text-violet-300',
    bg: 'bg-violet-900/30',
    border: 'border-violet-500/40',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    icon: '🛵',
    color: 'text-cyan-300',
    bg: 'bg-cyan-900/30',
    border: 'border-cyan-500/40',
  },
  delivered: {
    label: 'Delivered',
    icon: '✅',
    color: 'text-emerald-300',
    bg: 'bg-emerald-900/30',
    border: 'border-emerald-500/40',
  },
  cancelled: {
    label: 'Cancelled',
    icon: '❌',
    color: 'text-red-400',
    bg: 'bg-red-900/30',
    border: 'border-red-500/40',
  },
  refunded: {
    label: 'Refunded',
    icon: '↩️',
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/60',
    border: 'border-zinc-600/40',
  },
};

// ── HELPERS ───────────────────────────────────────────────────

function formatAdminTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** "2026-02-24T14:30:00Z" → "Mon, 24 Feb 2026 — 02:30 PM" */
function formatDeliverySlot(iso: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('en-PK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart} — ${timePart}`;
}

function shortId(id: string): string {
  return id.split('-')[0].toUpperCase();
}

function paymentMethodLabel(pm: string): string {
  return (
    {
      cash_on_delivery: 'Cash on Delivery',
      online_transfer: 'Bank Transfer',
      card: 'Card Payment',
      wallet: 'Wallet',
    }[pm] ?? pm
  );
}

// ── SUB-COMPONENTS ────────────────────────────────────────────

/** The bright, oversized pre-order delivery slot banner */
function PreorderBanner({ deliveryTime }: { deliveryTime: string }) {
  return (
    <div
      role="alert"
      aria-label="Pre-order delivery slot"
      className={[
        'relative overflow-hidden rounded-xl px-5 py-4',
        'bg-gradient-to-r from-blue-950 via-indigo-950 to-violet-950',
        'border border-blue-400/30',
        'shadow-[0_0_28px_rgba(96,165,250,0.15)]',
      ].join(' ')}
    >
      {/* Ambient orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-blue-400/10 blur-2xl"
      />

      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-2">
        🕐 Pre-order — Deliver at
      </p>
      <p className="text-[17px] font-black text-white leading-snug">
        {formatDeliverySlot(deliveryTime)}
      </p>
    </div>
  );
}

/** One order item row — oversized custom_message when present */
function OrderItemRow({ item }: { item: OrderItemWithProduct }) {
  const lineTotal =
    parseFloat(item.price_at_purchase) * item.quantity;

  return (
    <div
      className={[
        'rounded-xl border p-4 space-y-3',
        item.custom_message
          ? 'border-amber-500/35 bg-amber-950/20'
          : 'border-zinc-700/50 bg-zinc-800/40',
      ].join(' ')}
    >
      {/* Product row */}
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-zinc-700">
          <Image
            src={item.product.image_url ?? '/placeholder-product.png'}
            alt={item.product.name}
            fill
            sizes="44px"
            className="object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-white leading-snug truncate">
            {item.product.name}
          </p>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-zinc-500">
              {formatPrice(item.price_at_purchase)} × {item.quantity}
            </span>
            {item.product.is_fragile && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/40 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                🧊 Fragile
              </span>
            )}
          </div>
        </div>

        <span className="shrink-0 text-[14px] font-black text-white tabular-nums">
          {formatPrice(isNaN(lineTotal) ? '0' : lineTotal.toFixed(2))}
        </span>
      </div>

      {/* ── CUSTOM MESSAGE — kitchen instruction ──────────── */}
      {item.custom_message && (
        <div
          role="note"
          aria-label="Kitchen message"
          className={[
            'rounded-xl px-4 py-3.5',
            'bg-amber-950/50 border border-amber-400/40',
            'shadow-[0_0_16px_rgba(251,191,36,0.08)]',
          ].join(' ')}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400 mb-1.5">
            ✏️ Write on {item.product.category === 'cakes' ? 'Cake' : 'Card'}
          </p>
          {/* Deliberately oversized so the admin cannot miss it */}
          <p className="text-[22px] font-black leading-snug text-amber-100">
            "{item.custom_message}"
          </p>
        </div>
      )}
    </div>
  );
}

/** Receipt verification button — opens URL in new tab */
function ReceiptVerifyButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'flex items-center justify-center gap-2',
        'w-full rounded-xl py-3 px-4',
        'text-[13px] font-bold',
        'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300',
        'hover:bg-emerald-900/60 hover:border-emerald-400/60 hover:text-emerald-200',
        'transition-all duration-200',
        'shadow-[0_0_16px_rgba(16,185,129,0.1)]',
      ].join(' ')}
      aria-label="Verify payment receipt (opens in new tab)"
    >
      <span aria-hidden>🧾</span>
      Verify Payment Receipt
      <svg
        aria-hidden
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className="ml-auto opacity-60"
      >
        <path
          d="M2 2h8M10 2v8M2 10l8-8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </a>
  );
}

/** Status badge (read-only display) */
function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5',
        'text-[11px] font-bold border',
        meta.color,
        meta.bg,
        meta.border,
      ].join(' ')}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

/** Dropdown to change order status with optimistic update */
function StatusDropdown({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(currentStatus);
  const [errorMsg, setErrorMsg] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as OrderStatus;
    setErrorMsg('');

    startTransition(async () => {
      setOptimisticStatus(next);
      const result = await updateOrderStatus(orderId, next);
      if (!result.success) {
        setOptimisticStatus(currentStatus); // rollback
        setErrorMsg(result.error);
      }
    });
  }

  const meta = STATUS_META[optimisticStatus];

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={`status-${orderId}`}
        className="block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500"
      >
        Update Status
      </label>

      <div className="relative">
        {/* Coloured left accent */}
        <div
          aria-hidden
          className={[
            'absolute left-0 top-0 h-full w-1 rounded-l-xl',
            {
              pending: 'bg-yellow-500',
              confirmed: 'bg-blue-500',
              preparing: 'bg-violet-500',
              out_for_delivery: 'bg-cyan-500',
              delivered: 'bg-emerald-500',
              cancelled: 'bg-red-500',
              refunded: 'bg-zinc-500',
            }[optimisticStatus],
          ].join(' ')}
        />

        <select
          id={`status-${orderId}`}
          value={optimisticStatus}
          onChange={handleChange}
          disabled={isPending}
          aria-label="Order status"
          className={[
            'w-full appearance-none rounded-xl pl-5 pr-10 py-3',
            'bg-zinc-800 border border-zinc-700/60',
            'text-[13px] font-bold text-white',
            'outline-none transition-all',
            'focus:border-violet-500/70 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)]',
            isPending ? 'opacity-60 cursor-wait' : 'cursor-pointer',
          ].join(' ')}
        >
          {ADMIN_STATUSES.map((s) => {
            const m = STATUS_META[s];
            return (
              <option key={s} value={s}>
                {m.icon} {m.label}
              </option>
            );
          })}
        </select>

        {/* Custom chevron */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
        >
          {isPending ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </div>

      {errorMsg && (
        <p role="alert" className="text-[11px] text-red-400">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

// ── MAIN ORDER CARD ───────────────────────────────────────────

export interface OrderCardProps {
  order: OrderWithItems;
}

export function OrderCard({ order }: OrderCardProps) {
  const meta = STATUS_META[order.status];
  const hasCustomMessages = order.order_items.some((i) => i.custom_message);
  const addressParts = [
    order.address.line1,
    order.address.line2,
    order.address.city,
    order.address.postal_code,
  ].filter(Boolean);

  return (
    <article
      aria-label={`Order ${shortId(order.id)}`}
      className={[
        'relative rounded-2xl border overflow-hidden',
        'bg-zinc-900 transition-shadow duration-300',
        // Glow tint by active status
        order.status === 'pending' ? 'border-yellow-500/30 shadow-[0_0_24px_rgba(234,179,8,0.07)]' :
        order.status === 'preparing' ? 'border-violet-500/30 shadow-[0_0_24px_rgba(139,92,246,0.07)]' :
        order.status === 'out_for_delivery' ? 'border-cyan-500/30 shadow-[0_0_24px_rgba(6,182,212,0.07)]' :
        order.status === 'delivered' ? 'border-emerald-500/20' :
        'border-zinc-800',
      ].join(' ')}
    >
      {/* ── CARD HEADER ──────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-zinc-800/80">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-white text-[15px] tracking-tight">
              #{shortId(order.id)}
            </span>
            {order.is_preorder && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-900/50 border border-blue-400/30 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 tracking-wide">
                🕐 PRE-ORDER
              </span>
            )}
            {hasCustomMessages && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/50 border border-amber-400/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 tracking-wide">
                ✏️ CUSTOM MSG
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500">
            {formatAdminTimestamp(order.created_at)}
          </p>
        </div>

        <StatusBadge status={order.status} />
      </header>

      <div className="px-5 py-4 space-y-5">

        {/* ── 1. PRE-ORDER SLOT (unmissable) ─────────────────── */}
        {order.is_preorder && order.requested_delivery_time && (
          <PreorderBanner deliveryTime={order.requested_delivery_time} />
        )}

        {/* ── 2. CUSTOMER + ADDRESS ──────────────────────────── */}
        <section aria-label="Customer details">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-2">
            Customer
          </p>
          <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/40 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[14px] font-bold text-white">{order.customer_name}</p>
              <a
                href={`tel:${order.customer_phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-700/60 border border-zinc-600/50 px-3 py-1.5 text-[12px] font-semibold text-zinc-200 hover:text-white hover:border-zinc-400 transition-colors"
                aria-label={`Call ${order.customer_name}`}
              >
                <span aria-hidden>📞</span>
                {order.customer_phone}
              </a>
            </div>
            <p className="text-[12px] text-zinc-400 leading-snug">
              📍 {addressParts.join(', ')}
            </p>
          </div>
        </section>

        {/* ── 3. ORDER ITEMS with custom messages ────────────── */}
        <section aria-label="Order items">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-2">
            Items ({order.order_items.length})
          </p>
          <div className="space-y-2.5">
            {order.order_items.map((item) => (
              <OrderItemRow key={item.id} item={item} />
            ))}
          </div>
        </section>

        {/* ── 4. RECEIPT VERIFY ──────────────────────────────── */}
        {order.payment_method === 'online_transfer' && (
          <section aria-label="Payment verification">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-2">
              Payment — Bank Transfer
            </p>
            {order.payment_receipt_url ? (
              <ReceiptVerifyButton url={order.payment_receipt_url} />
            ) : (
              <div className="rounded-xl bg-red-950/30 border border-red-500/30 px-4 py-3 text-[12px] text-red-400 font-semibold">
                ⚠️ Receipt not yet uploaded by customer
              </div>
            )}
          </section>
        )}

        {/* ── 5. FEE BREAKDOWN ───────────────────────────────── */}
        <section
          aria-label="Fee breakdown"
          className="rounded-xl bg-zinc-800/40 border border-zinc-700/40 overflow-hidden"
        >
          <div className="px-4 py-3 space-y-2">
            <div className="flex justify-between text-[12px] text-zinc-500">
              <span>Subtotal</span>
              <span className="text-zinc-300 tabular-nums font-semibold">
                {formatPrice(order.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-[12px] text-zinc-500">
              <span>Delivery</span>
              <span className="text-zinc-300 tabular-nums font-semibold">
                {formatPrice(order.base_delivery_fee)}
              </span>
            </div>
            {parseFloat(order.fragile_item_fee) > 0 && (
              <div className="flex justify-between text-[12px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <span aria-hidden>🌹</span> Handling
                </span>
                <span className="text-rose-300 tabular-nums font-semibold">
                  {formatPrice(order.fragile_item_fee)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-zinc-700/50 text-[14px]">
              <span className="font-bold text-white">Total</span>
              <span className="font-black text-white tabular-nums">
                {formatPrice(order.total_amount)}
              </span>
            </div>
          </div>
        </section>

        {/* ── 6. STATUS DROPDOWN ─────────────────────────────── */}
        <StatusDropdown
          orderId={order.id}
          currentStatus={order.status}
        />

        {/* ── 7. SHARE RECEIPT (WhatsApp) ────────────────────── */}
        <section aria-label="Share receipt">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-2">
            Share Receipt
          </p>
          <ShareReceiptButton order={order} shortId={shortId(order.id)} />
        </section>

      </div>
    </article>
  );
}
