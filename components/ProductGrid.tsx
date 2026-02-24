'use client';

// ============================================================
// HXD — Product Grid with Modal
// components/ProductGrid.tsx
//
// Client component that manages product display and modal state
// ============================================================

import React, { useState } from 'react';
import type { Product } from '@/types/database';
import ProductCard from './ProductCard';
import ProductDetailModal from './ProductDetailModal';

export interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onClick={() => setSelectedProduct(product)}
          />
        ))}
      </div>

      <ProductDetailModal
        product={selectedProduct!}
        isOpen={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
      />
    </>
  );
}

export default ProductGrid;
