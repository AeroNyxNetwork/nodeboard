/**
 * ============================================
 * AeroNyx Privacy Network - Type Definitions
 * ============================================
 * File Path: src/types/index.ts
 *
 * Creation Reason: Centralized type definitions for the entire application
 * Modification Reason:
 *   v1.2.0 - Added node visibility / region / VPN types:
 *     NodeVisibility union type (private | public | password_protected | unlisted)
 *     Node and NodeDetail extended with visibility, region_code, city,
 *     auto_region, is_vpn_node, effective_region, has_access_password
 *     NodeUpdateRequest type for PATCH /nodes/{id}/
 *     PublicNode type for sanitized public pool response
 *     PublicNodeListResponse / PublicNodeDetailResponse response types
 *     VerifyAccessRequest / VerifyAccessResponse for password verification
 *     PublicNodesParams for query parameter typing
 *   v1.1.0 - Added window.phantom type declaration for newer Phantom versions.
 *     Phantom injects at window.phantom.solana instead of window.solana.
 *     Also added phantom.solana.connect({ onlyIfTrusted }) overload and
 *     okxwallet.solana.disconnect() method used by authStore.
 *
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
 * - NodeUpdateRequest.access_password semantics:
 *     undefined  → key not sent → password unchanged
 *     ""         → clear password
 *     "xyz"      → set new password
 * - PublicNode is SANITIZED — never contains owner / access_password_hash /
 *   public_key / hardware_info / binary_hash
 *
 * Last Modified: v1.2.0 - Added visibility / region / VPN types + public pool types
 * Previous: v1.1.0 - Added window.phantom type declaration
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

/**
 * Node visibility options.
 * private            → owner + staff only
 * public             → all authenticated users (appears in public pool)
 * password_protected → authenticated users who pass verify_access
 * unlisted           → authenticated users with direct link (NOT in public pool list)
 */
export type NodeVisibility =
  | 'private'
  | 'public'
  | 'password_protected'
  | 'unlisted';

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

