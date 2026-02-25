// ============================================================
// HXD — Order History Page (Placeholder)
// app/order-history/page.tsx
// ============================================================

import React from 'react';
import Link from 'next/link';

export default function OrderHistoryPage() {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl text-center space-y-6">
        <div className="text-6xl mb-4">📦</div>
        <h1 className="text-3xl font-black text-white">
          My Orders
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Track your current orders and view past deliveries.
          Sign in to see your order history.
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