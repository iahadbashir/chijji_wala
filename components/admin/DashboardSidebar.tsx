'use client';

// ============================================================
// HXD — Admin Dashboard Sidebar
// components/admin/DashboardSidebar.tsx
//
// Navigation sidebar for admin dashboard with logout button.
// ============================================================

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAdmin } from '@/actions/adminAuth';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/dashboard/orders', label: 'Orders', icon: '📦' },
  { href: '/admin/dashboard/inventory', label: 'Inventory', icon: '🏪' },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logoutAdmin();
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-zinc-800 bg-zinc-900 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] shadow-lg">
            <span className="text-lg font-black text-white">HXD</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-white">Chijji Admin</h1>
            <p className="text-xs text-zinc-500">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 rounded-xl px-4 py-3',
                'text-sm font-semibold transition-all duration-200',
                isActive
                  ? 'bg-[#FF6B6B]/15 text-[#FF6B6B] shadow-sm'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white',
              ].join(' ')}
            >
              <span className="text-lg" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer - Logout Button */}
      <div className="p-4 border-t border-zinc-800">
        <button
          onClick={handleLogout}
          className={[
            'w-full flex items-center justify-center gap-2',
            'rounded-xl px-4 py-3 text-sm font-semibold',
            'bg-zinc-800 text-zinc-400',
            'hover:bg-rose-950/30 hover:text-rose-400 hover:border-rose-500/30',
            'border border-zinc-700 transition-all duration-200',
          ].join(' ')}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default DashboardSidebar;
