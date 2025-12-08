/**
 * ============================================
 * AeroNyx Dashboard Layout
 * ============================================
 * File Path: src/app/dashboard/layout.tsx
 * 
 * Creation Reason: Layout wrapper for all dashboard pages
 * Main Functionality: Auth protection, sidebar navigation,
 *                     and responsive mobile menu
 * Dependencies:
 *   - src/stores/authStore.ts
 *   - src/components/dashboard/Sidebar.tsx
 *   - next/navigation
 * 
 * Main Logical Flow:
 * 1. Check authentication status
 * 2. Redirect to login if not authenticated
 * 3. Render sidebar and main content area
 * 4. Handle mobile menu toggle
 * 
 * ⚠️ Important Note for Next Developer:
 * - All /dashboard/* routes are protected
 * - Sidebar state is managed locally
 * - Mobile menu closes on navigation
 * 
 * Last Modified: v1.0.0 - Initial dashboard layout
 * ============================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import Sidebar, { MobileHeader } from '@/components/dashboard/Sidebar';

// ============================================
// Dashboard Layout Component
// ============================================

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Auth protection
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, []);

  // Show loading while checking auth
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Mobile Header */}
      <MobileHeader onMenuToggle={() => setIsSidebarOpen(true)} />

      <div className="flex">
        {/* Sidebar */}
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
        />

        {/* Main Content */}
        <main className="
          flex-1 min-h-screen
          lg:ml-0
          pt-16 lg:pt-0
        ">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
