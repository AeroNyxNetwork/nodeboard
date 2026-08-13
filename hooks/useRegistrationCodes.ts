/**
 * ============================================
 * AeroNyx Privacy Network - Registration Code Hooks
 * ============================================
 * File Path: hooks/useRegistrationCodes.ts
 * 
 * Creation Reason: React hooks for registration code management
 * Modification Reason:
 *   v1.1.0 - [CODE-LIFECYCLE 2026-08-13 by Codex] Guarded queries by
 *     authentication, exposed background refresh state, and kept mutations
 *     pending until every visible code list has reconciled.
 * Main Functionality: Custom hooks for fetching, generating, and
 *                     revoking registration codes with cache management
 * Dependencies:
 *   - types/index.ts (type definitions)
 *   - lib/api.ts (API client)
 *   - lib/constants.ts (polling intervals)
 *   - stores/authStore.ts (owner authentication gate)
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
 * Last Modified: v1.1.0 - Auth-safe, reconciled registration code lifecycle
 * Previous: v1.0.0 - Initial hooks implementation
 * ============================================
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { POLLING_INTERVALS } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
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
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

/**
 * Hook for fetching registration codes
 * Automatically filters valid codes for convenience
 */
export function useRegistrationCodes(
  options: UseRegistrationCodesOptions = {}
): UseRegistrationCodesResult {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
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
    enabled: enabled && isAuthenticated,
    refetchInterval,
    staleTime: 30000, // Codes can be stale for 30 seconds
    refetchOnWindowFocus: true,
  });

  // Filter valid (unused and not expired) codes
  const validCodes = (query.data ?? []).filter(
    code => code.status === 'unused' && code.is_valid
  );

  return {
    codes: query.data ?? [],
    validCodes,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
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
    onSuccess: async () => {
      // [CODE-LIFECYCLE 2026-08-13 by Codex] Keep the mutation pending until
      // the history view contains the new code, avoiding a transient stale row.
      await queryClient.invalidateQueries({ queryKey: codeKeys.lists() });
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
  reset: () => void;
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
    onSuccess: async () => {
      // Keep the confirmation pending until every list reflects revocation.
      await queryClient.invalidateQueries({ queryKey: codeKeys.lists() });
    },
  });

  return {
    revokeCode: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
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
export function getCodeTimeRemaining(expiresAt: string, now: Date = new Date()): {
  isExpired: boolean;
  totalSeconds: number;
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
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
export function isCodeUsable(code: RegistrationCode, now: Date = new Date()): boolean {
  if (code.status !== 'unused') return false;
  if (!code.is_valid) return false;
  
  const expiry = new Date(code.expires_at);
  return expiry.getTime() > now.getTime();
}
