/**
 * ============================================
 * AeroNyx Privacy Network - API Client
 * ============================================
 * File Path: lib/api.ts
 * 
 * Creation Reason: Centralized API client for all backend communications
 * Dependencies: 
 *   - types/index.ts (type definitions)
 *   - lib/constants.ts (API endpoints and config)
 * 
 * Last Modified: v1.0.1 - Fixed TypeScript type errors
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

import { API_BASE_URL, API_ENDPOINTS, STORAGE_KEYS } from './constants';

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

  private getAuthHeaders(): HeadersInit {
    const apiKey = this.getApiKey();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
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
  // Authentication Endpoints
  // ============================================

  async getNonce(walletAddress: string): Promise<NonceResponse> {
    const params = new URLSearchParams({ wallet_address: walletAddress });
    return this.request<NonceResponse>(
      `${API_ENDPOINTS.AUTH_NONCE}?${params}`,
      { method: 'GET' }
    );
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>(API_ENDPOINTS.AUTH_LOGIN, {
      method: 'POST',
      body: JSON.stringify(data),
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
    let endpoint = API_ENDPOINTS.NODES_LIST;
    if (status) {
      const params = new URLSearchParams({ status });
      endpoint = `${API_ENDPOINTS.NODES_LIST}?${params}`;
    }
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
