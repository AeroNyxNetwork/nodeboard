/**
 * ============================================
 * AeroNyx Privacy Network - Memory Hooks
 * ============================================
 * File Path: hooks/useMemories.ts
 *
 * Creation Reason: React Query hooks for the MemChain Memory Explorer.
 *   Provides data fetching, caching, and mutations for all MPI operations.
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
 * Main Logical Flow:
 *   1. All queries guard on isAuthenticated (same pattern as useNodes.ts)
 *   2. Mutations invalidate relevant queries on success
 *   3. Search uses useMutation (not useQuery) because it's user-initiated
 *      and takes a POST body — no automatic refetching
 *   4. Edit is a sequential forget → remember wrapped in a single mutation
 *
 * ⚠️ Important Note for Next Developer:
 * - MPI requests can take 1-3 seconds (search involves embedding)
 * - If the node is offline, all MPI requests return 503
 * - The "edit" operation is NOT atomic: forget then remember. If remember
 *   fails, the old record is already gone — frontend must handle this gracefully
 * - useMemorySearch returns { mutate, data, isPending } — call mutate() to search
 * - Query cache keys include nodeId so different nodes don't share cache
 *
 * Last Modified: v1.0.0 - Initial memory hooks for Memory Explorer
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
  MemoryRememberData,
  MemoryForgetData,
  MemoryLayer,
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

/**
 * Fetch MemChain engine status and memory statistics.
 * Used for the status card at the top of the Memory Explorer.
 */
export function useMemoryStatus(nodeId: string): UseMemoryStatusResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.status(nodeId),
    queryFn: async () => {
      const response = await api.getMemoryStatus(nodeId);
      return response.data;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: 30 * 1000, // 30s — status can change when AI interacts
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Always fresh on mount
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

/**
 * Fetch memory overview grouped by layer.
 * Used for the main memory list in the Memory Explorer.
 */
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
  /** Call this to trigger a search */
  search: (params: MemorySearchRequest) => void;
  /** Search results (persists until next search) */
  results: MemorySearchData | null;
  /** True while search is in progress */
  isSearching: boolean;
  /** Search error */
  error: Error | null;
  /** Reset results to null */
  reset: () => void;
}

/**
 * Semantic search across memories.
 * Uses useMutation because search is user-triggered (POST body).
 * Results persist until next search or manual reset.
 */
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

/**
 * Fetch a single memory record by ID.
 * Used for the detail/edit view.
 */
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

/**
 * Create a new memory.
 * Invalidates overview and status on success.
 */
export function useRememberMemory(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MemoryRememberRequest) => {
      const response = await api.rememberMemory(nodeId, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate overview and status to reflect new memory
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

/**
 * Delete a memory by record ID.
 * Invalidates overview and status on success.
 */
export function useForgetMemory(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordId: string) => {
      const response = await api.forgetMemory(nodeId, recordId);
      return response.data;
    },
    onSuccess: (_data, recordId) => {
      // Remove record detail cache
      queryClient.removeQueries({
        queryKey: memoryKeys.record(nodeId, recordId),
      });
      // Invalidate overview and status
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
  /** ID of the record to replace */
  oldRecordId: string;
  /** New memory data */
  newData: MemoryRememberRequest;
}

interface EditMemoryResult {
  /** New record ID after edit */
  newRecordId: string;
  /** Status of the remember operation */
  status: 'created' | 'duplicate';
}

/**
 * Edit a memory by deleting the old one and creating a new one.
 * This is NOT atomic — if remember fails after forget, the old record is gone.
 * The mutation returns the new record info on success.
 * Invalidates overview and status on success.
 */
export function useEditMemory(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EditMemoryParams): Promise<EditMemoryResult> => {
      // Step 1: Delete old record
      await api.forgetMemory(nodeId, params.oldRecordId);

      // Step 2: Create new record
      const response = await api.rememberMemory(nodeId, params.newData);

      return {
        newRecordId: response.data.record_id,
        status: response.data.status,
      };
    },
    onSuccess: (_data, params) => {
      // Remove old record detail cache
      queryClient.removeQueries({
        queryKey: memoryKeys.record(nodeId, params.oldRecordId),
      });
      // Invalidate overview and status
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
