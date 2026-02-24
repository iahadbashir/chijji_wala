'use client';

// ============================================================
// HXD — Receipt Template Component
// components/admin/ReceiptTemplate.tsx
//
// A print-ready receipt card designed to be converted to PNG.
// Styling priorities:
//   - Monospace font (receipt aesthetic)
//   - High contrast (black/white) for print clarity
//   - Fixed width (320px) — typical receipt paper width
//   - QR code at bottom for order tracking
// ============================================================

import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { OrderWithItems } from '@/types/database';
import { formatPrice, parsePrice } from '@/types/database';

// ── PROPS ──────────────────────────────────────────────────────

export interface ReceiptTemplateProps {
  order: OrderWithItems;
  shortId: string;
  trackingUrl: string;
}

// ── COMPONENT ──────────────────────────────────────────────────

export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(
  function ReceiptTemplate({ order, shortId, trackingUrl }, ref) {
    const itemsTotal = order.order_items.reduce((sum, item) => {
      return sum + parsePrice(item.price_at_purchase) * item.quantity;
    }, 0);

    const deliveryFee = parsePrice(order.base_delivery_fee);
    const fragileFee = parsePrice(order.fragile_item_fee);
    const grandTotal = parsePrice(order.total_amount);

    const date = new Date(order.created_at);
    const dateStr = date.toLocaleDateString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-PK', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return (
      <div
        ref={ref}
        className="relative w-[320px] bg-white text-black p-6 font-mono text-xs leading-relaxed"
        style={{
          fontFamily: '"Courier New", Courier, monospace',
        }}
      >
        {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="text-center mb-6 border-b-2 border-dashed border-black pb-4">
          <div className="text-2xl font-black mb-1 tracking-tight">CHIJJI</div>
          <div className="text-[9px] uppercase tracking-widest text-gray-700">
            Quick-Commerce • Karachi
          </div>
        </div>

        {/* ── ORDER INFO ─────────────────────────────────────── */}
        <div className="mb-4 space-y-1 border-b border-dashed border-gray-400 pb-3">
          <div className="flex justify-between">
            <span className="font-bold">ORDER #</span>
            <span className="font-black">{shortId}</span>
          </div>
          <div className="flex justify-between text-[10px] text-gray-700">
            <span>{dateStr}</span>
            <span>{timeStr}</span>
          </div>
          {order.is_preorder && order.requested_delivery_time && (
            <div className="mt-2 text-center text-[9px] bg-black text-white py-1 px-2 rounded">
              PRE-ORDER • {new Date(order.requested_delivery_time).toLocaleString('en-PK', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
        </div>

        {/* ── CUSTOMER ───────────────────────────────────────── */}
        <div className="mb-4 text-[10px] border-b border-dashed border-gray-400 pb-3">
          <div className="font-bold mb-1">CUSTOMER</div>
          <div>{order.customer_name}</div>
          <div className="text-gray-700">{order.customer_phone}</div>
        </div>

        {/* ── ITEMS ──────────────────────────────────────────── */}
        <div className="mb-4 border-b border-dashed border-gray-400 pb-3">
          <div className="font-bold mb-2">ITEMS</div>
          <div className="space-y-2">
            {order.order_items.map((item) => {
              const lineTotal = parsePrice(item.price_at_purchase) * item.quantity;
              return (
                <div key={item.id} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="flex-1">
                      {item.quantity}x {item.product.name}
                    </span>
                    <span className="font-bold tabular-nums">
                      {formatPrice(lineTotal.toFixed(2))}
                    </span>
                  </div>
                  {item.custom_message && (
                    <div className="text-[9px] text-gray-700 pl-4 italic">
                      &quot;{item.custom_message}&quot;
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── TOTALS ─────────────────────────────────────────── */}
        <div className="space-y-1.5 mb-4 border-b-2 border-black pb-3">
          <div className="flex justify-between text-gray-700">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatPrice(itemsTotal.toFixed(2))}</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Delivery</span>
            <span className="tabular-nums">{formatPrice(deliveryFee.toFixed(2))}</span>
          </div>
          {fragileFee > 0 && (
            <div className="flex justify-between text-gray-700">
              <span>Fragile Fee</span>
              <span className="tabular-nums">{formatPrice(fragileFee.toFixed(2))}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-base pt-1">
            <span>TOTAL</span>
            <span className="tabular-nums">{formatPrice(grandTotal.toFixed(2))}</span>
          </div>
        </div>

        {/* ── PAYMENT ────────────────────────────────────────── */}
        <div className="mb-4 text-[10px] text-gray-700 border-b border-dashed border-gray-400 pb-3">
          <div className="flex justify-between">
            <span>Payment</span>
            <span className="font-bold uppercase">
              {order.payment_method.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* ── QR CODE ────────────────────────────────────────── */}
        <div className="flex flex-col items-center space-y-2 mb-4">
          <div className="text-[9px] text-gray-700 uppercase tracking-wider">
            Track Your Order
          </div>
          <QRCodeSVG
            value={trackingUrl}
            size={80}
            level="M"
            includeMargin={false}
            style={{ display: 'block' }}
          />
          <div className="text-[8px] text-gray-500 text-center max-w-[200px] break-all">
            {trackingUrl}
          </div>
        </div>

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <div className="text-center text-[9px] text-gray-500 space-y-0.5 border-t border-dashed border-gray-400 pt-3">
          <div>Thank you for choosing Chijji!</div>
          <div className="font-bold">Questions? WhatsApp: 0320 6000655</div>
          <div className="text-[8px]">chijji.com • @chijjipk</div>
        </div>

        {/* ── WATERMARK ──────────────────────────────────────── */}
        <div className="absolute bottom-2 right-2 text-[7px] text-gray-400 opacity-50">
          Receipt #{shortId}
        </div>
      </div>
    );
  }
);

export default ReceiptTemplate;
