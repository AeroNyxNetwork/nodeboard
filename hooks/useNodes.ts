/**
 * ============================================
 * AeroNyx Privacy Network - Node Hooks
 * ============================================
 * File Path: hooks/useNodes.ts
 *
 * Modification Reason:
 *   v1.2.0 - Added public node pool hooks + updated useUpdateNode:
 *     New hooks:
 *       usePublicNodes(params)     — browse public node pool (no auth required)
 *       useVerifyNodeAccess()      — mutation: submit password for locked node
 *     Updated:
 *       useUpdateNode data type → NodeUpdateRequest (all new fields supported)
 *   v1.1.0 - Added auth guard (enabled: isAuthenticated) to all owner hooks.
 *     Dashboard mounts before login in modal flow; without the guard,
 *     queries fire with no API key → 401 → logout loop.
 *
 * Dependencies:
 *   - @tanstack/react-query
 *   - lib/api.ts
 *   - stores/authStore.ts
 *   - types/index.ts
 *
 * Main Logical Flow:
 * 1. Owner hooks: check isAuthenticated → disabled until login
 * 2. Public hooks: no auth check — always enabled (public endpoints)
 * 3. React Query caches per staleTime/gcTime
 * 4. Mutations invalidate relevant caches with refetchType: 'all'
 *
 * ⚠️ Important Note for Next Developer:
 * - ALL owner hooks MUST include `enabled: isAuthenticated && ...`
 * - usePublicNodes and useVerifyNodeAccess do NOT need auth guard
 *   (backend has no auth requirement for these endpoints)
 * - useUpdateNode now accepts NodeUpdateRequest — do NOT revert to narrow type
 * - usePublicNodes uses infinite-style pagination via 'page' param,
 *   but implemented as a simple query (not useInfiniteQuery) because
 *   the Explore page manages page state explicitly for filter+pagination UX
 * - staleTime: Infinity on owner hooks = manual refetch only
 * - staleTime: STALE_TIMES.PUBLIC_NODES (30s) on public hook = auto-stale
 *
 * Last Modified: v1.2.0 - Public pool hooks + NodeUpdateRequest type
 * Previous: v1.1.0 - Auth guard on all owner hooks
 * ============================================
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Node,
  NodeDetail,
  NodeStats,
  Session,
  NodeStatus,
  NodeUpdateRequest,
  PublicNode,
  PublicNodesParams,
  VerifyAccessRequest,
  VerifyAccessResponse,
  VpnOverview,
  VpnSession,
} from '@/types';
import { POLLING_INTERVALS, STALE_TIMES } from '@/lib/constants';

// ============================================
// Query Keys
// ============================================

export const nodeKeys = {
  all: ['nodes'] as const,
  // Owner
  list: () => ['nodes', 'list'] as const,
  listWithStatus: (status: NodeStatus | undefined) => ['nodes', 'list', status] as const,
  detail: (id: string) => ['nodes', 'detail', id] as const,
  stats: (id: string, days: number) => ['nodes', 'stats', id, days] as const,
  sessions: (id: string, options?: UseNodeSessionsOptions) =>
    ['nodes', 'sessions', id, options] as const,
  vpnOverview: () => ['nodes', 'vpn', 'overview'] as const,
  vpnSessions: (options?: UseVpnSessionsOptions) => ['nodes', 'vpn', 'sessions', options] as const,
  // Public pool
  publicList: (params: PublicNodesParams) => ['nodes', 'public', 'list', params] as const,
  publicDetail: (id: string) => ['nodes', 'public', 'detail', id] as const,
};

// ============================================
// Owner Hooks (auth required)
// ============================================

interface UseNodesResult {
  nodes: Node[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNodes(): UseNodesResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.list(),
    queryFn: async () => {
      const res = await api.getNodes();
      return res.data;
    },
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

interface UseNodeDetailResult {
  node: NodeDetail | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNodeDetail(nodeId: string): UseNodeDetailResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.detail(nodeId),
    queryFn: async () => {
      const res = await api.getNodeDetail(nodeId);
      return res.data;
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

export function useNodeStats(nodeId: string, options: UseNodeStatsOptions = {}): UseNodeStatsResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const days = options.days ?? 7;

  const query = useQuery({
    queryKey: nodeKeys.stats(nodeId, days),
    queryFn: async () => {
      const res = await api.getNodeStats(nodeId, days);
      return res.data;
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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.sessions(nodeId, options),
    queryFn: async () => {
      const res = await api.getNodeSessions(nodeId, options);
      return res.data;
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

interface UseVpnOverviewResult {
  overview: VpnOverview | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useVpnOverview(): UseVpnOverviewResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.vpnOverview(),
    queryFn: async () => {
      const res = await api.getVpnOverview();
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: POLLING_INTERVALS.VPN_OVERVIEW,
    refetchInterval: POLLING_INTERVALS.VPN_OVERVIEW,
    refetchOnWindowFocus: true,
  });

  return {
    overview: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export interface UseVpnSessionsOptions {
  status?: 'all' | 'active' | 'completed' | 'error';
  nodeId?: string;
  limit?: number;
}

interface UseVpnSessionsResult {
  sessions: VpnSession[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useVpnSessions(options: UseVpnSessionsOptions = {}): UseVpnSessionsResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.vpnSessions(options),
    queryFn: async () => {
      const res = await api.getVpnSessions(options);
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: POLLING_INTERVALS.VPN_SESSIONS,
    refetchInterval: POLLING_INTERVALS.VPN_SESSIONS,
    refetchOnWindowFocus: true,
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
// Public Node Pool Hooks (no auth required) [v1.2.0]
// ============================================

interface UsePublicNodesResult {
  nodes: PublicNode[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Browse the public node pool.
 * No authentication required — public endpoints.
 * Manages its own pagination state via the params object.
 *
 * @param params.region  ISO 3166-1 alpha-2, e.g. 'JP'
 * @param params.vpn     true = VPN nodes only
 * @param params.status  'online' | 'offline' (default backend: 'online')
 * @param params.page    page number (default 1)
 */
