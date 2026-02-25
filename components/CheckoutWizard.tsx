'use client';

// ============================================================
// HXD — Checkout Wizard Component
// components/CheckoutWizard.tsx
//
// Multi-step checkout with framer-motion slide transitions:
//   Step 1: Address & Contact (Pakistan phone validation)
//   Step 2: Gifting Details (Cake messages)
//   Step 3: Payment Selection (COD or Digital Transfer)
//
// Features animated progress bar at top showing completion %.
// ============================================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, MessageSquare, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';

// ── TYPES ─────────────────────────────────────────────────────

export interface CheckoutData {
  // Step 1: Contact & Address
  customerName: string;
  phoneNumber: string;
  address: string;
  city: string;
  
  // Step 2: Gifting
  giftMessage: string;
  isGift: boolean;
  recipientName: string;
  
  // Step 3: Payment
  paymentMethod: 'cash_on_delivery' | 'bank_transfer';
}

interface CheckoutWizardProps {
  onComplete: (data: CheckoutData) => void;
  onCancel?: () => void;
}

const STEPS = [
  { id: 1, title: 'Address & Contact', icon: MapPin },
  { id: 2, title: 'Gifting Details', icon: MessageSquare },
  { id: 3, title: 'Payment', icon: Wallet },
] as const;

// ── PHONE VALIDATION (Pakistan) ───────────────────────────────

function validatePakistanPhone(phone: string): { valid: boolean; message?: string } {
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');
  
  // Pakistan formats:
  // +92XXXXXXXXXX (13 chars)
  // 03XXXXXXXXX (11 chars)
  // 3XXXXXXXXX (10 chars)
  
  if (cleaned.startsWith('+92')) {
    if (cleaned.length === 13 && /^\+92[0-9]{10}$/.test(cleaned)) {
      return { valid: true };
    }
    return { valid: false, message: 'Format: +92XXXXXXXXXX (13 digits)' };
  }
  
  if (cleaned.startsWith('03')) {
    if (cleaned.length === 11 && /^03[0-9]{9}$/.test(cleaned)) {
      return { valid: true };
    }
    return { valid: false, message: 'Format: 03XXXXXXXXX (11 digits)' };
  }
  
  if (cleaned.startsWith('3')) {
    if (cleaned.length === 10 && /^3[0-9]{9}$/.test(cleaned)) {
      return { valid: true };
    }
    return { valid: false, message: 'Format: 3XXXXXXXXX (10 digits)' };
  }
  
  return { valid: false, message: 'Enter Pakistan phone: +923XX, 03XX, or 3XX' };
}

// ── MAIN COMPONENT ────────────────────────────────────────────

