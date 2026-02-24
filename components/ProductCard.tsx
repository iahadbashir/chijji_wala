'use client';

// ============================================================
// HXD Quick-Commerce — ProductCard
// components/ProductCard.tsx
//
// Two visual states:
//   AVAILABLE    — full-color image, vibrant "Add to Cart" CTA
//   TIME-GATED   — slightly desaturated + overlay badge showing
//                  the next opening time, CTA becomes "Pre-order"
//
// When product.requires_custom_text === true the CTA does NOT
// immediately add to cart. Instead it opens an accessible React
// Aria modal so the customer can write their personalised message
// before the item lands in the basket.
// ============================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from 'react';
import Image from 'next/image';
import {
  Modal,
  ModalOverlay,
  Dialog,
  Button,
  TextField,
  Label,
  TextArea,
  Heading,
} from 'react-aria-components';

import {
  type Product,
  formatPrice,
  isProductAvailableNow,
} from '@/types/database';
import { useCartStore } from '@/store/useCartStore';

// ── CONSTANTS ─────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 120;

/** Re-evaluate availability every 60 s so the card reacts to clock changes */
const AVAILABILITY_TICK_MS = 60_000;

// ── HELPERS ───────────────────────────────────────────────────

/**
 * Format a DB time string ("HH:MM:SS") into a human-readable label.
 * "10:00:00" → "10:00 AM"  |  "23:00:00" → "11:00 PM"
 */
function formatTimeDisplay(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = String(m).padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
}

/** Context-aware modal copy based on product category */
function getModalCopy(product: Product): { heading: string; label: string; placeholder: string } {
  switch (product.category) {
    case 'cakes':
      return {
        heading: `What should we write? 🎂`,
        label: 'Message on the cake',
        placeholder: 'e.g. Happy Birthday Sara! 🎉',
      };
    case 'flowers':
      return {
        heading: `Add a card note 💐`,
        label: 'Message on the card',
        placeholder: 'e.g. Thinking of you always 🌸',
      };
    default:
      return {
        heading: `Add a personal touch ✨`,
        label: 'Your custom message',
        placeholder: 'Write something special...',
      };
  }
}

// ── PROPS ─────────────────────────────────────────────────────

export interface ProductCardProps {
  product: Product;
  /** Override "now" for testing / Storybook. Defaults to new Date() */
  _nowOverride?: Date;
  /** Optional click handler for the card (opens detail modal) */
  onClick?: () => void;
}

// ── COMPONENT ─────────────────────────────────────────────────

