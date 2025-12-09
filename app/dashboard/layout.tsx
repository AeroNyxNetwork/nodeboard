/**
 * ============================================
 * AeroNyx Dashboard Layout
 * ============================================
 * File Path: app/dashboard/layout.tsx
 * 
 * Last Modified: v1.0.3 - Fixed infinite redirect loop (stale closure issue)
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // 如果未认证，重定向到首页
    if (!isAuthenticated) {
      router.replace('/');
    } else {
      // 如果已认证，停止加载状态，显示内容
      setIsChecking(false);
    }
  }, [isAuthenticated, router]);

  // Handle sidebar
  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
  };

  const handleOpenSidebar = () => {
    setIsSidebarOpen(true);
  };

  // 如果正在检查认证状态或未认证，显示 Loading
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Verifying session...</p>
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
