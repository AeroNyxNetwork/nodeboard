/**
 * ============================================
 * AeroNyx Privacy Network - Node Hooks
 * ============================================
 * File Path: hooks/useNodes.ts
 *
 * Modification Reason:
 *   v1.5.4 - Refresh VPN overview after node setting updates so Services
 *     restart readiness reflects maintenance_mode changes immediately.
 *   v1.5.3 - Exposed VPN overview refresh metadata so services can show live
 *     drain/rollout sync status while reading the same backend overview API.
 *   v1.5.2 - Added authenticated VPN server placement hook for operator
 *     failover visibility.
 *   v1.5.1 - Removed public discovery hooks so nodeboard remains an operator
 *     management console.
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
 * Backend API Map:
 *   Route registry:
 *     /root/aeronyx/privacy_network/urls.py
 *   Node owner APIs:
 *     /root/aeronyx/privacy_network/api/nodes.py
 *   VPN overview/sessions/metrics:
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *   VPN billing/events/placement:
 *     /root/aeronyx/privacy_network/api/vpn_billing.py
 *     /root/aeronyx/privacy_network/api/vpn_events.py
 *     /root/aeronyx/privacy_network/api/vpn_servers.py
 *   VPN commands/wallet bans:
 *     /root/aeronyx/privacy_network/api/vpn_commands.py
 *     /root/aeronyx/privacy_network/services/command_service.py
 *
 * Rust Data Lineage:
 *   Heartbeats and VPN health originate from:
 *     /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *     /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *   Policy/placement fields consumed by Rust live in:
 *     /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 *   Encrypted packet counters are incremented in:
 *     /root/open/AeroNyx/crates/aeronyx-server/src/handlers/packet.rs
 *
 * Main Logical Flow:
 * 1. Owner hooks: check isAuthenticated → disabled until login
 * 2. React Query caches per staleTime/gcTime
 * 3. Mutations invalidate relevant caches with refetchType: 'all'
 *
 * ⚠️ Important Note for Next Developer:
 * - ALL owner hooks MUST include `enabled: isAuthenticated && ...`
* - useUpdateNode now accepts NodeUpdateRequest — do NOT revert to narrow type
* - staleTime: Infinity on owner hooks = manual refetch only
 *
 * Last Modified: v1.5.4 - Refresh VPN overview after node updates
 * Previous: v1.5.3 - VPN overview live refresh metadata
 * Previous: v1.1.0 - Auth guard on all owner hooks
 * ============================================
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getNodeboardHealth } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Node,
  NodeDetail,
  NodeStats,
  Session,
  NodeStatus,
  NodeUpdateRequest,
  VpnOverview,
  VpnNodeMetrics,
  VpnSession,
  VpnSessionListResponse,
  VpnSessionQualitySummary,
  SessionQualityStatus,
  VpnBillingOverview,
  VpnEventsOverview,
  VpnEventSeverity,
  VpnServerCandidate,
  VpnServerPlacementSummary,
  NodeWalletBan,
  NodeCommand,
  NodeCommandListResponse,
  NodeboardHealthResponse,
  RunNodeCommandRequest,
  RunNodeCommandResponse,
} from '@/types';
import { POLLING_INTERVALS } from '@/lib/constants';

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
  vpnServers: () => ['nodes', 'vpn', 'servers'] as const,
  vpnNodeMetrics: (id: string, hours: number) => ['nodes', 'vpn', 'metrics', id, hours] as const,
  vpnSessions: (options?: UseVpnSessionsOptions) => ['nodes', 'vpn', 'sessions', options] as const,
  vpnBilling: (options?: UseVpnBillingOptions) => ['nodes', 'vpn', 'billing', options] as const,
  vpnEvents: (options?: UseVpnEventsOptions) => ['nodes', 'vpn', 'events', options] as const,
  walletBans: (id: string, status: 'active' | 'inactive' | 'all') =>
    ['nodes', 'wallet-bans', id, status] as const,
  commands: (id: string, options?: UseNodeCommandsOptions) =>
    ['nodes', 'commands', id, options] as const,
  nodeboardHealth: () => ['nodeboard', 'health'] as const,
};

// ============================================
// Nodeboard Runtime Hook
// ============================================

interface UseNodeboardHealthResult {
  health: NodeboardHealthResponse | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNodeboardHealth(): UseNodeboardHealthResult {
  const query = useQuery({
    queryKey: nodeKeys.nodeboardHealth(),
    queryFn: getNodeboardHealth,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    health: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

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
  refetchIntervalMs?: number;
  refetchOnMount?: boolean;
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
  const { refetchIntervalMs, refetchOnMount, ...requestOptions } = options;

  const query = useQuery({
    queryKey: nodeKeys.sessions(nodeId, options),
    queryFn: async () => {
      const res = await api.getNodeSessions(nodeId, requestOptions);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId,
    // Node Detail uses this hook in two modes:
    // - Recent Sessions: static audit table, no polling.
    // - Maintenance Drain: active-session guardrail for restart, polling on.
    //
    // Backend contract:
    //   GET /api/privacy_network/nodes/{node_id}/sessions/
    //   /root/aeronyx/privacy_network/api/sessions.py
    //   /root/aeronyx/privacy_network/serializers.py
    //
    // Privacy boundary:
    //   This returns tunnel/session operational metadata only. It does not
    //   expose client public IPs, DNS contents, destinations, packet payloads,
    //   domains, URLs, browsing history, or voucher secrets.
    staleTime: refetchIntervalMs ? 0 : Infinity,
    gcTime: 10 * 60 * 1000,
    refetchInterval: refetchIntervalMs,
    refetchOnWindowFocus: false,
    refetchOnMount: refetchOnMount ?? Boolean(refetchIntervalMs),
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
// VPN Observability Hooks
// ============================================
// These hooks are the nodeboard operator surface for the commercial VPN
// control plane. They intentionally read aggregate/session-operational data
// only; the backend privacy boundary excludes payloads, DNS contents,
// destinations, domains, URLs, browsing history, voucher secrets, and API keys.

interface UseVpnOverviewResult {
  overview: VpnOverview | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  dataUpdatedAt: number;
  refetch: () => void;
}

interface UseVpnOverviewOptions {
  /**
   * Optional live refresh cadence for operator pages.
   *
   * Backend endpoint:
   *   GET /api/privacy_network/vpn/overview/
   *   /root/aeronyx/privacy_network/api/vpn_observability.py
   * Rust heartbeat producers:
   *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
   *   /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
   *
   * Keep this aggregate-only: it refreshes fleet health, active-session counts,
   * rollout state, and cleanup policy metadata; it never requests payloads,
   * DNS contents, destinations, domains, URLs, or wallet-level traffic.
   */
  refetchIntervalMs?: number | false;
}

