/**
 * ============================================
 * AeroNyx Privacy Network - API Client
 * ============================================
 * File Path: lib/api.ts
 *
 * Creation Reason: Centralized API client for all backend communications
 * Modification Reason:
 *   v1.4.0 - Added public node pool methods + updated updateNode signature:
 *     New methods (all skipAuth: true — no API Key needed):
 *       getPublicNodes(params)   → GET /nodes/public/
 *       getPublicNodeDetail(id)  → GET /nodes/public/{id}/
 *       verifyNodeAccess(id, pw) → POST /nodes/{id}/verify_access/
 *     Updated:
 *       updateNode data param changed from { name?, is_active? }
 *       to NodeUpdateRequest (includes visibility / region / city / vpn)
 *   v1.3.0 - Added MemChain MPI v2.4.0 + v2.5.0 methods
 *   v1.2.0 - Added MemChain MPI methods for Memory Explorer
 *   v1.1.0 - Added Agent lifecycle API methods for Phase 1
 *   v1.0.3 - Fixed auth endpoints sending stale Authorization header
 *
 * Dependencies:
 *   - types/index.ts
 *   - types/agent.ts
 *   - types/memory.ts
 *   - lib/constants.ts
 *
 * Main Logical Flow:
 * 1. All requests go through request() which adds headers and handles errors
 * 2. Auth endpoints use skipAuth: true
 * 3. Public node pool endpoints use skipAuth: true (genuinely public)
 * 4. 401 responses trigger logout event and clear localStorage
 * 5. Authenticated endpoints automatically include Bearer token
 *
 * ⚠️ Important Note for Next Developer:
 * - getPublicNodes / getPublicNodeDetail / verifyNodeAccess MUST keep
 *   skipAuth: true — these endpoints have no auth requirement on the backend
 * - updateNode now accepts NodeUpdateRequest — do NOT revert to narrow type
 * - access_password in NodeUpdateRequest:
 *     undefined → don't send the key (password unchanged)
 *     ""        → send empty string (clear password)
 *     "xyz"     → send string (set new password)
 *   The request() method strips undefined keys via JSON.stringify naturally,
 *   but we must explicitly handle this in updateNode to avoid sending the key
 *   when the caller doesn't intend to change the password.
 * - MPI endpoints all require auth — do NOT use skipAuth
 * - getNonce and login MUST use skipAuth: true
 *
 * Last Modified: v1.4.0 - Public node pool methods + NodeUpdateRequest type
 * Previous: v1.3.0 - MPI v2.4.0 graph + v2.5.0 SuperNode methods
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
  NodeUpdateRequest,
  PublicNodeListResponse,
  PublicNodeDetailResponse,
  VerifyAccessRequest,
  VerifyAccessResponse,
  PublicNodesParams,
  SessionListResponse,
  SuccessResponse,
  NodeStatus,
} from '@/types';

import {
  AgentStatusResponse,
  AgentActionResponse,
  InstallAgentRequest,
  AgentType,
} from '@/types/agent';

import {
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
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        // Preserve requires_password flag for 403 on password_protected nodes
        const err = new Error(
          errorData.error || errorData.detail || 'Request failed'
        ) as Error & { requires_password?: boolean; statusCode?: number };
        err.requires_password = errorData.requires_password ?? false;
        err.statusCode = response.status;
        throw err;
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Network error. Please check your connection.');
    }
  }

  // ============================================
  // Authentication (skipAuth: true)
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
  // Registration Codes
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
  // Owner Node Management (API Key required)
  // ============================================

  async getNodes(status?: NodeStatus): Promise<NodeListResponse> {
    const endpoint = status
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

  /**
   * Update node settings.
   * v1.4.0: data is now NodeUpdateRequest — supports visibility, region,
   * city, is_vpn_node, access_password in addition to name and is_active.
   *
   * access_password handling:
   *   - Do NOT include the key if you don't want to change the password
   *   - Include "" to clear the password
   *   - Include "xyz" to set a new password
   */
  async updateNode(
    nodeId: string,
    data: NodeUpdateRequest
  ): Promise<NodeDetailResponse> {
    // Build payload: only include access_password key when explicitly provided
    // (undefined values are stripped by JSON.stringify, which is correct behavior)
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
  // Public Node Pool (skipAuth: true — no API Key needed) [v1.4.0]
  // ============================================

  /**
   * Browse the public node pool.
   * No authentication required — public nodes are genuinely public.
   *
   * @param params.region  ISO 3166-1 alpha-2, e.g. 'JP'
   * @param params.vpn     true = VPN nodes only
   * @param params.status  'online' | 'offline' (default: 'online')
   * @param params.page    page number, page_size=20
   */
  async getPublicNodes(
    params: PublicNodesParams = {}
  ): Promise<PublicNodeListResponse> {
    const qs = new URLSearchParams();
    if (params.region) qs.append('region', params.region);
    if (params.vpn !== undefined) qs.append('vpn', String(params.vpn));
    if (params.status) qs.append('status', params.status);
    if (params.page && params.page > 1) qs.append('page', String(params.page));

    const query = qs.toString();
    const endpoint = query
      ? `${API_ENDPOINTS.NODES_PUBLIC_LIST}?${query}`
      : API_ENDPOINTS.NODES_PUBLIC_LIST;

    return this.request<PublicNodeListResponse>(endpoint, {
      method: 'GET',
      skipAuth: true,
    });
  }

  /**
   * Get a single public node's detail.
   * No authentication required.
   * Returns 403 + requires_password: true for password_protected nodes
   * that haven't been unlocked yet (session-based grant).
   */
  async getPublicNodeDetail(nodeId: string): Promise<PublicNodeDetailResponse> {
    return this.request<PublicNodeDetailResponse>(
      API_ENDPOINTS.NODES_PUBLIC_DETAIL(nodeId),
      { method: 'GET', skipAuth: true }
    );
  }

  /**
   * Verify access password for a password_protected node.
   * No authentication required — anonymous users can unlock nodes too.
   * On success, the server stores a session grant (cookie-based).
   * Subsequent calls to getPublicNodeDetail will succeed without re-verification.
   */
  async verifyNodeAccess(
    nodeId: string,
    data: VerifyAccessRequest
  ): Promise<VerifyAccessResponse> {
    return this.request<VerifyAccessResponse>(
      API_ENDPOINTS.NODE_VERIFY_ACCESS(nodeId),
      { method: 'POST', body: JSON.stringify(data), skipAuth: true }
    );
  }

  // ============================================
  // Sessions
  // ============================================

  async getNodeSessions(
    nodeId: string,
    options?: { status?: 'active' | 'completed' | 'error'; limit?: number }
  ): Promise<SessionListResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    const qs = params.toString();
    const endpoint = qs
      ? `${API_ENDPOINTS.NODE_SESSIONS(nodeId)}?${qs}`
      : API_ENDPOINTS.NODE_SESSIONS(nodeId);
    return this.request<SessionListResponse>(endpoint, { method: 'GET' });
  }

  // ============================================
  // Agent Lifecycle (Phase 1)
  // ============================================

  async getAgentStatus(
    nodeId: string,
    agentType?: AgentType
  ): Promise<AgentStatusResponse> {
    const params = new URLSearchParams();
    if (agentType) params.append('agent_type', agentType);
    const qs = params.toString();
    const endpoint = qs
      ? `${API_ENDPOINTS.AGENT_STATUS(nodeId)}?${qs}`
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

  async getMemoryStatus(nodeId: string): Promise<MemoryStatusResponse> {
    return this.request<MemoryStatusResponse>(API_ENDPOINTS.MPI_STATUS(nodeId), { method: 'GET' });
  }

  async getMemoryOverview(nodeId: string, perLayer: number = 20): Promise<MemoryOverviewResponse> {
    const params = new URLSearchParams({ per_layer: String(perLayer) });
    return this.request<MemoryOverviewResponse>(
      `${API_ENDPOINTS.MPI_OVERVIEW(nodeId)}?${params}`,
      { method: 'GET' }
    );
  }

  async recallMemories(nodeId: string, data: MemoryRecallRequest): Promise<MemoryRecallResponse> {
    return this.request<MemoryRecallResponse>(
      API_ENDPOINTS.MPI_RECALL(nodeId),
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async recallMemoryDetail(
    nodeId: string,
    data: MemoryRecallDetailRequest
  ): Promise<MemoryRecallDetailResponse> {
    return this.request<MemoryRecallDetailResponse>(
      API_ENDPOINTS.MPI_RECALL_DETAIL(nodeId),
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async searchMemories(nodeId: string, data: MemorySearchRequest): Promise<MemorySearchResponse> {
    return this.request<MemorySearchResponse>(
      API_ENDPOINTS.MPI_SEARCH(nodeId),
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async searchMemoriesFts(nodeId: string, q: string): Promise<FtsSearchResponse> {
    const params = new URLSearchParams({ q });
    return this.request<FtsSearchResponse>(
      `${API_ENDPOINTS.MPI_SEARCH_FTS(nodeId)}?${params}`,
      { method: 'GET' }
    );
  }

  async getMemoryRecord(nodeId: string, recordId: string): Promise<MemoryRecordResponse> {
    return this.request<MemoryRecordResponse>(
      API_ENDPOINTS.MPI_RECORD(nodeId, recordId),
      { method: 'GET' }
    );
  }

  async rememberMemory(nodeId: string, data: MemoryRememberRequest): Promise<MemoryRememberResponse> {
    return this.request<MemoryRememberResponse>(
      API_ENDPOINTS.MPI_REMEMBER(nodeId),
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async forgetMemory(nodeId: string, recordId: string): Promise<MemoryForgetResponse> {
    return this.request<MemoryForgetResponse>(
      API_ENDPOINTS.MPI_FORGET(nodeId),
      { method: 'POST', body: JSON.stringify({ record_id: recordId }) }
    );
  }

  async embedText(nodeId: string, text: string): Promise<MemoryEmbedResponse> {
    return this.request<MemoryEmbedResponse>(
      API_ENDPOINTS.MPI_EMBED(nodeId),
      { method: 'POST', body: JSON.stringify({ text }) }
    );
  }

  async getContextInject(nodeId: string, query?: string): Promise<ContextInjectResponse> {
    const params = query ? `?${new URLSearchParams({ query })}` : '';
    return this.request<ContextInjectResponse>(
      `${API_ENDPOINTS.MPI_CONTEXT_INJECT(nodeId)}${params}`,
      { method: 'GET' }
    );
  }

  // ============================================
  // MemChain MPI — Cognitive Graph (v2.4.0)
  // ============================================

  async getProjects(nodeId: string): Promise<ProjectListResponse> {
    return this.request<ProjectListResponse>(API_ENDPOINTS.MPI_PROJECTS(nodeId), { method: 'GET' });
  }

  async getProjectDetail(nodeId: string, projectId: string): Promise<ProjectDetailResponse> {
    return this.request<ProjectDetailResponse>(
      API_ENDPOINTS.MPI_PROJECT_DETAIL(nodeId, projectId), { method: 'GET' }
    );
  }

  async getProjectTimeline(nodeId: string, projectId: string): Promise<ProjectTimelineResponse> {
    return this.request<ProjectTimelineResponse>(
      API_ENDPOINTS.MPI_PROJECT_TIMELINE(nodeId, projectId), { method: 'GET' }
    );
  }

  async getSessionDetail(nodeId: string, sessionId: string): Promise<SessionDetailResponse> {
    return this.request<SessionDetailResponse>(
      API_ENDPOINTS.MPI_SESSION_DETAIL(nodeId, sessionId), { method: 'GET' }
    );
  }

  async getSessionConversation(nodeId: string, sessionId: string): Promise<SessionConversationResponse> {
    return this.request<SessionConversationResponse>(
      API_ENDPOINTS.MPI_SESSION_CONVERSATION(nodeId, sessionId), { method: 'GET' }
    );
  }

  async getSessionArtifacts(nodeId: string, sessionId: string): Promise<SessionArtifactsResponse> {
    return this.request<SessionArtifactsResponse>(
      API_ENDPOINTS.MPI_SESSION_ARTIFACTS(nodeId, sessionId), { method: 'GET' }
    );
  }

  async getArtifactDetail(nodeId: string, artifactId: string): Promise<ArtifactDetailResponse> {
    return this.request<ArtifactDetailResponse>(
      API_ENDPOINTS.MPI_ARTIFACT_DETAIL(nodeId, artifactId), { method: 'GET' }
    );
  }

  async getArtifactVersions(nodeId: string, artifactId: string): Promise<ArtifactVersionsResponse> {
    return this.request<ArtifactVersionsResponse>(
      API_ENDPOINTS.MPI_ARTIFACT_VERSIONS(nodeId, artifactId), { method: 'GET' }
    );
  }

  async getEntities(nodeId: string): Promise<EntityListResponse> {
    return this.request<EntityListResponse>(API_ENDPOINTS.MPI_ENTITIES(nodeId), { method: 'GET' });
  }

  async getEntityDetail(nodeId: string, entityId: string): Promise<EntityDetailResponse> {
    return this.request<EntityDetailResponse>(
      API_ENDPOINTS.MPI_ENTITY_DETAIL(nodeId, entityId), { method: 'GET' }
    );
  }

  async getEntityGraph(nodeId: string, entityId: string): Promise<EntityGraphResponse> {
    return this.request<EntityGraphResponse>(
      API_ENDPOINTS.MPI_ENTITY_GRAPH(nodeId, entityId), { method: 'GET' }
    );
  }

  async getEntityTimeline(nodeId: string, entityId: string): Promise<EntityTimelineResponse> {
    return this.request<EntityTimelineResponse>(
      API_ENDPOINTS.MPI_ENTITY_TIMELINE(nodeId, entityId), { method: 'GET' }
    );
  }

  async getCommunities(nodeId: string): Promise<CommunityListResponse> {
    return this.request<CommunityListResponse>(
      API_ENDPOINTS.MPI_COMMUNITIES(nodeId), { method: 'GET' }
    );
  }

  // ============================================
  // MemChain MPI — SuperNode Management (v2.5.0)
  // ============================================

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

  async getSupernodeTaskDetail(nodeId: string, taskId: string): Promise<SupernodeTaskDetailResponse> {
    return this.request<SupernodeTaskDetailResponse>(
      API_ENDPOINTS.MPI_SUPERNODE_TASK_DETAIL(nodeId, taskId), { method: 'GET' }
    );
  }

  async retrySupernodeTask(nodeId: string, taskId: string): Promise<SupernodeTaskActionResponse> {
    return this.request<SupernodeTaskActionResponse>(
      API_ENDPOINTS.MPI_SUPERNODE_TASK_RETRY(nodeId, taskId),
      { method: 'POST', body: JSON.stringify({}) }
    );
  }

  async cancelSupernodeTask(nodeId: string, taskId: string): Promise<SupernodeTaskActionResponse> {
    return this.request<SupernodeTaskActionResponse>(
      API_ENDPOINTS.MPI_SUPERNODE_TASK_CANCEL(nodeId, taskId),
      { method: 'POST', body: JSON.stringify({}) }
    );
  }

  async getSupernodeUsage(nodeId: string, period?: string): Promise<SupernodeUsageResponse> {
    const params = period ? `?${new URLSearchParams({ period })}` : '';
    return this.request<SupernodeUsageResponse>(
      `${API_ENDPOINTS.MPI_SUPERNODE_USAGE(nodeId)}${params}`,
      { method: 'GET' }
    );
  }

  async getSupernodeHealth(nodeId: string): Promise<SupernodeHealthResponse> {
    return this.request<SupernodeHealthResponse>(
      API_ENDPOINTS.MPI_SUPERNODE_HEALTH(nodeId), { method: 'GET' }
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
