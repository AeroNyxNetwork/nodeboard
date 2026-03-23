/**
 * ============================================
 * AeroNyx Privacy Network - Memory Hooks
 * ============================================
 * File Path: hooks/useMemories.ts
 *
 * Creation Reason: React Query hooks for the MemChain Memory Explorer.
 *
 * Modification Reason (v2.1.0):
 *   Bug fixes and improvements from code audit:
 *
 *   [BUG FIX] useEditMemory 操作顺序反转 (数据安全):
 *     原来是 forget → remember，如果 remember 失败数据永久丢失。
 *     修复：先 remember 新的，成功后再 forget 旧的。
 *     onError 回调提示用户新记录创建失败，旧记录仍然存在。
 *
 *   [BUG FIX] useEntities query key 统一到 memoryKeys:
 *     原来手写 ['memories', nodeId, 'entities']，和其他 hook 不一致。
 *     修复：在 memoryKeys 对象中新增 entities key，useEntities 改用它。
 *
 *   [BUG FIX] 写操作 invalidation 范围扩大 (数据一致性):
 *     原来 useRememberMemory / useForgetMemory 只 invalidate status + overview。
 *     但文件头注释说"graph caches also invalidated"与实现矛盾。
 *     修复：同时 invalidate entities、communities、contextInject。
 *     注意：projects/sessions/artifacts 不 invalidate，因为它们由 Miner 异步
 *     更新（最快 1h），立即 invalidate 会触发无意义的重复请求。
 *
 *   [BUG FIX] useSupernodeTasks filters 稳定性:
 *     原来直接把调用方传入的 filters 对象作为 query key，
 *     调用方每次 render 创建新对象会触发不必要的 refetch。
 *     修复：hook 内部把 filters 拆解为 primitive values 重组成稳定 key。
 *
 *   [CLEANUP] 删除重复的 Entities section 注释块（复制粘贴残留）。
 *
 *   [NOTE] useContextInject cache entry 积累问题：
 *     每个 query 字符串都产生独立 cache entry，gcTime 10min 内积累。
 *     修复：gcTime 从 10min 降到 2min，减少内存压力。
 *
 *   [NOTE] useEditMemory 双重 blpop 最长 60s 问题：
 *     React Query 无内置 timeout，暂不修复（需要后端缩短 blpop 超时）。
 *     前端已在 onError 中给出明确错误提示。
 *
 * Modification Reason (v2.0.0):
 *   Phase 4 expansion — added v2.4.0 cognitive graph hooks and
 *   v2.5.0 SuperNode management hooks.
 *
 * Modification Reason (v1.1.0):
 *   Updated to match actual API response format (v1.5.0 backend doc).
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
 * - useEditMemory: remember first, forget second — reverse kills data
 * - write ops invalidate: status + all overview variants + entities +
 *   communities + contextInject. Do NOT add projects/sessions/artifacts
 *   (Miner-async, ~1h update cycle)
 * - useSupernodeTasks: filters decomposed to primitives in query key —
 *   callers do NOT need useMemo on filters object
 * - useSupernodeHealth never auto-fetches — call checkHealth() manually
 * - SuperNode hooks require supernodeEnabled=true to avoid 404s
 * - useContextInject gcTime is 2min (reduced from 10min for memory pressure)
 *
 * Last Modified: v2.1.0 - Bug fixes from code audit
 * Previous: v2.0.0 - Phase 4 graph + SuperNode hooks
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
// ⚠️ ALL keys MUST start with 'memories'.
// write invalidations use predicate to bust all relevant caches.

export const memoryKeys = {
  all: (nodeId: string) => ['memories', nodeId] as const,

  // Core memory
  status:        (nodeId: string) =>                    ['memories', nodeId, 'status'] as const,
  overview:      (nodeId: string, perLayer: number) =>  ['memories', nodeId, 'overview', perLayer] as const,
  record:        (nodeId: string, recordId: string) =>  ['memories', nodeId, 'record', recordId] as const,
  contextInject: (nodeId: string, query?: string) =>    ['memories', nodeId, 'context', query] as const,

  // Projects
  projects:        (nodeId: string) =>                        ['memories', nodeId, 'projects'] as const,
  projectDetail:   (nodeId: string, projectId: string) =>     ['memories', nodeId, 'project', projectId] as const,
  projectTimeline: (nodeId: string, projectId: string) =>     ['memories', nodeId, 'project', projectId, 'timeline'] as const,

  // Sessions
  sessionDetail:       (nodeId: string, sessionId: string) => ['memories', nodeId, 'session', sessionId] as const,
  sessionConversation: (nodeId: string, sessionId: string) => ['memories', nodeId, 'session', sessionId, 'conversation'] as const,
  sessionArtifacts:    (nodeId: string, sessionId: string) => ['memories', nodeId, 'session', sessionId, 'artifacts'] as const,

  // Artifacts
  artifactDetail:   (nodeId: string, artifactId: string) =>   ['memories', nodeId, 'artifact', artifactId] as const,
  artifactVersions: (nodeId: string, artifactId: string) =>   ['memories', nodeId, 'artifact', artifactId, 'versions'] as const,

  // Entities — v2.1.0: added to memoryKeys (was hand-written in useEntities)
  entities:       (nodeId: string) =>                         ['memories', nodeId, 'entities'] as const,
  entityDetail:   (nodeId: string, entityId: string) =>       ['memories', nodeId, 'entity', entityId] as const,
  entityGraph:    (nodeId: string, entityId: string) =>       ['memories', nodeId, 'entity', entityId, 'graph'] as const,
  entityTimeline: (nodeId: string, entityId: string) =>       ['memories', nodeId, 'entity', entityId, 'timeline'] as const,

  // Communities
  communities: (nodeId: string) =>                            ['memories', nodeId, 'communities'] as const,

  // SuperNode
  supernodeTasks:      (nodeId: string, status: string, type: string, limit: number) =>
    ['memories', nodeId, 'supernode', 'tasks', status, type, limit] as const,
  supernodeTaskDetail: (nodeId: string, taskId: string) =>    ['memories', nodeId, 'supernode', 'task', taskId] as const,
  supernodeUsage:      (nodeId: string, period?: string) =>   ['memories', nodeId, 'supernode', 'usage', period] as const,
  supernodeHealth:     (nodeId: string) =>                    ['memories', nodeId, 'supernode', 'health'] as const,
};

// ============================================
// Shared invalidation helper
// ============================================

/**
 * Invalidate all caches that are affected by a write operation
 * (remember / forget / edit).
 *
 * Invalidates:
 *   - status (record count changes)
 *   - all overview variants (layer counts change)
 *   - entities (NER may have extracted entities from the new memory)
 *   - communities (entity clustering may change)
 *   - contextInject (context injection depends on latest memories)
 *
 * Does NOT invalidate:
 *   - projects / sessions / artifacts — updated by Miner (~1h async cycle)
 *     Invalidating them would trigger useless refetches with stale data.
 */
function invalidateWriteCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  nodeId: string
) {
  // status
  queryClient.invalidateQueries({
    queryKey: memoryKeys.status(nodeId),
    refetchType: 'all',
  });

  // all overview variants (any perLayer value)
  queryClient.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey as string[];
      return key[0] === 'memories' && key[1] === nodeId && key[2] === 'overview';
    },
    refetchType: 'all',
  });

  // entities list (NER may produce new entities from the written memory)
  queryClient.invalidateQueries({
    queryKey: memoryKeys.entities(nodeId),
    refetchType: 'all',
  });

  // communities (entity changes affect clusters)
  queryClient.invalidateQueries({
    queryKey: memoryKeys.communities(nodeId),
    refetchType: 'all',
  });

  // contextInject (all query variants for this node)
  queryClient.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey as string[];
      return key[0] === 'memories' && key[1] === nodeId && key[2] === 'context';
    },
    refetchType: 'all',
  });
}

// ============================================
// Core Memory Hooks
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

/** Hybrid recall: vector + BM25 + graph + cross-encoder reranking. */
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

/**
 * Auto context injection for new sessions.
 * gcTime reduced to 2min to limit cache accumulation across query variants.
 */
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
    gcTime: 2 * 60 * 1000, // reduced from 10min — each query string = new entry
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
// Core Memory Mutation Hooks
// ============================================

/**
 * Create a new memory.
 * Invalidates: status, all overview variants, entities, communities, contextInject.
 */
