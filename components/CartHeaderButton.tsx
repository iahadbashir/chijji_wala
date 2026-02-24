'use client';

import Link from 'next/link';
import { useCartStore, selectTotalItemCount } from '@/store/useCartStore';

export default function CartHeaderButton() {
  const count = useCartStore(selectTotalItemCount);

  return (
    <Link
      href="/checkout"
      aria-label={`Cart — ${count} item${count === 1 ? '' : 's'}`}
      className="relative flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-900/60 px-3 py-1.5 text-[13px] font-bold text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors duration-200"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      <span>Cart</span>
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[9px] font-black text-white shadow-[0_0_8px_rgba(139,92,246,0.6)]"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