export function ProductCard({ product, _nowOverride, onClick }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);

  // ── Availability state (re-evaluated every minute) ──────────
  const [isAvailable, setIsAvailable] = useState<boolean>(() =>
    isProductAvailableNow(product, _nowOverride ?? new Date()),
  );

  useEffect(() => {
    if (_nowOverride) return; // static in test/preview — no need for a ticker
    const tick = () => setIsAvailable(isProductAvailableNow(product));
    const id = setInterval(tick, AVAILABILITY_TICK_MS);
    return () => clearInterval(id);
  }, [product, _nowOverride]);

  // ── Modal state ──────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when the modal opens
  useEffect(() => {
    if (isModalOpen) {
      // Small delay so the modal entrance animation finishes first
      const t = setTimeout(() => textareaRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
    // Reset state when modal closes
    setMessage('');
    setMessageError('');
  }, [isModalOpen]);

  // ── Handlers ─────────────────────────────────────────────────

  /** Called by the CTA button */
  const handleCTAClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent card click from firing when clicking the button
    e.stopPropagation();
    
    if (product.requires_custom_text) {
      // Intercept — open the message modal instead of adding immediately
      setIsModalOpen(true);
    } else {
      // Add directly (no personalisation needed)
      // is_preorder = true when the product is currently outside its time window
      addItem({ product, quantity: 1, is_preorder: !isAvailable });
    }
  }, [product, addItem, isAvailable]);

  /** Called when the user submits the modal form */
  const handleModalSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = message.trim();

      if (!trimmed) {
        setMessageError("Please write something — even a single word will make it special 💛");
        return;
      }

      addItem({ product, quantity: 1, custom_message: trimmed, is_preorder: !isAvailable });
      setIsModalOpen(false);
    },
    [product, message, addItem],
  );

  // ── Derived display values ───────────────────────────────────
  const openTimeLabel = formatTimeDisplay(product.available_from);
  const modalCopy = getModalCopy(product);
  const charsLeft = MAX_MESSAGE_LENGTH - message.length;

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <>
      {/* ── CARD ─────────────────────────────────────────────── */}
      <article
        onClick={onClick}
        className={[
          // Base
          'group relative flex flex-col rounded-2xl overflow-hidden',
          'bg-zinc-900 border border-zinc-800',
          // Cursor
          onClick ? 'cursor-pointer' : '',
          // Hover glow — adapts to availability
          'transition-all duration-300 ease-out',
          isAvailable
            ? 'hover:border-violet-500/60 hover:shadow-[0_0_28px_rgba(139,92,246,0.25)]'
            : 'hover:border-zinc-600/60 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]',
        ].join(' ')}
      >
        {/* ── IMAGE CONTAINER ────────────────────────────────── */}
        <div className="relative aspect-square overflow-hidden bg-zinc-800">

          {/* Product image */}
          <Image
            src={product.image_url ?? '/placeholder-product.png'}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={[
              'object-cover transition-all duration-500',
              'group-hover:scale-105',
              // Desaturate + dim when outside time window
              isAvailable
                ? 'saturate-100 brightness-100'
                : 'saturate-[0.35] brightness-[0.55]',
            ].join(' ')}
          />

          {/* ── TIME-GATE OVERLAY BADGE (State 2 only) ───────── */}
          {!isAvailable && (
            <div
              aria-label={`Available from ${openTimeLabel}`}
              className={[
                // Pill centred over the image
                'absolute inset-0 flex flex-col items-center justify-center gap-1',
                'px-4 text-center',
              ].join(' ')}
            >
              {/* Frosted glass pill */}
              <span
                className={[
                  'inline-flex flex-col items-center gap-0.5',
                  'rounded-2xl px-5 py-3',
                  'bg-black/60 backdrop-blur-md',
                  'border border-white/10',
                  'shadow-[0_0_24px_rgba(0,0,0,0.6)]',
                ].join(' ')}
              >
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                  Available at
                </span>
                <span className="text-2xl font-black text-white tabular-nums leading-none">
                  {openTimeLabel}
                </span>
              </span>
            </div>
          )}

          {/* ── FRAGILE BADGE ──────────────────────────────────── */}
          {product.is_fragile && (
            <span
              aria-label="Fragile item — handle with care"
              className={[
                'absolute top-2.5 right-2.5',
                'inline-flex items-center gap-1 rounded-full',
                'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                'bg-amber-900/70 backdrop-blur-sm border border-amber-500/40',
                'text-amber-300',
              ].join(' ')}
            >
              <span aria-hidden>🧊</span> Fragile
            </span>
          )}

          {/* ── UNAVAILABLE (manually toggled off) ─────────────── */}
          {!product.is_available && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <span className="text-sm font-semibold text-zinc-400 tracking-wider uppercase">
                Unavailable
              </span>
            </div>
          )}
        </div>

        {/* ── CARD BODY ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3 p-4 flex-1">

          {/* Name + category */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[15px] font-bold leading-snug text-white">
                {product.name}
              </h3>
              <span className="mt-0.5 inline-block text-[11px] font-medium capitalize text-zinc-500">
                {product.category}
              </span>
            </div>

            {/* Price */}
            <span
              className={[
                'shrink-0 rounded-lg px-2.5 py-1 text-sm font-black tabular-nums',
                isAvailable
                  ? 'bg-violet-500/15 text-violet-300'
                  : 'bg-zinc-700/40 text-zinc-400',
              ].join(' ')}
            >
              {formatPrice(product.price)}
            </span>
          </div>

          {/* Description (if present) */}
          {product.description && (
            <p className="text-[12px] leading-relaxed text-zinc-500 line-clamp-2">
              {product.description}
            </p>
          )}

          {/* Custom message hint */}
          {product.requires_custom_text && (
            <p className="flex items-center gap-1.5 text-[11px] text-violet-400/80">
              <span aria-hidden>✏️</span>
              <span>You'll add a personal message</span>
            </p>
          )}

          {/* Spacer pushes CTA to bottom */}
          <div className="flex-1" />

          {/* ── CTA BUTTON ─────────────────────────────────── */}
          {product.is_available ? (
            <button
              type="button"
              onClick={handleCTAClick}
              className={[
                'w-full rounded-xl py-3 text-[13px] font-bold tracking-wide',
                'transition-all duration-200 active:scale-[0.97]',
                isAvailable
                  // Vibrant gradient — available
                  ? [
                      'bg-gradient-to-r from-violet-600 to-fuchsia-500',
                      'text-white',
                      'shadow-[0_4px_20px_rgba(139,92,246,0.4)]',
                      'hover:shadow-[0_4px_28px_rgba(139,92,246,0.65)]',
                      'hover:from-violet-500 hover:to-fuchsia-400',
                    ].join(' ')
                  // Muted — pre-order state
                  : [
                      'bg-zinc-800 border border-zinc-600/60',
                      'text-zinc-300',
                      'hover:border-zinc-400/60 hover:text-white',
                    ].join(' '),
              ].join(' ')}
              aria-label={
                isAvailable
                  ? `Add ${product.name} to cart`
                  : `Pre-order ${product.name} for later`
              }
            >
              {isAvailable ? (
                <span className="flex items-center justify-center gap-2">
                  <span aria-hidden>🛒</span> Add to Cart
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span aria-hidden>🕐</span> Pre-order for Later
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-xl py-3 text-[13px] font-bold tracking-wide bg-zinc-800/50 text-zinc-600"
            >
              Unavailable
            </button>
          )}
        </div>
      </article>

      {/* ── CUSTOM MESSAGE MODAL ────────────────────────────────── */}
      <ModalOverlay
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        isDismissable
        // Full-screen frosted backdrop
        className={[
          'fixed inset-0 z-50 flex items-end justify-center sm:items-center',
          'bg-black/70 backdrop-blur-md',
          // Entrance / exit animations via data attributes set by React Aria
          'data-[entering]:animate-[fadeIn_200ms_ease-out]',
          'data-[exiting]:animate-[fadeOut_150ms_ease-in]',
        ].join(' ')}
      >
        <Modal
          className={[
            'relative w-full max-w-md mx-4 mb-4 sm:mb-0',
            'rounded-2xl sm:rounded-3xl overflow-hidden',
            'bg-zinc-900 border border-zinc-700/60',
            'shadow-[0_0_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)]',
            'data-[entering]:animate-[slideUp_250ms_cubic-bezier(0.34,1.56,0.64,1)]',
            'data-[exiting]:animate-[slideDown_150ms_ease-in]',
          ].join(' ')}
        >
          <Dialog
            aria-label={modalCopy.heading}
            className="outline-none"
          >
            {({ close }) => (
              <form onSubmit={handleModalSubmit} noValidate>
                {/* ── MODAL HEADER ──────────────────────────── */}
                <div className="relative px-6 pt-6 pb-4 border-b border-zinc-800">
                  {/* Ambient glow behind heading */}
                  <div
                    aria-hidden
                    className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full bg-violet-600/20 blur-3xl pointer-events-none"
                  />

                  <Heading
                    slot="title"
                    className="text-xl font-black text-white leading-snug"
                  >
                    {modalCopy.heading}
                  </Heading>

                  <p className="mt-1.5 text-[13px] text-zinc-400 leading-relaxed">
                    This goes straight to the kitchen — make it count 🌟
                  </p>

                  {/* Close button */}
                  <Button
                    slot="close"
                    onPress={close}
                    aria-label="Close"
                    className={[
                      'absolute top-5 right-5',
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      'bg-zinc-800 text-zinc-400',
                      'hover:bg-zinc-700 hover:text-white',
                      'transition-colors outline-none',
                      'focus-visible:ring-2 focus-visible:ring-violet-500',
                    ].join(' ')}
                  >
                    <svg
                      aria-hidden
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        d="M1 1l12 12M13 1L1 13"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </Button>
                </div>

                {/* ── MODAL BODY ────────────────────────────── */}
                <div className="px-6 py-5 space-y-4">

                  {/* Product mini-preview */}
                  <div className="flex items-center gap-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-4 py-3">
                    <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-zinc-700">
                      <Image
                        src={product.image_url ?? '/placeholder-product.png'}
                        alt={product.name}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-white">
                        {product.name}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {formatPrice(product.price)}
                      </p>
                    </div>
                  </div>

                  {/* Textarea field */}
                  <TextField
                    isInvalid={!!messageError}
                    isRequired
                    className="space-y-2"
                  >
                    <Label className="block text-[12px] font-semibold uppercase tracking-widest text-zinc-400">
                      {modalCopy.label}
                    </Label>

                    <div className="relative">
                      <TextArea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => {
                          setMessageError('');
                          if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                            setMessage(e.target.value);
                          }
                        }}
                        placeholder={modalCopy.placeholder}
                        rows={3}
                        maxLength={MAX_MESSAGE_LENGTH}
                        className={[
                          'w-full resize-none rounded-xl',
                          'bg-zinc-800 border px-4 py-3',
                          'text-[14px] text-white placeholder:text-zinc-600',
                          'outline-none transition-all duration-200',
                          messageError
                            ? 'border-red-500/70 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
                            : 'border-zinc-700/60 focus:border-violet-500/70 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.2)]',
                        ].join(' ')}
                      />

                      {/* Character counter */}
                      <span
                        aria-live="polite"
                        className={[
                          'absolute bottom-2.5 right-3 text-[11px] tabular-nums',
                          charsLeft <= 15 ? 'text-amber-400' : 'text-zinc-600',
                        ].join(' ')}
                      >
                        {charsLeft}
                      </span>
                    </div>

                    {/* Inline error */}
                    {messageError && (
                      <p role="alert" className="text-[12px] text-red-400 leading-snug">
                        {messageError}
                      </p>
                    )}
                  </TextField>
                </div>

                {/* ── MODAL FOOTER ──────────────────────────── */}
                <div className="flex gap-3 px-6 pb-6">
                  <button
                    type="button"
                    onClick={close}
                    className={[
                      'flex-1 rounded-xl py-3 text-[13px] font-semibold',
                      'bg-zinc-800 border border-zinc-700/60 text-zinc-400',
                      'hover:text-white hover:border-zinc-500 transition-colors',
                    ].join(' ')}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={[
                      'flex-[2] rounded-xl py-3 text-[13px] font-black tracking-wide',
                      'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white',
                      'shadow-[0_4px_20px_rgba(139,92,246,0.4)]',
                      'hover:shadow-[0_4px_28px_rgba(139,92,246,0.65)]',
                      'hover:from-violet-500 hover:to-fuchsia-400',
                      'transition-all duration-200 active:scale-[0.97]',
                    ].join(' ')}
                  >
                    {isAvailable ? (
                      <span className="flex items-center justify-center gap-2">
                        <span aria-hidden>🛒</span> Add to Cart
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <span aria-hidden>🕐</span> Pre-order
                      </span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}

export default ProductCard;
