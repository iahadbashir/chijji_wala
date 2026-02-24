// ============================================================
// Chijji — Storefront (Home Page)
// app/page.tsx — Server Component
// ============================================================

import { createServiceClient } from '@/lib/supabase/server';
import type { Product } from '@/types/database';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';

// ── Cart link in header ───────────────────────────────────────
// We import a thin client wrapper so we can keep this page a
// pure Server Component and still show a reactive cart badge.
import CartHeaderButton from '@/components/CartHeaderButton';

// ── Hero categories ───────────────────────────────────────────
const CATEGORIES = ['🎂 Cakes', '💐 Flowers', '🍭 Snacks', '🎁 Gifts', '✨ All'];

// ── Fetch products ─────────────────────────────────────────────
async function fetchProducts(): Promise<Product[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[fetchProducts] Supabase error:', error.message);
      return [];
    }
    return (data ?? []) as Product[];
  } catch (err) {
    console.error('[fetchProducts] Unexpected error:', err);
    return [];
  }
}

// ── Page ───────────────────────────────────────────────────────
export const revalidate = 60; // ISR: re-fetch every 60 s

export default async function StorefrontPage() {
  const products = await fetchProducts();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* ── Ambient background ─────────────────────────────── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 h-[700px] w-[700px] rounded-full bg-violet-600/8 blur-[140px]" />
        <div className="absolute bottom-0 right-[-10%] h-[400px] w-[400px] rounded-full bg-fuchsia-600/6 blur-[120px]" />
      </div>

      {/* ── Sticky header ──────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 h-14">

          {/* Wordmark */}
          <Link
            href="/"
            className="text-[17px] font-black tracking-tight bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent select-none"
          >
            Chijji ✨
          </Link>

          {/* Nav area */}
          <div className="flex items-center gap-3">
            <CartHeaderButton />
            <Link
              href="/admin/orders"
              className="hidden sm:block rounded-xl border border-zinc-700/50 bg-zinc-900/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors duration-200"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative px-4 sm:px-6 pt-12 pb-8 text-center mx-auto max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-400/80 mb-4">
          Delivered in 45 minutes
        </p>
        <h1 className="text-[46px] sm:text-[58px] font-black tracking-tight leading-[0.95] mb-5">
          <span className="bg-gradient-to-br from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            The vibe,
          </span>
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            delivered.
          </span>
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-md mx-auto">
          Cakes, flowers, snacks and gifts — express your feelings instantly.
        </p>

        {/* Category pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          {CATEGORIES.map((c) => (
            <span
              key={c}
              className="rounded-full border border-zinc-700/60 bg-zinc-900/70 px-4 py-1.5 text-[12px] font-semibold text-zinc-400 hover:text-white hover:border-zinc-500 cursor-pointer transition-colors duration-200 select-none"
            >
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* ── Product grid ───────────────────────────────────── */}
      <main className="relative z-10 px-4 sm:px-6 pb-24 mx-auto max-w-6xl">
        {products.length === 0 ? (
          <EmptyState />
        ) : (
          <section>
            <h2 className="sr-only">Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/50 text-center py-8 px-4">
        <p className="text-[11px] text-zinc-700 uppercase tracking-[0.15em] font-semibold">
          Chijji &copy; {new Date().getFullYear()} &mdash; Fast delivery, big vibes.
        </p>
      </footer>
    </div>
  );
}

// ── Empty / env-not-configured state ─────────────────────────
function EmptyState() {
  const missingEnv =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <div className="flex flex-col items-center justify-center py-32 text-center gap-6">
      <div className="text-6xl" aria-hidden>✨</div>
      <div className="space-y-2">
        <h2 className="text-[20px] font-black text-white">No products yet</h2>
        <p className="text-[13px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
          {missingEnv
            ? 'Add your Supabase credentials to .env.local and seed the products table to see the storefront.'
            : 'The products table is empty. Add some products in Supabase to get started.'}
        </p>
      </div>
      {missingEnv && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 px-6 py-4 text-left max-w-sm w-full">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-400 mb-3">
            Setup Required
          </p>
          <div className="space-y-1 text-[12px] font-mono text-amber-300/80">
            <p>NEXT_PUBLIC_SUPABASE_URL=…</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=…</p>
            <p>SUPABASE_SERVICE_ROLE_KEY=…</p>
          </div>
          <p className="mt-3 text-[11px] text-amber-400/60">Copy these into /HXD/.env.local</p>
        </div>
      )}
    </div>
  );
}
