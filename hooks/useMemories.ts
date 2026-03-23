/**
 * ============================================
 * AeroNyx Privacy Network - Memory Hooks
 * ============================================
 * File Path: hooks/useMemories.ts
 *
 * Creation Reason: React Query hooks for the MemChain Memory Explorer.
 *
 * Modification Reason (v2.0.0):
 *   Phase 4 expansion — added v2.4.0 cognitive graph hooks and
 *   v2.5.0 SuperNode management hooks. All new hooks share the
 *   same 'memories' cache key prefix so write operations
 *   (remember/forget) correctly invalidate graph caches too.
 *
 *   New hooks added:
 *     Core recall:
 *       useRecallMemories, useRecallMemoryDetail,
 *       useSearchMemoriesFts, useContextInject
 *     Cognitive graph:
 *       useProjects, useProjectDetail, useProjectTimeline,
 *       useSessionDetail, useSessionConversation, useSessionArtifacts,
 *       useArtifactDetail, useArtifactVersions,
 *       useEntityDetail, useEntityGraph, useEntityTimeline,
 *       useCommunities
 *     SuperNode:
 *       useSupernodeTasks, useSupernodeTaskDetail,
 *       useRetrySupernodeTask, useCancelSupernodeTask,
 *       useSupernodeUsage, useSupernodeHealth
 *
 *   Bug fixes in existing hooks:
 *     - useRememberMemory / useForgetMemory: invalidate overview used
 *       bare array ['memories', nodeId, 'overview'] which skips perLayer
 *       variants. Replaced with predicate-based invalidation to correctly
 *       bust all overview cache entries regardless of perLayer value.
 *     - useMemorySearch: renamed internal field for clarity (no API change).
 *
 * Modification Reason (v1.1.0):
 *   Updated to match actual API response format (v1.5.0 backend doc):
 *   - useMemoryOverview now returns MemoryOverviewData with `recent_by_layer`
 *   - Search results use MemoryRecord (has `layer`, ISO dates)
 *   - Overview records use MemoryOverviewRecord (Unix seconds, no `layer`)
 *
 * Dependencies:
 *   - @tanstack/react-query
 *   - lib/api.ts (api singleton)
 *   - stores/authStore.ts (isAuthenticated guard)
 *   - types/memory.ts
 *   - lib/constants.ts (STALE_TIMES, POLLING_INTERVALS)
 *
 * ⚠️ Important Note for Next Developer:
 * - ALL cache keys use 'memories' prefix — do NOT create a second prefix
 *   (e.g. 'memory') or write invalidations will miss graph/supernode caches
 * - MPI core requests take 1-3s (search involves embedding)
 * - getSessionConversation may take up to 30s (decryption of large sessions)
 * - getSupernodeHealth may take up to 15s (pings external LLM providers)
 * - useSupernodeHealth never auto-fetches — call checkHealth() manually
 * - SuperNode hooks require supernodeEnabled=true to avoid 404s when
 *   supernode.enabled=false on the node — get this from useMemoryStatus
 * - useMemorySearch exposes { search, results, isSearching, error, reset }
 *   (not the raw React Query mutation API) — this is intentional for
 *   backward compatibility with existing MemoryOverview component
 * - The "edit" operation is NOT atomic: forget then remember (useEditMemory)
 * - Query cache keys include nodeId so different nodes don't share cache
 * - Progressive recall: call useRecallMemories(mode='index') → get IDs →
 *   call useRecallMemoryDetail with those IDs to fetch full content
 *
 * Last Modified: v2.0.0 - Added v2.4.0 graph hooks + v2.5.0 SuperNode hooks
 * Previous: v1.1.0 - Aligned with actual API response format
 * ============================================
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { STALE_TIMES, POLLING_INTERVALS } from '@/lib/constants';
import type {
  MemoryStatusData,
  MemoryOverviewData,
  MemorySearchRequest,
  MemorySearchData,
  MemoryRecord,
  MemoryRememberRequest,
  MemoryRecallRequest,
  MemoryRecallDetailRequest,
} from '@/types/memory';

// ============================================
// Query Keys
// ============================================
//
// ⚠️ ALL keys MUST start with 'memories' — this ensures predicate-based
// invalidations in useRememberMemory / useForgetMemory bust the correct
// cache entries across core memory, graph, and supernode sections.

export const memoryKeys = {
  all: (nodeId: string) => ['memories', nodeId] as const,

  // Core memory
  status:        (nodeId: string) =>                    ['memories', nodeId, 'status'] as const,
  overview:      (nodeId: string, perLayer: number) =>  ['memories', nodeId, 'overview', perLayer] as const,
  record:        (nodeId: string, recordId: string) =>  ['memories', nodeId, 'record', recordId] as const,
  contextInject: (nodeId: string, query?: string) =>    ['memories', nodeId, 'context', query] as const,

  // Projects
  projects:        (nodeId: string) =>                          ['memories', nodeId, 'projects'] as const,
  projectDetail:   (nodeId: string, projectId: string) =>       ['memories', nodeId, 'project', projectId] as const,
  projectTimeline: (nodeId: string, projectId: string) =>       ['memories', nodeId, 'project', projectId, 'timeline'] as const,

  // Sessions
  sessionDetail:       (nodeId: string, sessionId: string) =>   ['memories', nodeId, 'session', sessionId] as const,
  sessionConversation: (nodeId: string, sessionId: string) =>   ['memories', nodeId, 'session', sessionId, 'conversation'] as const,
  sessionArtifacts:    (nodeId: string, sessionId: string) =>   ['memories', nodeId, 'session', sessionId, 'artifacts'] as const,

  // Artifacts
  artifactDetail:   (nodeId: string, artifactId: string) =>     ['memories', nodeId, 'artifact', artifactId] as const,
  artifactVersions: (nodeId: string, artifactId: string) =>     ['memories', nodeId, 'artifact', artifactId, 'versions'] as const,

  // Entities
  entityDetail:   (nodeId: string, entityId: string) =>         ['memories', nodeId, 'entity', entityId] as const,
  entityGraph:    (nodeId: string, entityId: string) =>         ['memories', nodeId, 'entity', entityId, 'graph'] as const,
  entityTimeline: (nodeId: string, entityId: string) =>         ['memories', nodeId, 'entity', entityId, 'timeline'] as const,

  // Communities
  communities: (nodeId: string) =>                              ['memories', nodeId, 'communities'] as const,

  // SuperNode
  supernodeTasks:      (nodeId: string, filters: SupernodeTaskFilters) => ['memories', nodeId, 'supernode', 'tasks', filters] as const,
  supernodeTaskDetail: (nodeId: string, taskId: string) =>      ['memories', nodeId, 'supernode', 'task', taskId] as const,
  supernodeUsage:      (nodeId: string, period?: string) =>     ['memories', nodeId, 'supernode', 'usage', period] as const,
  supernodeHealth:     (nodeId: string) =>                      ['memories', nodeId, 'supernode', 'health'] as const,
};

// ============================================
// Shared types
// ============================================

interface SupernodeTaskFilters {
  status?: string;
  type?: string;
  limit?: number;
}

// ============================================
// Core Memory Hooks (v1.1.0, unchanged API)
// ============================================

export function useMemoryStatus(nodeId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.status(nodeId),
    queryFn: async () => {
      const res = await api.getMemoryStatus(nodeId);
      return res.data;
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

export function useMemoryOverview(nodeId: string, options: { perLayer?: number } = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const perLayer = options.perLayer ?? 20;

  const query = useQuery({
    queryKey: memoryKeys.overview(nodeId, perLayer),
    queryFn: async () => {
      const res = await api.getMemoryOverview(nodeId, perLayer);
      return res.data;
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

/**
 * Semantic search (embed + recall combo).
 * Exposes { search, results, isSearching, error, reset } for backward
 * compatibility with MemoryOverview component.
 */
