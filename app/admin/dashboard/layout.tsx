// ============================================================
// HXD — Admin Dashboard Layout
// app/admin/dashboard/layout.tsx
//
// Layout wrapper for all admin dashboard pages.
// Includes sidebar navigation and main content area.
// ============================================================

import React from 'react';
import { DashboardSidebar } from '@/components/admin/DashboardSidebar';

export const metadata = {
  title: 'Admin Dashboard | HXD Chijji',
  robots: 'noindex, nofollow', // Don't index admin pages
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <DashboardSidebar />
      
      <main className="ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