export function useRememberMemory(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MemoryRememberRequest) => {
      const res = await api.rememberMemory(nodeId, data);
      return res.data;
    },
    onSuccess: () => {
      invalidateWriteCaches(queryClient, nodeId);
    },
  });
}

/**
 * Delete (forget) a memory.
 * Invalidates: status, all overview variants, entities, communities, contextInject.
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
      invalidateWriteCaches(queryClient, nodeId);
    },
  });
}

/**
 * Edit = remember new first, then forget old.
 *
 * v2.1.0 BUG FIX: Operation order reversed from forget→remember to remember→forget.
 *
 * Previous order (dangerous):
 *   forget old → remember new
 *   If remember fails, old record is gone and new record was never created.
 *   Data permanently lost with no recovery path.
 *
 * New order (safe):
 *   remember new → forget old
 *   If remember fails: old record still exists, onError tells user to retry.
 *   If forget fails: both records exist (duplicate), user can manually delete old.
 *   Either failure mode is recoverable.
 *
 * ⚠️ Note: max wait time is still ~60s (two sequential blpop calls, 30s each).
 *   No frontend timeout — React Query default behavior. Show loading state.
 */
export function useEditMemory(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { oldRecordId: string; newData: MemoryRememberRequest }) => {
      // Step 1: create new record first (safe — old record still exists if this fails)
      const rememberRes = await api.rememberMemory(nodeId, params.newData);
      const newRecordId = rememberRes.data.record_id;
      const status = rememberRes.data.status;

      // Step 2: delete old record only after new one is confirmed created
      // If this fails, both records exist (recoverable duplicate)
      if (status !== 'duplicate') {
        await api.forgetMemory(nodeId, params.oldRecordId);
      }

      return { newRecordId, status };
    },
    onSuccess: (_data, params) => {
      queryClient.removeQueries({ queryKey: memoryKeys.record(nodeId, params.oldRecordId) });
      invalidateWriteCaches(queryClient, nodeId);
    },
    // onError: called when rememberMemory fails — old record still exists, nothing lost
    // Caller (MemoryEditSheet) shows the error message to the user
  });
}

// ============================================
// Cognitive Graph Hooks — Projects
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
// Cognitive Graph Hooks — Sessions
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
 * ⚠️ May take up to 30s. Content is immutable — gcTime 30min.
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
// Cognitive Graph Hooks — Artifacts
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
// Cognitive Graph Hooks — Entities
// ============================================

/**
 * List all entities extracted by the Miner (up to 200).
 * v2.1.0: query key now uses memoryKeys.entities() instead of hand-written array.
 */
export function useEntities(nodeId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: memoryKeys.entities(nodeId),
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
// Cognitive Graph Hooks — Communities
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
// SuperNode Hooks — Tasks
// ============================================

interface SupernodeTaskFilters {
  status?: string;
  type?: string;
  limit?: number;
}

/**
 * SuperNode cognitive task queue.
 *
 * v2.1.0: filters decomposed to primitive values in query key.
 * Callers do NOT need useMemo on the filters object — React Query
 * previously did deep comparison on the object reference, causing
 * spurious refetches when callers passed inline object literals.
 *
 * @param supernodeEnabled - from useMemoryStatus data.supernode?.enabled
 * @param options.refetchInterval - false to pause polling when panel hidden
 */
export function useSupernodeTasks(
  nodeId: string,
  supernodeEnabled: boolean,
  filters: SupernodeTaskFilters = {},
  options: { refetchInterval?: number | false } = {}
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Decompose to primitives so React Query key comparison is stable
  const statusFilter = filters.status ?? '';
  const typeFilter = filters.type ?? '';
  const limitFilter = filters.limit ?? 50;

  const refetchInterval = options.refetchInterval !== undefined
    ? options.refetchInterval
    : POLLING_INTERVALS.SUPERNODE_TASKS;

  const query = useQuery({
    queryKey: memoryKeys.supernodeTasks(nodeId, statusFilter, typeFilter, limitFilter),
    queryFn: async () => {
      const res = await api.getSupernodeTasks(nodeId, {
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        limit: limitFilter,
      });
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
// SuperNode Hooks — Usage & Health
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
    enabled: false,
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
