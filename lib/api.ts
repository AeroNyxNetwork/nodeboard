/**
 * ============================================
 * AeroNyx Privacy Network - API Client
 * ============================================
 * File Path: lib/api.ts
 *
 * Creation Reason: Centralized API client for all backend communications
 * Modification Reason:
 *   v1.3.0 - Added MemChain MPI v2.4.0 + v2.5.0 methods:
 *     v2.4.0 认知图谱方法:
 *       recallMemories (hybrid recall with mode support),
 *       recallMemoryDetail (progressive retrieval step 2),
 *       searchMemoriesFts (FTS5 keyword search),
 *       getProjects, getProjectDetail, getProjectTimeline,
 *       getSessionDetail, getSessionConversation, getSessionArtifacts,
 *       getArtifactDetail, getArtifactVersions,
 *       getEntityDetail, getEntityGraph, getEntityTimeline,
 *       getCommunities, getContextInject
 *     v2.5.0 SuperNode 管理方法:
 *       getSupernodeTasks, getSupernodeTaskDetail,
 *       retrySupernodeTask, cancelSupernodeTask,
 *       getSupernodeUsage, getSupernodeHealth
 *     新增 import: GraphResponse types + SuperNode types from types/memory.ts
 *   v1.2.0 - Added MemChain MPI methods for Memory Explorer:
 *     getMemoryStatus, getMemoryOverview, searchMemories,
 *     getMemoryRecord, rememberMemory, forgetMemory, embedText
 *     All MPI methods require auth and an online node.
 *   v1.1.0 - Added Agent lifecycle API methods for Phase 1
 *   v1.0.3 - Fixed auth endpoints sending stale Authorization header
 *
 * Dependencies:
 *   - types/index.ts (type definitions)
 *   - types/agent.ts (agent type definitions — Phase 1)
 *   - types/memory.ts (memory type definitions — v1.2.0+)
 *   - lib/constants.ts (API endpoints and config)
 *
 * Main Logical Flow:
 * 1. All requests go through request() which adds headers and handles errors
 * 2. Auth endpoints (getNonce, login) use skipAuth: true to avoid sending tokens
 * 3. 401 responses trigger logout event and clear localStorage
 * 4. Authenticated endpoints automatically include Bearer token from localStorage
 * 5. Agent endpoints follow the same authenticated pattern
 * 6. MPI core endpoints follow the same pattern; expect 503/504 on offline nodes
 * 7. MPI graph endpoints (v2.4.0) return structured cognitive graph data
 * 8. SuperNode endpoints (v2.5.0) return task queue and provider health data
 *
 * ⚠️ Important Note for Next Developer:
 * - getNonce and login MUST use skipAuth: true — they are pre-auth endpoints
 * - If you add new public endpoints, also use skipAuth: true
 * - The 401 handler dispatches 'auth:logout' custom event, listened by authStore
 * - Do not change the error message format without updating authStore error handling
 * - Agent endpoints all require auth — do NOT use skipAuth
 * - MPI endpoints all require auth — do NOT use skipAuth
 * - MPI core requests may take 1-3s (search involves embedding)
 * - MPI session conversation may take up to 30s (decryption of large sessions)
 * - MPI SuperNode health may take up to 15s (pings external LLM providers)
 *   — useMemory.ts sets appropriate timeouts for these
 * - recallMemories supports mode='index' for progressive retrieval:
 *   Step 1 call recallMemories({mode:'index', ...}) → returns record IDs
 *   Step 2 call recallMemoryDetail({record_ids: [...]}) → returns full content
 *
 * Last Modified: v1.3.0 - Added MPI v2.4.0 graph + v2.5.0 SuperNode methods
 * Previous: v1.2.0 - Added MPI endpoints for Memory Explorer
 * ============================================
 */

import {
  NonceResponse,
  LoginRequest,
  LoginResponse,
  GenerateCodeResponse,
  CodeListResponse,
  NodeListResponse,
  NodeDetailResponse,
  NodeStatusResponse,
  NodeStatsResponse,
  SessionListResponse,
  SuccessResponse,
  ApiError,
  NodeStatus,
} from '@/types';

import {
  AgentStatusResponse,
  AgentActionResponse,
  InstallAgentRequest,
  AgentType,
} from '@/types/agent';

