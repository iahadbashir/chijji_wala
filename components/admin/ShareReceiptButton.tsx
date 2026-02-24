'use client';

// ============================================================
// HXD — Share Receipt Button
// components/admin/ShareReceiptButton.tsx
//
// Flow:
//   1. Render ReceiptTemplate in a hidden div
//   2. Convert to PNG using html-to-image (toPng)
//   3. Create a File blob from the data URL
//   4. MOBILE: Use navigator.share() with the file
//      DESKTOP: Use whatsapp:// deep link (image attachment not supported)
//   5. Clean up the rendered receipt node
//
// Dependencies:
//   • html-to-image (canvas-based HTML → PNG)
//   • qrcode.react (QR code SVG generation)
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { ReceiptTemplate } from './ReceiptTemplate';
import { buildWhatsAppShareUrl, buildTrackingUrl } from '@/actions/generateReceipt';
import type { OrderWithItems } from '@/types/database';

// ── PROPS ──────────────────────────────────────────────────────

export interface ShareReceiptButtonProps {
  order: OrderWithItems;
  shortId: string;
}

// ── COMPONENT ──────────────────────────────────────────────────

export function ShareReceiptButton({ order, shortId }: ShareReceiptButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const trackingUrl = buildTrackingUrl(order.id);
  const whatsappUrl = buildWhatsAppShareUrl(shortId);

  const handleShare = useCallback(async () => {
    if (!receiptRef.current) return;

    setIsGenerating(true);
    setError(null);

    try {
      // ── Step 1: Render receipt off-screen ────────────────
      // (already rendered, but hidden with opacity-0)

      // ── Step 2: Convert to PNG ────────────────────────────
      const dataUrl = await toPng(receiptRef.current, {
        quality: 1.0,
        pixelRatio: 2, // 2x for retina displays
        cacheBust: true,
      });

      // ── Step 3: Convert data URL → File blob ─────────────
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `chijji-receipt-${shortId}.png`, {
        type: 'image/png',
      });

      // ── Step 4: Share via Web Share API (mobile) ──────────
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Chijji Receipt #${shortId}`,
          text: `Oye Chijji! 👋 Here is your receipt for Order #${shortId}. Your treats are on the way! 🎂✨`,
          files: [file],
        });
      } else {
        // ── FALLBACK: Download image + open WhatsApp ────────
        // Create a temporary download link
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `chijji-receipt-${shortId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Open WhatsApp in new tab (user must manually attach the downloaded image)
        window.open(whatsappUrl, '_blank');
      }
    } catch (err) {
      console.error('[ShareReceiptButton] Generation failed:', err);
      setError('Failed to generate receipt. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [order, shortId, whatsappUrl, trackingUrl]);

  return (
    <>
      {/* ── BUTTON ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleShare}
        disabled={isGenerating}
        className={[
          'flex items-center justify-center gap-2',
          'rounded-xl px-4 py-2.5 text-[12px] font-bold',
          'transition-all duration-200',
          isGenerating
            ? 'cursor-not-allowed bg-zinc-700 text-zinc-500'
            : [
                'bg-gradient-to-r from-emerald-600 to-emerald-500',
                'text-white shadow-[0_2px_12px_rgba(16,185,129,0.3)]',
                'hover:from-emerald-500 hover:to-emerald-400',
                'hover:shadow-[0_4px_16px_rgba(16,185,129,0.4)]',
                'active:scale-95',
              ].join(' '),
        ].join(' ')}
        aria-label={`Share receipt for order ${shortId} via WhatsApp`}
      >
        {isGenerating ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Generating...
          </>
        ) : (
          <>
            <WhatsAppIcon className="h-4 w-4" />
            Share Receipt
          </>
        )}
      </button>

      {/* ── ERROR MESSAGE ──────────────────────────────────── */}
      {error && (
        <p role="alert" className="text-[10px] text-rose-400 mt-1">
          {error}
        </p>
      )}

      {/* ── HIDDEN RECEIPT TEMPLATE (for rendering) ───────── */}
      <div className="fixed -left-[9999px] -top-[9999px] opacity-0 pointer-events-none">
        <ReceiptTemplate
          ref={receiptRef}
          order={order}
          shortId={shortId}
          trackingUrl={trackingUrl}
        />
      </div>
    </>
  );
}

// ── WHATSAPP ICON ─────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default ShareReceiptButton;
