/**
 * ============================================
 * AeroNyx Privacy Network - Type Definitions
 * ============================================
 * File Path: src/types/index.ts
 *
 * Creation Reason: Centralized type definitions for the entire application
 * Modification Reason:
 *   v1.1.0 - Added window.phantom type declaration for newer Phantom versions.
 *     Phantom injects at window.phantom.solana instead of window.solana.
 *     Also added phantom.solana.connect({ onlyIfTrusted }) overload and
 *     okxwallet.solana.disconnect() method used by authStore.
 * Main Functionality: TypeScript interfaces and types for API responses,
 *                     wallet connections, nodes, sessions, and UI state
 * Dependencies: None (base types file)
 *
 * Main Logical Flow:
 * 1. Define wallet-related types (ETH/SOL)
 * 2. Define API response structures
 * 3. Define node and session data models
 * 4. Define UI state types
 * 5. Declare global Window extensions for wallet providers
 *
 * ⚠️ Important Note for Next Developer:
 * - All API response types must match the backend documentation exactly
 * - Wallet types must support both ETH and SOL chains
 * - Keep types in sync with API documentation version
 * - Window declarations must cover ALL injection paths used in authStore.ts
 *
 * Last Modified: v1.1.0 - Added window.phantom type declaration
 * Previous: v1.0.1 - Fixed duplicate NodeStatus identifier
 * ============================================
 */

// ============================================
// Wallet Types
// ============================================

export type WalletType = 'ETH' | 'SOL';

export type WalletProvider = 'phantom' | 'metamask' | 'okx';

export interface WalletInfo {
  address: string;
  type: WalletType;
  provider: WalletProvider;
}

// ============================================
// Authentication Types
// ============================================

export interface NonceResponse {
  nonce: string;
  message: string;
  is_new_user: boolean;
}

export interface LoginRequest {
  wallet_address: string;
  wallet_type: WalletType;
  signature: string;
}

export interface LoginResponse {
  api_key: string;
  user: {
    id: string;
    wallet_address: string;
    wallet_type: WalletType;
  };
  message: string;
}

export interface AuthState {
  apiKey: string | null;
  walletAddress: string | null;
  walletType: WalletType | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ============================================
// Registration Code Types
// ============================================

export type CodeStatus = 'unused' | 'used' | 'expired' | 'revoked';

export interface RegistrationCode {
  id: string;
  code: string;
  owner_wallet: string;
  status: CodeStatus;
  expires_at: string;
  created_at: string;
  is_valid: boolean;
}

export interface GenerateCodeResponse {
  success: boolean;
  data: RegistrationCode;
  message: string;
}

export interface CodeListResponse {
  success: boolean;
  data: RegistrationCode[];
  count: number;
}

// ============================================
// Node Types
// ============================================

export type NodeStatus = 'online' | 'offline' | 'suspended';

export interface HardwareInfo {
  cpu: string;
  memory: string;
  os: string;
}

export interface CachedHeartbeat {
  timestamp: string;
  cpu_usage: number;
  memory_mb: number;
  active_sessions: number;
}

export interface Node {
  id: string;
  name: string;
  status: NodeStatus;
  public_ip: string;
  port: number;
  version: string;
  last_heartbeat: string;
  current_sessions: number;
  total_sessions: number;
  online_duration: number;
  total_traffic_gb: number;
  is_verified: boolean;
  created_at: string;
}

export interface NodeDetail extends Node {
  owner_wallet: string;
  public_key: string;
  total_uptime_seconds: number;
  total_data_bytes: number;
  hardware_info: HardwareInfo;
  updated_at: string;
}

export interface NodeStatusInfo {
  node_id: string;
  node_name: string;
  status: NodeStatus;
  last_heartbeat: string;
  current_sessions: number;
  public_ip: string;
  port: number;
  version: string;
  is_verified: boolean;
  cached_heartbeat: CachedHeartbeat | null;
}

export interface NodeStats {
  node_id: string;
  node_name: string;
  status: NodeStatus;
  total_uptime_hours: number;
  uptime_percentage: number;
  total_traffic_gb: number;
  avg_session_traffic_mb: number;
  total_sessions: number;
  active_sessions: number;
  avg_session_duration_minutes: number;
  period_start: string;
  period_end: string;
}

export interface NodeListResponse {
  success: boolean;
  data: Node[];
  count: number;
}

export interface NodeDetailResponse {
  success: boolean;
  data: NodeDetail;
}

export interface NodeStatusResponse {
  success: boolean;
  data: NodeStatusInfo;
}

export interface NodeStatsResponse {
  success: boolean;
  data: NodeStats;
}

// ============================================
// Session Types
// ============================================

export type SessionStatus = 'active' | 'completed' | 'error';

export interface Session {
  id: string;
  session_id: string;
  client_wallet: string;
  bytes_in: number;
  bytes_out: number;
  total_bytes_mb: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  status: SessionStatus;
}

export interface SessionListResponse {
  success: boolean;
  data: Session[];
  count: number;
}

// ============================================
// API Response Types
// ============================================

export interface ApiError {
  error: string;
  detail?: string;
}

export interface SuccessResponse {
  success: boolean;
  message: string;
}

// ============================================
// UI State Types
// ============================================

export interface ModalState {
  isOpen: boolean;
  type: 'addNode' | 'nodeDetail' | 'deleteConfirm' | null;
  data?: unknown;
}

export interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

// ============================================
// Window Extensions for Wallet Providers
// ============================================

/** Shared Solana provider interface used by Phantom and OKX */
interface SolanaWalletProvider {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signMessage: (
    message: Uint8Array,
    encoding: string
  ) => Promise<{ signature: Uint8Array }>;
  on: (event: string, callback: () => void) => void;
  removeListener: (event: string, callback: () => void) => void;
}

/** Shared Ethereum provider interface used by MetaMask and OKX */
interface EthereumProvider {
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    /** Legacy Phantom injection path (older versions) */
    solana?: SolanaWalletProvider;

    /** Modern Phantom injection path (newer versions) */
    phantom?: {
      solana?: SolanaWalletProvider;
    };

    /** MetaMask / other EVM wallets */
    ethereum?: EthereumProvider;

    /** OKX Wallet — supports both Solana and Ethereum */
    okxwallet?: {
      solana?: SolanaWalletProvider;
      ethereum?: EthereumProvider;
    };
  }
}

export {};
