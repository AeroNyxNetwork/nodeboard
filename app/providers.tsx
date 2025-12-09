/**
 * ============================================
 * AeroNyx App Providers
 * ============================================
 * File Path: app/providers.tsx
 * 
 * Creation Reason: Client-side providers wrapper
 * Main Functionality: Initialize React Query, auth state, and any
 *                     other client-side providers
 * Dependencies:
 *   - @tanstack/react-query
 *   - stores/authStore.ts
 * 
 * Last Modified: v1.0.0 - Initial providers setup
 * ============================================
 */

'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';

// ============================================
// Query Client Configuration
// ============================================

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof Error && 
              (error.message.includes('401') || error.message.includes('403'))) {
            return false;
          }
          return failureCount < 3;
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

// ============================================
// Auth Initializer Component
// ============================================

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initialize();
    setIsInitialized(true);
  }, [initialize]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

// ============================================
// Providers Component
// ============================================

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        {children}
      </AuthInitializer>
    </QueryClientProvider>
  );
}
