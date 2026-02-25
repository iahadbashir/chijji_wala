'use client';

// ============================================================
// HXD — Checkout Wizard Demo Page
// app/checkout-wizard/page.tsx
//
// Demonstration of the new CheckoutWizard component with
// framer-motion animations and multi-step validation.
// ============================================================

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckoutWizard } from '@/components/CheckoutWizard';
import type { CheckoutData } from '@/components/CheckoutWizard';

export default function CheckoutWizardDemoPage() {
  const router = useRouter();
  const [orderData, setOrderData] = useState<CheckoutData | null>(null);

  const handleComplete = (data: CheckoutData) => {
    console.log('Order completed with data:', data);
    setOrderData(data);
    
    // Simulate order processing
    setTimeout(() => {
      // In real app, this would call your processOrder action
      router.push('/order-confirmation?id=demo-' + Date.now());
    }, 1000);
  };

  const handleCancel = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 h-[700px] w-[700px] rounded-full bg-violet-600/8 blur-[140px]" />
        <div className="absolute bottom-0 right-[-10%] h-[400px] w-[400px] rounded-full bg-fuchsia-600/6 blur-[120px]" />
      </div>

      {/* Header */}
      <div className="border-b border-zinc-800/50 bg-black/30 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white">
                Checkout
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                Complete your order in 3 easy steps
              </p>
            </div>
            <Link
              href="/"
              className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              ← Back to Store
            </Link>
          </div>
        </div>
      </div>

      {/* Wizard */}
      <div className="mx-auto max-w-4xl px-4 py-12">
        {!orderData ? (
          <CheckoutWizard
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        ) : (
          <div className="text-center space-y-6 py-12">
            <div className="text-6xl mb-4">✨</div>
            <h2 className="text-3xl font-black text-white">
              Processing your order...
            </h2>
            <p className="text-zinc-400">
              You'll be redirected to the confirmation page shortly.
            </p>
            <div className="inline-flex gap-2">
              <div className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 rounded-full bg-fuchsia-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer help */}
      <div className="fixed bottom-4 right-4">
        <div className="rounded-xl bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 px-4 py-3 shadow-xl">
          <p className="text-xs text-zinc-400">
            Need help? <a href="https://wa.me/923206000655" target="_blank" rel="noopener" className="text-violet-400 hover:text-violet-300 font-semibold">WhatsApp us</a>
          </p>
        </div>
      </div>
    </div>
  );
}
