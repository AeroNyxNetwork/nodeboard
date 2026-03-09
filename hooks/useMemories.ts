/**
 * ============================================
 * AeroNyx Privacy Network - Memory Hooks
 * ============================================
 * File Path: hooks/useMemories.ts
 *
 * Creation Reason: React Query hooks for the MemChain Memory Explorer.
 *
 * Modification Reason (v1.1.0):
 *   Updated to match actual API response format (v1.5.0 backend doc):
 *   - useMemoryOverview now returns MemoryOverviewData with `recent_by_layer`
 *   - Search results use MemoryRecord (has `layer`, ISO dates)
 *   - Overview records use MemoryOverviewRecord (Unix seconds, no `layer`)
 *
 * Main Functionality:
 *   - useMemoryStatus: Engine status + stats (query)
 *   - useMemoryOverview: Layer-grouped memory list (query)
 *   - useMemorySearch: Semantic search (mutation — user-triggered POST)
 *   - useMemoryRecord: Single record detail (query)
 *   - useRememberMemory: Create new memory (mutation)
 *   - useForgetMemory: Delete memory (mutation)
 *   - useEditMemory: Combined forget + remember (mutation)
 *
 * Dependencies:
 *   - @tanstack/react-query
 *   - lib/api.ts (api singleton)
 *   - stores/authStore.ts (isAuthenticated guard)
 *   - types/memory.ts
 *
 * ⚠️ Important Note for Next Developer:
 * - MPI requests can take 1-3 seconds (search involves embedding)
 * - If the node is offline, all MPI requests return 503
 * - The "edit" operation is NOT atomic: forget then remember
 * - useMemorySearch returns { mutate, data, isPending } — call mutate() to search
 * - Query cache keys include nodeId so different nodes don't share cache
 *
 * Last Modified: v1.1.0 - Aligned with actual API response format
 * Previous: v1.0.0 - Initial memory hooks
 * ============================================
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  MemoryStatusData,
  MemoryOverviewData,
  MemorySearchRequest,
  MemorySearchData,
  MemoryRecord,
  MemoryRememberRequest,
} from '@/types/memory';

// ============================================
// Query Keys
// ============================================

export const memoryKeys = {
  all: (nodeId: string) => ['memories', nodeId] as const,
  status: (nodeId: string) => ['memories', nodeId, 'status'] as const,
  overview: (nodeId: string, perLayer: number) => ['memories', nodeId, 'overview', perLayer] as const,
  record: (nodeId: string, recordId: string) => ['memories', nodeId, 'record', recordId] as const,
  search: (nodeId: string) => ['memories', nodeId, 'search'] as const,
};

// ============================================
// useMemoryStatus
// ============================================

interface UseMemoryStatusResult {
  status: MemoryStatusData | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useMemoryStatus(nodeId: string): UseMemoryStatusResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.status(nodeId),
    queryFn: async () => {
      const response = await api.getMemoryStatus(nodeId);
      return response.data;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  return {
    status: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// useMemoryOverview
// ============================================

interface UseMemoryOverviewOptions {
  perLayer?: number;
}

interface UseMemoryOverviewResult {
  overview: MemoryOverviewData | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useMemoryOverview(
  nodeId: string,
  options: UseMemoryOverviewOptions = {}
): UseMemoryOverviewResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const perLayer = options.perLayer ?? 20;

  const query = useQuery({
    queryKey: memoryKeys.overview(nodeId, perLayer),
    queryFn: async () => {
      const response = await api.getMemoryOverview(nodeId, perLayer);
      return response.data;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  return {
    overview: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// useMemorySearch
// ============================================

interface UseMemorySearchResult {
  search: (params: MemorySearchRequest) => void;
  results: MemorySearchData | null;
  isSearching: boolean;
  error: Error | null;
  reset: () => void;
}

export function useMemorySearch(nodeId: string): UseMemorySearchResult {
  const mutation = useMutation({
    mutationFn: async (params: MemorySearchRequest) => {
      const response = await api.searchMemories(nodeId, params);
      return response.data;
    },
  });

  return {
    search: mutation.mutate,
    results: mutation.data ?? null,
    isSearching: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

// ============================================
// useMemoryRecord
// ============================================

interface UseMemoryRecordResult {
  record: MemoryRecord | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useMemoryRecord(
  nodeId: string,
  recordId: string | null
): UseMemoryRecordResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.record(nodeId, recordId ?? ''),
    queryFn: async () => {
      if (!recordId) throw new Error('No record ID');
      const response = await api.getMemoryRecord(nodeId, recordId);
      return response.data;
    },
    enabled: isAuthenticated && !!nodeId && !!recordId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    record: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// useRememberMemory (create)
// ============================================

export function useRememberMemory(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MemoryRememberRequest) => {
      const response = await api.rememberMemory(nodeId, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: memoryKeys.status(nodeId),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: ['memories', nodeId, 'overview'],
        refetchType: 'all',
      });
    },
  });
}

// ============================================
// useForgetMemory (delete)
// ============================================

export function useForgetMemory(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordId: string) => {
      const response = await api.forgetMemory(nodeId, recordId);
      return response.data;
    },
    onSuccess: (_data, recordId) => {
      queryClient.removeQueries({
        queryKey: memoryKeys.record(nodeId, recordId),
      });
      queryClient.invalidateQueries({
        queryKey: memoryKeys.status(nodeId),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: ['memories', nodeId, 'overview'],
        refetchType: 'all',
      });
    },
  });
}

// ============================================
// useEditMemory (forget + remember)
// ============================================

interface EditMemoryParams {
  oldRecordId: string;
  newData: MemoryRememberRequest;
}

interface EditMemoryResult {
  newRecordId: string;
  status: 'created' | 'duplicate';
}

export function useEditMemory(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EditMemoryParams): Promise<EditMemoryResult> => {
      await api.forgetMemory(nodeId, params.oldRecordId);
      const response = await api.rememberMemory(nodeId, params.newData);
      return {
        newRecordId: response.data.record_id,
        status: response.data.status,
      };
    },
    onSuccess: (_data, params) => {
      queryClient.removeQueries({
        queryKey: memoryKeys.record(nodeId, params.oldRecordId),
      });
      queryClient.invalidateQueries({
        queryKey: memoryKeys.status(nodeId),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: ['memories', nodeId, 'overview'],
        refetchType: 'all',
      });
    },
  });
}
