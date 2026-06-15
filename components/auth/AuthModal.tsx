/**
 * ============================================
 * AeroNyx Auth Modal Component
 * ============================================
 * File Path: components/auth/AuthModal.tsx
 *
 * Creation Reason: Dashboard no longer redirects to a landing page for login.
 *   Instead, this modal overlays the dashboard and presents the WalletConnect
 *   component. It cannot be dismissed — the user must authenticate to proceed.
 * Main Functionality:
 *   - Full-screen modal overlay with WalletConnect
 *   - Non-dismissable (no close button, no backdrop click to close)
 *   - Automatically closes when authentication succeeds (via store subscription)
 * Dependencies:
 *   - components/auth/WalletConnect.tsx (wallet connection UI)
 *   - components/common/Logo.tsx (branding)
 *   - stores/authStore.ts (auth state)
 *
 * Main Logical Flow:
 * 1. Dashboard layout detects unauthenticated user
 * 2. Renders AuthModal on top of skeleton/dashboard
 * 3. User connects wallet via WalletConnect inside the modal
 * 4. On successful auth, isAuthenticated flips → layout hides modal
 *
 * ⚠️ Important Note for Next Developer:
 * - This modal is controlled by the parent (dashboard layout) via isAuthenticated
 * - Do NOT add a close/dismiss button — auth is required to use the dashboard
 * - WalletConnect's success state + redirect logic is handled by the parent
 * - Maintain interface compatibility with app/dashboard/layout.tsx
 *
 * Last Modified: v1.0.0 - Initial auth modal implementation
 * ============================================
 */

'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Logo from '@/components/common/Logo';
import WalletConnect from '@/components/auth/WalletConnect';
import { useI18n } from '@/lib/i18n/I18nProvider';

// ============================================
// Props Interface
// ============================================

interface AuthModalProps {
  /** Whether the modal is visible. Controlled by parent based on auth state. */
  isOpen: boolean;
}

// ============================================
// Auth Modal Component
// ============================================

export default function AuthModal({ isOpen }: AuthModalProps) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="auth-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="
            fixed inset-0 z-50
            flex items-center justify-center
            bg-[#0A0A0F]/80 backdrop-blur-xl
          "
        >
          {/* Background Decorative Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-30" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl opacity-20" />
            <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl opacity-20" />
          </div>

          {/* Modal Content */}
          <motion.div
            key="auth-modal-content"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="
              relative z-10 w-full max-w-md mx-4
              p-8 rounded-3xl
              bg-gradient-to-br from-white/[0.08] to-white/[0.02]
              border border-white/10
              backdrop-blur-xl
              shadow-2xl
            "
          >
            {/* Logo / Branding */}
            <div className="flex justify-center mb-6">
              <Logo className="w-10 h-10" showText />
            </div>

            {/* WalletConnect Component */}
            <WalletConnect />

            {/* Footer Note */}
            <p className="mt-6 text-center text-xs text-gray-500">
              {t('auth.modal.footer')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