export function useVpnOverview(options: UseVpnOverviewOptions = {}): UseVpnOverviewResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refetchIntervalMs = options.refetchIntervalMs ?? POLLING_INTERVALS.VPN_OVERVIEW;

  const query = useQuery({
    queryKey: nodeKeys.vpnOverview(),
    queryFn: async () => {
      const res = await api.getVpnOverview();
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: refetchIntervalMs || POLLING_INTERVALS.VPN_OVERVIEW,
    refetchInterval: refetchIntervalMs,
    refetchOnWindowFocus: true,
  });

  return {
    overview: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    dataUpdatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
  };
}

interface UseVpnServersResult {
  servers: VpnServerCandidate[];
  summary: VpnServerPlacementSummary | null;
  total: number;
  available: number;
  online: number;
  generatedAt: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useVpnServers(): UseVpnServersResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.vpnServers(),
    queryFn: async () => api.getVpnServers(),
    enabled: isAuthenticated,
    staleTime: POLLING_INTERVALS.VPN_SERVERS,
    refetchInterval: POLLING_INTERVALS.VPN_SERVERS,
    refetchOnWindowFocus: true,
  });

  return {
    servers: query.data?.servers ?? query.data?.data ?? [],
    summary: query.data?.summary ?? null,
    total: query.data?.total ?? 0,
    available: query.data?.available ?? 0,
    online: query.data?.online ?? 0,
    generatedAt: query.data?.generated_at ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

interface UseVpnNodeMetricsResult {
  metrics: VpnNodeMetrics | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useVpnNodeMetrics(
  nodeId: string,
  options: { hours?: number } = {}
): UseVpnNodeMetricsResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hours = options.hours ?? 24;

  const query = useQuery({
    queryKey: nodeKeys.vpnNodeMetrics(nodeId, hours),
    queryFn: async () => {
      const res = await api.getVpnNodeMetrics(nodeId, { hours });
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: POLLING_INTERVALS.VPN_NODE_METRICS,
    refetchInterval: POLLING_INTERVALS.VPN_NODE_METRICS,
    refetchOnWindowFocus: true,
  });

  return {
    metrics: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export interface UseVpnSessionsOptions {
  status?: 'all' | 'active' | 'completed' | 'error';
  nodeId?: string;
  qualityStatus?: 'all' | SessionQualityStatus;
  q?: string;
  limit?: number;
}

interface UseVpnSessionsResult {
  sessions: VpnSession[];
  count: number;
  filteredCount: number;
  qualitySummary: VpnSessionQualitySummary | null;
  filters: VpnSessionListResponse['filters'] | null;
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
      return res;
    },
    enabled: isAuthenticated,
    staleTime: POLLING_INTERVALS.VPN_SESSIONS,
    refetchInterval: POLLING_INTERVALS.VPN_SESSIONS,
    refetchOnWindowFocus: true,
  });

  return {
    sessions: query.data?.data ?? [],
    count: query.data?.count ?? 0,
    filteredCount: query.data?.filtered_count ?? query.data?.count ?? 0,
    qualitySummary: query.data?.quality_summary ?? null,
    filters: query.data?.filters ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export interface UseVpnBillingOptions {
  days?: number;
  status?: 'all' | 'active' | 'completed' | 'error';
  nodeId?: string;
  q?: string;
}

interface UseVpnBillingResult {
  billing: VpnBillingOverview | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useVpnBilling(options: UseVpnBillingOptions = {}): UseVpnBillingResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.vpnBilling(options),
    queryFn: async () => {
      const res = await api.getVpnBilling(options);
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: POLLING_INTERVALS.VPN_OVERVIEW,
    refetchInterval: POLLING_INTERVALS.VPN_OVERVIEW,
    refetchOnWindowFocus: true,
  });

  return {
    billing: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export interface UseVpnEventsOptions {
  days?: number;
  severity?: 'all' | VpnEventSeverity;
  type?: string;
  nodeId?: string;
  limit?: number;
}

interface UseVpnEventsResult {
  events: VpnEventsOverview | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useVpnEvents(options: UseVpnEventsOptions = {}): UseVpnEventsResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.vpnEvents(options),
    queryFn: async () => {
      const res = await api.getVpnEvents(options);
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: POLLING_INTERVALS.VPN_EVENTS,
    refetchInterval: POLLING_INTERVALS.VPN_EVENTS,
    refetchOnWindowFocus: true,
  });

  return {
    events: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

interface UseNodeWalletBansResult {
  bans: NodeWalletBan[];
  count: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNodeWalletBans(
  nodeId: string,
  status: 'active' | 'inactive' | 'all' = 'active'
): UseNodeWalletBansResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.walletBans(nodeId, status),
    queryFn: async () => {
      const res = await api.getNodeWalletBans(nodeId, status);
      return res;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: POLLING_INTERVALS.VPN_SESSIONS,
    refetchInterval: POLLING_INTERVALS.VPN_SESSIONS,
    refetchOnWindowFocus: true,
  });

  return {
    bans: query.data?.data ?? [],
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export interface UseNodeCommandsOptions {
  status?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

interface UseNodeCommandsResult {
  commands: NodeCommand[];
  stats: NodeCommandListResponse['stats'] | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNodeCommands(
  nodeId: string,
  options: UseNodeCommandsOptions = {}
): UseNodeCommandsResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: nodeKeys.commands(nodeId, options),
    queryFn: async () => {
      const res = await api.getNodeCommands(nodeId, options);
      return res;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: POLLING_INTERVALS.VPN_SESSIONS,
    refetchInterval: POLLING_INTERVALS.VPN_SESSIONS,
    refetchOnWindowFocus: true,
  });

  return {
    commands: query.data?.data ?? [],
    stats: query.data?.stats ?? null,
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
 *
 * Backend API and file:
 *   PATCH /api/privacy_network/nodes/{id}/
 *   /root/aeronyx/privacy_network/api/nodes.py
 *
 * Services dependency:
 *   app/dashboard/services/page.tsx uses this mutation to enable
 *   maintenance_mode from the restart readiness gate. The VPN overview cache
 *   must be invalidated so GET /api/privacy_network/vpn/overview/ reflects
 *   the new backend restart_readiness immediately.
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
      queryClient.invalidateQueries({
        queryKey: nodeKeys.vpnOverview(),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: ['nodes', 'vpn', 'events'],
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

export function useRunNodeCommand() {
  const queryClient = useQueryClient();

  return useMutation<
    RunNodeCommandResponse,
    Error,
    { nodeId: string; data: RunNodeCommandRequest }
  >({
    mutationFn: ({ nodeId, data }) => api.runNodeCommand(nodeId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: nodeKeys.commands(variables.nodeId),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: nodeKeys.vpnOverview(),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: ['nodes', 'vpn', 'sessions'],
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: ['nodes', 'wallet-bans', variables.nodeId],
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: ['nodes', 'vpn', 'events'],
        refetchType: 'all',
      });
    },
  });
}

export function useCancelNodeCommand() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; message: string },
    Error,
    { nodeId: string; commandId: string }
  >({
    mutationFn: ({ nodeId, commandId }) => api.cancelNodeCommand(nodeId, commandId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: nodeKeys.commands(variables.nodeId),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: nodeKeys.vpnOverview(),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        queryKey: ['nodes', 'vpn', 'events'],
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
