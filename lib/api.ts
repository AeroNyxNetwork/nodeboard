/**
 * ============================================
 * AeroNyx Privacy Network - API Client
 * ============================================
 * File Path: lib/api.ts
 *
 * Creation Reason: Centralized API client for all backend communications
 * Modification Reason:
 *   v1.1.0 - Added Agent lifecycle API methods for Phase 1:
 *     - getAgentStatus(nodeId, agentType?) — GET /nodes/{id}/agent_status/
 *     - installAgent(nodeId, data?) — POST /nodes/{id}/install_agent/
 *     - startAgent(nodeId) — POST /nodes/{id}/start_agent/
 *     - stopAgent(nodeId) — POST /nodes/{id}/stop_agent/
 *     - restartAgent(nodeId) — POST /nodes/{id}/restart_agent/
 *     - uninstallAgent(nodeId) — POST /nodes/{id}/uninstall_agent/
 *     All methods use existing auth flow (Bearer token).
 *   v1.0.3 - Fixed auth endpoints (getNonce, login) sending stale Authorization
 *     header. These are public endpoints that should NOT include Bearer token.
 *     When a stale/expired API key exists in localStorage, the backend returns
 *     401 which triggers "Session expired" before login can complete.
 *     Added `skipAuth` option to request() for public endpoints.
 * Dependencies:
 *   - types/index.ts (type definitions)
 *   - types/agent.ts (agent type definitions — Phase 1)
 *   - lib/constants.ts (API endpoints and config)
 *
 * Main Logical Flow:
 * 1. All requests go through request() which adds headers and handles errors
 * 2. Auth endpoints (getNonce, login) use skipAuth: true to avoid sending tokens
 * 3. 401 responses trigger logout event and clear localStorage
 * 4. Authenticated endpoints automatically include Bearer token from localStorage
 * 5. Agent endpoints follow the same authenticated pattern
 *
 * ⚠️ Important Note for Next Developer:
 * - getNonce and login MUST use skipAuth: true — they are pre-auth endpoints
 * - If you add new public endpoints, also use skipAuth: true
 * - The 401 handler dispatches 'auth:logout' custom event, listened by authStore
 * - Do not change the error message format without updating authStore error handling
 * - Agent endpoints all require auth — do NOT use skipAuth
 * - installAgent accepts optional body; backend defaults agent_type to "openclaw"
 *
 * Last Modified: v1.1.0 - Added Agent lifecycle API methods for Phase 1
 * Previous: v1.0.3 - Fixed stale auth header on public endpoints
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

    // Only add Authorization header for authenticated endpoints
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

      // Only trigger session expiry for AUTHENTICATED endpoints
      // Public endpoints (skipAuth: true) should not trigger logout
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
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
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
    options?: {
      status?: 'active' | 'completed' | 'error';
      limit?: number;
    }
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

  /**
   * Get agent status for a node.
   * @param nodeId - Node UUID
   * @param agentType - Optional filter by agent type (e.g. "openclaw").
   *                    If omitted, returns all agents on the node.
   */
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

  /**
   * Install agent on a node.
   * All fields in the request body are optional.
   * Backend defaults: agent_type="openclaw", version="latest"
   */
  async installAgent(
    nodeId: string,
    data?: InstallAgentRequest
  ): Promise<AgentActionResponse> {
    return this.request<AgentActionResponse>(
      API_ENDPOINTS.AGENT_INSTALL(nodeId),
      {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }
    );
  }

  /**
   * Start an installed agent on a node.
   */
  async startAgent(
    nodeId: string,
    agentType: AgentType = 'openclaw'
  ): Promise<AgentActionResponse> {
    return this.request<AgentActionResponse>(
      API_ENDPOINTS.AGENT_START(nodeId),
      {
        method: 'POST',
        body: JSON.stringify({ agent_type: agentType }),
      }
    );
  }

  /**
   * Stop a running agent on a node.
   */
  async stopAgent(
    nodeId: string,
    agentType: AgentType = 'openclaw'
  ): Promise<AgentActionResponse> {
    return this.request<AgentActionResponse>(
      API_ENDPOINTS.AGENT_STOP(nodeId),
      {
        method: 'POST',
        body: JSON.stringify({ agent_type: agentType }),
      }
    );
  }

  /**
   * Restart a running agent on a node.
   */
  async restartAgent(
    nodeId: string,
    agentType: AgentType = 'openclaw'
  ): Promise<AgentActionResponse> {
    return this.request<AgentActionResponse>(
      API_ENDPOINTS.AGENT_RESTART(nodeId),
      {
        method: 'POST',
        body: JSON.stringify({ agent_type: agentType }),
      }
    );
  }

  /**
   * Uninstall an agent from a node.
   */
  async uninstallAgent(
    nodeId: string,
    agentType: AgentType = 'openclaw'
  ): Promise<AgentActionResponse> {
    return this.request<AgentActionResponse>(
      API_ENDPOINTS.AGENT_UNINSTALL(nodeId),
      {
        method: 'POST',
        body: JSON.stringify({ agent_type: agentType }),
      }
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
