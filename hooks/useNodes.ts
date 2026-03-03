/**
 * ============================================
 * AeroNyx Privacy Network - Node Hooks
 * ============================================
 * File Path: hooks/useNodes.ts
 *
 * Modification Reason: All data-fetching hooks now check isAuthenticated
 *   before firing queries. With the modal-based auth flow, dashboard
 *   components mount BEFORE login completes (behind the modal).
 *   Without the `enabled: isAuthenticated` guard, queries fire with no
 *   API key → 401 → triggers "Session expired" logout loop.
 * Dependencies:
 *   - @tanstack/react-query (data fetching)
 *   - lib/api.ts (API client)
 *   - stores/authStore.ts (auth state for enabled guard)
 *   - types/index.ts (type definitions)
 *
 * Main Logical Flow:
 * 1. Hook checks isAuthenticated from authStore
 * 2. If not authenticated, query stays disabled (no network request)
 * 3. When user logs in, isAuthenticated flips → queries automatically fire
 * 4. React Query caches results per staleTime/gcTime settings
 *
 * ⚠️ Important Note for Next Developer:
 * - ALL query hooks MUST include `enabled: isAuthenticated && ...`
 * - If you add new hooks, follow the same pattern
 * - Mutation hooks don't need the guard (they're triggered manually)
 * - staleTime: Infinity means data never auto-refetches — call refetch() manually
 *
 * Last Modified: v1.1.0 - Added auth guard to all query hooks
 * Previous: v1.0.3 - Added options support to useNodeSessions
 * ============================================
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Node, NodeDetail, NodeStats, Session, NodeStatus } from '@/types';

// ============================================
// Query Keys - use stable references
// ============================================

export const nodeKeys = {
  all: ['nodes'] as const,
  list: () => ['nodes', 'list'] as const,
  listWithStatus: (status: NodeStatus | undefined) => ['nodes', 'list', status] as const,
  detail: (id: string) => ['nodes', 'detail', id] as const,
  stats: (id: string, days: number) => ['nodes', 'stats', id, days] as const,
  sessions: (id: string, options?: UseNodeSessionsOptions) => ['nodes', 'sessions', id, options] as const,
};

// ============================================
// Node List Hook
// ============================================

interface UseNodesResult {
  nodes: Node[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNodes(): UseNodesResult {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.list(),
    queryFn: async () => {
      const response = await api.getNodes();
      return response.data;
    },
    // Only fetch when authenticated — dashboard mounts before login in modal flow
    enabled: isAuthenticated,
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  return {
    nodes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// Node Detail Hook
// ============================================

interface UseNodeDetailResult {
  node: NodeDetail | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNodeDetail(nodeId: string): UseNodeDetailResult {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.detail(nodeId),
    queryFn: async () => {
      const response = await api.getNodeDetail(nodeId);
      return response.data;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    node: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// Node Stats Hook
// ============================================

interface UseNodeStatsOptions {
  days?: number;
}

interface UseNodeStatsResult {
  stats: NodeStats | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNodeStats(
  nodeId: string,
  options: UseNodeStatsOptions = {}
): UseNodeStatsResult {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const days = options.days ?? 7;

  const query = useQuery({
    queryKey: nodeKeys.stats(nodeId, days),
    queryFn: async () => {
      const response = await api.getNodeStats(nodeId, days);
      return response.data;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    stats: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// Node Sessions Hook
// ============================================

interface UseNodeSessionsOptions {
  status?: 'active' | 'completed' | 'error';
  limit?: number;
}

interface UseNodeSessionsResult {
  sessions: Session[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNodeSessions(
  nodeId: string,
  options: UseNodeSessionsOptions = {}
): UseNodeSessionsResult {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.sessions(nodeId, options),
    queryFn: async () => {
      const response = await api.getNodeSessions(nodeId, options);
      return response.data;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// Node Mutation Hooks
// ============================================

export function useUpdateNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nodeId,
      data,
    }: {
      nodeId: string;
      data: { name?: string; is_active?: boolean };
    }) => {
      const response = await api.updateNode(nodeId, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.list() });
    },
  });
}

export function useDeleteNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nodeId: string) => {
      return api.deleteNode(nodeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.list() });
    },
  });
}

// ============================================
// Aggregated Stats Hook
// ============================================

interface AggregatedStats {
  totalNodes: number;
  onlineNodes: number;
  totalSessions: number;
  activeSessions: number;
  totalTrafficGB: number;
  avgUptime: number;
}

export function useAggregatedStats(): {
  stats: AggregatedStats;
  isLoading: boolean;
} {
  const { nodes, isLoading } = useNodes();

  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter(n => n.status === 'online').length;
  const totalSessions = nodes.reduce((sum, n) => sum + n.total_sessions, 0);
  const activeSessions = nodes.reduce((sum, n) => sum + n.current_sessions, 0);
  const totalTrafficGB = nodes.reduce((sum, n) => sum + n.total_traffic_gb, 0);
  const avgUptime = totalNodes > 0
    ? nodes.reduce((sum, n) => sum + n.online_duration, 0) / totalNodes
    : 0;

  return {
    stats: {
      totalNodes,
      onlineNodes,
      totalSessions,
      activeSessions,
      totalTrafficGB,
      avgUptime,
    },
    isLoading,
  };
}
