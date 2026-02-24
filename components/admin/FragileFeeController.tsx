'use client';

// ============================================================
// HXD — Fragile Fee Controller
// components/admin/FragileFeeController.tsx
//
// Lets the admin set the fragile-item surcharge live from the
// dashboard. No page reload required — optimistic update with
// instant visual feedback.
//
// Usage (in a Server Component parent):
//   const { current_fragile_fee } = await getSettings();
//   <FragileFeeController initialFee={current_fragile_fee} />
// ============================================================

import React, { useState, useTransition } from 'react';
import {
  NumberField,
  Label,
  Group,
  Input,
  Button,
  FieldError,
  Text,
} from 'react-aria-components';
import { updateFragileFee } from '@/actions/updateFragileFee';

// ── TYPES ──────────────────────────────────────────────────────

export interface FragileFeeControllerProps {
  /** Current value fetched server-side — avoids a client loading flash */
  initialFee: number;
}

// ── FEEDBACK STATE ─────────────────────────────────────────────

type FeedbackState =
  | { type: 'idle' }
  | { type: 'success'; savedFee: number }
  | { type: 'error';   message: string };

// ── COMPONENT ──────────────────────────────────────────────────

export function FragileFeeController({ initialFee }: FragileFeeControllerProps) {
  const [fee,      setFee]      = useState<number>(initialFee);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'idle' });
  const [isPending, startTransition] = useTransition();

  // Derived: has the user changed the value from the last saved value?
  const lastSaved = feedback.type === 'success' ? feedback.savedFee : initialFee;
  const isDirty   = fee !== lastSaved;

  function handleSave() {
    if (!isDirty || isPending) return;

    setFeedback({ type: 'idle' });

    startTransition(async () => {
      const result = await updateFragileFee(fee);

      if (result.success) {
        setFeedback({ type: 'success', savedFee: result.updatedFee });
        // Auto-dismiss the success state after 3 s
        setTimeout(() => setFeedback((prev) =>
          prev.type === 'success' ? { type: 'idle' } : prev,
        ), 3000);
      } else {
        setFeedback({ type: 'error', message: result.error });
        // Roll back the input to the last confirmed value
        setFee(lastSaved);
      }
    });
  }

  return (
    <div
      className={[
        'relative rounded-2xl border p-5 space-y-4',
        'bg-zinc-900 transition-all duration-300',
        feedback.type === 'success'
          ? 'border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.1)]'
          : feedback.type === 'error'
            ? 'border-red-500/40 shadow-[0_0_24px_rgba(239,68,68,0.1)]'
            : 'border-zinc-800',
      ].join(' ')}
    >
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5 shrink-0" aria-hidden>🌹</span>
        <div>
          <h3 className="text-[14px] font-black text-white leading-snug">
            Fragile Item Surcharge
          </h3>
          <p className="text-[12px] text-zinc-500 leading-relaxed mt-0.5">
            Applied when a basket contains cakes or flowers.
            Changes take effect immediately for all new orders.
          </p>
        </div>
      </div>

      {/* ── REACT ARIA NUMBER FIELD ────────────────────────── */}
      <NumberField
        value={fee}
        onChange={setFee}
        minValue={0}
        maxValue={9999.99}
        step={5}
        formatOptions={{
          // Raw numeric display — we add the "Rs." prefix manually in the label
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }}
        isDisabled={isPending}
        aria-label="Fragile item surcharge amount in Pakistani Rupees"
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
            Surcharge Amount
          </Label>
          <Text
            slot="description"
            className="text-[11px] text-zinc-600"
          >
            0 = disabled
          </Text>
        </div>

        <Group
          className={[
            'flex items-center rounded-xl border overflow-hidden',
            'transition-all duration-200',
            isPending
              ? 'border-zinc-700/40 opacity-60'
              : isDirty
                ? 'border-violet-500/60 shadow-[0_0_0_3px_rgba(139,92,246,0.12)]'
                : 'border-zinc-700/60',
            'focus-within:border-violet-500/70 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.15)]',
          ].join(' ')}
        >
          {/* Currency prefix */}
          <span
            aria-hidden
            className="shrink-0 bg-zinc-800 border-r border-zinc-700/60 px-3 py-3 text-[13px] font-bold text-zinc-400 select-none"
          >
            Rs.
          </span>

          <Input
            className={[
              'flex-1 bg-zinc-800 px-4 py-3',
              'text-[16px] font-black text-white tabular-nums',
              'outline-none placeholder:text-zinc-600',
              'disabled:cursor-wait',
            ].join(' ')}
          />

          {/* Stepper buttons */}
          <div className="flex flex-col border-l border-zinc-700/60">
            <Button
              slot="increment"
              aria-label="Increase fee by Rs. 5"
              className={[
                'flex h-[26px] w-9 items-center justify-center',
                'border-b border-zinc-700/60 bg-zinc-800',
                'text-zinc-400 hover:text-white hover:bg-zinc-700',
                'transition-colors outline-none',
                'focus-visible:bg-zinc-700',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 6.5l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
            <Button
              slot="decrement"
              aria-label="Decrease fee by Rs. 5"
              className={[
                'flex h-[26px] w-9 items-center justify-center',
                'bg-zinc-800',
                'text-zinc-400 hover:text-white hover:bg-zinc-700',
                'transition-colors outline-none',
                'focus-visible:bg-zinc-700',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>
        </Group>

        <FieldError className="text-[11px] text-red-400" />
      </NumberField>

      {/* ── SAVE BUTTON ────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!isDirty || isPending}
        aria-disabled={!isDirty || isPending}
        className={[
          'w-full rounded-xl py-3 text-[13px] font-black tracking-wide',
          'transition-all duration-200 active:scale-[0.97]',
          !isDirty || isPending
            ? 'bg-zinc-800 border border-zinc-700/60 text-zinc-600 cursor-not-allowed'
            : [
                'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white',
                'shadow-[0_4px_18px_rgba(139,92,246,0.35)]',
                'hover:shadow-[0_4px_24px_rgba(139,92,246,0.55)]',
                'hover:from-violet-500 hover:to-fuchsia-400',
              ].join(' '),
        ].join(' ')}
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Saving…
          </span>
        ) : isDirty ? (
          <span className="flex items-center justify-center gap-2">
            <span aria-hidden>💾</span>
            Save — Rs. {fee.toFixed(2)}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <span aria-hidden>✓</span>
            No Changes
          </span>
        )}
      </button>

      {/* ── FEEDBACK BANNER ────────────────────────────────── */}
      {feedback.type === 'success' && (
        <div
          role="status"
          aria-live="polite"
          className={[
            'flex items-center gap-2 rounded-xl px-4 py-3',
            'bg-emerald-950/50 border border-emerald-500/35',
            'text-[12px] font-semibold text-emerald-300',
            'animate-[fadeIn_200ms_ease-out]',
          ].join(' ')}
        >
          <span aria-hidden>✅</span>
          Surcharge updated to{' '}
          <span className="font-black text-emerald-200">
            Rs. {feedback.savedFee.toFixed(2)}
          </span>
          . Live for all new orders.
        </div>
      )}

      {feedback.type === 'error' && (
        <div
          role="alert"
          aria-live="assertive"
          className={[
            'flex items-center gap-2 rounded-xl px-4 py-3',
            'bg-red-950/50 border border-red-500/35',
            'text-[12px] font-semibold text-red-300',
            'animate-[fadeIn_200ms_ease-out]',
          ].join(' ')}
        >
          <span aria-hidden>⚠️</span>
          {feedback.message}
        </div>
      )}

      {/* ── CURRENT SAVED VALUE HINT ───────────────────────── */}
      {feedback.type === 'idle' && (
        <p className="text-[11px] text-zinc-600 text-center">
          Current saved value:{' '}
          <span className="font-bold text-zinc-500">Rs. {lastSaved.toFixed(2)}</span>
        </p>
      )}
    </div>
  );
}
