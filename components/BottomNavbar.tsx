'use client';

// ============================================================
// HXD — Bottom Navigation Bar (Mobile)
// components/BottomNavbar.tsx
//
// Fixed bottom navigation for mobile with 4 primary actions:
//   - Home (browse products)
//   - Explore (categories/search)
//   - My Orders (order history)
//   - Cart (checkout)
//
// Uses Lucide React icons and backdrop blur for glass effect.
// ============================================================

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Receipt, ShoppingCart } from 'lucide-react';
import { useCartStore, selectTotalItemCount } from '@/store/useCartStore';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/',                    label: 'Home',      icon: Home },
  { href: '/explore',             label: 'Explore',   icon: Compass },
  { href: '/order-history',       label: 'Orders',    icon: Receipt },
  { href: '/checkout',            label: 'Cart',      icon: ShoppingCart },
];

export function BottomNavbar() {
  const pathname = usePathname();
  const cartCount = useCartStore(selectTotalItemCount);

  // Hide navbar on admin pages
  if (pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/60 bg-black/50 backdrop-blur-lg sm:hidden"
    >
      <div className="mx-auto max-w-lg">
        <div className="grid grid-cols-4 h-16">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const showBadge = item.href === '/checkout' && cartCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'relative flex flex-col items-center justify-center gap-1',
                  'transition-colors duration-200',
                  isActive
                    ? 'text-violet-400'
                    : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Icon container */}
                <div className="relative">
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  
                  {/* Cart badge */}
                  {showBadge && (
                    <span
                      aria-label={`${cartCount} items in cart`}
                      className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[9px] font-black text-white shadow-lg"
                    >
                      {cartCount > 9 ? '9' : cartCount}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span className={[
                  'text-[10px] font-semibold tracking-wide',
                  isActive ? 'text-violet-400' : 'text-zinc-600',
                ].join(' ')}>
                  {item.label}
                </span>

                {/* Active indicator */}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Safe area padding for iOS notch */}
      <div className="h-safe-area-inset-bottom bg-black/50" />
    </nav>
  );
}

export default BottomNavbar;