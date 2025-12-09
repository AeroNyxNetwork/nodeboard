/**
 * ============================================
 * AeroNyx Privacy Network - Node Hooks
 * ============================================
 * File Path: hooks/useNodes.ts
 * 
 * Last Modified: v1.0.1 - Disabled aggressive auto-refresh to prevent constant reloading
 * ============================================
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Node, NodeDetail, NodeStats, Session, NodeStatus } from '@/types';

// ============================================
// Query Keys
// ============================================

export const nodeKeys = {
  all: ['nodes'] as const,
  lists: () => [...nodeKeys.all, 'list'] as const,
  list: (status?: NodeStatus) => [...nodeKeys.lists(), { status }] as const,
  details: () => [...nodeKeys.all, 'detail'] as const,
  detail: (id: string) => [...nodeKeys.details(), id] as const,
  statuses: () => [...nodeKeys.all, 'status'] as const,
  status: (id: string) => [...nodeKeys.statuses(), id] as const,
  stats: () => [...nodeKeys.all, 'stats'] as const,
  stat: (id: string, days?: number) => [...nodeKeys.stats(), id, { days }] as const,
  sessions: () => [...nodeKeys.all, 'sessions'] as const,
  session: (id: string, filters?: object) => [...nodeKeys.sessions(), id, filters] as const,
};

// ============================================
// Node List Hook
// ============================================

interface UseNodesOptions {
  status?: NodeStatus;
  enabled?: boolean;
}

interface UseNodesResult {
  nodes: Node[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNodes(options: UseNodesOptions = {}): UseNodesResult {
  const { status, enabled = true } = options;

  const query = useQuery({
    queryKey: nodeKeys.list(status),
    queryFn: async () => {
      const response = await api.getNodes(status);
      return response.data;
    },
    enabled,
    staleTime: 60000, // Data is fresh for 1 minute
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
    refetchInterval: false, // Disable auto-refresh
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

interface UseNodeDetailOptions {
  enabled?: boolean;
}

interface UseNodeDetailResult {
  node: NodeDetail | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNodeDetail(
  nodeId: string,
  options: UseNodeDetailOptions = {}
): UseNodeDetailResult {
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: nodeKeys.detail(nodeId),
    queryFn: async () => {
      const response = await api.getNodeDetail(nodeId);
      return response.data;
    },
    enabled: enabled && !!nodeId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
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
  enabled?: boolean;
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
  const { days = 7, enabled = true } = options;

  const query = useQuery({
    queryKey: nodeKeys.stat(nodeId, days),
    queryFn: async () => {
      const response = await api.getNodeStats(nodeId, days);
      return response.data;
    },
    enabled: enabled && !!nodeId,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
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
  enabled?: boolean;
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
  const { status, limit, enabled = true } = options;

  const query = useQuery({
    queryKey: nodeKeys.session(nodeId, { status, limit }),
    queryFn: async () => {
      const response = await api.getNodeSessions(nodeId, { status, limit });
      return response.data;
    },
    enabled: enabled && !!nodeId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: nodeKeys.detail(variables.nodeId) });
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
      queryClient.invalidateQueries({ queryKey: nodeKeys.lists() });
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

  const stats: AggregatedStats = {
    totalNodes: nodes.length,
    onlineNodes: nodes.filter(n => n.status === 'online').length,
    totalSessions: nodes.reduce((sum, n) => sum + n.total_sessions, 0),
    activeSessions: nodes.reduce((sum, n) => sum + n.current_sessions, 0),
    totalTrafficGB: nodes.reduce((sum, n) => sum + n.total_traffic_gb, 0),
    avgUptime: nodes.length > 0
      ? nodes.reduce((sum, n) => sum + n.online_duration, 0) / nodes.length
      : 0,
  };

  return { stats, isLoading };
}
