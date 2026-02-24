'use client';

// ============================================================
// HXD — Product Detail Modal
// components/ProductDetailModal.tsx
//
// Modal dialog showing product details with quantity selector.
// ============================================================

import React, { useState } from 'react';
import Image from 'next/image';
import type { Product } from '@/types/database';
import { formatPrice, parsePrice } from '@/types/database';
import { useCartStore } from '@/store/useCartStore';

// ── PROPS ──────────────────────────────────────────────────────

export interface ProductDetailModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

// ── COMPONENT ──────────────────────────────────────────────────

export function ProductDetailModal({ product, isOpen, onClose }: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [customMessage, setCustomMessage] = useState('');
  const addItem = useCartStore((s) => s.addItem);

  if (!isOpen) return null;

  const handleAddToCart = () => {
    addItem({
      product,
      quantity,
      custom_message: customMessage || undefined,
    });
    
    onClose();
    setQuantity(1);
    setCustomMessage('');
  };

  const totalPrice = parsePrice(product.price) * quantity;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200"
      >
        <div className="m-4 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800/80 backdrop-blur-sm text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            aria-label="Close modal"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="grid md:grid-cols-2 gap-6 p-6">
            {/* Left: Product Image */}
            <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800">
              <Image
                src={product.image_url || '/placeholder-product.jpg'}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {!product.is_available && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <span className="rounded-full bg-zinc-900/90 px-4 py-2 text-sm font-bold text-zinc-400">
                    Unavailable
                  </span>
                </div>
              )}
            </div>

            {/* Right: Product Info */}
            <div className="flex flex-col">
              {/* Header */}
              <div className="mb-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 id="product-modal-title" className="text-2xl font-black text-white">
                    {product.name}
                  </h2>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    {getCategoryLabel(product.category)}
                  </span>
                </div>
                {product.description && (
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="mb-6">
                <p className="text-3xl font-black bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] bg-clip-text text-transparent">
                  {formatPrice(product.price)}
                </p>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-6">
                {product.is_fragile && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/30 border border-rose-500/30 px-3 py-1 text-xs font-bold text-rose-400">
                    📦 Fragile Item
                  </span>
                )}
                {product.requires_custom_text && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/30 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-400">
                    ✏️ Custom Message
                  </span>
                )}
              </div>

              {/* Quantity Selector */}
              {product.is_available && (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Quantity
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        −
                      </button>
                      <span className="text-2xl font-black text-white w-12 text-center">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                        disabled={quantity >= 99}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Custom Message */}
                  {product.requires_custom_text && (
                    <div className="mb-6">
                      <label htmlFor="custom-message" className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                        Custom Message
                      </label>
                      <textarea
                        id="custom-message"
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="E.g., 'Happy Birthday Sarah!'"
                        maxLength={100}
                        rows={3}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#FF6B6B]/50 focus:ring-2 focus:ring-[#FF6B6B]/20 transition-all resize-none"
                      />
                      <p className="mt-1 text-xs text-zinc-600">
                        {customMessage.length}/100 characters
                      </p>
                    </div>
                  )}

                  {/* Total & Add to Cart */}
                  <div className="mt-auto pt-4 border-t border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-zinc-400">Total</span>
                      <span className="text-2xl font-black text-white">
                        {formatPrice(totalPrice.toFixed(2))}
                      </span>
                    </div>
                    <button
                      onClick={handleAddToCart}
                      className={[
                        'w-full rounded-xl py-3 text-sm font-black tracking-wide',
                        'bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white',
                        'shadow-[0_4px_24px_rgba(255,107,107,0.35)]',
                        'hover:from-[#ff5555] hover:to-[#ff7a3a]',
                        'hover:shadow-[0_6px_32px_rgba(255,107,107,0.5)]',
                        'active:scale-98 transition-all duration-200',
                      ].join(' ')}
                    >
                      Add to Cart • {quantity} {quantity === 1 ? 'item' : 'items'}
                    </button>
                  </div>
                </>
              )}

              {/* Unavailable State */}
              {!product.is_available && (
                <div className="mt-auto pt-4 border-t border-zinc-800">
                  <p className="text-center text-sm text-zinc-500">
                    This item is currently unavailable
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    cakes: 'Cake',
    flowers: 'Flowers',
    snacks: 'Snacks',
    noodles: 'Noodles',
    beverages: 'Drink',
    other: 'Other',
  };
  return labels[category] || category;
}

export default ProductDetailModal;