import {
  // Core memory types (v1.2.0)
  MemoryStatusResponse,
  MemoryOverviewResponse,
  MemorySearchRequest,
  MemorySearchResponse,
  MemoryRecallRequest,
  MemoryRecallResponse,
  MemoryRecallDetailRequest,
  MemoryRecallDetailResponse,
  MemoryRecordResponse,
  MemoryRememberRequest,
  MemoryRememberResponse,
  MemoryForgetResponse,
  MemoryEmbedResponse,
  // Cognitive graph types (v1.3.0 / v2.4.0 backend)
  EntityListResponse,
  ProjectListResponse,
  ProjectDetailResponse,
  ProjectTimelineResponse,
  SessionDetailResponse,
  SessionConversationResponse,
  SessionArtifactsResponse,
  ArtifactDetailResponse,
  ArtifactVersionsResponse,
  EntityDetailResponse,
  EntityGraphResponse,
  EntityTimelineResponse,
  CommunityListResponse,
  ContextInjectResponse,
  FtsSearchResponse,
  // SuperNode types (v1.3.0 / v2.5.0 backend)
  SupernodeTasksResponse,
  SupernodeTaskDetailResponse,
  SupernodeTaskActionResponse,
  SupernodeUsageResponse,
  SupernodeHealthResponse,
} from '@/types/memory';

import { API_BASE_URL, API_ENDPOINTS, STORAGE_KEYS } from './constants';

// ============================================
// Extended Request Options
// ============================================

interface ApiRequestOptions extends RequestInit {
  /** If true, do NOT include Authorization header. Use for public endpoints. */
  skipAuth?: boolean;
}

