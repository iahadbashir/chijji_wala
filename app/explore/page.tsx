// ============================================================
// HXD — Explore Page (Placeholder)
// app/explore/page.tsx
// ============================================================

import React from 'react';
import Link from 'next/link';

export default function ExplorePage() {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl text-center space-y-6">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-3xl font-black text-white">
          Explore Categories
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Browse by category, filter by price, or search for specific items.
          This feature is coming soon!
        </p>
        <Link
          href="/"
          className="inline-block mt-6 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white hover:bg-violet-500 transition-colors"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