export function CheckoutWizard({ onComplete, onCancel }: CheckoutWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  
  const [formData, setFormData] = useState<CheckoutData>({
    customerName: '',
    phoneNumber: '',
    address: '',
    city: 'Hafizabad',
    giftMessage: '',
    isGift: false,
    recipientName: '',
    paymentMethod: 'cash_on_delivery',
  });
  
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutData, string>>>({});

  // ── PROGRESS CALCULATION ───────────────────────────────────
  const progressPercent = ((currentStep) / STEPS.length) * 100;

  // ── HANDLERS ───────────────────────────────────────────────

  const updateField = <K extends keyof CheckoutData>(field: K, value: CheckoutData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof CheckoutData, string>> = {};

    if (step === 1) {
      if (!formData.customerName.trim()) {
        newErrors.customerName = 'Name is required';
      }
      const phoneCheck = validatePakistanPhone(formData.phoneNumber);
      if (!phoneCheck.valid) {
        newErrors.phoneNumber = phoneCheck.message;
      }
      if (!formData.address.trim()) {
        newErrors.address = 'Address is required';
      }
      if (!formData.city.trim()) {
        newErrors.city = 'City is required';
      }
    }

    if (step === 2) {
      if (formData.isGift && !formData.recipientName.trim()) {
        newErrors.recipientName = 'Recipient name required for gifts';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < STEPS.length) {
      setDirection('forward');
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection('backward');
      setCurrentStep((prev) => prev - 1);
    }
  };

  // ── ANIMATION VARIANTS ─────────────────────────────────────

  const slideVariants = {
    enter: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? -300 : 300,
      opacity: 0,
    }),
  };

  // ── RENDER ─────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl">
      
      {/* ── Progress Bar ──────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
            Step {currentStep} of {STEPS.length}
          </h2>
          <span className="text-xs font-semibold text-violet-400">
            {Math.round(progressPercent)}% Complete
          </span>
        </div>
        
        {/* Progress bar track */}
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 shadow-lg shadow-violet-500/50"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mt-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isComplete = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={[
                  'flex flex-col items-center gap-1.5',
                  idx > 0 ? 'ml-2' : '',
                ].join(' ')}>
                  <div className={[
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                    isActive
                      ? 'border-violet-500 bg-violet-500/20 text-violet-300 shadow-lg shadow-violet-500/30'
                      : isComplete
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-500',
                  ].join(' ')}>
                    <Icon size={18} strokeWidth={2.5} />
                  </div>
                  <span className={[
                    'text-[10px] font-semibold text-center max-w-[80px]',
                    isActive ? 'text-violet-400' : isComplete ? 'text-emerald-400' : 'text-zinc-600',
                  ].join(' ')}>
                    {step.title}
                  </span>
                </div>
                
                {/* Connector line */}
                {idx < STEPS.length - 1 && (
                  <div className={[
                    'h-0.5 w-12 sm:w-20 mx-2 transition-colors duration-300',
                    isComplete ? 'bg-emerald-500/50' : 'bg-zinc-800',
                  ].join(' ')} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Step Content (Animated) ───────────────────────── */}
      <div className="relative min-h-[400px] rounded-2xl border border-zinc-800/60 bg-zinc-900/50 backdrop-blur-sm p-6 sm:p-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="space-y-6"
          >
            {currentStep === 1 && (
              <Step1AddressContact
                formData={formData}
                errors={errors}
                updateField={updateField}
              />
            )}
            
            {currentStep === 2 && (
              <Step2GiftingDetails
                formData={formData}
                errors={errors}
                updateField={updateField}
              />
            )}
            
            {currentStep === 3 && (
              <Step3Payment
                formData={formData}
                updateField={updateField}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Navigation Buttons ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between gap-4 mt-8 pt-6 border-t border-zinc-800"
        >
          <button
            type="button"
            onClick={currentStep === 1 ? onCancel : handleBack}
            className={[
              'flex items-center gap-2 rounded-xl px-5 py-2.5',
              'border border-zinc-700 bg-zinc-800/50',
              'text-sm font-semibold text-zinc-300',
              'hover:bg-zinc-700 hover:text-white',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            <ChevronLeft size={16} />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            type="button"
            onClick={handleNext}
            className={[
              'flex items-center gap-2 rounded-xl px-6 py-2.5',
              'bg-gradient-to-r from-violet-600 to-fuchsia-600',
              'text-sm font-bold text-white',
              'shadow-lg shadow-violet-500/30',
              'hover:shadow-xl hover:shadow-violet-500/40',
              'hover:from-violet-500 hover:to-fuchsia-500',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {currentStep === STEPS.length ? 'Complete Order' : 'Continue'}
            <ChevronRight size={16} />
          </button>
        </motion.div>
      </div>
    </div>
  );
}

// ── STEP 1: ADDRESS & CONTACT ─────────────────────────────────

interface StepProps {
  formData: CheckoutData;
  errors: Partial<Record<keyof CheckoutData, string>>;
  updateField: <K extends keyof CheckoutData>(field: K, value: CheckoutData[K]) => void;
}

function Step1AddressContact({ formData, errors, updateField }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-black text-white mb-2">
          📍 Where should we deliver?
        </h3>
        <p className="text-sm text-zinc-400">
          Enter your contact information and delivery address
        </p>
      </div>

      {/* Customer Name */}
      <div>
        <label htmlFor="customerName" className="block text-sm font-semibold text-zinc-300 mb-2">
          Full Name *
        </label>
        <input
          id="customerName"
          type="text"
          value={formData.customerName}
          onChange={(e) => updateField('customerName', e.target.value)}
          placeholder="Ahad Qazi"
          className={[
            'w-full rounded-xl px-4 py-3',
            'bg-zinc-800/50 border',
            errors.customerName ? 'border-red-500/50' : 'border-zinc-700',
            'text-white placeholder:text-zinc-500',
            'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
            'transition-all duration-200',
          ].join(' ')}
        />
        {errors.customerName && (
          <p className="mt-1.5 text-xs text-red-400">{errors.customerName}</p>
        )}
      </div>

      {/* Phone Number */}
      <div>
        <label htmlFor="phoneNumber" className="block text-sm font-semibold text-zinc-300 mb-2">
          Phone Number * <span className="text-xs text-zinc-500">(Pakistan)</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            id="phoneNumber"
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => updateField('phoneNumber', e.target.value)}
            placeholder="+92 300 1234567"
            className={[
              'w-full rounded-xl pl-11 pr-4 py-3',
              'bg-zinc-800/50 border',
              errors.phoneNumber ? 'border-red-500/50' : 'border-zinc-700',
              'text-white placeholder:text-zinc-500',
              'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
              'transition-all duration-200',
            ].join(' ')}
          />
        </div>
        {errors.phoneNumber && (
          <p className="mt-1.5 text-xs text-red-400">{errors.phoneNumber}</p>
        )}
        <p className="mt-1.5 text-xs text-zinc-500">
          Formats: +923XXXXXXXXX, 03XXXXXXXXX, or 3XXXXXXXXX
        </p>
      </div>

      {/* Address */}
      <div>
        <label htmlFor="address" className="block text-sm font-semibold text-zinc-300 mb-2">
          Delivery Address *
        </label>
        <textarea
          id="address"
          value={formData.address}
          onChange={(e) => updateField('address', e.target.value)}
          placeholder="House #, Street, Area..."
          rows={3}
          className={[
            'w-full rounded-xl px-4 py-3',
            'bg-zinc-800/50 border',
            errors.address ? 'border-red-500/50' : 'border-zinc-700',
            'text-white placeholder:text-zinc-500',
            'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
            'transition-all duration-200',
            'resize-none',
          ].join(' ')}
        />
        {errors.address && (
          <p className="mt-1.5 text-xs text-red-400">{errors.address}</p>
        )}
      </div>

      {/* City */}
      <div>
        <label htmlFor="city" className="block text-sm font-semibold text-zinc-300 mb-2">
          City *
        </label>
        <select
          id="city"
          value={formData.city}
          onChange={(e) => updateField('city', e.target.value)}
          className={[
            'w-full rounded-xl px-4 py-3',
            'bg-zinc-800/50 border',
            errors.city ? 'border-red-500/50' : 'border-zinc-700',
            'text-white',
            'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
            'transition-all duration-200',
            'cursor-pointer',
          ].join(' ')}
        >
          <option value="Hafizabad">Hafizabad</option>
          <option value="Pindi Bhattian">Pindi Bhattian</option>
          <option value="Sukheke">Sukheke</option>
          <option value="Other">Other</option>
        </select>
        {errors.city && (
          <p className="mt-1.5 text-xs text-red-400">{errors.city}</p>
        )}
      </div>
    </div>
  );
}

// ── STEP 2: GIFTING DETAILS ───────────────────────────────────

function Step2GiftingDetails({ formData, errors, updateField }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-black text-white mb-2">
          🎁 Make it special
        </h3>
        <p className="text-sm text-zinc-400">
          Add a personal message or gift details
        </p>
      </div>

      {/* Is Gift Toggle */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50">
        <input
          type="checkbox"
          id="isGift"
          checked={formData.isGift}
          onChange={(e) => updateField('isGift', e.target.checked)}
          className="h-5 w-5 rounded border-zinc-600 bg-zinc-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-0 cursor-pointer"
        />
        <label htmlFor="isGift" className="text-sm font-semibold text-zinc-300 cursor-pointer">
          This order is a gift for someone else
        </label>
      </div>

      {/* Recipient Name (if gift) */}
      {formData.isGift && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <label htmlFor="recipientName" className="block text-sm font-semibold text-zinc-300 mb-2">
            Recipient Name *
          </label>
          <input
            id="recipientName"
            type="text"
            value={formData.recipientName}
            onChange={(e) => updateField('recipientName', e.target.value)}
            placeholder="Who is receiving this gift?"
            className={[
              'w-full rounded-xl px-4 py-3',
              'bg-zinc-800/50 border',
              errors.recipientName ? 'border-red-500/50' : 'border-zinc-700',
              'text-white placeholder:text-zinc-500',
              'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
              'transition-all duration-200',
            ].join(' ')}
          />
          {errors.recipientName && (
            <p className="mt-1.5 text-xs text-red-400">{errors.recipientName}</p>
          )}
        </motion.div>
      )}

      {/* Gift Message */}
      <div>
        <label htmlFor="giftMessage" className="block text-sm font-semibold text-zinc-300 mb-2">
          Message on Cake / Card
          <span className="ml-2 text-xs font-normal text-zinc-500">(Optional)</span>
        </label>
        <textarea
          id="giftMessage"
          value={formData.giftMessage}
          onChange={(e) => updateField('giftMessage', e.target.value)}
          placeholder="Happy Birthday! Wishing you all the best... 🎂"
          rows={4}
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
            We'll write this on your cake or include it in a card
          </p>
          <span className="text-xs text-zinc-600">
            {formData.giftMessage.length}/200
          </span>
        </div>
      </div>

      {/* Suggestions */}
      <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
        <p className="text-xs font-semibold text-violet-400 mb-2">💡 Message Ideas</p>
        <div className="flex flex-wrap gap-2">
          {[
            'Happy Birthday! 🎂',
            'Congratulations! 🎉',
            'Get well soon! 💐',
            'Thinking of you ❤️',
            'You\'re the best! ✨',
          ].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => updateField('giftMessage', suggestion)}
              className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── STEP 3: PAYMENT ───────────────────────────────────────────

function Step3Payment({ formData, updateField }: Omit<StepProps, 'errors'>) {
  const paymentOptions = [
    {
      value: 'cash_on_delivery' as const,
      label: 'Cash on Delivery',
      description: 'Pay when your order arrives',
      icon: '💵',
      recommended: true,
    },
    {
      value: 'bank_transfer' as const,
      label: 'Bank Transfer',
      description: 'Pay via JazzCash, EasyPaisa, or bank',
      icon: '🏦',
      recommended: false,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-black text-white mb-2">
          💳 How would you like to pay?
        </h3>
        <p className="text-sm text-zinc-400">
          Choose your preferred payment method
        </p>
      </div>

      <div className="space-y-3">
        {paymentOptions.map((option) => {
          const isSelected = formData.paymentMethod === option.value;
          
          return (
            <motion.button
              key={option.value}
              type="button"
              onClick={() => updateField('paymentMethod', option.value)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={[
                'w-full rounded-xl p-4 text-left',
                'border-2 transition-all duration-200',
                'flex items-start gap-4',
                isSelected
                  ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/20'
                  : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/50',
              ].join(' ')}
            >
              {/* Icon */}
              <div className={[
                'flex h-12 w-12 items-center justify-center rounded-xl text-2xl',
                isSelected ? 'bg-violet-500/20' : 'bg-zinc-700/30',
              ].join(' ')}>
                {option.icon}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className={[
                    'text-sm font-bold',
                    isSelected ? 'text-white' : 'text-zinc-300',
                  ].join(' ')}>
                    {option.label}
                  </h4>
                  {option.recommended && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase">
                      Recommended
                    </span>
                  )}
                </div>
                <p className={[
                  'text-xs mt-1',
                  isSelected ? 'text-zinc-400' : 'text-zinc-500',
                ].join(' ')}>
                  {option.description}
                </p>
              </div>

              {/* Radio indicator */}
              <div className={[
                'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                isSelected ? 'border-violet-500' : 'border-zinc-600',
              ].join(' ')}>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-2.5 w-2.5 rounded-full bg-violet-500"
                  />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Payment Info */}
      {formData.paymentMethod === 'bank_transfer' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4"
        >
          <p className="text-xs font-semibold text-blue-400 mb-2">📱 Transfer Details</p>
          <div className="space-y-1 text-xs text-zinc-400">
            <p><span className="font-semibold text-zinc-300">JazzCash:</span> 0300-1234567</p>
            <p><span className="font-semibold text-zinc-300">EasyPaisa:</span> 0300-1234567</p>
            <p><span className="font-semibold text-zinc-300">Bank:</span> HBL - 12345678901234</p>
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            💡 Send payment and share screenshot via WhatsApp for confirmation
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default CheckoutWizard;
