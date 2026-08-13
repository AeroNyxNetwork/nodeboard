/**
 * ============================================
 * AeroNyx Dashboard Layout
 * ============================================
 * File Path: app/dashboard/layout.tsx
 *
 * Modification Reason: Instead of redirecting unauthenticated users to the
 *   landing page, the layout now shows the dashboard skeleton behind a
 *   non-dismissable AuthModal. Once the user authenticates, the modal
 *   disappears and the full dashboard is revealed.
 *   v1.1.1 - Read loading copy from lib/i18n/I18nProvider.tsx.
 *   v1.2.0 - [AUTH-GATE 2026-08-13 by Codex] Make the dashboard shell inert
 *   while the non-dismissable authentication surface is active.
 * Main Functionality:
 *   - Auth-gated layout with login modal overlay
 *   - Sidebar navigation (desktop + mobile)
 *   - Skeleton loading state while hydrating
 * Dependencies:
 *   - stores/authStore.ts (auth state)
 *   - components/auth/AuthModal.tsx (login modal — NEW)
 *   - components/dashboard/Sidebar.tsx (navigation)
 *
 * Main Logical Flow:
 * 1. Wait for auth store hydration (brief spinner)
 * 2. Render dashboard shell (sidebar + content area)
 * 3. If !isAuthenticated → overlay AuthModal (non-dismissable)
 * 4. If isAuthenticated → render children normally
 *
 * ⚠️ Important Note for Next Developer:
 * - Auth redirect to '/' has been removed — do NOT re-add it
 * - AuthModal is controlled by isAuthenticated from the store
 * - The dashboard skeleton is always rendered (behind modal if needed)
 * - Maintain interface compatibility with components/dashboard/Sidebar.tsx
 *
 * Last Modified: v1.2.0 - Isolated authentication interaction boundary
 * Previous: v1.1.1 - i18n loading copy
 * Previous: v1.1.0 - Replaced redirect-to-landing with AuthModal overlay
 * Previous: v1.0.4 - Fixed redirect loop with proper state management
 * ============================================
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Sidebar, { MobileHeader } from '@/components/dashboard/Sidebar';
import AuthModal from '@/components/auth/AuthModal';
import { useI18n } from '@/lib/i18n/I18nProvider';

// ============================================
// Dashboard Layout Component
// ============================================

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasChecked = useRef(false);
  const { t } = useI18n();

  // ============================================
  // Wait for auth store hydration from localStorage
  // ============================================
  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    // Small delay to ensure zustand store is hydrated from localStorage
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // ============================================
  // Sidebar handlers
  // ============================================
  const handleCloseSidebar = () => setIsSidebarOpen(false);
  const handleOpenSidebar = () => setIsSidebarOpen(true);

  // ============================================
  // Pre-hydration: show loading spinner
  // ============================================
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">{t('common.loadingDashboard')}</p>
        </div>
      </div>
    );
  }

  // ============================================
  // Post-hydration: render dashboard + auth modal if needed
  // ============================================
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Auth Modal — overlays everything when not authenticated */}
      <AuthModal isOpen={!isAuthenticated} />

      <div
        aria-hidden={!isAuthenticated ? true : undefined}
        inert={!isAuthenticated ? true : undefined}
      >
        {/* Mobile Header */}
        <MobileHeader onMenuToggle={handleOpenSidebar} />

        <div className="flex">
          {/* Sidebar */}
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={handleCloseSidebar}
          />

          {/* Main Content */}
          <main className="flex-1 min-h-screen pt-16 lg:pt-0">
            <div className="p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