/** Owner-scoped node (list view) — includes all fields */
export interface Node {
  id: string;
  name: string;
  status: NodeStatus;
  // v1.2.0 — visibility & access
  visibility: NodeVisibility;
  // v1.2.0 — region
  region_code: string;
  city: string;
  effective_region: string;
  auto_region: string;
  // v1.2.0 — VPN
  is_vpn_node: boolean;
  // network
  public_ip: string;
  port: number;
  version: string;
  last_heartbeat: string;
  current_sessions: number;
  total_sessions: number;
  online_duration: number;
  total_traffic_gb: number;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

/** Owner-scoped node (detail view) — full fields including sensitive ones */
export interface NodeDetail extends Node {
  owner_wallet: string;
  public_key: string;
  // v1.2.0 — password indicator (never exposes the hash)
  has_access_password: boolean;
  binary_hash: string;
  total_uptime_seconds: number;
  total_data_bytes: number;
  hardware_info: HardwareInfo;
  updated_at: string;
}

/**
 * Sanitized public node — returned by GET /nodes/public/.
 * Never contains: owner, access_password_hash, public_key,
 * hardware_info, binary_hash, is_active.
 */
export interface PublicNode {
  id: string;
  name: string;
  visibility: NodeVisibility;
  /** True when visibility === 'password_protected' */
  requires_password: boolean;
  region_code: string;
  city: string;
  effective_region: string;
  auto_region: string;
  is_vpn_node: boolean;
  public_ip: string;
  port: number;
  version: string;
  status: NodeStatus;
  current_sessions: number;
  total_sessions: number;
  is_verified: boolean;
  last_heartbeat: string;
  created_at: string;
}

/**
 * Request body for PATCH /nodes/{id}/.
 * All fields optional (partial update).
 *
 * access_password semantics:
 *   undefined  → do not send the key → password unchanged
 *   ""         → send empty string → clear existing password
 *   "xyz"      → send string → set new password
 */
export interface NodeUpdateRequest {
  name?: string;
  is_active?: boolean;
  visibility?: NodeVisibility;
  access_password?: string;
  region_code?: string;
  city?: string;
  is_vpn_node?: boolean;
}

/** Query parameters for GET /nodes/public/ */
export interface PublicNodesParams {
  region?: string;
  vpn?: boolean;
  status?: 'online' | 'offline';
  page?: number;
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

// ============================================
// Node API Response Types
// ============================================

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

/** Response for GET /nodes/public/ (paginated) */
export interface PublicNodeListResponse {
  success: boolean;
  count: number;
  page: number;
  page_size: number;
  data: PublicNode[];
}

/** Response for GET /nodes/public/{id}/ */
export interface PublicNodeDetailResponse {
  success: boolean;
  data: PublicNode;
  /** Present when 403 + password_protected */
  requires_password?: boolean;
  error?: string;
}

/** Request body for POST /nodes/{id}/verify_access/ */
export interface VerifyAccessRequest {
  password: string;
}

/** Response for POST /nodes/{id}/verify_access/ */
export interface VerifyAccessResponse {
  success: boolean;
  detail?: string;
  error?: string;
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
// VPN Observability Types
// ============================================

export type VpnHealthStatus = 'healthy' | 'degraded' | 'offline' | 'overloaded';

export interface VpnHealthCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface VpnNodeHealth {
  id: string;
  name: string;
  public_ip: string | null;
  port: number;
  version: string;
  region_code: string;
  city: string;
  node_tier: 'public' | 'premium' | string;
  is_vpn_node: boolean;
  health_status: VpnHealthStatus;
  health_score: number;
  last_heartbeat: string | null;
  last_seen_seconds: number | null;
  active_sessions: number;
  total_sessions: number;
  traffic_in_mb: number;
  traffic_out_mb: number;
  system: {
    source: 'cache' | 'sample' | string | null;
    cpu_usage: number | null;
    memory_mb: number | null;
    memory_total_mb: number | null;
    cpu_count: number | null;
    net_rx_bytes: number | null;
    net_tx_bytes: number | null;
    reported_active_sessions: number | null;
    runtime_id?: string | null;
    runtime_started_at?: string | null;
  };
  checks: VpnHealthCheck[];
}

export interface VpnAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  node_id: string;
  node_name: string;
  type: string;
  message: string;
  created_at: string | null;
}

export interface VpnOverviewSummary {
  total_nodes: number;
  healthy_nodes: number;
  degraded_nodes: number;
  offline_nodes: number;
  overloaded_nodes: number;
  active_sessions: number;
  traffic_in_mb: number;
  traffic_out_mb: number;
  open_alerts: number;
}

export interface VpnOverview {
  summary: VpnOverviewSummary;
  nodes: VpnNodeHealth[];
  alerts: VpnAlert[];
  generated_at: string;
}

export interface VpnOverviewResponse {
  success: boolean;
  data: VpnOverview;
}

export interface VpnSession {
  id: string;
  session_id: string;
  node_id: string;
  node_name: string;
  client_wallet: string;
  virtual_ip: string;
  voucher_id: string;
  bytes_in: number;
  bytes_out: number;
  total_bytes_mb: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  status: SessionStatus;
  last_rx_at: string | null;
  last_tx_at: string | null;
  rtt_ms: number | null;
  packet_loss: number | null;
  last_error: string;
}

export interface VpnSessionListResponse {
  success: boolean;
  data: VpnSession[];
  count: number;
}

export type NodeCommandAction = 'system_info' | 'collect_logs' | string;
export type NodeCommandStatus =
  | 'pending'
  | 'sent'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout'
  | string;

export interface NodeCommand {
  id: string;
  action: NodeCommandAction;
  action_display: string;
  params: Record<string, unknown>;
  status: NodeCommandStatus;
  status_display: string;
  priority: number;
  result: Record<string, unknown>;
  error_message: string;
  retry_count: number;
  created_at: string;
  sent_at: string | null;
  completed_at: string | null;
}

export interface NodeCommandStats {
  total: number;
  pending: number;
  sent: number;
  executing: number;
  completed: number;
  failed: number;
  cancelled: number;
  timeout: number;
  [key: string]: number;
}

export interface NodeCommandListResponse {
  success: boolean;
  data: NodeCommand[];
  stats: NodeCommandStats;
}

export interface RunNodeCommandRequest {
  action: 'system_info' | 'collect_logs';
  params?: Record<string, unknown>;
  priority?: number;
}

export interface RunNodeCommandResponse {
  success: boolean;
  data: {
    command: {
      id: string;
      action: string;
      params: Record<string, unknown>;
      priority: number;
      issued_at: string;
    };
  };
  message: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiError {
  error: string;
  detail?: string;
  requires_password?: boolean;
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
