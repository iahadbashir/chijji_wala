// filepath: /Users/ahadqazi/Developer/HXD/components/admin/AddProductForm.tsx
'use client';

// ============================================================
// HXD — Add Product Form
// components/admin/AddProductForm.tsx
//
// Upgrades over v1:
//   - Image URL text field → FileTrigger (React Aria) with
//     instant local preview before upload
//   - uploadProductImage() called first on submit; resulting
//     publicUrl written into image_url hidden field
//   - Three-phase submit button:
//       idle          → "Add Product"
//       uploading     → "Uploading image…"  (spinner + Upload icon)
//       saving        → "Saving…"           (spinner)
//   - lucide-react Upload icon in the dropzone
// ============================================================

import React, {
  useState,
  useTransition,
  useRef,
  useCallback,
} from 'react';
import {
  TextField,
  Label,
  Input,
  TextArea,
  FieldError,
  Select,
  SelectValue,
  Popover,
  ListBox,
  ListBoxItem,
  Button,
  Switch,
  NumberField,
  Group,
  Text,
  FileTrigger,
} from 'react-aria-components';
import { Upload, ImagePlus, X, Loader2 } from 'lucide-react';

import { addProduct, uploadProductImage } from '@/actions/adminProducts';
import type { ProductCategory } from '@/types/database';

// ── CONSTANTS ─────────────────────────────────────────────────

const CATEGORIES: { value: ProductCategory; label: string; emoji: string }[] = [
  { value: 'cakes',      label: 'Cakes',      emoji: '🎂' },
  { value: 'flowers',    label: 'Flowers',    emoji: '💐' },
  { value: 'snacks',     label: 'Snacks',     emoji: '🍭' },
  { value: 'noodles',    label: 'Noodles',    emoji: '🍜' },
  { value: 'beverages',  label: 'Beverages',  emoji: '🧋' },
  { value: 'other',      label: 'Other',      emoji: '🎁' },
];

const MAX_IMAGE_MB   = 4;
const ACCEPTED_MIME  = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ACCEPTED_EXTS  = '.jpg,.jpeg,.png,.webp,.avif';

// ── STYLE TOKENS ──────────────────────────────────────────────

const inputBase = [
  'w-full rounded-xl border border-zinc-700/60 bg-zinc-800/70',
  'px-3.5 py-2.5 text-[13px] text-white placeholder-zinc-600',
  'outline-none ring-0 transition-all duration-150',
  'focus:border-[#FF6B6B]/70 focus:ring-2 focus:ring-[#FF6B6B]/20',
  'data-[invalid]:border-rose-500/70',
].join(' ');

const labelBase = 'block text-[11px] font-bold uppercase tracking-[0.13em] text-zinc-400 mb-1.5';
const errorBase = 'mt-1.5 text-[11px] text-rose-400';

// ── SUBMIT PHASE ──────────────────────────────────────────────

type SubmitPhase = 'idle' | 'uploading' | 'saving';

// ── COMPONENT ─────────────────────────────────────────────────