export function usePublicNodes(params: PublicNodesParams = {}): UsePublicNodesResult {
  const query = useQuery({
    queryKey: nodeKeys.publicList(params),
    queryFn: async () => {
      const res = await api.getPublicNodes(params);
      return res;
    },
    // Always enabled — no auth required
    enabled: true,
    staleTime: STALE_TIMES.PUBLIC_NODES,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const data = query.data;
  const pageSize = data?.page_size ?? 20;
  const total = data?.count ?? 0;
  const page = data?.page ?? 1;

  return {
    nodes: data?.data ?? [],
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Get a single public node's detail.
 * No authentication required.
 */
interface UsePublicNodeDetailResult {
  node: PublicNode | null;
  requiresPassword: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePublicNodeDetail(nodeId: string): UsePublicNodeDetailResult {
  const query = useQuery({
    queryKey: nodeKeys.publicDetail(nodeId),
    queryFn: async () => {
      const res = await api.getPublicNodeDetail(nodeId);
      return res;
    },
    enabled: !!nodeId,
    staleTime: STALE_TIMES.PUBLIC_NODES,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      // Do not retry on 403 (password required) or 404 (not found)
      const e = error as Error & { statusCode?: number };
      if (e.statusCode === 403 || e.statusCode === 404) return false;
      return failureCount < 2;
    },
  });

  return {
    node: query.data?.data ?? null,
    requiresPassword: (query.error as (Error & { requires_password?: boolean }) | null)
      ?.requires_password ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Update node settings.
 * v1.2.0: accepts full NodeUpdateRequest including visibility / region /
 * city / is_vpn_node / access_password.
 */
export function useUpdateNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nodeId,
      data,
    }: {
      nodeId: string;
      data: NodeUpdateRequest;
    }) => {
      const res = await api.updateNode(nodeId, data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: nodeKeys.detail(variables.nodeId),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: nodeKeys.list(),
        refetchType: 'all',
      });
    },
  });
}

export function useDeleteNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nodeId: string) => api.deleteNode(nodeId),
    onSuccess: (_data, nodeId) => {
      queryClient.removeQueries({ queryKey: nodeKeys.detail(nodeId) });
      queryClient.invalidateQueries({
        queryKey: nodeKeys.list(),
        refetchType: 'all',
      });
    },
  });
}

/**
 * Verify access password for a password_protected node.
 * No auth required. On success, server stores a session grant.
 * After calling this, invalidate the public detail cache so it re-fetches.
 */
export function useVerifyNodeAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nodeId,
      data,
    }: {
      nodeId: string;
      data: VerifyAccessRequest;
    }): Promise<VerifyAccessResponse> => {
      return api.verifyNodeAccess(nodeId, data);
    },
    onSuccess: (_data, variables) => {
      // Re-fetch the public node detail now that access is granted
      queryClient.invalidateQueries({
        queryKey: nodeKeys.publicDetail(variables.nodeId),
        refetchType: 'all',
      });
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
  const onlineNodes = nodes.filter((n) => n.status === 'online').length;
  const totalSessions = nodes.reduce((s, n) => s + n.total_sessions, 0);
  const activeSessions = nodes.reduce((s, n) => s + n.current_sessions, 0);
  const totalTrafficGB = nodes.reduce((s, n) => s + n.total_traffic_gb, 0);
  const avgUptime =
    totalNodes > 0
      ? nodes.reduce((s, n) => s + n.online_duration, 0) / totalNodes
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
