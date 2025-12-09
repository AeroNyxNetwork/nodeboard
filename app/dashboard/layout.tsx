/**
 * ============================================
 * AeroNyx Dashboard Layout
 * ============================================
 * File Path: app/dashboard/layout.tsx
 * 
 * Last Modified: v1.0.1 - Fixed auth check and sidebar display
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
  const [isChecking, setIsChecking] = useState(true);

  // Auth protection - only check once on mount
  useEffect(() => {
    // Small delay to allow auth store to initialize
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        router.push('/');
      }
      setIsChecking(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  // Show loading while checking auth
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // If not authenticated after check, show nothing (will redirect)
  if (!isAuthenticated) {
    return null;
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
        <main className="flex-1 min-h-screen pt-16 lg:pt-0">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
