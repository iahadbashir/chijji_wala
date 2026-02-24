// ============================================================
// HXD — Admin Live Orders Dashboard
// app/admin/orders/page.tsx
//
// Server Component — data fetched at request time so ops
// always see up-to-date orders without a client-side websocket.
//
// Filter tabs use Next.js searchParams so the URL is shareable
// and ?status=preparing bookmarks the bakery coordinator's view.
// ============================================================

import React from 'react';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import type { OrderWithItems, OrderStatus } from '@/types/database';
import { OrderCard } from '@/components/admin/OrderCard';

// ── FILTER CONFIG ─────────────────────────────────────────────

interface FilterTab {
  label: string;
  icon: string;
  /** null = show all */
  status: OrderStatus | null;
}

const FILTER_TABS: FilterTab[] = [
  { label: 'All',          icon: '📋', status: null },
  { label: 'Pending',      icon: '🟡', status: 'pending' },
  { label: 'Confirmed',    icon: '🔵', status: 'confirmed' },
  { label: 'At Bakery',    icon: '🧁', status: 'preparing' },
  { label: 'On the Way',   icon: '🛵', status: 'out_for_delivery' },
  { label: 'Delivered',    icon: '✅', status: 'delivered' },
];

// ── DATA FETCHER ──────────────────────────────────────────────

async function fetchOrders(statusFilter: OrderStatus | null): Promise<OrderWithItems[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from('orders')
    .select(
      `
      *,
      order_items (
        *,
        product:products (*)
      )
    `,
    )
    .order('created_at', { ascending: false })
    .limit(100);

  // Only filter if a specific status is selected (null means "All")
  if (statusFilter !== null) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[fetchOrders]', error);
    return [];
  }

  return (data ?? []) as unknown as OrderWithItems[];
}

// ── STAT COUNTER ──────────────────────────────────────────────

async function fetchStatusCounts(): Promise<Partial<Record<OrderStatus | 'all', number>>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('orders')
    .select('status');

  if (error || !data) return {};

  const orders = data as { status: OrderStatus }[];
  const counts: Partial<Record<OrderStatus | 'all', number>> = { all: orders.length };
  for (const row of orders) {
    const s = row.status;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

// ── PAGE PROPS ────────────────────────────────────────────────

interface PageProps {
  searchParams: { status?: string };
}

// ── EMPTY STATE ───────────────────────────────────────────────

function EmptyState({ filter }: { filter: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="text-5xl" aria-hidden>
        {filter ? '🔍' : '🎉'}
      </span>
      <p className="text-lg font-bold text-white">
        {filter ? 'No orders match this filter' : 'No orders yet'}
      </p>
      <p className="text-sm text-zinc-500">
        {filter
          ? 'Try a different status tab above'
          : 'Orders will appear here as soon as customers check out'}
      </p>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'; // never cache — always fresh

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  // Validate the status param against known enum values
  const VALID_STATUSES: OrderStatus[] = [
    'pending', 'confirmed', 'preparing', 'out_for_delivery',
    'delivered', 'cancelled', 'refunded',
  ];

  const rawStatus = searchParams.status ?? null;
  const activeStatus: OrderStatus | null =
    rawStatus && VALID_STATUSES.includes(rawStatus as OrderStatus)
      ? (rawStatus as OrderStatus)
      : null;

  // Fetch orders and counts in parallel
  const [orders, counts] = await Promise.all([
    fetchOrders(activeStatus),
    fetchStatusCounts(),
  ]);

  const preorderCount = orders.filter((o) => o.is_preorder).length;
  const withMessageCount = orders.filter((o) =>
    o.order_items.some((i) => i.custom_message),
  ).length;

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* ── STICKY HEADER ──────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4 gap-4">
            <div>
              <h1 className="text-xl font-black tracking-tight">
                Live Orders
              </h1>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                HXD Operations Dashboard · {new Date().toLocaleString('en-PK', {
                  weekday: 'short', day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit', hour12: true,
                })}
              </p>
            </div>

            {/* Quick stats */}
            <div className="hidden sm:flex items-center gap-3">
              {preorderCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-900/40 border border-blue-500/30 px-3 py-1.5 text-[11px] font-bold text-blue-300">
                  🕐 {preorderCount} pre-order{preorderCount !== 1 ? 's' : ''}
                </span>
              )}
              {withMessageCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-900/40 border border-amber-500/30 px-3 py-1.5 text-[11px] font-bold text-amber-300">
                  ✏️ {withMessageCount} custom msg{withMessageCount !== 1 ? 's' : ''}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-[11px] font-bold text-zinc-300">
                📋 {orders.length} order{orders.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* ── FILTER TABS ──────────────────────────────── */}
          <nav
            aria-label="Filter orders by status"
            className="flex items-center gap-1 overflow-x-auto pb-0 scrollbar-none -mx-1 px-1"
          >
            {FILTER_TABS.map((tab) => {
              const isActive =
                tab.status === null ? activeStatus === null : activeStatus === tab.status;
              const tabCount =
                tab.status === null
                  ? counts.all
                  : counts[tab.status];

              return (
                <Link
                  key={tab.label}
                  href={tab.status ? `/admin/dashboard/orders?status=${tab.status}` : '/admin/dashboard/orders'}
                  className={[
                    'shrink-0 flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 mb-[-1px]',
                    'text-[12px] font-bold border-b-2 transition-all duration-150',
                    isActive
                      ? 'border-violet-500 text-white bg-violet-500/10'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600',
                  ].join(' ')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span aria-hidden>{tab.icon}</span>
                  {tab.label}
                  {tabCount !== undefined && tabCount > 0 && (
                    <span
                      className={[
                        'rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums min-w-[18px] text-center',
                        isActive
                          ? 'bg-violet-500 text-white'
                          : 'bg-zinc-700 text-zinc-400',
                      ].join(' ')}
                    >
                      {tabCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">

        {orders.length === 0 ? (
          <EmptyState filter={activeStatus} />
        ) : (
          <>
            {/* Operational hint banners */}
            {preorderCount > 0 && !activeStatus && (
              <div
                role="note"
                className="mb-6 rounded-2xl bg-blue-950/40 border border-blue-500/25 px-5 py-3 text-[13px] text-blue-300"
              >
                <span className="font-bold text-blue-200">🕐 {preorderCount} pre-order{preorderCount !== 1 ? 's' : ''} in this view.</span>
                {' '}Each pre-order card shows the exact delivery slot the customer booked — don't miss the time!
              </div>
            )}
            {withMessageCount > 0 && !activeStatus && (
              <div
                role="note"
                className="mb-6 rounded-2xl bg-amber-950/40 border border-amber-500/25 px-5 py-3 text-[13px] text-amber-300"
              >
                <span className="font-bold text-amber-200">✏️ {withMessageCount} order{withMessageCount !== 1 ? 's have' : ' has'} custom bakery messages.</span>
                {' '}Messages are shown in bold inside each item card — confirm with the bakery before dispatching.
              </div>
            )}

            {/* Responsive card grid */}
            <div
              className="grid gap-5"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))',
              }}
            >
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