export function useMemorySearch(nodeId: string) {
  const mutation = useMutation({
    mutationFn: async (params: MemorySearchRequest) => {
      const res = await api.searchMemories(nodeId, params);
      return res.data;
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

export function useMemoryRecord(nodeId: string, recordId: string | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.record(nodeId, recordId ?? ''),
    queryFn: async () => {
      if (!recordId) throw new Error('No record ID');
      const res = await api.getMemoryRecord(nodeId, recordId);
      return res.data;
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

/**
 * Hybrid recall: vector + BM25 + graph + cross-encoder reranking.
 * Supports progressive retrieval: call with mode='index' → get IDs →
 * call useRecallMemoryDetail with those IDs for full content.
 */
export function useRecallMemories(nodeId: string) {
  return useMutation({
    mutationFn: async (data: MemoryRecallRequest) => {
      const res = await api.recallMemories(nodeId, data);
      return res.data;
    },
  });
}

/** Progressive retrieval step 2 — fetch full content for specific record IDs. */
export function useRecallMemoryDetail(nodeId: string) {
  return useMutation({
    mutationFn: async (data: MemoryRecallDetailRequest) => {
      const res = await api.recallMemoryDetail(nodeId, data);
      return res.data;
    },
  });
}

/** FTS5 full-text keyword search with highlighted snippets. Fast (< 30ms). */
export function useSearchMemoriesFts(nodeId: string) {
  return useMutation({
    mutationFn: async (q: string) => {
      const res = await api.searchMemoriesFts(nodeId, q);
      return res.data;
    },
  });
}

/** Auto context injection for new sessions. */
export function useContextInject(nodeId: string, query?: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const q = useQuery({
    queryKey: memoryKeys.contextInject(nodeId, query),
    queryFn: async () => {
      const res = await api.getContextInject(nodeId, query);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: STALE_TIMES.MEMORY_GRAPH,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    context: q.data ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

// ============================================
// Core Memory Mutation Hooks (v1.1.0, bug fix in v2.0.0)
// ============================================

/**
 * Create a new memory.
 *
 * v2.0.0 bug fix: invalidate overview uses predicate instead of bare
 * array key to correctly bust all perLayer variants.
 */
export function useRememberMemory(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MemoryRememberRequest) => {
      const res = await api.rememberMemory(nodeId, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: memoryKeys.status(nodeId),
        refetchType: 'all',
      });
      // Bust ALL overview entries for this node (all perLayer variants)
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey as string[];
          return key[0] === 'memories' && key[1] === nodeId && key[2] === 'overview';
        },
        refetchType: 'all',
      });
    },
  });
}

/**
 * Delete (forget) a memory.
 *
 * v2.0.0 bug fix: same predicate-based overview invalidation as useRememberMemory.
 */
export function useForgetMemory(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordId: string) => {
      const res = await api.forgetMemory(nodeId, recordId);
      return res.data;
    },
    onSuccess: (_data, recordId) => {
      queryClient.removeQueries({ queryKey: memoryKeys.record(nodeId, recordId) });
      queryClient.invalidateQueries({
        queryKey: memoryKeys.status(nodeId),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey as string[];
          return key[0] === 'memories' && key[1] === nodeId && key[2] === 'overview';
        },
        refetchType: 'all',
      });
    },
  });
}

