'use client';

// ============================================================
// HXD — Sticky Header Component
// components/StickyHeader.tsx
//
// Features:
//   • position: sticky, top: 0 with high z-index
//   • Frosted glass backdrop (blur + semi-transparent bg)
//   • Chijji logo (left)
//   • Search icon (middle-right)
//   • Cart button with pulsing badge (far right)
// ============================================================

import React from 'react';
import Link from 'next/link';
import { Search, ShoppingCart } from 'lucide-react';
import { useCartStore, selectTotalItemCount } from '@/store/useCartStore';

export function StickyHeader() {
  const cartCount = useCartStore(selectTotalItemCount);

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 z-50',
        'border-b border-zinc-800/60',
        'bg-black/50 backdrop-blur-md',
        'transition-all duration-300',
      ].join(' ')}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* ── LEFT: Logo ───────────────────────────────── */}
          <Link
            href="/"
            className="flex items-center gap-2 group"
          >
            <div
              className={[
                'flex h-9 w-9 items-center justify-center rounded-xl',
                'bg-gradient-to-br from-violet-600 to-fuchsia-500',
                'shadow-[0_4px_20px_rgba(139,92,246,0.4)]',
                'group-hover:shadow-[0_4px_28px_rgba(139,92,246,0.6)]',
                'transition-shadow duration-200',
              ].join(' ')}
            >
              <span className="text-lg font-black text-white">✨</span>
            </div>
            <span
              className={[
                'text-[18px] font-black tracking-tight',
                'bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400',
                'bg-clip-text text-transparent',
                'select-none',
              ].join(' ')}
            >
              Chijji
            </span>
          </Link>

          {/* ── RIGHT: Actions ───────────────────────────── */}
          <div className="flex items-center gap-3">
            
            {/* Search Button */}
            <button
              type="button"
              aria-label="Search products"
              className={[
                'flex h-9 w-9 items-center justify-center rounded-xl',
                'border border-zinc-700/60 bg-zinc-900/60',
                'text-zinc-400',
                'hover:border-zinc-600 hover:bg-zinc-800 hover:text-white',
                'transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
              ].join(' ')}
            >
              <Search size={18} strokeWidth={2} aria-hidden />
            </button>

            {/* Cart Button with Pulsing Badge */}
            <Link
              href="/checkout"
              aria-label={`Cart — ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              className={[
                'relative flex items-center gap-2',
                'rounded-xl border px-3.5 py-2',
                'text-[13px] font-bold',
                'transition-all duration-200',
                cartCount > 0
                  ? [
                      'border-violet-500/60 bg-violet-500/10',
                      'text-violet-300',
                      'shadow-[0_0_16px_rgba(139,92,246,0.2)]',
                      'hover:border-violet-400/80 hover:bg-violet-500/15',
                      'hover:shadow-[0_0_24px_rgba(139,92,246,0.3)]',
                    ].join(' ')
                  : [
                      'border-zinc-700/60 bg-zinc-900/60',
                      'text-zinc-400',
                      'hover:border-zinc-600 hover:bg-zinc-800 hover:text-white',
                    ].join(' '),
              ].join(' ')}
            >
              <ShoppingCart size={16} strokeWidth={2.5} aria-hidden />
              <span className="hidden sm:inline">Cart</span>

              {/* Pulsing Notification Badge */}
              {cartCount > 0 && (
                <>
                  {/* Animated pulse ring */}
                  <span
                    aria-hidden
                    className={[
                      'absolute -top-1 -right-1',
                      'flex h-5 w-5',
                      'animate-ping',
                      'rounded-full',
                      'bg-violet-500/60',
                      'opacity-75',
                    ].join(' ')}
                  />

                  {/* Static badge with count */}
                  <span
                    aria-hidden
                    className={[
                      'absolute -top-1 -right-1',
                      'flex h-5 w-5 items-center justify-center',
                      'rounded-full',
                      'bg-gradient-to-br from-violet-500 to-fuchsia-500',
                      'text-[10px] font-black text-white',
                      'shadow-[0_2px_8px_rgba(139,92,246,0.6)]',
                      'ring-2 ring-black/20',
                    ].join(' ')}
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                </>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom glow line (accent) */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-60"
      />
    </header>
  );
}

export default StickyHeader;