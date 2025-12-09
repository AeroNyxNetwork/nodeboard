/**
 * ============================================
 * AeroNyx Dashboard Layout
 * ============================================
 * File Path: app/dashboard/layout.tsx
 * 
 * Last Modified: v1.0.4 - Fixed redirect loop with proper state management
 * ============================================
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only check once
    if (hasChecked.current) return;
    hasChecked.current = true;

    // Small delay to ensure store is hydrated from localStorage
    const timer = setTimeout(() => {
      // Get the current auth state directly from store
      const currentAuth = useAuthStore.getState().isAuthenticated;
      
      if (!currentAuth) {
        router.replace('/');
      } else {
        setIsReady(true);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  // Handle sidebar
  const handleCloseSidebar = () => setIsSidebarOpen(false);
  const handleOpenSidebar = () => setIsSidebarOpen(true);

  // Show loading while checking auth
  if (!isReady) {
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
  );
}
