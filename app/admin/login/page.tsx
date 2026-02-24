'use client';

// ============================================================
// HXD — Admin Login Page
// app/admin/login/page.tsx
//
// Simple password-based authentication for admin access.
// ============================================================

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginAdmin } from '@/actions/adminAuth';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await loginAdmin(password);

      if (result.success) {
        router.push('/admin/dashboard/orders');
        router.refresh();
      } else {
        setError(result.error);
        setPassword('');
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      {/* Background gradient */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-1/2 -right-1/4 h-[800px] w-[800px] rounded-full bg-gradient-to-br from-[#FF6B6B]/10 via-[#FFE66D]/5 to-transparent blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 h-[800px] w-[800px] rounded-full bg-gradient-to-tr from-violet-500/10 via-cyan-500/5 to-transparent blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] mb-4 shadow-[0_8px_32px_rgba(255,107,107,0.4)]">
            <span className="text-2xl font-black text-white">HXD</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Admin Dashboard</h1>
          <p className="text-sm text-zinc-500">Enter password to continue</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                className={[
                  'w-full rounded-xl border px-4 py-3 text-sm',
                  'bg-zinc-800/70 text-white placeholder-zinc-600',
                  'outline-none ring-0 transition-all duration-200',
                  'focus:border-[#FF6B6B]/70 focus:ring-2 focus:ring-[#FF6B6B]/20',
                  error ? 'border-rose-500/50 bg-rose-950/20' : 'border-zinc-700/60',
                  isPending && 'opacity-60 cursor-not-allowed',
                ].join(' ')}
                placeholder="Enter admin password"
                autoComplete="current-password"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
                  <span aria-hidden>⚠️</span>
                  {error}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending || !password}
              className={[
                'w-full rounded-xl py-3 text-sm font-black tracking-wide',
                'transition-all duration-200',
                isPending || !password
                  ? 'cursor-not-allowed bg-zinc-700 text-zinc-500'
                  : [
                      'bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white',
                      'shadow-[0_4px_24px_rgba(255,107,107,0.35)]',
                      'hover:from-[#ff5555] hover:to-[#ff7a3a]',
                      'hover:shadow-[0_6px_32px_rgba(255,107,107,0.5)]',
                      'active:scale-98',
                    ].join(' '),
              ].join(' ')}
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {/* Footer Note */}
          <p className="mt-6 text-center text-xs text-zinc-600">
            For security, ensure you're on the correct domain
          </p>
        </div>

        {/* Back to Home Link */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
