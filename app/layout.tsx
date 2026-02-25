// ============================================================
// HXD — Root Layout
// app/layout.tsx
//
// Includes:
//   - StickyHeader (top, fixed)
//   - BottomNavbar (bottom, fixed, mobile only)
//   - Vercel Analytics
//   - Safe padding to prevent content from hiding under bars
// ============================================================

import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { StickyHeader } from '@/components/StickyHeader';
import { BottomNavbar } from '@/components/BottomNavbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chijji — Snacks, Cakes & Flowers Delivered',
  description:
    'Stay in your pajamas. Your favorite snacks and gifts delivered in Hafizabad.',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-white">
        
        {/* Fixed top navigation */}
        <StickyHeader />

        {/* Main content with safe padding */}
        <main className="min-h-screen pt-16 pb-16 sm:pb-0">
          {children}
        </main>

        {/* Fixed bottom navigation (mobile only) */}
        <BottomNavbar />

        {/* Analytics */}
        <Analytics />
      </body>
    </html>
  );
}
