'use client';

// ============================================================
// HXD (Chijji) — Order Success Page
// app/success/page.tsx
//
// Architecture note — hydration safety:
//   `useSearchParams()` must be rendered inside a <Suspense>
//   boundary in Next.js 14 App Router to avoid the
//   "useSearchParams() should be wrapped in a suspense boundary"
//   build error and SSR/CSR hydration mismatches.
//
//   Pattern used here:
//     SuccessPage (default export) — Client Component shell that
//       owns the <Suspense> wrapper.
//     SuccessCard — inner Client Component that safely reads
//       the orderId param and calls clearCart on mount.
//
// URL param: ?orderId=<string>
// WhatsApp: wa.me with URL-encoded pre-filled message
// ============================================================

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { useCartStore } from '@/store/useCartStore';

// ── CONSTANTS ─────────────────────────────────────────────────

/** Replace with the verified Chijji WhatsApp business number */
const WHATSAPP_BUSINESS_NUMBER = '923206000655';

/** Build a wa.me deep-link with a pre-filled, URL-encoded message */
function buildWhatsAppUrl(orderId: string): string {
  // Extract short hex (first segment of UUID)
  const shortHex = orderId.split('-')[0].toUpperCase();
  const message = `Hey Chijji! ✨ Just placed Order #${shortHex}. Can't wait for the vibe! 🎂`;
  return `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(message)}`;
}

// ── SVG ICONS ─────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// ── SPARKLE RING ──────────────────────────────────────────────
// Pure CSS animated starburst — 8 rays radiating from the icon.