/** Edit = forget old + remember new. Not atomic. */
export function useEditMemory(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { oldRecordId: string; newData: MemoryRememberRequest }) => {
      await api.forgetMemory(nodeId, params.oldRecordId);
      const res = await api.rememberMemory(nodeId, params.newData);
      return { newRecordId: res.data.record_id, status: res.data.status };
    },
    onSuccess: (_data, params) => {
      queryClient.removeQueries({ queryKey: memoryKeys.record(nodeId, params.oldRecordId) });
      queryClient.invalidateQueries({
        queryKey: memoryKeys.status(nodeId),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey as string[];
          return key[0] === 'memories' && key[1] === nodeId && key[2] === 'overview';
        },
        refetchType: 'all',
      });
    },
  });
}

// ============================================
// Cognitive Graph Hooks — Projects (v2.0.0 / v2.4.0 backend)
// ============================================

export function useProjects(nodeId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.projects(nodeId),
    queryFn: async () => {
      const res = await api.getProjects(nodeId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: STALE_TIMES.MEMORY_GRAPH,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    projects: query.data?.projects ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useProjectDetail(nodeId: string, projectId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.projectDetail(nodeId, projectId),
    queryFn: async () => {
      const res = await api.getProjectDetail(nodeId, projectId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && !!projectId,
    staleTime: STALE_TIMES.MEMORY_GRAPH,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    project: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useProjectTimeline(nodeId: string, projectId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.projectTimeline(nodeId, projectId),
    queryFn: async () => {
      const res = await api.getProjectTimeline(nodeId, projectId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && !!projectId,
    staleTime: STALE_TIMES.MEMORY_GRAPH,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    timeline: query.data?.timeline ?? [],
    projectName: query.data?.project_name ?? '',
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// Cognitive Graph Hooks — Sessions (v2.0.0 / v2.4.0 backend)
// ============================================

export function useSessionDetail(nodeId: string, sessionId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.sessionDetail(nodeId, sessionId),
    queryFn: async () => {
      const res = await api.getSessionDetail(nodeId, sessionId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && !!sessionId,
    staleTime: STALE_TIMES.MEMORY_DETAIL,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    session: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Full decrypted conversation replay.
 * ⚠️ May take up to 30s for long sessions. Content is immutable — gcTime 30min.
 */
export function useSessionConversation(nodeId: string, sessionId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.sessionConversation(nodeId, sessionId),
    queryFn: async () => {
      const res = await api.getSessionConversation(nodeId, sessionId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && !!sessionId,
    staleTime: STALE_TIMES.MEMORY_DETAIL,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    conversation: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

export function useSessionArtifacts(nodeId: string, sessionId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.sessionArtifacts(nodeId, sessionId),
    queryFn: async () => {
      const res = await api.getSessionArtifacts(nodeId, sessionId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && !!sessionId,
    staleTime: STALE_TIMES.MEMORY_DETAIL,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    artifacts: query.data?.artifacts ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// Cognitive Graph Hooks — Artifacts (v2.0.0 / v2.4.0 backend)
// ============================================

export function useArtifactDetail(nodeId: string, artifactId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.artifactDetail(nodeId, artifactId),
    queryFn: async () => {
      const res = await api.getArtifactDetail(nodeId, artifactId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && !!artifactId,
    staleTime: STALE_TIMES.MEMORY_DETAIL,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    artifact: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

export function useArtifactVersions(nodeId: string, artifactId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.artifactVersions(nodeId, artifactId),
    queryFn: async () => {
      const res = await api.getArtifactVersions(nodeId, artifactId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && !!artifactId,
    staleTime: STALE_TIMES.MEMORY_DETAIL,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    versions: query.data?.versions ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

// ============================================
// Cognitive Graph Hooks — Entities (v2.0.0 / v2.4.0 backend)
// ============================================

// ============================================
// Cognitive Graph Hooks — Entities (v2.0.0 / v2.4.0 backend)
// ============================================

/**
 * List all entities extracted by the Miner (up to 200).
 * staleTime: 5 min — same as other graph data.
 */
export function useEntities(nodeId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: ['memories', nodeId, 'entities'] as const,
    queryFn: async () => {
      const res = await api.getEntities(nodeId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: STALE_TIMES.MEMORY_GRAPH,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    entities: query.data?.entities ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useEntityDetail(nodeId: string, entityId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.entityDetail(nodeId, entityId),
    queryFn: async () => {
      const res = await api.getEntityDetail(nodeId, entityId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && !!entityId,
    staleTime: STALE_TIMES.MEMORY_GRAPH,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    entity: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useEntityGraph(nodeId: string, entityId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.entityGraph(nodeId, entityId),
    queryFn: async () => {
      const res = await api.getEntityGraph(nodeId, entityId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && !!entityId,
    staleTime: STALE_TIMES.MEMORY_GRAPH,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    graph: query.data ?? null,
    nodes: query.data?.nodes ?? [],
    edges: query.data?.edges ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useEntityTimeline(nodeId: string, entityId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.entityTimeline(nodeId, entityId),
    queryFn: async () => {
      const res = await api.getEntityTimeline(nodeId, entityId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && !!entityId,
    staleTime: STALE_TIMES.MEMORY_GRAPH,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    events: query.data?.events ?? [],
    entityName: query.data?.entity_name ?? '',
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// Cognitive Graph Hooks — Communities (v2.0.0 / v2.4.0 backend)
// ============================================

/**
 * List all communities.
 * v2.5.0: communities may include LLM-generated narrative summaries.
 * Use hasLlmCommunityNarrative() from types/memory.ts to check quality.
 */
export function useCommunities(nodeId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.communities(nodeId),
    queryFn: async () => {
      const res = await api.getCommunities(nodeId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId,
    staleTime: STALE_TIMES.MEMORY_GRAPH,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    communities: query.data?.communities ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================
// SuperNode Hooks — Tasks (v2.0.0 / v2.5.0 backend)
// ============================================

/**
 * SuperNode cognitive task queue.
 *
 * @param supernodeEnabled - from useMemoryStatus data.supernode?.enabled.
 *   Pass false to disable the query and avoid 404 when SuperNode is off.
 * @param options.refetchInterval - Pass false to stop polling when panel
 *   is collapsed. Defaults to POLLING_INTERVALS.SUPERNODE_TASKS (5s).
 */
export function useSupernodeTasks(
  nodeId: string,
  supernodeEnabled: boolean,
  filters: SupernodeTaskFilters = {},
  options: { refetchInterval?: number | false } = {}
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const refetchInterval = options.refetchInterval !== undefined
    ? options.refetchInterval
    : POLLING_INTERVALS.SUPERNODE_TASKS;

  const query = useQuery({
    queryKey: memoryKeys.supernodeTasks(nodeId, filters),
    queryFn: async () => {
      const res = await api.getSupernodeTasks(nodeId, filters);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && supernodeEnabled,
    staleTime: STALE_TIMES.SUPERNODE_TASKS,
    gcTime: 5 * 60 * 1000,
    refetchInterval,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  return {
    tasks: query.data?.tasks ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useSupernodeTaskDetail(
  nodeId: string,
  taskId: string,
  supernodeEnabled: boolean
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.supernodeTaskDetail(nodeId, taskId),
    queryFn: async () => {
      const res = await api.getSupernodeTaskDetail(nodeId, taskId);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && !!taskId && supernodeEnabled,
    staleTime: STALE_TIMES.SUPERNODE_TASKS,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  return {
    task: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Retry a failed or cancelled task. Invalidates task list + detail. */
export function useRetrySupernodeTask(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await api.retrySupernodeTask(nodeId, taskId);
      return res.data;
    },
    onSuccess: (_data, taskId) => {
      queryClient.invalidateQueries({
        queryKey: memoryKeys.supernodeTaskDetail(nodeId, taskId),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey as string[];
          return key[0] === 'memories' && key[1] === nodeId &&
            key[2] === 'supernode' && key[3] === 'tasks';
        },
        refetchType: 'all',
      });
    },
  });
}

/** Cancel a pending task. Invalidates task list + detail. */
export function useCancelSupernodeTask(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await api.cancelSupernodeTask(nodeId, taskId);
      return res.data;
    },
    onSuccess: (_data, taskId) => {
      queryClient.invalidateQueries({
        queryKey: memoryKeys.supernodeTaskDetail(nodeId, taskId),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey as string[];
          return key[0] === 'memories' && key[1] === nodeId &&
            key[2] === 'supernode' && key[3] === 'tasks';
        },
        refetchType: 'all',
      });
    },
  });
}

// ============================================
// SuperNode Hooks — Usage & Health (v2.0.0 / v2.5.0 backend)
// ============================================

export function useSupernodeUsage(
  nodeId: string,
  supernodeEnabled: boolean,
  period?: string
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.supernodeUsage(nodeId, period),
    queryFn: async () => {
      const res = await api.getSupernodeUsage(nodeId, period);
      return res.data;
    },
    enabled: isAuthenticated && !!nodeId && supernodeEnabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    usage: query.data ?? null,
    stats: query.data?.stats ?? [],
    totals: query.data?.totals ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * SuperNode provider health check.
 * ⚠️ Never auto-fetches (up to 15s per call). Call checkHealth() manually.
 */
export function useSupernodeHealth(nodeId: string, supernodeEnabled: boolean) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.supernodeHealth(nodeId),
    queryFn: async () => {
      const res = await api.getSupernodeHealth(nodeId);
      return res.data;
    },
    enabled: false, // never auto-fetches — use checkHealth() below
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const checkHealth = () => {
    if (!isAuthenticated || !nodeId || !supernodeEnabled) return;
    query.refetch();
  };

  return {
    health: query.data ?? null,
    providers: query.data?.providers ?? [],
    queueSummary: query.data?.queue_summary ?? null,
    isLoading: query.isFetching,
    isError: query.isError,
    error: query.error,
    hasFetched: query.isFetched,
    checkHealth,
  };
}
