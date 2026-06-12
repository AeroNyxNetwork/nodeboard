/**
 * ============================================
 * AeroNyx Privacy Network - Type Definitions
 * ============================================
 * File Path: src/types/index.ts
 *
 * Creation Reason: Centralized type definitions for the entire application
 * Modification Reason:
 *   v1.5.1 - Removed public discovery response types from nodeboard.
 *   v1.2.0 - Added node visibility / region / VPN types.
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
 *
 * Last Modified: v1.5.1 - Removed public discovery types
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
export type NodeTier = 'public' | 'premium';

/**
 * Node visibility options.
 * private            → owner + staff only
 * public             → eligible for public VPN placement
 * password_protected → requires an access password configured by the operator
 * unlisted           → operator-managed direct access only
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
  // v1.3+ — commercial VPN operator policy
  node_tier: NodeTier | string;
  maintenance_mode: boolean;
  max_sessions: number;
  bandwidth_limit_mbps: number;
  heartbeat_interval_seconds: number;
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
  node_tier?: NodeTier;
  maintenance_mode?: boolean;
  max_sessions?: number;
  bandwidth_limit_mbps?: number;
  heartbeat_interval_seconds?: number;
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

export interface VpnNodeAvailability {
  percent: number;
  window_hours: number;
  sample_count: number;
  valid_sample_count: number;
  first_seen_at: string | null;
  last_sample_at: string | null;
  last_gap_seconds: number;
}

export interface VpnPolicyEnforcement {
  maintenance_rejections: number;
  max_sessions_rejections: number;
  bandwidth_drops: number;
  last_rejection_reason: string | null;
  last_rejection_at: number | null;
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
  maintenance_mode: boolean;
  max_sessions: number;
  bandwidth_limit_mbps: number;
  heartbeat_interval_seconds: number;
  is_vpn_node: boolean;
  health_status: VpnHealthStatus;
  health_score: number;
  availability_24h: VpnNodeAvailability;
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
    vpn_health_status?: 'ok' | 'degraded' | 'failed' | string | null;
    vpn_health_checked_at?: number | null;
    policy_enforcement?: VpnPolicyEnforcement;
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

export type VpnEventSeverity = 'info' | 'warning' | 'critical';

export interface VpnEvent {
  id: string;
  severity: VpnEventSeverity;
  type: string;
  title: string;
  message: string;
  node_id: string | null;
  node_name: string;
  source: 'node_health' | 'vpn_session' | 'node_command' | string;
  created_at: string | null;
  status: string;
  action: string | null;
  session_id: string | null;
  command_id: string | null;
  details: Record<string, unknown>;
}

export interface VpnEventsSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  open: number;
}

export interface VpnEventsOverview {
  summary: VpnEventsSummary;
  events: VpnEvent[];
  filters: {
    days: number;
    severity: 'all' | VpnEventSeverity;
    type: string;
    node_id: string;
    limit: number;
    start_at: string;
    end_at: string;
  };
  generated_at: string;
}

export interface VpnEventsResponse {
  success: boolean;
  data: VpnEventsOverview;
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
  availability_24h_percent: number | null;
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

export interface VpnNodeMetricPoint {
  timestamp: string;
  cpu_usage: number | null;
  memory_mb: number | null;
  memory_total_mb: number | null;
  cpu_count: number | null;
  active_sessions: number;
  net_rx_bytes: number | null;
  net_tx_bytes: number | null;
  rx_delta_bytes: number | null;
  tx_delta_bytes: number | null;
  rx_bps: number | null;
  tx_bps: number | null;
  total_bps: number | null;
  interval_seconds: number | null;
  vpn_health_status: string;
  is_valid: boolean;
}

export interface VpnNodeMetrics {
  node: {
    id: string;
    name: string;
    public_ip: string | null;
    region_code: string;
  };
  window_hours: number;
  sample_count: number;
  points: VpnNodeMetricPoint[];
  summary: {
    avg_cpu_usage: number | null;
    max_cpu_usage: number | null;
    avg_memory_mb: number | null;
    max_memory_mb: number | null;
    max_active_sessions: number;
    total_rx_bytes: number;
    total_tx_bytes: number;
    peak_total_bps: number | null;
    invalid_samples: number;
  };
  generated_at: string;
}

export interface VpnNodeMetricsResponse {
  success: boolean;
  data: VpnNodeMetrics;
}

export type SessionQualityStatus = 'healthy' | 'degraded' | 'stale' | 'error' | 'pending' | 'completed';
export type VpnSessionQualitySummary = Record<SessionQualityStatus, number>;

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
  keepalive_probes_sent: number;
  keepalive_acks: number;
  keepalive_missed: number;
  keepalive_pending: number;
  last_error: string;
  quality_status: SessionQualityStatus;
  quality_score: number | null;
  degraded_reason: string;
  quality_reasons: string[];
  last_activity_at: string | null;
  last_activity_age_seconds: number | null;
}

export interface VpnSessionListResponse {
  success: boolean;
  data: VpnSession[];
  count: number;
  filtered_count: number;
  quality_summary: VpnSessionQualitySummary;
  filters?: {
    status: string;
    node_id: string;
    quality_status: 'all' | SessionQualityStatus;
    limit: number;
    sample_limit: number;
  };
}

export interface VpnBillingSummary {
  total_nodes: number;
  filtered_nodes: number;
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  error_sessions: number;
  bytes_in: number;
  bytes_out: number;
  total_bytes: number;
  traffic_in_mb: number;
  traffic_out_mb: number;
  total_traffic_mb: number;
  duration_seconds: number;
  avg_mb_per_session: number;
  matched_session_count: number;
}

export interface VpnBillingQuota {
  monthly: {
    tier: string;
    year: number;
    month: number;
    quota_bytes: number;
    used_bytes: number;
    remaining_bytes: number | null;
    is_exceeded: boolean;
    usage_percent: number | null;
    is_unlimited: boolean;
  } | null;
  monthly_row_exists: boolean;
  daily_vpn_usage: {
    tier: string;
    day: string;
    is_unlimited: boolean;
    quota_seconds: number;
    used_seconds: number;
    reserved_seconds: number;
    has_reserved_access: boolean;
    billable_seconds: number;
    remaining_seconds: number | null;
    usage_percent: number | null;
    is_exceeded: boolean;
    can_connect: boolean;
    renews_at: string;
  };
  daily_row_exists: boolean;
}

export interface VpnBillingVoucherAccounting {
  epoch: string;
  issued_vouchers: number;
  issue_events: number;
  last_issued_at: string | null;
  privacy_note: string;
}

export interface VpnBillingNodeRow {
  node_id: string;
  node_name: string;
  region_code: string;
  city: string;
  node_tier: string;
  sessions: number;
  active_sessions: number;
  bytes_in: number;
  bytes_out: number;
  total_bytes: number;
  total_traffic_mb: number;
  duration_seconds: number;
  first_seen: string | null;
  last_seen: string | null;
}

export interface VpnBillingIdentityRow {
  client_wallet: string;
  wallet_short: string;
  tier: string;
  sessions: number;
  active_sessions: number;
  bytes_in: number;
  bytes_out: number;
  total_bytes: number;
  total_traffic_mb: number;
  duration_seconds: number;
  first_seen: string | null;
  last_seen: string | null;
}

export interface VpnBillingDailyRow {
  day: string;
  sessions: number;
  bytes_in: number;
  bytes_out: number;
  total_bytes: number;
  total_traffic_mb: number;
  duration_seconds: number;
}

export interface VpnBillingSessionRow {
  session_id: string;
  voucher_id: string;
  virtual_ip: string;
  client_wallet: string;
  wallet_short: string;
  node_id: string;
  node_name: string;
  status: SessionStatus;
  bytes_in: number;
  bytes_out: number;
  total_bytes: number;
  total_traffic_mb: number;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
  updated_at: string;
  last_rx_at: string | null;
  last_tx_at: string | null;
  rtt_ms: number | null;
  packet_loss: number | null;
  last_error: string;
}

export interface VpnBillingTierRow {
  tier: string;
  sessions: number;
  share_percent: number | null;
}

export interface VpnBillingOverview {
  filters: {
    days: number;
    status: string;
    node_id: string;
    q: string;
    start_at: string;
    end_at: string;
  };
  summary: VpnBillingSummary;
  quota: VpnBillingQuota;
  voucher_accounting: VpnBillingVoucherAccounting;
  nodes: VpnBillingNodeRow[];
  identities: VpnBillingIdentityRow[];
  daily: VpnBillingDailyRow[];
  sessions: VpnBillingSessionRow[];
  tiers: VpnBillingTierRow[];
  known_identity_count: number;
  privacy_note: string;
  generated_at: string;
}

export interface VpnBillingOverviewResponse {
  success: boolean;
  data: VpnBillingOverview;
}

export interface NodeWalletBan {
  id: string;
  node_id: string;
  wallet_hex: string;
  wallet_short: string;
  reason: string;
  source: string;
  is_active: boolean;
  banned_by_wallet: string;
  command_id: string | null;
  banned_at: string;
  unbanned_at: string | null;
  updated_at: string;
}

export interface NodeWalletBanListResponse {
  success: boolean;
  data: NodeWalletBan[];
  count: number;
  status: 'active' | 'inactive' | 'all';
}

export type NodeCommandAction =
  | 'system_info'
  | 'collect_logs'
  | 'kick_session'
  | 'ban_wallet'
  | 'unban_wallet'
  | 'refresh_config'
  | 'restart_service'
  | string;
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
  acked_at: string | null;
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
  action: 'system_info' | 'collect_logs' | 'kick_session' | 'ban_wallet' | 'unban_wallet' | 'refresh_config' | 'restart_service';
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