// ============================================
// API Client Class
// ============================================

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getApiKey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.API_KEY);
  }

  private getAuthHeaders(skipAuth: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (!skipAuth) {
      const apiKey = this.getApiKey();
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      ...fetchOptions,
      headers: {
        ...this.getAuthHeaders(skipAuth),
        ...fetchOptions.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401 && !skipAuth) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEYS.API_KEY);
          localStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESS);
          localStorage.removeItem(STORAGE_KEYS.WALLET_TYPE);
          window.dispatchEvent(new CustomEvent('auth:logout'));
        }
        throw new Error('Session expired. Please reconnect your wallet.');
      }

      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || errorData.detail || 'Request failed');
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error. Please check your connection.');
    }
  }

  // ============================================
  // Authentication Endpoints (Public - no auth header)
  // ============================================

  async getNonce(walletAddress: string): Promise<NonceResponse> {
    const params = new URLSearchParams({ wallet_address: walletAddress });
    return this.request<NonceResponse>(
      `${API_ENDPOINTS.AUTH_NONCE}?${params}`,
      { method: 'GET', skipAuth: true }
    );
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>(API_ENDPOINTS.AUTH_LOGIN, {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
  }

  // ============================================
  // Registration Code Endpoints
  // ============================================

  async generateCode(): Promise<GenerateCodeResponse> {
    return this.request<GenerateCodeResponse>(API_ENDPOINTS.CODES_GENERATE, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getCodes(includeExpired: boolean = false): Promise<CodeListResponse> {
    const params = new URLSearchParams({
      include_expired: String(includeExpired),
    });
    return this.request<CodeListResponse>(
      `${API_ENDPOINTS.CODES_LIST}?${params}`,
      { method: 'GET' }
    );
  }

  async revokeCode(code: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(API_ENDPOINTS.CODES_REVOKE, {
      method: 'DELETE',
      body: JSON.stringify({ code }),
    });
  }

  // ============================================
  // Node Management Endpoints
  // ============================================

  async getNodes(status?: NodeStatus): Promise<NodeListResponse> {
    const endpoint: string = status
      ? `${API_ENDPOINTS.NODES_LIST}?${new URLSearchParams({ status })}`
      : API_ENDPOINTS.NODES_LIST;
    return this.request<NodeListResponse>(endpoint, { method: 'GET' });
  }

  async getNodeDetail(nodeId: string): Promise<NodeDetailResponse> {
    return this.request<NodeDetailResponse>(
      API_ENDPOINTS.NODE_DETAIL(nodeId),
      { method: 'GET' }
    );
  }

  async getNodeStatus(nodeId: string): Promise<NodeStatusResponse> {
    return this.request<NodeStatusResponse>(
      API_ENDPOINTS.NODE_STATUS(nodeId),
      { method: 'GET' }
    );
  }

  async getNodeStats(nodeId: string, days: number = 7): Promise<NodeStatsResponse> {
    const params = new URLSearchParams({ days: String(days) });
    return this.request<NodeStatsResponse>(
      `${API_ENDPOINTS.NODE_STATS(nodeId)}?${params}`,
      { method: 'GET' }
    );
  }

  async updateNode(
    nodeId: string,
    data: { name?: string; is_active?: boolean }
  ): Promise<NodeDetailResponse> {
    return this.request<NodeDetailResponse>(
      API_ENDPOINTS.NODE_DETAIL(nodeId),
      { method: 'PATCH', body: JSON.stringify(data) }
    );
  }

  async deleteNode(nodeId: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(
      API_ENDPOINTS.NODE_DETAIL(nodeId),
      { method: 'DELETE' }
    );
  }

  // ============================================
  // Session Endpoints
  // ============================================

  async getNodeSessions(
    nodeId: string,
    options?: { status?: 'active' | 'completed' | 'error'; limit?: number }
  ): Promise<SessionListResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));

    const queryString = params.toString();
    const endpoint = queryString
      ? `${API_ENDPOINTS.NODE_SESSIONS(nodeId)}?${queryString}`
      : API_ENDPOINTS.NODE_SESSIONS(nodeId);

    return this.request<SessionListResponse>(endpoint, { method: 'GET' });
  }

  // ============================================
  // Agent Lifecycle Endpoints (Phase 1)
  // ============================================

  async getAgentStatus(
    nodeId: string,
    agentType?: AgentType
  ): Promise<AgentStatusResponse> {
    const params = new URLSearchParams();
    if (agentType) params.append('agent_type', agentType);
    const queryString = params.toString();
    const endpoint = queryString
      ? `${API_ENDPOINTS.AGENT_STATUS(nodeId)}?${queryString}`
      : API_ENDPOINTS.AGENT_STATUS(nodeId);
    return this.request<AgentStatusResponse>(endpoint, { method: 'GET' });
  }

  async installAgent(nodeId: string, data?: InstallAgentRequest): Promise<AgentActionResponse> {
    return this.request<AgentActionResponse>(API_ENDPOINTS.AGENT_INSTALL(nodeId), {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async startAgent(nodeId: string, agentType: AgentType = 'openclaw'): Promise<AgentActionResponse> {
    return this.request<AgentActionResponse>(API_ENDPOINTS.AGENT_START(nodeId), {
      method: 'POST',
      body: JSON.stringify({ agent_type: agentType }),
    });
  }

  async stopAgent(nodeId: string, agentType: AgentType = 'openclaw'): Promise<AgentActionResponse> {
    return this.request<AgentActionResponse>(API_ENDPOINTS.AGENT_STOP(nodeId), {
      method: 'POST',
      body: JSON.stringify({ agent_type: agentType }),
    });
  }

  async restartAgent(nodeId: string, agentType: AgentType = 'openclaw'): Promise<AgentActionResponse> {
    return this.request<AgentActionResponse>(API_ENDPOINTS.AGENT_RESTART(nodeId), {
      method: 'POST',
      body: JSON.stringify({ agent_type: agentType }),
    });
  }

  async uninstallAgent(nodeId: string, agentType: AgentType = 'openclaw'): Promise<AgentActionResponse> {
    return this.request<AgentActionResponse>(API_ENDPOINTS.AGENT_UNINSTALL(nodeId), {
      method: 'POST',
      body: JSON.stringify({ agent_type: agentType }),
    });
  }

  // ============================================
  // MemChain MPI — Core Memory (v1.2.0)
  // ============================================
  //
  // ⚠️ All MPI endpoints require auth and an online node.
  //   Expect 503 if node is offline, 504 if request times out (30s).
  //   Frontend should check node status before calling these.

  /** Get MemChain engine status and memory statistics. */
  async getMemoryStatus(nodeId: string): Promise<MemoryStatusResponse> {
    return this.request<MemoryStatusResponse>(
      API_ENDPOINTS.MPI_STATUS(nodeId),
      { method: 'GET' }
    );
  }

  /**
   * Get memory overview grouped by layer.
   * @param perLayer - Records per layer (default 20, max 50)
   */
  async getMemoryOverview(nodeId: string, perLayer: number = 20): Promise<MemoryOverviewResponse> {
    const params = new URLSearchParams({ per_layer: String(perLayer) });
    return this.request<MemoryOverviewResponse>(
      `${API_ENDPOINTS.MPI_OVERVIEW(nodeId)}?${params}`,
      { method: 'GET' }
    );
  }

  /**
   * Hybrid recall: vector + BM25 + graph + cross-encoder reranking.
   *
   * Supports two modes:
   *   mode='full'  (default) — returns complete memory content
   *   mode='index' — returns only record IDs (use recallMemoryDetail for content)
   *
   * Takes 1-3s (embedding + retrieval pipeline).
   */
  async recallMemories(nodeId: string, data: MemoryRecallRequest): Promise<MemoryRecallResponse> {
    return this.request<MemoryRecallResponse>(
      API_ENDPOINTS.MPI_RECALL(nodeId),
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  /**
   * Progressive retrieval step 2 — fetch full content for specific record IDs.
   * Used after recallMemories(mode='index') to load content on demand.
   */
  async recallMemoryDetail(
    nodeId: string,
    data: MemoryRecallDetailRequest
  ): Promise<MemoryRecallDetailResponse> {
    return this.request<MemoryRecallDetailResponse>(
      API_ENDPOINTS.MPI_RECALL_DETAIL(nodeId),
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  /**
   * Semantic search (embed + recall combo).
   * Pass plain text query; backend handles embedding automatically.
   * Takes 1-3s.
   */
  async searchMemories(nodeId: string, data: MemorySearchRequest): Promise<MemorySearchResponse> {
    return this.request<MemorySearchResponse>(
      API_ENDPOINTS.MPI_SEARCH(nodeId),
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  /**
   * FTS5 full-text keyword search with highlighted snippets.
   * Fast (< 30ms), exact keyword matching. Use for precise term lookup.
   * @param q - Search query string
   */
  async searchMemoriesFts(nodeId: string, q: string): Promise<FtsSearchResponse> {
    const params = new URLSearchParams({ q });
    return this.request<FtsSearchResponse>(
      `${API_ENDPOINTS.MPI_SEARCH_FTS(nodeId)}?${params}`,
      { method: 'GET' }
    );
  }

  /** Get a single memory record by ID. */
  async getMemoryRecord(nodeId: string, recordId: string): Promise<MemoryRecordResponse> {
    return this.request<MemoryRecordResponse>(
      API_ENDPOINTS.MPI_RECORD(nodeId, recordId),
      { method: 'GET' }
    );
  }

  /**
   * Create a new memory. Rust node auto-embeds the content.
   * Returns 'duplicate' status if content already exists.
   */
  async rememberMemory(nodeId: string, data: MemoryRememberRequest): Promise<MemoryRememberResponse> {
    return this.request<MemoryRememberResponse>(
      API_ENDPOINTS.MPI_REMEMBER(nodeId),
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  /** Delete (forget) a memory by record ID. Removes vector + FTS index too. */
  async forgetMemory(nodeId: string, recordId: string): Promise<MemoryForgetResponse> {
    return this.request<MemoryForgetResponse>(
      API_ENDPOINTS.MPI_FORGET(nodeId),
      { method: 'POST', body: JSON.stringify({ record_id: recordId }) }
    );
  }

  /**
   * Vectorize text (advanced usage).
   * Normally not called directly — /mpi/search/ handles embedding internally.
   */
  async embedText(nodeId: string, text: string): Promise<MemoryEmbedResponse> {
    return this.request<MemoryEmbedResponse>(
      API_ENDPOINTS.MPI_EMBED(nodeId),
      { method: 'POST', body: JSON.stringify({ text }) }
    );
  }

  /**
   * Get auto context injection for a new session.
   * Call at session start to pre-load relevant recent memories.
   * @param query - Optional topic hint for context retrieval
   */
  async getContextInject(nodeId: string, query?: string): Promise<ContextInjectResponse> {
    const params = query ? `?${new URLSearchParams({ query })}` : '';
    return this.request<ContextInjectResponse>(
      `${API_ENDPOINTS.MPI_CONTEXT_INJECT(nodeId)}${params}`,
      { method: 'GET' }
    );
  }

  // ============================================
  // MemChain MPI — Cognitive Graph (v1.3.0 / v2.4.0 backend)
  // ============================================

  /** List all projects (auto-detected from entity communities). */
  async getProjects(nodeId: string): Promise<ProjectListResponse> {
    return this.request<ProjectListResponse>(
      API_ENDPOINTS.MPI_PROJECTS(nodeId),
      { method: 'GET' }
    );
  }

  /** Get project detail including member entities and community info. */
  async getProjectDetail(nodeId: string, projectId: string): Promise<ProjectDetailResponse> {
    return this.request<ProjectDetailResponse>(
      API_ENDPOINTS.MPI_PROJECT_DETAIL(nodeId, projectId),
      { method: 'GET' }
    );
  }

  /** Get project session timeline grouped by date. */
  async getProjectTimeline(nodeId: string, projectId: string): Promise<ProjectTimelineResponse> {
    return this.request<ProjectTimelineResponse>(
      API_ENDPOINTS.MPI_PROJECT_TIMELINE(nodeId, projectId),
      { method: 'GET' }
    );
  }

  /**
   * Get session detail including LLM-generated title (v2.5.0 SuperNode).
   * Title may be null if SuperNode hasn't processed it yet.
   */
  async getSessionDetail(nodeId: string, sessionId: string): Promise<SessionDetailResponse> {
    return this.request<SessionDetailResponse>(
      API_ENDPOINTS.MPI_SESSION_DETAIL(nodeId, sessionId),
      { method: 'GET' }
    );
  }

  /**
   * Get full decrypted conversation replay.
   * ⚠️ May take up to 30s for long sessions (decryption cost).
   * Show loading state to the user.
   */
  async getSessionConversation(
    nodeId: string,
    sessionId: string
  ): Promise<SessionConversationResponse> {
    return this.request<SessionConversationResponse>(
      API_ENDPOINTS.MPI_SESSION_CONVERSATION(nodeId, sessionId),
      { method: 'GET' }
    );
  }

  /** Get code artifacts extracted from a session. */
  async getSessionArtifacts(nodeId: string, sessionId: string): Promise<SessionArtifactsResponse> {
    return this.request<SessionArtifactsResponse>(
      API_ENDPOINTS.MPI_SESSION_ARTIFACTS(nodeId, sessionId),
      { method: 'GET' }
    );
  }

  /** Get artifact detail. */
  async getArtifactDetail(nodeId: string, artifactId: string): Promise<ArtifactDetailResponse> {
    return this.request<ArtifactDetailResponse>(
      API_ENDPOINTS.MPI_ARTIFACT_DETAIL(nodeId, artifactId),
      { method: 'GET' }
    );
  }

  /** Get artifact version history. */
  async getArtifactVersions(nodeId: string, artifactId: string): Promise<ArtifactVersionsResponse> {
    return this.request<ArtifactVersionsResponse>(
      API_ENDPOINTS.MPI_ARTIFACT_VERSIONS(nodeId, artifactId),
      { method: 'GET' }
    );
  }

  /** List all entities extracted by the Miner (up to 200). */
  async getEntities(nodeId: string): Promise<EntityListResponse> {
    return this.request<EntityListResponse>(
      API_ENDPOINTS.MPI_ENTITIES(nodeId),
      { method: 'GET' }
    );
  }

  /** Get entity detail including all relationships. */
  async getEntityDetail(nodeId: string, entityId: string): Promise<EntityDetailResponse> {
    return this.request<EntityDetailResponse>(
      API_ENDPOINTS.MPI_ENTITY_DETAIL(nodeId, entityId),
      { method: 'GET' }
    );
  }

  /** Get entity BFS subgraph (2-hop traversal). */
  async getEntityGraph(nodeId: string, entityId: string): Promise<EntityGraphResponse> {
    return this.request<EntityGraphResponse>(
      API_ENDPOINTS.MPI_ENTITY_GRAPH(nodeId, entityId),
      { method: 'GET' }
    );
  }

  /** Get entity event timeline (when entity was mentioned across sessions). */
  async getEntityTimeline(nodeId: string, entityId: string): Promise<EntityTimelineResponse> {
    return this.request<EntityTimelineResponse>(
      API_ENDPOINTS.MPI_ENTITY_TIMELINE(nodeId, entityId),
      { method: 'GET' }
    );
  }

  /**
   * List all communities.
   * v2.5.0: communities may include LLM-generated narrative summaries.
   */
  async getCommunities(nodeId: string): Promise<CommunityListResponse> {
    return this.request<CommunityListResponse>(
      API_ENDPOINTS.MPI_COMMUNITIES(nodeId),
      { method: 'GET' }
    );
  }

  // ============================================
  // MemChain MPI — SuperNode Management (v1.3.0 / v2.5.0 backend)
  // ============================================
  //
  // ⚠️ These endpoints return 404 when supernode.enabled=false on the node.
  //   Check MemoryStatusResponse.data.supernode before showing the SuperNode panel.

  /**
   * List cognitive task queue.
   * @param options.status  - Filter: pending | processing | completed | failed | cancelled
   * @param options.type    - Filter: session_title | community_narrative | entity_description | ...
   * @param options.limit   - Max results (default 20, max 100)
   */
  async getSupernodeTasks(
    nodeId: string,
    options?: { status?: string; type?: string; limit?: number }
  ): Promise<SupernodeTasksResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.type) params.append('type', options.type);
    if (options?.limit) params.append('limit', String(options.limit));
    const qs = params.toString();
    return this.request<SupernodeTasksResponse>(
      qs
        ? `${API_ENDPOINTS.MPI_SUPERNODE_TASKS(nodeId)}?${qs}`
        : API_ENDPOINTS.MPI_SUPERNODE_TASKS(nodeId),
      { method: 'GET' }
    );
  }

  /** Get task detail including payload, result, prompt messages, and token usage. */
  async getSupernodeTaskDetail(
    nodeId: string,
    taskId: string
  ): Promise<SupernodeTaskDetailResponse> {
    return this.request<SupernodeTaskDetailResponse>(
      API_ENDPOINTS.MPI_SUPERNODE_TASK_DETAIL(nodeId, taskId),
      { method: 'GET' }
    );
  }

  /** Retry a failed or cancelled task (resets to pending). */
  async retrySupernodeTask(
    nodeId: string,
    taskId: string
  ): Promise<SupernodeTaskActionResponse> {
    return this.request<SupernodeTaskActionResponse>(
      API_ENDPOINTS.MPI_SUPERNODE_TASK_RETRY(nodeId, taskId),
      { method: 'POST', body: JSON.stringify({}) }
    );
  }

  /** Cancel a pending task. */
  async cancelSupernodeTask(
    nodeId: string,
    taskId: string
  ): Promise<SupernodeTaskActionResponse> {
    return this.request<SupernodeTaskActionResponse>(
      API_ENDPOINTS.MPI_SUPERNODE_TASK_CANCEL(nodeId, taskId),
      { method: 'POST', body: JSON.stringify({}) }
    );
  }

  /**
   * Get LLM usage statistics grouped by provider × task type.
   * @param period - Month filter in YYYY-MM format (e.g. '2026-03')
   */
  async getSupernodeUsage(nodeId: string, period?: string): Promise<SupernodeUsageResponse> {
    const params = period ? `?${new URLSearchParams({ period })}` : '';
    return this.request<SupernodeUsageResponse>(
      `${API_ENDPOINTS.MPI_SUPERNODE_USAGE(nodeId)}${params}`,
      { method: 'GET' }
    );
  }

  /**
   * Check SuperNode provider health (live ping to each LLM provider).
   * ⚠️ May take up to 15s (pings external providers). Show loading state.
   */
  async getSupernodeHealth(nodeId: string): Promise<SupernodeHealthResponse> {
    return this.request<SupernodeHealthResponse>(
      API_ENDPOINTS.MPI_SUPERNODE_HEALTH(nodeId),
      { method: 'GET' }
    );
  }
}

// ============================================
// Export Singleton Instance
// ============================================

export const api = new ApiClient(API_BASE_URL);

// ============================================
// Utility Functions
// ============================================

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

  return then.toLocaleDateString();
}

export function truncateAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}
