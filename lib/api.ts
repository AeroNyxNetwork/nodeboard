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
 *   v1.5.0 - Focused client methods on VPN operations
 *   v1.0.3 - Fixed auth endpoints sending stale Authorization header
 *
 * Dependencies:
 *   - types/index.ts
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
 * - getNonce and login MUST use skipAuth: true
 *
 * Last Modified: v1.5.0 - VPN-only nodeboard API client surface
 * Previous: v1.4.0 - Public node pool methods + NodeUpdateRequest type
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
  VpnOverviewResponse,
  VpnNodeMetricsResponse,
  VpnSessionListResponse,
  VpnBillingOverviewResponse,
  VpnEventsResponse,
  NodeWalletBanListResponse,
  NodeCommandListResponse,
  RunNodeCommandRequest,
  RunNodeCommandResponse,
  SuccessResponse,
  NodeStatus,
  SessionQualityStatus,
} from '@/types';

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

  async getVpnOverview(): Promise<VpnOverviewResponse> {
    return this.request<VpnOverviewResponse>(
      API_ENDPOINTS.VPN_OVERVIEW,
      { method: 'GET' }
    );
  }

  async getVpnNodeMetrics(
    nodeId: string,
    options?: { hours?: number }
  ): Promise<VpnNodeMetricsResponse> {
    const params = new URLSearchParams();
    if (options?.hours) params.append('hours', String(options.hours));
    const qs = params.toString();
    const endpoint = qs
      ? `${API_ENDPOINTS.VPN_NODE_METRICS(nodeId)}?${qs}`
      : API_ENDPOINTS.VPN_NODE_METRICS(nodeId);
    return this.request<VpnNodeMetricsResponse>(endpoint, { method: 'GET' });
  }

  async getVpnSessions(
    options?: {
      status?: 'all' | 'active' | 'completed' | 'error';
      nodeId?: string;
      qualityStatus?: 'all' | SessionQualityStatus;
      limit?: number;
    }
  ): Promise<VpnSessionListResponse> {
    const params = new URLSearchParams();
    if (options?.status && options.status !== 'all') params.append('status', options.status);
    if (options?.nodeId) params.append('node_id', options.nodeId);
    if (options?.qualityStatus && options.qualityStatus !== 'all') {
      params.append('quality_status', options.qualityStatus);
    }
    if (options?.limit) params.append('limit', String(options.limit));
    const qs = params.toString();
    const endpoint = qs
      ? `${API_ENDPOINTS.VPN_SESSIONS}?${qs}`
      : API_ENDPOINTS.VPN_SESSIONS;
    return this.request<VpnSessionListResponse>(endpoint, { method: 'GET' });
  }

  async getVpnBilling(
    options?: { days?: number; status?: 'all' | 'active' | 'completed' | 'error'; nodeId?: string; q?: string }
  ): Promise<VpnBillingOverviewResponse> {
    const params = new URLSearchParams();
    if (options?.days) params.append('days', String(options.days));
    if (options?.status && options.status !== 'all') params.append('status', options.status);
    if (options?.nodeId) params.append('node_id', options.nodeId);
    if (options?.q) params.append('q', options.q);
    const qs = params.toString();
    const endpoint = qs
      ? `${API_ENDPOINTS.VPN_BILLING}?${qs}`
      : API_ENDPOINTS.VPN_BILLING;
    return this.request<VpnBillingOverviewResponse>(endpoint, { method: 'GET' });
  }

  async getVpnEvents(
    options?: {
      days?: number;
      severity?: 'all' | 'info' | 'warning' | 'critical';
      type?: string;
      nodeId?: string;
      limit?: number;
    }
  ): Promise<VpnEventsResponse> {
    const params = new URLSearchParams();
    if (options?.days) params.append('days', String(options.days));
    if (options?.severity && options.severity !== 'all') {
      params.append('severity', options.severity);
    }
    if (options?.type) params.append('type', options.type);
    if (options?.nodeId) params.append('node_id', options.nodeId);
    if (options?.limit) params.append('limit', String(options.limit));
    const qs = params.toString();
    const endpoint = qs
      ? `${API_ENDPOINTS.VPN_EVENTS}?${qs}`
      : API_ENDPOINTS.VPN_EVENTS;
    return this.request<VpnEventsResponse>(endpoint, { method: 'GET' });
  }

  async getNodeWalletBans(
    nodeId: string,
    status: 'active' | 'inactive' | 'all' = 'active'
  ): Promise<NodeWalletBanListResponse> {
    const params = new URLSearchParams({ status });
    return this.request<NodeWalletBanListResponse>(
      `${API_ENDPOINTS.NODE_WALLET_BANS(nodeId)}?${params}`,
      { method: 'GET' }
    );
  }

  async getNodeCommands(
    nodeId: string,
    options?: { status?: string; action?: string; limit?: number; offset?: number }
  ): Promise<NodeCommandListResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.action) params.append('action', options.action);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    const qs = params.toString();
    const endpoint = qs
      ? `${API_ENDPOINTS.NODE_COMMANDS(nodeId)}?${qs}`
      : API_ENDPOINTS.NODE_COMMANDS(nodeId);
    return this.request<NodeCommandListResponse>(endpoint, { method: 'GET' });
  }

  async runNodeCommand(
    nodeId: string,
    data: RunNodeCommandRequest
  ): Promise<RunNodeCommandResponse> {
    return this.request<RunNodeCommandResponse>(API_ENDPOINTS.NODE_COMMAND_RUN(nodeId), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelNodeCommand(
    nodeId: string,
    commandId: string
  ): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(
      API_ENDPOINTS.NODE_COMMAND_CANCEL(nodeId, commandId),
      { method: 'POST', body: JSON.stringify({}) }
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
