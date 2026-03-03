/**
 * ============================================
 * AeroNyx Privacy Network - Agent React Query Hooks
 * ============================================
 * File Path: hooks/useAgent.ts
 *
 * Creation Reason: Phase 1 — Agent Lifecycle Management requires hooks
 *   for querying agent status and triggering lifecycle actions (install,
 *   start, stop, restart, uninstall). Follows the same patterns as
 *   hooks/useNodes.ts for consistency.
 *
 * Main Functionality:
 *   - useAgentStatus(nodeId) — Query hook with adaptive polling
 *     (fast during transitions, slow/off during stable states)
 *   - useInstallAgent() — Mutation to install agent
 *   - useStartAgent() — Mutation to start agent
 *   - useStopAgent() — Mutation to stop agent
 *   - useRestartAgent() — Mutation to restart agent
 *   - useUninstallAgent() — Mutation to uninstall agent
 *
 * Dependencies:
 *   - @tanstack/react-query (React Query v5)
 *   - stores/authStore.ts (isAuthenticated guard)
 *   - lib/api.ts (api singleton)
 *   - types/agent.ts (AgentInfo, AgentStatus, TRANSITIONAL_STATUSES)
 *   - lib/constants.ts (POLLING_INTERVALS)
 *
 * Main Logical Flow:
 * 1. useAgentStatus fetches GET /agent_status/?agent_type=openclaw
 * 2. Returns the first agent (openclaw) from the agents array
 * 3. Polling interval adapts: 2s for transitional, 30s for stable, off if null
 * 4. All mutations invalidate the agent status query on success
 * 5. All hooks are auth-guarded (enabled: isAuthenticated)
 *
 * ⚠️ Important Note for Next Developer:
 * - Query key is ['agent-status', nodeId, agentType] — keep consistent
 * - Mutations use refetchType: 'all' to force immediate re-fetch
 * - TRANSITIONAL_STATUSES drives polling speed — update types/agent.ts if needed
 * - The hook returns agent as AgentInfo | null; null means not installed
 *   OR the API returned an empty agents array
 * - Do NOT add staleTime: Infinity — agent status must stay fresh
 *
 * Last Modified: v1.0.0 - Initial agent hooks for Phase 1
 * ============================================
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { POLLING_INTERVALS } from '@/lib/constants';
import {
  AgentInfo,
  AgentStatus,
  AgentType,
  AgentStatusResponse,
  AgentActionResponse,
  InstallAgentRequest,
  TRANSITIONAL_STATUSES,
} from '@/types/agent';

// ============================================
// Query Keys
// ============================================

const AGENT_QUERY_KEYS = {
  status: (nodeId: string, agentType: AgentType = 'openclaw') =>
    ['agent-status', nodeId, agentType] as const,
};

// ============================================
// Polling Interval Helper
// ============================================

/**
 * Returns the appropriate polling interval based on agent status.
 * - Transitional states (installing, starting, etc.): 2s
 * - Stable states (running, stopped, etc.): 30s
 * - null/not_installed: no polling (return false to disable)
 */
function getPollingInterval(agent: AgentInfo | null): number | false {
  if (!agent) return false;

  if (TRANSITIONAL_STATUSES.has(agent.status)) {
    return POLLING_INTERVALS.AGENT_TRANSITIONAL;
  }

  // For running state, poll less frequently to catch health changes
  if (agent.status === 'running') {
    return POLLING_INTERVALS.AGENT_STABLE;
  }

  // For installed/stopped/error/not_installed — no auto-polling
  return false;
}

// ============================================
// useAgentStatus — Query Hook
// ============================================

/**
 * Fetches and auto-polls agent status for a given node.
 *
 * @param nodeId - Node UUID
 * @param agentType - Agent type to filter (default: 'openclaw')
 *
 * @returns {
 *   agent: AgentInfo | null — The agent data, or null if not found
 *   agentStatus: AgentStatus | null — Convenience shortcut for agent.status
 *   isLoading: boolean
 *   isError: boolean
 *   error: Error | null
 *   refetch: () => void
 * }
 */
export function useAgentStatus(
  nodeId: string,
  agentType: AgentType = 'openclaw'
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery<AgentStatusResponse, Error>({
    queryKey: AGENT_QUERY_KEYS.status(nodeId, agentType),
    queryFn: () => api.getAgentStatus(nodeId, agentType),
    enabled: !!nodeId && isAuthenticated,
    // Start with fast polling; refetchInterval function adapts based on data
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const agent = data.data.agents?.[0] ?? null;
      return getPollingInterval(agent);
    },
    // Keep data fresh — no stale time for agent status
    staleTime: 0,
    // Don't retry too aggressively during polling
    retry: 2,
    retryDelay: 1000,
  });

  // Extract the first agent (openclaw) from the response
  const agent: AgentInfo | null = query.data?.data?.agents?.[0] ?? null;
  const agentStatus: AgentStatus | null = agent?.status ?? null;

  return {
    agent,
    agentStatus,
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
 * Install agent on a node.
 * Invalidates agent status query on success to trigger re-fetch.
 */
export function useInstallAgent() {
  const queryClient = useQueryClient();

  return useMutation<
    AgentActionResponse,
    Error,
    { nodeId: string; data?: InstallAgentRequest }
  >({
    mutationFn: ({ nodeId, data }) => api.installAgent(nodeId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: AGENT_QUERY_KEYS.status(variables.nodeId),
        refetchType: 'all',
      });
    },
  });
}

/**
 * Start an installed agent.
 */
export function useStartAgent() {
  const queryClient = useQueryClient();

  return useMutation<
    AgentActionResponse,
    Error,
    { nodeId: string; agentType?: AgentType }
  >({
    mutationFn: ({ nodeId, agentType }) =>
      api.startAgent(nodeId, agentType),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: AGENT_QUERY_KEYS.status(variables.nodeId),
        refetchType: 'all',
      });
    },
  });
}

/**
 * Stop a running agent.
 */
export function useStopAgent() {
  const queryClient = useQueryClient();

  return useMutation<
    AgentActionResponse,
    Error,
    { nodeId: string; agentType?: AgentType }
  >({
    mutationFn: ({ nodeId, agentType }) =>
      api.stopAgent(nodeId, agentType),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: AGENT_QUERY_KEYS.status(variables.nodeId),
        refetchType: 'all',
      });
    },
  });
}

/**
 * Restart a running agent.
 */
export function useRestartAgent() {
  const queryClient = useQueryClient();

  return useMutation<
    AgentActionResponse,
    Error,
    { nodeId: string; agentType?: AgentType }
  >({
    mutationFn: ({ nodeId, agentType }) =>
      api.restartAgent(nodeId, agentType),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: AGENT_QUERY_KEYS.status(variables.nodeId),
        refetchType: 'all',
      });
    },
  });
}

/**
 * Uninstall an agent from a node.
 */
export function useUninstallAgent() {
  const queryClient = useQueryClient();

  return useMutation<
    AgentActionResponse,
    Error,
    { nodeId: string; agentType?: AgentType }
  >({
    mutationFn: ({ nodeId, agentType }) =>
      api.uninstallAgent(nodeId, agentType),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: AGENT_QUERY_KEYS.status(variables.nodeId),
        refetchType: 'all',
      });
    },
  });
}
