'use client';

// ============================================================
// HXD — Admin Settings Page
// app/admin/dashboard/settings/page.tsx
//
// Manage shop configuration:
//   - Shop Status (Open/Closed toggle)
//   - Banner Message (Announcement input)
// ============================================================

import React, { useState, useEffect } from 'react';
import { getShopSettings, updateShopStatus, updateBannerMessage, type ShopSettings } from '@/actions/shopSettings';
import { Store, MessageSquare, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [bannerMessage, setBannerMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Load settings on mount ────────────────────────────────

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      const data = await getShopSettings();
      if (data) {
        setSettings(data);
        setIsOpen(data.is_open);
        setBannerMessage(data.banner_message || '');
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  // ── Show notification temporarily ─────────────────────────

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Toggle shop status ────────────────────────────────────

  const handleToggleShopStatus = async (newStatus: boolean) => {
    setSaving(true);
    const result = await updateShopStatus(newStatus);
    setSaving(false);

    if (result.success) {
      setIsOpen(newStatus);
      showNotification('success', `Shop is now ${newStatus ? 'OPEN' : 'CLOSED'}`);
    } else {
      showNotification('error', result.error || 'Failed to update shop status');
    }
  };

  // ── Save banner message ───────────────────────────────────

  const handleSaveBanner = async () => {
    setSaving(true);
    const result = await updateBannerMessage(bannerMessage);
    setSaving(false);

    if (result.success) {
      showNotification('success', 'Banner message updated successfully');
    } else {
      showNotification('error', result.error || 'Failed to update banner message');
    }
  };

  // ── Loading state ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-zinc-700 border-t-violet-500 animate-spin" />
          <p className="text-sm text-zinc-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────

  return (
    <div className="max-w-4xl">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">
          ⚙️ Shop Settings
        </h1>
        <p className="text-zinc-400 text-sm">
          Manage your shop status and customer-facing announcements
        </p>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={[
            'mb-6 rounded-xl px-4 py-3 flex items-center gap-3',
            'border',
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400',
          ].join(' ')}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span className="text-sm font-semibold">{notification.message}</span>
        </div>
      )}

      <div className="space-y-6">
        
        {/* ── SHOP STATUS ────────────────────────────────── */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={[
                'flex h-12 w-12 items-center justify-center rounded-xl',
                isOpen ? 'bg-emerald-500/20' : 'bg-zinc-700/30',
              ].join(' ')}>
                <Store size={24} className={isOpen ? 'text-emerald-400' : 'text-zinc-500'} />
              </div>
              
              <div>
                <h2 className="text-lg font-bold text-white mb-1">
                  Shop Status
                </h2>
                <p className="text-sm text-zinc-400 mb-3">
                  Control whether customers can place new orders
                </p>
                
                {/* Status indicator */}
                <div className={[
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold',
                  isOpen
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-zinc-700/50 text-zinc-400',
                ].join(' ')}>
                  <div className={[
                    'h-2 w-2 rounded-full',
                    isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500',
                  ].join(' ')} />
                  {isOpen ? 'SHOP IS OPEN' : 'SHOP IS CLOSED'}
                </div>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={() => handleToggleShopStatus(!isOpen)}
              disabled={saving}
              className={[
                'relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-900',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isOpen ? 'bg-emerald-500' : 'bg-zinc-700',
              ].join(' ')}
              aria-label="Toggle shop status"
            >
              <span
                className={[
                  'inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200',
                  isOpen ? 'translate-x-7' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </div>

          {/* Info message */}
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">
              💡 {isOpen 
                ? 'When open, customers can browse products and place orders normally.'
                : 'When closed, customers will see a notice that the shop is temporarily unavailable.'}
            </p>
          </div>
        </div>

        {/* ── BANNER MESSAGE ─────────────────────────────── */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20">
              <MessageSquare size={24} className="text-violet-400" />
            </div>
            
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white mb-1">
                Banner Message
              </h2>
              <p className="text-sm text-zinc-400">
                Display a custom announcement at the top of your storefront
              </p>
            </div>
          </div>

          {/* Banner input */}
          <div className="space-y-3">
            <div>
              <label htmlFor="bannerMessage" className="block text-sm font-semibold text-zinc-300 mb-2">
                Message Text
                <span className="ml-2 text-xs font-normal text-zinc-500">(Leave empty to hide banner)</span>
              </label>
              <textarea
                id="bannerMessage"
                value={bannerMessage}
                onChange={(e) => setBannerMessage(e.target.value)}
                placeholder="e.g., 🌧️ Rainy day special - Free delivery on all orders!"
                rows={3}
                maxLength={200}
                className={[
                  'w-full rounded-xl px-4 py-3',
                  'bg-zinc-800/50 border border-zinc-700',
                  'text-white placeholder:text-zinc-500',
                  'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
                  'transition-all duration-200',
                  'resize-none',
                ].join(' ')}
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-zinc-500">
                  This will appear as a prominent banner on the homepage
                </p>
                <span className="text-xs text-zinc-600">
                  {bannerMessage.length}/200
                </span>
              </div>
            </div>

            {/* Preview */}
            {bannerMessage.trim() && (
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-4">
                <p className="text-xs font-semibold text-zinc-500 mb-2">PREVIEW</p>
                <div className="rounded-lg bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-pink-500/20 border border-violet-500/30 px-4 py-3">
                  <p className="text-sm text-white">{bannerMessage}</p>
                </div>
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSaveBanner}
              disabled={saving}
              className={[
                'w-full flex items-center justify-center gap-2',
                'rounded-xl px-4 py-3 text-sm font-bold',
                'bg-gradient-to-r from-violet-600 to-fuchsia-600',
                'text-white shadow-lg shadow-violet-500/30',
                'hover:shadow-xl hover:shadow-violet-500/40',
                'hover:from-violet-500 hover:to-fuchsia-500',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200',
              ].join(' ')}
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Banner Message
                </>
              )}
            </button>
          </div>

          {/* Quick suggestions */}
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 mb-2">💡 QUICK IDEAS</p>
            <div className="flex flex-wrap gap-2">
              {[
                '🌧️ Free delivery today!',
                '🎉 20% off all cakes this week',
                '⚡ Express delivery available',
                '🎂 Pre-order for weekend parties',
                '💐 Fresh flowers daily!',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setBannerMessage(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Info footer */}
        <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-400/80 space-y-1">
              <p className="font-semibold text-blue-400">Settings are applied immediately</p>
              <p>Changes to shop status and banner messages take effect instantly for all customers.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