export function AddProductForm() {
  const formRef                   = useRef<HTMLFormElement>(null);
  const [isPending, startTrans]   = useTransition();
  const [phase, setPhase]         = useState<SubmitPhase>('idle');
  const [banner, setBanner]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [fieldErrors, setFErrors] = useState<Record<string, string>>({});

  // ── Controlled fields ──────────────────────────────────────
  const [isFragile,          setIsFragile]          = useState(false);
  const [requiresCustomText, setRequiresCustomText] = useState(false);
  const [category,           setCategory]           = useState<ProductCategory>('snacks');
  const [price,              setPrice]              = useState<number>(0);

  // ── Image state ────────────────────────────────────────────
  const [imageFile,      setImageFile]      = useState<File | null>(null);
  const [imagePreview,   setImagePreview]   = useState<string | null>(null);
  const [imageError,     setImageError]     = useState<string | null>(null);
  // Holds the Supabase public URL after a successful upload
  const [uploadedUrl,    setUploadedUrl]    = useState<string | null>(null);

  // ── Image selection handler ────────────────────────────────

  const handleFileSelect = useCallback((files: FileList | null) => {
    const file = files?.[0] ?? null;
    setImageError(null);
    setUploadedUrl(null);

    if (!file) return;

    if (!ACCEPTED_MIME.includes(file.type)) {
      setImageError('Only JPG, PNG, WebP, or AVIF images are accepted.');
      return;
    }

    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setImageError(`Image must be under ${MAX_IMAGE_MB} MB.`);
      return;
    }

    setImageFile(file);

    // Build a local object URL for the instant preview (revoked on next selection)
    const objectUrl = URL.createObjectURL(file);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
  }, []);

  // ── Clear image ────────────────────────────────────────────

  const clearImage = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
    setUploadedUrl(null);
  }, [imagePreview]);

  // ── Full submit handler ────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFErrors({});
    setBanner(null);

    let resolvedImageUrl: string | null = uploadedUrl;

    // ── Phase 1: Upload image if one is staged ───────────────
    if (imageFile && !uploadedUrl) {
      setPhase('uploading');

      const uploadResult = await uploadProductImage(imageFile);

      if (!uploadResult.success) {
        setImageError(uploadResult.error);
        setPhase('idle');
        return;
      }

      resolvedImageUrl = uploadResult.publicUrl;
      setUploadedUrl(uploadResult.publicUrl); // cache so resubmit skips upload
    }

    // ── Phase 2: Save product to DB ──────────────────────────
    setPhase('saving');

    const fd = new FormData(formRef.current!);

    // Inject controlled values that React Aria doesn't bind to native inputs
    fd.set('is_fragile',           String(isFragile));
    fd.set('requires_custom_text', String(requiresCustomText));
    fd.set('category',             category);
    fd.set('price',                String(price));
    fd.set('image_url',            resolvedImageUrl ?? '');

    // Remove raw file from FormData — URL is already resolved above
    fd.delete('image_file');

    startTrans(async () => {
      const result = await addProduct(fd);

      if (result.success) {
        setBanner({ type: 'success', msg: result.message });

        // Reset all state
        formRef.current?.reset();
        setIsFragile(false);
        setRequiresCustomText(false);
        setCategory('snacks');
        setPrice(0);
        clearImage();
        setPhase('idle');

        setTimeout(() => setBanner(null), 4500);
      } else {
        setBanner({ type: 'error', msg: result.error });
        if ('fieldErrors' in result && result.fieldErrors)
          setFErrors(result.fieldErrors);
        setPhase('idle');
      }
    });
  }

  // ── Button label helper ────────────────────────────────────

  const isSubmitting = isPending || phase !== 'idle';

  function buttonContent() {
    if (phase === 'uploading') {
      return (
        <span className="flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Uploading image…
        </span>
      );
    }
    if (phase === 'saving' || isPending) {
      return (
        <span className="flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Saving…
        </span>
      );
    }
    return (
      <span className="flex items-center justify-center gap-2">
        <Upload size={14} aria-hidden />
        Add Product
      </span>
    );
  }

  // ── RENDER ────────────────────────────────────────────────


  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6B6B]/15 text-lg">
          ➕
        </div>
        <div>
          <h2 className="text-[15px] font-black text-white">Add New Product</h2>
          <p className="text-[11px] text-zinc-500">It goes live instantly after saving.</p>
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div
          role="status"
          aria-live="polite"
          className={[
            'mb-5 rounded-xl px-4 py-3 text-[12px] font-medium border',
            banner.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10  text-rose-400  border-rose-500/30',
          ].join(' ')}
        >
          {banner.type === 'success' ? '✅ ' : '⚠️ '}{banner.msg}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">

        {/* ── Name + Category ────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <TextField name="name" isRequired isInvalid={!!fieldErrors.name} className="flex flex-col">
            <Label className={labelBase}>Product Name *</Label>
            <Input className={inputBase} placeholder="e.g. Molten Lava Cake" />
            <FieldError className={errorBase}>{fieldErrors.name ?? 'Required'}</FieldError>
          </TextField>

          <div className="flex flex-col">
            <label className={labelBase}>Category *</label>
            <Select
              selectedKey={category}
              onSelectionChange={(k) => setCategory(k as ProductCategory)}
            >
              <Button className={[inputBase, 'flex items-center justify-between cursor-pointer'].join(' ')}>
                <SelectValue className="text-[13px]">
                  {() => {
                    const cat = CATEGORIES.find((c) => c.value === category);
                    return cat ? `${cat.emoji} ${cat.label}` : 'Select…';
                  }}
                </SelectValue>
                <span className="text-zinc-500 text-xs" aria-hidden>▾</span>
              </Button>
              <Popover className="z-50 w-full min-w-[180px] rounded-xl border border-zinc-700 bg-zinc-800 shadow-2xl py-1 mt-1 outline-none">
                <ListBox className="outline-none">
                  {CATEGORIES.map((cat) => (
                    <ListBoxItem
                      key={cat.value}
                      id={cat.value}
                      className={({ isFocused, isSelected }) => [
                        'flex cursor-pointer items-center gap-2 px-3.5 py-2 text-[13px] outline-none transition-colors',
                        isFocused  ? 'bg-zinc-700 text-white'   : 'text-zinc-300',
                        isSelected ? 'text-[#FF6B6B] font-bold' : '',
                      ].join(' ')}
                    >
                      <span aria-hidden>{cat.emoji}</span>
                      {cat.label}
                    </ListBoxItem>
                  ))}
                </ListBox>
              </Popover>
            </Select>
            {fieldErrors.category && <p className={errorBase}>{fieldErrors.category}</p>}
          </div>
        </div>

        {/* ── Description ────────────────────────────────────── */}
        <TextField name="description" className="flex flex-col">
          <Label className={labelBase}>Description</Label>
          <TextArea
            className={[inputBase, 'resize-none h-20 leading-relaxed'].join(' ')}
            placeholder="A short description customers will see…"
          />
        </TextField>

        {/* ── Price ──────────────────────────────────────────── */}
        <div className="flex flex-col">
          <label className={labelBase}>Price (PKR) *</label>
          <NumberField
            value={price}
            onChange={setPrice}
            minValue={0}
            maxValue={999999}
            isInvalid={!!fieldErrors.price}
            className="flex flex-col"
          >
            <Group className="relative flex">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-zinc-500 pointer-events-none select-none">
                Rs.
              </span>
              <Input className={[inputBase, 'pl-10'].join(' ')} placeholder="349" />
            </Group>
            <FieldError className={errorBase}>{fieldErrors.price}</FieldError>
          </NumberField>
        </div>

        {/* ── Row: Time window ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <TextField name="available_from" className="flex flex-col">
            <Label className={labelBase}>Available From</Label>
            <Input className={inputBase} type="time" />
            <Text slot="description" className="mt-1 text-[10px] text-zinc-600">
              Leave blank = all day
            </Text>
          </TextField>

          <TextField name="available_until" className="flex flex-col">
            <Label className={labelBase}>Available Until</Label>
            <Input className={inputBase} type="time" />
          </TextField>
        </div>

        {/* ── Toggles ───────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 divide-y divide-zinc-800">

          {/* Fragile Item */}
          <Switch
            isSelected={isFragile}
            onChange={setIsFragile}
            className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 group outline-none"
          >
            <div>
              <p className="text-[13px] font-semibold text-white group-data-[selected]:text-[#FF6B6B]">
                📦 Fragile Item
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Adds Rs.100 fragile surcharge + special packaging.
              </p>
            </div>
            <div className={[
              'relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5',
              'transition-colors duration-200',
              isFragile ? 'bg-[#FF6B6B]' : 'bg-zinc-700',
            ].join(' ')}>
              <div className={[
                'h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
                isFragile ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')} />
            </div>
          </Switch>

          {/* Requires Custom Text */}
          <Switch
            isSelected={requiresCustomText}
            onChange={setRequiresCustomText}
            className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 group outline-none"
          >
            <div>
              <p className="text-[13px] font-semibold text-white group-data-[selected]:text-[#FFE66D]">
                ✏️ Requires Personal Message
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Shows a text input at checkout (cake name, card note, etc.).
              </p>
            </div>
            <div className={[
              'relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5',
              'transition-colors duration-200',
              requiresCustomText ? 'bg-[#FFE66D]' : 'bg-zinc-700',
            ].join(' ')}>
              <div className={[
                'h-5 w-5 rounded-full shadow transition-transform duration-200',
                requiresCustomText ? 'translate-x-5 bg-zinc-900' : 'translate-x-0 bg-white',
              ].join(' ')} />
            </div>
          </Switch>
        </div>

        {/* ── Submit ───────────────────────────────────────── */}
        <Button
          type="submit"
          isDisabled={isPending}
          className={[
            'w-full rounded-xl py-3 text-[13px] font-black tracking-wide',
            'transition-all duration-200 active:scale-[0.98]',
            isPending
              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              : [
                  'bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53]',
                  'text-white shadow-[0_4px_24px_rgba(255,107,107,0.35)]',
                  'hover:shadow-[0_4px_32px_rgba(255,107,107,0.55)]',
                  'hover:from-[#ff5555] hover:to-[#ff7a3a]',
                ].join(' '),
          ].join(' ')}
        >
          {isPending ? '⏳ Saving…' : '✅ Add Product'}
        </Button>

      </form>
    </div>
  );
}

export default AddProductForm;