// filepath: /Users/ahadqazi/Developer/HXD/actions/adminProducts.ts
'use server';

// ============================================================
// HXD — Admin Product Management Server Actions
// actions/adminProducts.ts
// ============================================================

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import type { ProductInsert, ProductCategory, UUID } from '@/types/database';

// ── TYPES ─────────────────────────────────────────────────────

export type AdminActionResult =
  | { success: true;  message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type UploadImageResult =
  | { success: true;  publicUrl: string }
  | { success: false; error: string };

// ── CONSTANTS ─────────────────────────────────────────────────

const PRODUCT_IMAGE_BUCKET  = 'product-images';
const MAX_IMAGE_BYTES        = 4 * 1024 * 1024;           // 4 MB
const ALLOWED_IMAGE_MIME     = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ALLOWED_IMAGE_EXT      = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

// ── HELPERS ───────────────────────────────────────────────────

function sanitize(val: FormDataEntryValue | null): string {
  return typeof val === 'string' ? val.trim() : '';
}

const VALID_CATEGORIES: ProductCategory[] = [
  'snacks', 'noodles', 'cakes', 'flowers', 'beverages', 'other',
];

// ── uploadProductImage ────────────────────────────────────────

/**
 * Upload a product image to the `product-images` Supabase Storage bucket.
 *
 * Security:
 *   - Runs server-side with the service_role key so it can write to
 *     the bucket regardless of Storage RLS policies.
 *   - MIME type + file size validated BEFORE the upload reaches Supabase.
 *
 * Naming:
 *   - Files are stored as `products/<timestamp>-<random>.ext`
 *   - The random suffix prevents enumeration attacks and cache collisions.
 *
 * @returns UploadImageResult — { success: true, publicUrl } | { success: false, error }
 */
export async function uploadProductImage(
  file: File,
): Promise<UploadImageResult> {
  // ── Server-side validation ────────────────────────────────────
  if (!file || file.size === 0) {
    return { success: false, error: 'No file received.' };
  }

  if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
    return {
      success: false,
      error: 'Only JPG, PNG, WebP, or AVIF images are accepted.',
    };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return {
      success: false,
      error: 'Image must be under 4 MB.',
    };
  }

  // Derive a safe extension — fall back to 'jpg' if header is ambiguous
  const rawExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const ext     = ALLOWED_IMAGE_EXT.includes(rawExt) ? rawExt : 'jpg';

  // Collision-resistant file path
  const fileName = `products/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = createServiceClient();

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
      cacheControl: '31536000', // 1 year — images are immutable once uploaded
    });

  if (uploadError) {
    console.error('[uploadProductImage] Storage upload failed:', uploadError);
    return {
      success: false,
      error: 'Image upload failed. Please try again.',
    };
  }

  // Retrieve the CDN-backed public URL (never expires)
  const { data: urlData } = supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(fileName);

  if (!urlData?.publicUrl) {
    return {
      success: false,
      error: 'Image uploaded but public URL could not be retrieved.',
    };
  }

  return { success: true, publicUrl: urlData.publicUrl };
}

// ── addProduct ────────────────────────────────────────────────

export async function addProduct(
  formData: FormData,
): Promise<AdminActionResult> {
  const fieldErrors: Record<string, string> = {};

  // ── Parse text fields ──────────────────────────────────────
  const name               = sanitize(formData.get('name'));
  const description        = sanitize(formData.get('description'));
  const priceRaw           = sanitize(formData.get('price'));
  const category           = sanitize(formData.get('category')) as ProductCategory;
  const availableFrom      = sanitize(formData.get('available_from'));
  const availableUntil     = sanitize(formData.get('available_until'));
  const isFragile          = formData.get('is_fragile')           === 'true';
  const requiresCustomText = formData.get('requires_custom_text') === 'true';

  // image_url is either:
  //   a) already-uploaded URL written by the form (preferred path), or
  //   b) a manual fallback text URL the user typed in
  let imageUrl = sanitize(formData.get('image_url'));

  // ── Handle inline image upload when a File is present ──────
  // The form appends the raw File under the key 'image_file' when
  // the user selected a local file before submitting.
  const imageFile = formData.get('image_file');

  if (imageFile instanceof File && imageFile.size > 0) {
    const uploadResult = await uploadProductImage(imageFile);
    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error };
    }
    imageUrl = uploadResult.publicUrl;
  }

  // ── Validation ─────────────────────────────────────────────
  if (!name || name.length < 2)
    fieldErrors.name = 'Product name must be at least 2 characters.';

  const price = parseFloat(priceRaw);
  if (isNaN(price) || price < 0)
    fieldErrors.price = 'Enter a valid price (0 or more).';
  if (!isNaN(price) && price > 999_999.99)
    fieldErrors.price = 'Price cannot exceed Rs. 999,999.99.';

  if (!VALID_CATEGORIES.includes(category))
    fieldErrors.category = 'Please select a valid category.';

  // Only validate image_url format when it's a manually-typed URL (no file)
  if (imageUrl && !(imageFile instanceof File && imageFile.size > 0)) {
    if (!/^https?:\/\/.+/.test(imageUrl))
      fieldErrors.image_url = 'Image URL must start with http:// or https://';
  }

  if (Object.keys(fieldErrors).length > 0)
    return { success: false, error: 'Please fix the errors below.', fieldErrors };

  // ── Insert ─────────────────────────────────────────────────
  const payload: ProductInsert = {
    name,
    description:          description || null,
    category,
    price:                price.toFixed(2),
    image_url:            imageUrl || null,
    available_from:       availableFrom  || null,
    available_until:      availableUntil || null,
    is_fragile:           isFragile,
    requires_custom_text: requiresCustomText,
    is_available:         true,
  };

  const supabase = createServiceClient();
  // @ts-ignore - Supabase type inference issue with dynamic inserts
  const { error } = await supabase.from('products').insert(payload);

  if (error) {
    console.error('[addProduct] DB insert failed:', error);
    return { success: false, error: 'Database error. Please try again.' };
  }

  revalidatePath('/admin/inventory');
  revalidatePath('/');

  return { success: true, message: `"${name}" added to the inventory.` };
}

// ── deleteProduct ─────────────────────────────────────────────

export async function deleteProduct(
  productId: UUID,
): Promise<AdminActionResult> {
  if (!productId)
    return { success: false, error: 'Product ID is required.' };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('[deleteProduct] DB delete failed:', error);
    if (error.code === '23503')
      return {
        success: false,
        error: 'Cannot delete — this product has existing orders. Disable it instead.',
      };
    return { success: false, error: 'Database error. Please try again.' };
  }

  revalidatePath('/admin/inventory');
  revalidatePath('/');

  return { success: true, message: 'Product deleted.' };
}

// ── toggleProductAvailability ─────────────────────────────────

export async function toggleProductAvailability(
  productId: UUID,
  newValue: boolean,
): Promise<AdminActionResult> {
  if (!productId)
    return { success: false, error: 'Product ID is required.' };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('products')
    // @ts-expect-error - Supabase type inference issue
    .update({ is_available: newValue })
    .eq('id', productId);

  if (error) {
    console.error('[toggleProductAvailability] DB update failed:', error);
    return { success: false, error: 'Failed to update availability.' };
  }

  revalidatePath('/admin/inventory');
  revalidatePath('/');

  return { success: true, message: `Product ${newValue ? 'enabled' : 'disabled'}.` };
}