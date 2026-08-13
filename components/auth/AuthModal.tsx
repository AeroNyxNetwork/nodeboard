/**
 * ============================================
 * AeroNyx Auth Modal Component
 * ============================================
 * File Path: components/auth/AuthModal.tsx
 *
 * Creation Reason: Dashboard no longer redirects to a landing page for login.
 *   Instead, this modal overlays the dashboard and presents the WalletConnect
 *   component. It cannot be dismissed — the user must authenticate to proceed.
 * Modification Reason:
 *   v1.1.0 - [AUTH-GATE 2026-08-13 by Codex] Removed narrow-screen overflow,
 *     added safe vertical scrolling and focus containment, and internationalized
 *     the phone-login path without changing the wallet authentication contract.
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
 * Last Modified: v1.1.0 - Accessible responsive authentication gate
 * Previous: v1.0.0 - Initial auth modal implementation
 * ============================================
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
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
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // [AUTH-GATE 2026-08-13 by Codex] Keep keyboard interaction inside the
  // non-dismissable sign-in surface and restore page state after authentication.
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      const modal = modalRef.current;
      const firstAction = modal?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      (firstAction ?? modal)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusableElements = Array.from(modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null && element.getAttribute('aria-hidden') !== 'true');

      if (focusableElements.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
      previousFocusRef.current = null;
    };
  }, [isOpen]);

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
            flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6
            bg-[#0A0A0F]/80 backdrop-blur-xl
          "
        >
          {/* Modal Content */}
          <motion.div
            ref={modalRef}
            key="auth-modal-content"
            role="dialog"
            aria-modal="true"
            aria-label={t('auth.connectWallet.title')}
            tabIndex={-1}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="
              relative z-10 my-auto min-w-0 w-full max-w-md
              p-5 rounded-2xl sm:p-8 sm:rounded-3xl
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

            {/* Phone login — sign in to the DASHBOARD by scanning with the
                AeroNyx app (wallet signs remotely, key stays on the phone).
                Points at /oplogin, NOT /weblogin: /weblogin imports the chat
                identity and would NOT authenticate the operator dashboard. */}
            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-gray-500">{t('auth.modal.or')}</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <Link
              href="/oplogin"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-sm text-white/90 transition-colors hover:bg-white/[0.06]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>
              {t('auth.modal.phoneLogin')}
            </Link>

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
