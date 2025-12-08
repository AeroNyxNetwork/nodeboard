/**
 * ============================================
 * AeroNyx Privacy Network - Registration Code Hooks
 * ============================================
 * File Path: src/hooks/useRegistrationCodes.ts
 * 
 * Creation Reason: React hooks for registration code management
 * Main Functionality: Custom hooks for fetching, generating, and
 *                     revoking registration codes with cache management
 * Dependencies:
 *   - src/types/index.ts (type definitions)
 *   - src/lib/api.ts (API client)
 *   - src/lib/constants.ts (polling intervals)
 *   - @tanstack/react-query
 * 
 * Main Logical Flow:
 * 1. useRegistrationCodes - Fetch and cache code list
 * 2. useGenerateCode - Generate new registration code
 * 3. useRevokeCode - Revoke existing code
 * 4. Automatic cache invalidation on mutations
 * 
 * ⚠️ Important Note for Next Developer:
 * - Codes have expiration - UI should show remaining time
 * - Only unused codes can be revoked
 * - Generated codes should be displayed prominently to user
 * 
 * Last Modified: v1.0.0 - Initial hooks implementation
 * ============================================
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { POLLING_INTERVALS } from '@/lib/constants';
import { RegistrationCode } from '@/types';

// ============================================
// Query Keys
// ============================================

export const codeKeys = {
  all: ['codes'] as const,
  lists: () => [...codeKeys.all, 'list'] as const,
  list: (includeExpired: boolean) => [...codeKeys.lists(), { includeExpired }] as const,
};

// ============================================
// Registration Codes List Hook
// ============================================

interface UseRegistrationCodesOptions {
  includeExpired?: boolean;
  enabled?: boolean;
  refetchInterval?: number;
}

interface UseRegistrationCodesResult {
  codes: RegistrationCode[];
  validCodes: RegistrationCode[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for fetching registration codes
 * Automatically filters valid codes for convenience
 */
export function useRegistrationCodes(
  options: UseRegistrationCodesOptions = {}
): UseRegistrationCodesResult {
  const {
    includeExpired = false,
    enabled = true,
    refetchInterval = POLLING_INTERVALS.CODES_LIST,
  } = options;

  const query = useQuery({
    queryKey: codeKeys.list(includeExpired),
    queryFn: async () => {
      const response = await api.getCodes(includeExpired);
      return response.data;
    },
    enabled,
    refetchInterval,
    staleTime: 30000, // Codes can be stale for 30 seconds
  });

  // Filter valid (unused and not expired) codes
  const validCodes = (query.data ?? []).filter(
    code => code.status === 'unused' && code.is_valid
  );

  return {
    codes: query.data ?? [],
    validCodes,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// Generate Code Hook
// ============================================

interface UseGenerateCodeResult {
  generateCode: () => Promise<RegistrationCode>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  lastGeneratedCode: RegistrationCode | null;
  reset: () => void;
}

/**
 * Hook for generating new registration codes
 * Stores the last generated code for easy access
 */
export function useGenerateCode(): UseGenerateCodeResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await api.generateCode();
      return response.data;
    },
    onSuccess: () => {
      // Invalidate codes list to show new code
      queryClient.invalidateQueries({ queryKey: codeKeys.lists() });
    },
  });

  return {
    generateCode: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    lastGeneratedCode: mutation.data ?? null,
    reset: mutation.reset,
  };
}

// ============================================
// Revoke Code Hook
// ============================================

interface UseRevokeCodeResult {
  revokeCode: (code: string) => Promise<void>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Hook for revoking registration codes
 */
export function useRevokeCode(): UseRevokeCodeResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (code: string) => {
      await api.revokeCode(code);
    },
    onSuccess: () => {
      // Invalidate codes list to remove revoked code
      queryClient.invalidateQueries({ queryKey: codeKeys.lists() });
    },
  });

  return {
    revokeCode: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

// ============================================
// Code Expiration Helpers
// ============================================

/**
 * Calculate remaining time until code expiration
 * @param expiresAt - ISO date string of expiration
 * @returns Object with remaining time components
 */
export function getCodeTimeRemaining(expiresAt: string): {
  isExpired: boolean;
  totalSeconds: number;
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isExpired: true,
      totalSeconds: 0,
      minutes: 0,
      seconds: 0,
      formatted: 'Expired',
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formatted = minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`;

  return {
    isExpired: false,
    totalSeconds,
    minutes,
    seconds,
    formatted,
  };
}

/**
 * Format code for display with dashes
 * @param code - Raw code string
 * @returns Formatted code string
 */
export function formatCode(code: string): string {
  return code; // Codes already come formatted as NYX-XXXX-XXXXX
}

/**
 * Check if code is still usable
 * @param code - Registration code object
 * @returns Boolean indicating if code can be used
 */
export function isCodeUsable(code: RegistrationCode): boolean {
  if (code.status !== 'unused') return false;
  if (!code.is_valid) return false;
  
  const now = new Date();
  const expiry = new Date(code.expires_at);
  return expiry.getTime() > now.getTime();
}
