// filepath: /Users/ahadqazi/Developer/HXD/components/admin/InventoryRow.tsx
'use client';

// ============================================================
// HXD — Inventory Table Row (Client Component)
// components/admin/InventoryRow.tsx
//
// Isolated as a Client Component so optimistic toggle + delete
// confirmation live here without making the whole page client.
// ============================================================

import React, { useOptimistic, useTransition, useState } from 'react';
import Image from 'next/image';
import { Switch, Button, DialogTrigger, Dialog, Modal, ModalOverlay, Heading } from 'react-aria-components';
import { toggleProductAvailability, deleteProduct } from '@/actions/adminProducts';
import { formatPrice } from '@/types/database';
import type { Product } from '@/types/database';

interface InventoryRowProps {
  product: Product;
}

export function InventoryRow({ product }: InventoryRowProps) {
  const [isPending,      startTrans]        = useTransition();
  const [deleteError,    setDeleteError]    = useState<string | null>(null);
  const [isConfirmOpen,  setIsConfirmOpen]  = useState(false);

  // Optimistic availability toggle
  const [optimisticAvail, setOptimisticAvail] = useOptimistic(
    product.is_available,
    (_prev: boolean, next: boolean) => next,
  );

  async function handleToggle(next: boolean) {
    startTrans(async () => {
      setOptimisticAvail(next);
      const result = await toggleProductAvailability(product.id, next);
      if (!result.success) {
        // Revert is automatic because useOptimistic rolls back on action end
        console.error('[InventoryRow] toggle failed:', result.error);
      }
    });
  }

  async function handleDelete() {
    setDeleteError(null);
    startTrans(async () => {
      const result = await deleteProduct(product.id);
      if (!result.success) {
        setDeleteError(result.error);
        setIsConfirmOpen(false);
      }
      // On success, revalidatePath in the action removes this row from the page
    });
  }

  const categoryEmoji: Record<string, string> = {
    cakes: '🎂', flowers: '💐', snacks: '🍭',
    noodles: '🍜', beverages: '🧋', other: '🎁',
  };

  return (
    <>
      <tr className={[
        'group border-b border-zinc-800/60 transition-colors duration-150',
        'hover:bg-zinc-800/30',
        isPending ? 'opacity-60' : '',
      ].join(' ')}>

        {/* Image + Name */}
        <td className="py-3 pl-4 pr-3">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl">
                  {categoryEmoji[product.category] ?? '🎁'}
                </div>
              )}
            </div>
            <div>
              <p className="text-[13px] font-bold text-white leading-snug">{product.name}</p>
              {product.description && (
                <p className="text-[11px] text-zinc-500 line-clamp-1 max-w-[180px]">
                  {product.description}
                </p>
              )}
            </div>
          </div>
        </td>

        {/* Category */}
        <td className="px-3 py-3 text-[12px] text-zinc-400 capitalize">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-2.5 py-1">
            <span aria-hidden>{categoryEmoji[product.category] ?? '🎁'}</span>
            {product.category}
          </span>
        </td>

        {/* Price */}
        <td className="px-3 py-3 text-[13px] font-black tabular-nums text-[#FFE66D]">
          {formatPrice(product.price)}
        </td>

        {/* Badges */}
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-1.5">
            {product.is_fragile && (
              <span className="rounded-md bg-[#FF6B6B]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF6B6B]">
                📦 Fragile
              </span>
            )}
            {product.requires_custom_text && (
              <span className="rounded-md bg-[#FFE66D]/10 px-2 py-0.5 text-[10px] font-bold text-[#FFE66D]">
                ✏️ Message
              </span>
            )}
            {product.available_from && (
              <span className="rounded-md bg-zinc-700/60 px-2 py-0.5 text-[10px] text-zinc-400">
                🕐 {product.available_from.slice(0, 5)}–{product.available_until?.slice(0, 5) ?? '?'}
              </span>
            )}
          </div>
        </td>

        {/* Availability Toggle */}
        <td className="px-3 py-3">
          <Switch
            isSelected={optimisticAvail}
            onChange={handleToggle}
            isDisabled={isPending}
            aria-label={`Toggle availability for ${product.name}`}
            className="group/switch flex cursor-pointer items-center gap-2 outline-none"
          >
            <div className={[
              'relative flex h-5 w-9 items-center rounded-full p-0.5',
              'transition-colors duration-200',
              optimisticAvail ? 'bg-emerald-500' : 'bg-zinc-700',
            ].join(' ')}>
              <div className={[
                'h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                optimisticAvail ? 'translate-x-4' : 'translate-x-0',
              ].join(' ')} />
            </div>
            <span className={[
              'text-[11px] font-bold transition-colors',
              optimisticAvail ? 'text-emerald-400' : 'text-zinc-600',
            ].join(' ')}>
              {optimisticAvail ? 'Live' : 'Off'}
            </span>
          </Switch>
        </td>

        {/* Delete */}
        <td className="py-3 pl-3 pr-4 text-right">
          {deleteError && (
            <p className="mb-1 text-[10px] text-rose-400 max-w-[140px] text-right leading-tight">
              {deleteError}
            </p>
          )}
          <DialogTrigger isOpen={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <Button
              isDisabled={isPending}
              className={[
                'rounded-lg px-3 py-1.5 text-[11px] font-bold',
                'border border-zinc-700 text-zinc-500',
                'transition-all duration-150',
                'hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-400',
                'pressed:scale-95',
              ].join(' ')}
            >
              🗑 Delete
            </Button>

            <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
              <Modal className="w-full max-w-sm mx-4 animate-slideUp">
                <Dialog className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 outline-none">
                  {({ close }) => (
                    <>
                      <Heading slot="title" className="text-[16px] font-black text-white mb-2">
                        Delete "{product.name}"?
                      </Heading>
                      <p className="text-[12px] text-zinc-400 mb-6 leading-relaxed">
                        This is permanent. If this product has existing orders it cannot be deleted — disable it instead.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          onPress={close}
                          className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-[12px] font-bold text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors"
                        >
                          Cancel
                        </Button>
                        <Button
                          onPress={handleDelete}
                          isDisabled={isPending}
                          className={[
                            'flex-1 rounded-xl py-2.5 text-[12px] font-bold text-white transition-all',
                            isPending
                              ? 'bg-zinc-700 cursor-not-allowed'
                              : 'bg-rose-600 hover:bg-rose-500 shadow-[0_4px_16px_rgba(239,68,68,0.3)]',
                          ].join(' ')}
                        >
                          {isPending ? 'Deleting…' : '🗑 Yes, Delete'}
                        </Button>
                      </div>
                    </>
                  )}
                </Dialog>
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
        </td>

      </tr>
    </>
  );
}

export default InventoryRow;