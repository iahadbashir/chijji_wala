// filepath: /Users/ahadqazi/Developer/HXD/app/admin/inventory/page.tsx
// ============================================================
// HXD — Admin Inventory Management Page
// app/admin/inventory/page.tsx  — Server Component
//
// Fetches all products server-side.
// AddProductForm + InventoryRow are Client Components embedded
// here so this page itself remains a fast Server Component.
// ============================================================

import React from 'react';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import type { Product } from '@/types/database';
import { AddProductForm } from '@/components/admin/AddProductForm';
import { InventoryRow } from '@/components/admin/InventoryRow';

export const dynamic = 'force-dynamic'; // always fresh — no caching on admin

// ── Data fetcher ───────────────────────────────────────────────

async function fetchAllProducts(): Promise<Product[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[fetchAllProducts]', error.message);
      return [];
    }
    return (data ?? []) as Product[];
  } catch (err) {
    console.error('[fetchAllProducts] unexpected:', err);
    return [];
  }
}

// ── Stat pill ──────────────────────────────────────────────────

function StatPill({ emoji, label, value, accent }: {
  emoji: string;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      <span className="text-2xl" aria-hidden>{emoji}</span>
      <div>
        <p className={`text-[22px] font-black tabular-nums ${accent}`}>{value}</p>
        <p className="text-[11px] text-zinc-500 uppercase tracking-[0.1em]">{label}</p>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default async function InventoryPage() {
  const products = await fetchAllProducts();

  const liveCount    = products.filter((p) => p.is_available).length;
  const fragileCount = products.filter((p) => p.is_fragile).length;
  const totalCount   = products.length;

  const categoryEmoji: Record<string, string> = {
    cakes: '🎂', flowers: '💐', snacks: '🍭',
    noodles: '🍜', beverages: '🧋', other: '🎁',
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">

      {/* ── Top Nav ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard/orders"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors"
              aria-label="Back to orders"
            >
              ←
            </Link>
            <div>
              <h1 className="text-[15px] font-black text-white leading-none">Inventory</h1>
              <p className="text-[10px] text-zinc-600 mt-0.5">Manage your products</p>
            </div>
          </div>

          <Link
            href="/admin/dashboard/orders"
            className="flex items-center gap-2 rounded-xl border border-zinc-700 px-3.5 py-2 text-[12px] font-bold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            📋 Orders
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {/* ── Stats Row ──────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-3 gap-3 sm:gap-4">
          <StatPill emoji="🛍️" label="Total Products" value={totalCount}   accent="text-white" />
          <StatPill emoji="✅" label="Live Now"        value={liveCount}    accent="text-emerald-400" />
          <StatPill emoji="📦" label="Fragile Items"   value={fragileCount} accent="text-[#FF6B6B]" />
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_420px]">

          {/* ── Left: Inventory Table ─────────────────────────── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[13px] font-black uppercase tracking-[0.12em] text-zinc-400">
                All Products
              </h2>
              <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-400">
                {totalCount} total
              </span>
            </div>

            {products.length === 0 ? (
              /* ── Empty state ─────────────────────────────────── */
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 py-20 text-center">
                <p className="text-5xl mb-4" aria-hidden>🛒</p>
                <p className="text-[16px] font-black text-white mb-1">No products yet</p>
                <p className="text-[12px] text-zinc-500 max-w-xs leading-relaxed">
                  Use the form on the right to add your first product.
                  It'll appear here and go live on the storefront instantly.
                </p>
              </div>
            ) : (
              /* ── Product table ───────────────────────────────── */
              <div className="overflow-hidden rounded-2xl border border-zinc-800">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/60">
                        <th className="py-2.5 pl-4 pr-3 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">
                          Product
                        </th>
                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">
                          Category
                        </th>
                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">
                          Price
                        </th>
                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">
                          Tags
                        </th>
                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">
                          Status
                        </th>
                        <th className="py-2.5 pl-3 pr-4 text-right text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-500">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <InventoryRow key={product.id} product={product} />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Gradient fade-out at bottom of long lists */}
                {products.length > 8 && (
                  <div className="h-8 bg-gradient-to-t from-zinc-900/80 to-transparent rounded-b-2xl pointer-events-none" />
                )}
              </div>
            )}

            {/* Category legend */}
            {products.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(
                  products.reduce<Record<string, number>>((acc, p) => {
                    acc[p.category] = (acc[p.category] ?? 0) + 1;
                    return acc;
                  }, {}),
                ).map(([cat, count]) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/60 px-2.5 py-1 text-[11px] text-zinc-400"
                  >
                    <span aria-hidden>{categoryEmoji[cat] ?? '🎁'}</span>
                    <span className="capitalize">{cat}</span>
                    <span className="font-bold text-zinc-300">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* ── Right: Add Product Form ──────────────────────── */}
          <aside className="xl:sticky xl:top-[72px] xl:self-start">
            <AddProductForm />
          </aside>

        </div>
      </main>
    </div>
  );
}