function SparkleRing() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {/* Outer slow-spin ring of dots */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-violet-300/50"
          style={{
            transform: `rotate(${i * 45}deg) translateY(-52px)`,
            animation: `sparkle-pulse 2.4s ease-in-out ${i * 0.3}s infinite`,
          }}
        />
      ))}
      {/* Inner faster-spin ring */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="absolute h-1 w-1 rounded-full bg-orange-300/60"
          style={{
            transform: `rotate(${i * 60 + 22}deg) translateY(-38px)`,
            animation: `sparkle-pulse 1.8s ease-in-out ${i * 0.28}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── LOADING FALLBACK ──────────────────────────────────────────

function SuccessSkeleton() {
  return (
    <main
      className="min-h-screen bg-zinc-950 flex items-center justify-center"
      aria-label="Loading order confirmation"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="h-24 w-24 rounded-full bg-zinc-800 animate-pulse" />
        <div className="h-7 w-48 rounded-xl bg-zinc-800 animate-pulse" />
        <div className="h-4 w-64 rounded-lg bg-zinc-800 animate-pulse" />
        <div className="h-14 w-72 rounded-2xl bg-zinc-800 animate-pulse" />
      </div>
    </main>
  );
}

// ── SUCCESS CARD ──────────────────────────────────────────────
// Inner client component — safe to call useSearchParams() here
// because it is always rendered inside <Suspense>.

function SuccessCard() {
  const params   = useSearchParams();
  const orderId  = params.get('orderId') ?? 'N/A';
  const clearCart = useCartStore((s) => s.clearCart);

  // Wipe the cart exactly once on mount.
  // useRef guards against StrictMode double-invocation in dev.
  const cleared = useRef(false);
  useEffect(() => {
    if (!cleared.current) {
      clearCart();
      cleared.current = true;
    }
  }, [clearCart]);

  const whatsappUrl = buildWhatsAppUrl(orderId);

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6 text-center">

      {/* ── AMBIENT BACKGROUND GLOWS ──────────────────────── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Top-centre violet bloom */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 h-[520px] w-[520px] rounded-full bg-violet-600/10 blur-[120px]" />
        {/* Bottom-left orange warmth */}
        <div className="absolute bottom-[-8%] left-[-5%] h-[360px] w-[360px] rounded-full bg-orange-500/8 blur-[100px]" />
        {/* Top-right accent */}
        <div className="absolute top-[10%] right-[-5%] h-[280px] w-[280px] rounded-full bg-fuchsia-500/8 blur-[90px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-sm w-full">

        {/* ── SUCCESS ICON ────────────────────────────────── */}
        <div className="relative flex items-center justify-center">
          {/* Sparkle ring animation */}
          <SparkleRing />

          {/* Outer glow halo */}
          <div
            aria-hidden
            className={[
              'absolute inset-0 rounded-full blur-2xl',
              'bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20',
              'scale-110',
            ].join(' ')}
          />

          {/* Icon circle */}
          <div
            className={[
              'relative h-24 w-24 rounded-full',
              'bg-gradient-to-br from-violet-600/25 via-violet-500/15 to-fuchsia-600/10',
              'border border-violet-400/30',
              'shadow-[0_0_48px_rgba(139,92,246,0.35),inset_0_1px_0_rgba(255,255,255,0.08)]',
              'flex items-center justify-center',
            ].join(' ')}
          >
            {/* Inner pulse ring */}
            <div
              aria-hidden
              className={[
                'absolute inset-2 rounded-full',
                'bg-gradient-to-br from-violet-500/20 to-transparent',
                'animate-ping opacity-30',
              ].join(' ')}
            />
            <CheckIcon className="h-9 w-9 text-violet-300 drop-shadow-[0_0_8px_rgba(196,181,253,0.8)]" />
          </div>
        </div>

        {/* ── HEADLINE ────────────────────────────────────── */}
        <div className="space-y-3">
          <h1
            className={[
              'text-[32px] font-black tracking-tight leading-none',
              'bg-gradient-to-r from-white via-violet-100 to-fuchsia-200',
              'bg-clip-text text-transparent',
            ].join(' ')}
          >
            The vibe is secured.
          </h1>

          <p className="text-[14px] leading-relaxed text-zinc-400">
            Your order{' '}
            <span
              className={[
                'font-bold',
                'bg-gradient-to-r from-violet-400 to-fuchsia-400',
                'bg-clip-text text-transparent',
              ].join(' ')}
            >
              #{orderId}
            </span>{' '}
            has been received. Our team is on it.
          </p>
        </div>

        {/* ── ORDER ID PILL ────────────────────────────────── */}
        <div
          className={[
            'inline-flex items-center gap-2.5 rounded-2xl',
            'border border-zinc-700/60 bg-zinc-900/80 backdrop-blur-sm',
            'px-5 py-3',
          ].join(' ')}
          aria-label={`Order number ${orderId}`}
        >
          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
            Order ID
          </span>
          <span className="text-[13px] font-black text-white tabular-nums">
            #{orderId}
          </span>
        </div>

        {/* ── WHATSAPP CTA ─────────────────────────────────── */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Track or update order #${orderId} via WhatsApp`}
          className={[
            'group relative w-full overflow-hidden',
            'flex items-center justify-center gap-3',
            'rounded-2xl px-6 py-4',
            'text-[15px] font-black text-white',
            // Neon peach / orange gradient
            'bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400',
            'shadow-[0_4px_28px_rgba(251,146,60,0.45)]',
            'transition-all duration-300',
            'hover:shadow-[0_6px_36px_rgba(251,146,60,0.65)]',
            'hover:from-orange-400 hover:via-amber-300 hover:to-orange-300',
            'active:scale-[0.97]',
          ].join(' ')}
        >
          {/* Shimmer sweep on hover */}
          <div
            aria-hidden
            className={[
              'absolute inset-0 translate-x-[-100%]',
              'bg-gradient-to-r from-transparent via-white/20 to-transparent',
              'transition-transform duration-700',
              'group-hover:translate-x-[100%]',
            ].join(' ')}
          />

          <WhatsAppIcon className="h-5 w-5 shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]" />
          <span className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.25)]">
            Track or Update via WhatsApp
          </span>
          {/* Arrow icon */}
          <svg
            className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        {/* ── SECONDARY ACTIONS ────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 w-full">
          <p className="text-[11px] text-zinc-600">
            You&apos;ll also receive updates on WhatsApp automatically
          </p>

          <Link
            href="/"
            className={[
              'text-[13px] font-semibold text-zinc-500',
              'underline underline-offset-4 decoration-zinc-700',
              'hover:text-zinc-300 hover:decoration-zinc-500',
              'transition-colors duration-200',
            ].join(' ')}
          >
            Browse more treats →
          </Link>
        </div>

        {/* ── REASSURANCE STRIP ────────────────────────────── */}
        <div
          className={[
            'w-full rounded-2xl border border-zinc-800/60',
            'bg-zinc-900/50 backdrop-blur-sm',
            'px-5 py-4',
          ].join(' ')}
        >
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: '📦', label: 'Order\nReceived' },
              { icon: '🛵', label: 'Rider\nAssigned' },
              { icon: '✨', label: 'On\nThe Way' },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className={['text-xl', i === 0 ? '' : 'opacity-30'].join(' ')} aria-hidden>
                  {step.icon}
                </span>
                <p
                  className={[
                    'text-[10px] font-bold uppercase tracking-[0.12em] text-center whitespace-pre-line leading-tight',
                    i === 0 ? 'text-emerald-400' : 'text-zinc-700',
                  ].join(' ')}
                >
                  {step.label}
                </p>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-1 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
              aria-hidden
            />
          </div>
        </div>

      </div>

      {/* ── SPARKLE KEYFRAMES ─────────────────────────────── */}
      <style>{`
        @keyframes sparkle-pulse {
          0%, 100% { opacity: 0.2; transform: var(--tw-transform) scale(0.8); }
          50%       { opacity: 1;   transform: var(--tw-transform) scale(1.4); }
        }
      `}</style>
    </main>
  );
}

// ── PAGE EXPORT ───────────────────────────────────────────────
// `SuccessCard` is wrapped in <Suspense> here so that
// `useSearchParams()` inside it never triggers a hydration error.
// The fallback renders a skeleton that matches the page's visual
// weight, preventing a jarring layout shift on initial paint.

export default function SuccessPage() {
  return (
    <Suspense fallback={<SuccessSkeleton />}>
      <SuccessCard />
    </Suspense>
  );
}
