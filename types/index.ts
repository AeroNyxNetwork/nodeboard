/**
 * ============================================
 * AeroNyx Privacy Network - Type Definitions
 * ============================================
 * File Path: src/types/index.ts
 *
 * Creation Reason: Centralized type definitions for the entire application
 * Modification Reason:
 *   v1.5.33 - Added PeerStore discovery stability summary fields from Rust
 *     so nodeboard can show relay-foundation readiness without exposing peer
 *     URLs, full peer public keys, user traffic, chat payloads, Memory Chain
 *     plaintext, or wallet-level traffic.
 *   v1.5.32 - Added packet_runtime health telemetry from Rust packet handler
 *     counters so node detail can show stale-session packet drops after node
 *     restarts without exposing session IDs, client IPs, packet payloads, or
 *     wallet-level traffic.
 *   v1.5.31 - Added encrypted chat peer relay health telemetry from Rust
 *     heartbeat system_stats.chat_relay_status for node detail stability
 *     diagnostics.
 *   v1.5.30 - Added discovery outbound gossip health fields.
 *   v1.5.29 - Added discovery seed recovery counters from Rust heartbeat.
 *   v1.5.28 - Added VPN transport capability health metadata.
 *   v1.5.27 - Added VPN DNS ownership health metadata.
 *   v1.5.26 - Documented nodeboard health contract for capacity.risks.
 *   v1.5.25 - Documented fleet placement rollout action links.
 *   v1.5.24 - Documented placement rollout action links.
 *   v1.5.23 - Documented placement rollout cutover safety coupling.
 *   v1.5.22 - Documented durable placement readiness fallback.
 *   v1.5.21 - Added node-level Rust placement readiness snapshot.
 *   v1.5.20 - Added restart safety to Rust placement rollout targets.
 *   v1.5.19 - Added Rust placement rollout missing node list.
 *   v1.5.18 - Added Rust placement rollout summary.
 *   v1.5.17 - Added Rust placement readiness fields.
 *   v1.5.16 - Added commercial placement health summary.
 *   v1.5.15 - Added fleet dominant policy block reason summary.
 *   v1.5.14 - Added fleet policy counter scope rollout summary.
 *   v1.5.13 - Added fleet policy counter scope summary fields.
 *   v1.5.12 - Added Rust policy counter scope timestamp.
 *   v1.5.11 - Added node policy block current-impact fields.
 *   v1.5.10 - Documented node heartbeat source quality.
 *   v1.5.9 - Added policy enforcement telemetry source quality fields.
 *   v1.5.8 - Added fleet policy enforcement health summary types.
 *   v1.5.7 - Added fleet policy sync health summary types.
 *   v1.5.6 - Documented commercial capacity PATCH policy fields.
 *   v1.5.5 - Added maintenance exit placement context fields.
 *   v1.5.4 - Documented maintenance exit candidates as action-plan sourced.
 *   v1.5.3 - Added fleet maintenance exit candidate summary types.
 *   v1.5.2 - Added backend recommended operator actions under
 *     restart_readiness.operator_action_plan for node detail controls.
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
 * - NodeUpdateRequest.max_sessions / bandwidth_limit_mbps are commercial
 *   capacity policy fields accepted by:
 *     /root/aeronyx/privacy_network/serializers.py
 *     /root/aeronyx/privacy_network/api/nodes.py
 *   and consumed by Rust node policy:
 *     /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 *
 * Last Modified: v1.5.33 - Added PeerStore stability fields
 * Previous: v1.5.32 - Added packet_runtime health telemetry
 * Previous: v1.5.31 - Added encrypted chat peer relay health fields
 * Previous: v1.5.30 - Added discovery outbound gossip health fields
 * Previous: v1.5.29 - Added discovery seed recovery counters
 * Previous: v1.5.28 - Added VPN transport capability health metadata
 * Previous: v1.5.27 - Added VPN DNS ownership health metadata
 * Previous: v1.5.26 - Documented nodeboard health contract for capacity.risks
 * Previous: v1.5.25 - Documented fleet placement rollout action links
 * Previous: v1.5.24 - Documented placement rollout action links
 * Previous: v1.5.23 - Documented placement rollout cutover safety coupling
 * Previous: v1.5.22 - Documented durable placement readiness fallback
 * Previous: v1.5.21 - Added node-level Rust placement readiness snapshot
 * Previous: v1.5.20 - Added restart safety to Rust placement rollout targets
 * Previous: v1.5.19 - Added Rust placement rollout missing node list
 * Previous: v1.5.18 - Added Rust placement rollout summary
 * Previous: v1.5.17 - Added Rust placement readiness fields
 * Previous: v1.5.16 - Added commercial placement health summary
 * Previous: v1.5.15 - Added fleet dominant policy block reason summary
 * Previous: v1.5.14 - Added fleet policy counter scope rollout summary
 * Previous: v1.5.13 - Added fleet policy counter scope summary fields
 * Previous: v1.5.12 - Added Rust policy counter scope timestamp
 * Previous: v1.5.11 - Added node policy block current-impact fields
 * Previous: v1.5.10 - Documented node heartbeat source quality
 * Previous: v1.5.9 - Added policy enforcement telemetry source quality
 * Previous: v1.5.8 - Added fleet policy enforcement health summary
 * Previous: v1.5.7 - Added fleet policy sync health summary
 * Previous: v1.5.6 - Documented commercial capacity policy fields
 * Previous: v1.5.5 - Added maintenance exit placement context
 * Previous: v1.5.4 - Documented action-sourced maintenance exits
 * Previous: v1.5.3 - Added maintenance exit candidate types
 * Previous: v1.5.2 - Added recommended operator action types
 * Previous: v1.5.1 - Removed public discovery types
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

export interface RegistrationCodeLinkedNode {
  id: string;
  name: string;
  status: NodeStatus | string;
  is_vpn_node: boolean;
  last_heartbeat?: string | null;
}

export interface RegistrationCode {
  id: string;
  code: string;
  owner_wallet: string;
  status: CodeStatus;
  expires_at: string;
  used_at?: string | null;
  created_at: string;
  is_valid: boolean;
  install_status?: 'not_started' | 'planning' | 'running' | 'completed' | 'failed' | string;
  install_step?: string;
  install_message?: string;
  install_progress?: Record<string, unknown>;
  install_last_reported_at?: string | null;
  linked_node?: RegistrationCodeLinkedNode | null;
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
  // v1.2.0 — password indicator only; never exposes hash or plaintext.
  has_access_password: boolean;
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

/**
 * Privacy-safe install workflow summary attached to NodeDetail.
 *
 * Backend API:
 *   GET /api/privacy_network/nodes/{id}/
 * Backend file:
 *   /root/aeronyx/privacy_network/serializers.py
 * Rust/deploy producer:
 *   /root/open/AeroNyx/deploy/node/install.sh
 *
 * This links a consumed node registration code to the node detail page without
 * exposing the registration code value, node private keys, client public IPs,
 * destinations, DNS contents, packet payloads, chat plaintext, voucher
 * secrets, or wallet-level traffic.
 */
export interface NodeInstallProgressSummary {
  registration_code_id: string;
  code_status: CodeStatus | string;
  status: 'not_started' | 'planning' | 'running' | 'completed' | 'failed' | string;
  step: string;
  message: string;
  progress: Record<string, unknown>;
  last_reported_at: string | null;
  used_at: string | null;
  created_at: string | null;
  source: string;
  privacy_boundary?: string;
}

/** Owner-scoped node (detail view) — full fields including sensitive ones */
export interface NodeDetail extends Node {
  owner_wallet: string;
  public_key: string;
  binary_hash: string;
  total_uptime_seconds: number;
  total_data_bytes: number;
  hardware_info: HardwareInfo;
  install_status?: NodeInstallProgressSummary | null;
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
 *
 * Commercial capacity semantics:
 *   max_sessions and bandwidth_limit_mbps are PATCHed through
 *   /api/privacy_network/nodes/{id}/ and validated in
 *   /root/aeronyx/privacy_network/serializers.py. Rust consumes the resulting
 *   node_policy values in
 *   /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs.
 *   0 means unlimited/local default.
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
  node_name?: string;
  session_id: string;
  client_wallet: string;
  virtual_ip?: string | null;
  bytes_in: number;
  bytes_out: number;
  total_bytes: number;
  total_bytes_mb: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  last_rx_at?: string | null;
  last_tx_at?: string | null;
  rtt_ms?: number | null;
  packet_loss?: number | null;
  packets_rx?: number;
  packets_tx?: number;
  keepalive_probes_sent?: number;
  keepalive_acks?: number;
  keepalive_missed?: number;
  keepalive_pending?: number;
  status: SessionStatus;
  last_error?: string;
  updated_at?: string;
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
  /**
   * Unix timestamp when Rust process-local policy counters started.
   *
   * Backend API:
   *   GET /api/privacy_network/vpn/overview/
   * Backend file:
   *   /root/aeronyx/privacy_network/api/vpn_observability.py
   * Rust source:
   *   /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
   */
  counters_started_at?: number | null;
  maintenance_rejections: number;
  max_sessions_rejections: number;
  bandwidth_drops: number;
  /**
   * Aggregate Rust node_policy bandwidth limiter telemetry exposed through:
   *   GET /api/privacy_network/vpn/overview/
   *
   * Backend file:
   *   /root/aeronyx/privacy_network/api/vpn_observability.py
   * Rust source:
   *   /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
   *
   * Privacy boundary: aggregate limiter counters only. No packet payloads,
   * destinations, DNS contents, domains, URLs, browsing history, voucher
   * secrets, client public IPs, or wallet-level traffic.
   */
  bandwidth_drop_bytes?: number;
  bandwidth_limit_bytes_per_second?: number;
  bandwidth_window_bytes?: number;
  last_rejection_reason: string | null;
  last_rejection_at: number | null;
  /**
   * Backend-authored current-impact classification from:
   *   GET /api/privacy_network/vpn/overview/
   *
   * Backend file:
   *   /root/aeronyx/privacy_network/api/vpn_observability.py
   *
   * Rust counters are cumulative for the current process. These fields let
   * node detail separate active commercial blocking from historical audit
   * counters without reimplementing freshness rules in React.
   */
  last_rejection_age_seconds?: number | null;
  recent_block_active?: boolean;
  recent_block_window_seconds?: number;
  impact_status?: 'clear' | 'active' | 'historical' | string;
}

export interface VpnPolicySnapshot {
  node_tier: 'public' | 'premium' | string;
  maintenance_mode: boolean;
  max_sessions: number;
  bandwidth_limit_mbps: number;
  heartbeat_interval_seconds: number;
  updated_at?: string | null;
}

export interface VpnPolicySync {
  status: 'synced' | 'pending' | 'unknown' | string;
  desired: VpnPolicySnapshot;
  runtime: VpnPolicySnapshot | null;
  mismatched_fields: string[];
  heartbeat_age_seconds: number | null;
  message: string;
}

export interface VpnRuntimeRecovery {
  status: 'stable' | 'restarted_recently' | 'sessions_interrupted' | 'unknown' | string;
  runtime_id: string | null;
  runtime_started_at: string | null;
  runtime_uptime_seconds: number | null;
  restarted_within_24h: boolean;
  interrupted_sessions_24h: number;
  last_interrupted_at: string | null;
  message: string;
  privacy_boundary?: string;
}

/**
 * Rust service manager metadata exposed through:
 *   GET /api/privacy_network/vpn/overview/
 *
 * Backend file:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 * Rust source:
 *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 * Frontend consumer:
 *   /root/open/nodeboard/app/dashboard/services/page.tsx
 *
 * This is process manager metadata only. It does not include destinations, DNS
 * contents, packet payloads, domains, URLs, browsing history, voucher secrets,
 * client public IPs, or wallet-level traffic.
 */
export interface VpnServiceManagerStatus {
  manager: 'systemd' | string;
  service_name: string;
  load_state: string;
  active_state?: string;
  unit_file_state?: string;
  restart_supported: boolean;
  detail: string;
}

export interface VpnSessionCleanupStatus {
  client_liveness_timeout_seconds: number;
  source: string;
  privacy_boundary: string;
}

export interface VpnRestartReadinessBlocker {
  // Backend source: /root/aeronyx/privacy_network/api/vpn_observability.py
  // _restart_readiness() emits these owner-scoped operational blocker codes.
  code:
    | 'maintenance_required'
    | 'active_sessions'
    | 'cleanup_policy_pending'
    | 'restart_command_active'
    | string;
  message: string;
}

export interface VpnRestartCommandState {
  id: string;
  action?: 'restart_service' | string;
  status:
    | 'pending'
    | 'sent'
    | 'executing'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'timeout'
    | string;
  created_at: string | null;
  sent_at?: string | null;
  acked_at?: string | null;
  completed_at?: string | null;
  is_terminal?: boolean;
  can_retry?: boolean;
  can_cancel?: boolean;
  cancel_reason?: string;
  age_seconds?: number | null;
  stale_after_seconds?: number | null;
  is_stale?: boolean;
  stale_reason?: string;
  source: 'node_command_restart_service_queue' | string;
}

export interface VpnDrainActivityHealth {
  status: 'clear' | 'active_traffic' | 'keepalive_degraded' | 'client_rx_stale' | 'idle_or_stale' | string;
  risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
  label: string;
  detail: string;
}

export interface VpnRestartCutoverGuard {
  safe_to_cutover: boolean;
  requires_active_sessions_zero?: boolean;
  status:
    | 'safe'
    | 'active_client_rx'
    | 'cleanup_policy_pending'
    | 'cleanup_window_open'
    | 'stale_sessions_pending_cleanup'
    | 'active_sessions_present'
    | string;
  risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
  label: string;
  detail: string;
  next_step: string;
  user_impact_if_forced?: string;
  active_sessions?: number;
  recent_client_rx_sessions?: number;
  stale_client_rx_sessions?: number;
  never_client_rx_sessions?: number;
  activity_window_seconds?: number;
  source?: 'restart_readiness.drain_eta' | string;
  privacy_boundary?: string;
}

export interface VpnRestartCutoverProblemNode {
  id: string;
  name: string;
  health_status: string;
  last_seen_seconds: number | null;
  maintenance_mode: boolean;
  active_sessions: number;
  blocker_codes?: string[];
  status: VpnRestartCutoverGuard['status'];
  risk: VpnRestartCutoverGuard['risk'];
  label: string;
  detail: string;
  next_step: string;
  safe_to_cutover: boolean;
  actionable?: boolean;
  actionable_reason?: string;
  user_impact_if_forced: string;
  recent_client_rx_sessions: number;
  stale_client_rx_sessions: number;
  never_client_rx_sessions: number;
  source: 'restart_readiness.drain_eta.cutover_guard' | string;
}

export interface VpnRestartDrainEta {
  status:
    | 'no_active_sessions'
    | 'cleanup_policy_pending'
    | 'activity_pending'
    | 'cleanup_due'
    | 'waiting_for_idle_cleanup'
    | string;
  next_step: string;
  active_sessions: number;
  recent_activity_sessions?: number;
  idle_activity_sessions?: number;
  recent_client_rx_sessions?: number;
  stale_client_rx_sessions?: number;
  never_client_rx_sessions?: number;
  activity_pending_sessions?: number;
  activity_window_seconds?: number;
  keepalive_missed_sessions?: number;
  keepalive_pending_sessions?: number;
  keepalive_missed_total?: number;
  keepalive_pending_total?: number;
  activity_health?: VpnDrainActivityHealth | null;
  cutover_guard?: VpnRestartCutoverGuard | null;
  oldest_started_at: string | null;
  latest_activity_at: string | null;
  latest_client_rx_at?: string | null;
  latest_server_tx_at?: string | null;
  cleanup_timeout_seconds: number | null;
  estimated_cleanup_at: string | null;
  estimated_seconds_remaining: number | null;
  source: 'client_session_activity_aggregate' | string;
  privacy_boundary: string;
}

/**
 * Backend-authoritative controlled restart gate.
 *
 * Backend API:
 *   GET /api/privacy_network/vpn/overview/
 * Backend file:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 * Command source:
 *   /root/aeronyx/privacy_network/models.py (NodeCommand)
 *   /root/aeronyx/privacy_network/services/command_service.py
 * Drain ETA source:
 *   /root/aeronyx/privacy_network/models.py (ClientSession aggregate timing)
 *   data.nodes[].system.restart_readiness.drain_eta activity bucket fields
 *   are node-level counts only: recent_activity_sessions,
 *   idle_activity_sessions, activity_pending_sessions, keepalive issue
 *   session counts, and keepalive totals.
 *   recent_client_rx_sessions / stale_client_rx_sessions /
 *   never_client_rx_sessions split client-originated tunnel packets from
 *   server-side last_tx/update activity so old Rust runtimes do not look
 *   healthy merely because the server is still transmitting keepalives.
 *   activity_health is backend-authored commercial triage status so React
 *   views do not duplicate restart/drain risk rules.
 * Operator action plan source:
 *   data.nodes[].system.restart_readiness.operator_action_plan is a
 *   backend-authored node detail preflight summary built from restart gate,
 *   command delivery, drain ETA, and restart command lifecycle metadata.
 *   recommended_actions is a machine-readable action list ordered by backend
 *   priority so node detail can render state-specific controls without
 *   duplicating operator workflow rules in React.
 * Nodeboard consumers:
 *   /root/open/nodeboard/app/dashboard/services/page.tsx
 *   /root/open/nodeboard/app/dashboard/nodes/[id]/page.tsx
 * Rust sources:
 *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   /root/open/AeroNyx/crates/aeronyx-server/src/services/session.rs
 *   /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *
 * Privacy boundary: aggregate restart readiness only. No client public IPs,
 * destinations, DNS contents, packet payloads, domains, URLs, browsing
 * history, voucher secrets, or wallet-level traffic. active_restart_command is
 * command lifecycle metadata only and never contains command payload secrets.
 * latest_restart_command extends the same privacy boundary to terminal
 * outcomes for fleet restart closure. age_seconds/stale_after_seconds/is_stale
 * are backend-authored SLA metadata from vpn_observability.py only; drain_eta
 * is node-level aggregate timing only. command_delivery is backend-authored
 * node-level restart command delivery readiness from heartbeat freshness plus
 * operator_reporting. rollout_reported confirms operator_status.runtime_rollout
 * exists in /root/aeronyx/privacy_network/api/vpn_observability.py. operator_action_plan
 * is summary copy and checklist only, never raw command params/result/error_message.
 */
export interface VpnRestartReadiness {
  status: 'ready' | 'blocked' | 'pending' | 'current' | string;
  can_restart: boolean;
  blockers: VpnRestartReadinessBlocker[];
  next_step: string;
  maintenance_mode: boolean;
  active_sessions: number;
  operator_reporting: boolean;
  rollout_reported?: boolean;
  restart_required: boolean;
  cleanup_reported: boolean;
  command_delivery?: {
    status: string;
    risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
    label: string;
    detail: string;
    next_step: string;
    last_seen_seconds: number | null;
    operator_reporting: boolean;
    fresh_seconds: number;
    degraded_seconds: number;
    source: string;
    privacy_boundary: string;
  };
  operator_action_plan?: {
    status: string;
    risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
    label: string;
    summary: string;
    primary_action: string;
    secondary_action: string;
    can_restart: boolean;
    reasons: string[];
    checklist: Array<{
      key: string;
      label: string;
      status: string;
      detail: string;
    }>;
    recommended_actions?: Array<{
      key:
        | 'start_maintenance'
        | 'end_maintenance'
        | 'open_active_sessions'
        | 'system_info'
        | 'collect_logs'
        | 'restart_service'
        | 'cancel_restart'
        | 'open_commands'
        | string;
      label: string;
      intent: 'node_policy' | 'sessions' | 'node_commands' | 'node_detail' | string;
      priority: number;
      enabled: boolean;
      detail: string;
    }>;
    source: string;
    privacy_boundary: string;
  };
  active_restart_command?: VpnRestartCommandState | null;
  latest_restart_command?: VpnRestartCommandState | null;
  drain_eta?: VpnRestartDrainEta | null;
  source: string;
  privacy_boundary: string;
}

export interface VpnRestartReadinessBlockedNode {
  id: string;
  name: string;
  active_sessions: number;
  maintenance_mode: boolean;
  next_step: string;
  blocker_codes: string[];
  drain_status?: string;
  drain_next_step?: string;
  drain_activity?: {
    active_sessions: number;
    recent_activity_sessions: number;
    idle_activity_sessions: number;
    recent_client_rx_sessions?: number;
    stale_client_rx_sessions?: number;
    never_client_rx_sessions?: number;
    activity_pending_sessions: number;
    activity_window_seconds: number;
    keepalive_missed_sessions: number;
    keepalive_pending_sessions: number;
    keepalive_missed_total: number;
    keepalive_pending_total: number;
    activity_health?: VpnDrainActivityHealth | null;
    source: 'restart_readiness.drain_eta' | string;
  };
  active_restart_command_status?: string;
  recommended_action?: {
    key: string;
    label: string;
    intent: 'node_policy' | 'sessions' | 'node_commands' | 'node_detail' | string;
    detail: string;
  };
}

/**
 * Owner-scoped fleet restart summary from the backend overview API.
 *
 * Backend API:
 *   GET /api/privacy_network/vpn/overview/
 * Backend file:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 * Blocked node activity source:
 *   data.summary.restart_readiness.blocked_nodes[].drain_activity
 *   mirrors data.nodes[].system.restart_readiness.drain_eta aggregate buckets.
 *   recent_client_rx_sessions / stale_client_rx_sessions /
 *   never_client_rx_sessions separate client-originated RX from server-side
 *   TX/update activity for stale-session rollout triage.
 * Summary activity source:
 *   data.summary.restart_readiness.drain_activity_health_counts
 *   aggregates backend-authored activity_health status/risk by blocked node.
 *   summary is backend-authored copy and next_step for the Services Drain
 *   Risk card.
 * Command lifecycle source:
 *   data.summary.restart_readiness.command_lifecycle_counts aggregates
 *   active/stale/retry/terminal restart_service lifecycle metadata and
 *   cancelable_active/non_cancelable_active counts for the Services Command
 *   SLA card. outcome_summary is backend-authored copy for the Services
 *   Restart Outcome Audit panel. history_24h is a backend aggregate
 *   reliability window with latest_any_created_at/latest_any_status context
 *   that excludes raw command params/result/error_message.
 * Command delivery source:
 *   data.summary.restart_readiness.command_delivery_health aggregates Rust
 *   heartbeat freshness plus backend operator_reporting for the Services
 *   Command Delivery card. problem_nodes is a capped privacy-safe triage list
 *   for nodes that cannot receive restart commands promptly. problem_nodes[]
 *   primary_action and problem_panel_summary are backend-authored operator
 *   guidance from /root/aeronyx/privacy_network/api/vpn_observability.py.
 * Runtime capability source:
 *   data.summary.restart_readiness.runtime_capability_health aggregates
 *   backend restart_readiness.operator_reporting, rollout_reported, and
 *   cleanup_reported from /root/aeronyx/privacy_network/api/vpn_observability.py
 *   so Services can show stale Rust binaries that do not report
 *   operator_status.runtime_rollout or session_cleanup before commercial
 *   cutover work. problem_nodes also feeds the Restart Action Queue as
 *   backend-authored runtime upgrade work. upgrade_gate mirrors
 *   restart_readiness.drain_eta.cutover_guard so the UI can show whether
 *   upgrading/restarting Rust is safe now. upgrade_gate.checklist is
 *   backend-authored preflight copy for maintenance, recent client RX, active
 *   sessions, and runtime telemetry. checklist_summary is the backend-owned
 *   count contract; React should not derive readiness totals. primary_action
 *   is the backend-owned next operator intent for the Restart Action Queue.
 *   upgrade_blocker_counts aggregates checklist_summary.blocking_keys for the
 *   fleet Rust Capability card. upgrade_blockers is the backend-sorted display
 *   list with labels/statuses; upgrade_blocker_summary is backend-authored
 *   card sentence and next-step copy; problem_panel_summary is backend-owned
 *   Rust Capability Gaps panel context; counts remains a compatibility map.
 * Policy sync source:
 *   data.summary.restart_readiness.policy_sync_health aggregates
 *   data.nodes[].system.policy_sync from
 *   /root/aeronyx/privacy_network/api/vpn_observability.py so Services can
 *   show whether max_sessions / bandwidth_limit_mbps policy changes have
 *   reached Rust node_policy before operators trust commercial capacity.
 *   problem_panel_summary and problem_nodes[].primary_action are
 *   backend-authored remediation metadata for the Services Policy Sync panel.
 * Policy enforcement source:
 *   data.summary.restart_readiness.policy_enforcement_health aggregates
 *   data.nodes[].system.policy_enforcement from
 *   /root/aeronyx/privacy_network/api/vpn_observability.py so Services can
 *   show whether Rust node_policy is actively blocking handshakes or packets.
 *   bandwidth_drop_bytes / bandwidth_limit_bytes_per_second /
 *   bandwidth_window_bytes are aggregate limiter fields produced by
 *   /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs.
 *   recent_problem_nodes / historical_problem_nodes are backend-authored
 *   current-impact classification from last_rejection_at, because Rust
 *   counters are cumulative for the current process.
 *   telemetry_source_counts / telemetry_source_summary tell Services whether
 *   counters came from fresh Redis heartbeat cache or durable sample fallback.
 *   counter_scope_started_at_min / counter_scope_started_at_max summarize
 *   Rust process-local counter scope across the fleet; source Rust file:
 *   /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs.
 *   counter_scope_summary is backend-authored rollout quality for the Rust
 *   counters_started_at field.
 *   dominant_block_reason is backend-authored guidance for whether fleet
 *   policy blocks are mainly maintenance, max_sessions, or bandwidth.
 *   problem_panel_summary and problem_nodes[].primary_action are
 *   backend-authored remediation metadata for the Services Policy Blocks panel.
 * Commercial placement source:
 *   data.summary.restart_readiness.commercial_placement_health is produced by
 *   /root/aeronyx/privacy_network/api/vpn_observability.py from
 *   data.nodes[], policy_sync_health, and policy_enforcement_health so
 *   Services can show whether AeroNyx Privacy Protocol nodes are safe for
 *   more paid placement. The backend owns ready/watch/blocked classification;
 *   React only renders the operator decision and routes primary_action.
 *   New Rust runtimes also report data.nodes[].system.placement_readiness
 *   from /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 *   and /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs.
 *   commercial_placement_health includes rust_placement_reporting_nodes and
 *   rust_placement_accepting_nodes so Services can show rollout coverage for
 *   runtime-owned admission decisions.
 *   rust_placement_rollout_summary is backend-authored coverage copy and
 *   next-step guidance so the Services page does not compare raw counters to
 *   infer whether runtime admission rollout is complete.
 *   missing_node_list is backend-sorted rollout work; React only renders the
 *   target node and routes primary_action to node detail.
 *   missing_node_list[].restart_safety mirrors backend cutover_guard so
 *   Services can show whether upgrading/restarting a missing runtime is safe.
 * Maintenance recovery source:
 *   data.summary.restart_readiness.maintenance_exit_candidates lists nodes
 *   that are current, drained, and still in maintenance mode so Services can
 *   restore commercial client placement capacity.
 *   maintenance_exit_summary is backend-authored fleet recovery context:
 *   visible/hidden candidate counts, public entry count, and region count.
 *   Candidates are sourced from node-level
 *   operator_action_plan.recommended_actions key=end_maintenance.
 *   Candidate public_ip / region_code / city / version are node placement
 *   metadata from /root/aeronyx/privacy_network/api/vpn_observability.py so
 *   Services can show which commercial entry point returns to placement.
 * Cutover safety source:
 *   data.summary.restart_readiness.cutover_guard_counts aggregates
 *   data.nodes[].system.restart_readiness.drain_eta.cutover_guard from
 *   /root/aeronyx/privacy_network/api/vpn_observability.py so Services can
 *   show whether Rust replacement/restart is commercially safe across the
 *   fleet without parsing backend English copy.
 *   actionable_problem_nodes is backend-authored queue input for Services
 *   Cutover Blockers. problem_nodes remains the full safety-accounting list,
 *   including healthy current nodes that are simply serving client traffic.
 *   observed_only_nodes / serving_traffic_nodes explain unsafe cutover states
 *   that are not operator work.
 *   actionable/actionable_reason explain why a node became operator work;
 *   blocker_codes mirrors backend restart_readiness.blockers for compact
 *   cutover queue diagnostics without exposing client-level traffic details.
 * Frontend consumers:
 *   /root/open/nodeboard/app/dashboard/services/page.tsx
 *   /root/open/nodeboard/app/api/health/route.ts
 */
export interface VpnRestartReadinessSummary {
  total_vpn_nodes: number;
  ready: number;
  blocked: number;
  pending: number;
  current: number;
  can_restart: number;
  sessions_blocking_restart: number;
  blocker_counts: Record<string, number>;
  cutover_guard_counts?: {
    total_nodes: number;
    safe_nodes: number;
    blocked_nodes: number;
    actionable_blocked_nodes?: number;
    observed_only_nodes?: number;
    serving_traffic_nodes?: number;
    critical_nodes: number;
    warning_nodes: number;
    status_counts: Record<string, number>;
    risk_counts: Record<string, number>;
    forced_impact_counts: Record<string, number>;
    problem_nodes?: VpnRestartCutoverProblemNode[];
    actionable_problem_nodes?: VpnRestartCutoverProblemNode[];
    summary?: {
      label: string;
      risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
      detail: string;
      next_step: string;
      count: number;
    };
    source: 'nodes.system.restart_readiness.drain_eta.cutover_guard' | string;
    privacy_boundary: string;
  };
  maintenance_exit_candidate_count?: number;
  maintenance_exit_summary?: {
    status?: string;
    risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
    label: string;
    detail: string;
    next_step?: string;
    count: number;
    visible_count: number;
    hidden_count: number;
    public_entry_count: number;
    regions_count: number;
    source: string;
  };
  maintenance_exit_candidates?: Array<{
    id: string;
    name: string;
    public_ip?: string | null;
    region_code?: string | null;
    city?: string | null;
    version?: string | null;
    health_status: string;
    last_seen_seconds: number | null;
    active_sessions: number;
    next_step: string;
    recommended_action?: {
      key: 'end_maintenance' | string;
      label: string;
      intent: 'node_policy' | string;
      detail: string;
    };
    source: string;
  }>;
  policy_sync_health?: {
    total_nodes: number;
    synced_nodes: number;
    pending_nodes: number;
    unknown_nodes: number;
    attention_nodes: number;
    label: string;
    risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
    detail: string;
    next_step: string;
    mismatched_field_counts: Record<string, number>;
    problem_nodes?: Array<{
      id: string;
      name: string;
      health_status: string;
      last_seen_seconds: number | null;
      status: 'synced' | 'pending' | 'unknown' | string;
      mismatched_fields: string[];
      message: string;
      next_step: string;
      primary_action?: {
        key: string;
        label: string;
        intent: 'node_policy' | string;
        detail: string;
      };
    }>;
    problem_panel_summary?: {
      status?: string;
      risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
      label: string;
      detail: string;
      next_step?: string;
      count: number;
      visible_count: number;
      hidden_count: number;
      pending_nodes: number;
      unknown_nodes: number;
      source: string;
    };
    source: 'nodes.system.policy_sync' | string;
    privacy_boundary: string;
  };
  policy_enforcement_health?: {
    maintenance_rejections: number;
    max_sessions_rejections: number;
    bandwidth_drops: number;
    bandwidth_drop_bytes?: number;
    bandwidth_limit_bytes_per_second?: number;
    bandwidth_window_bytes?: number;
    total_blocks: number;
    problem_node_count: number;
    critical_nodes: number;
    warning_nodes: number;
    recent_problem_nodes?: number;
    historical_problem_nodes?: number;
    recent_block_window_seconds?: number;
    enforcement_reporting_nodes?: number;
    counter_scope_started_at_min?: number | null;
    counter_scope_started_at_max?: number | null;
    counter_scope_reporting_nodes?: number;
    counter_scope_summary?: {
      status: string;
      risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
      label: string;
      detail: string;
      next_step: string;
      reporting_nodes: number;
      covered_nodes: number;
      missing_nodes: number;
    };
    dominant_block_reason?: {
      key: 'maintenance' | 'max_sessions' | 'bandwidth' | 'none' | string;
      label: string;
      count: number;
      share_percent: number;
      detail: string;
      next_step: string;
      reason_counts: Record<string, number>;
      source: string;
    };
    telemetry_source_counts?: Record<string, number>;
    telemetry_source_summary?: {
      status: string;
      risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
      label: string;
      detail: string;
      next_step: string;
    };
    label: string;
    risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
    detail: string;
    next_step: string;
    problem_nodes?: Array<{
      id: string;
      name: string;
      health_status: string;
      last_seen_seconds: number | null;
      telemetry_source?: string;
      counters_started_at?: number | null;
      maintenance_rejections: number;
      max_sessions_rejections: number;
      bandwidth_drops: number;
      bandwidth_drop_bytes?: number;
      bandwidth_limit_bytes_per_second?: number;
      bandwidth_window_bytes?: number;
      total_blocks: number;
      last_rejection_reason: string | null;
      last_rejection_at: number | null;
      last_rejection_age_seconds?: number | null;
      recent_block_active?: boolean;
      recent_block_window_seconds?: number;
      severity: 'warning' | 'critical' | string;
      next_step: string;
      primary_action?: {
        key: string;
        label: string;
        intent: 'node_policy' | string;
        detail: string;
      };
    }>;
    problem_panel_summary?: {
      status?: string;
      risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
      label: string;
      detail: string;
      next_step?: string;
      count: number;
      visible_count: number;
      hidden_count: number;
      critical_nodes: number;
      warning_nodes: number;
      recent_problem_nodes?: number;
      historical_problem_nodes?: number;
      recent_block_window_seconds?: number;
      enforcement_reporting_nodes?: number;
      counter_scope_started_at_min?: number | null;
      counter_scope_started_at_max?: number | null;
      counter_scope_reporting_nodes?: number;
      counter_scope_summary?: {
        status: string;
        risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
        label: string;
        detail: string;
        next_step: string;
        reporting_nodes: number;
        covered_nodes: number;
        missing_nodes: number;
      };
      dominant_block_reason?: {
        key: 'maintenance' | 'max_sessions' | 'bandwidth' | 'none' | string;
        label: string;
        count: number;
        share_percent: number;
        detail: string;
        next_step: string;
        reason_counts: Record<string, number>;
        source: string;
      };
      telemetry_source_counts?: Record<string, number>;
      telemetry_source_summary?: {
        status: string;
        risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
        label: string;
        detail: string;
        next_step: string;
      };
      maintenance_rejections: number;
      max_sessions_rejections: number;
      bandwidth_drops: number;
      bandwidth_drop_bytes?: number;
      bandwidth_limit_bytes_per_second?: number;
      bandwidth_window_bytes?: number;
      source: string;
    };
    source: 'nodes.system.policy_enforcement' | string;
    privacy_boundary: string;
  };
  commercial_placement_health?: {
    status: 'ready' | 'watch' | 'attention' | 'blocked' | 'pending' | string;
    risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
    label: string;
    detail: string;
    next_step: string;
    total_nodes: number;
    public_entry_nodes: number;
    ready_nodes: number;
    watch_nodes: number;
    blocked_nodes: number;
    regions_count: number;
    active_sessions: number;
    max_capacity_slots: number;
    bounded_capacity_remaining: number;
    unlimited_capacity_nodes: number;
    capacity_score_percent: number;
    policy_sync_attention_nodes: number;
    recent_policy_problem_nodes: number;
    rust_placement_reporting_nodes?: number;
    rust_placement_accepting_nodes?: number;
    rust_placement_missing_nodes?: number;
    rust_placement_coverage_percent?: number;
    rust_placement_rollout_summary?: {
      status: string;
      risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
      label: string;
      detail: string;
      next_step: string;
      reporting_nodes: number;
      accepting_nodes: number;
      missing_nodes: number;
      total_nodes: number;
      coverage_percent: number;
      visible_missing_node_count: number;
      hidden_missing_node_count: number;
      missing_node_list?: Array<{
        id: string;
        name: string;
        health_status: string;
        public_ip?: string | null;
        region_code?: string | null;
        city?: string | null;
        version?: string | null;
        active_sessions: number;
        last_seen_seconds: number | null;
        restart_safety?: {
          safe_to_cutover: boolean;
          status: string;
          risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
          label: string;
          detail: string;
          next_step: string;
          source: string;
        };
        next_step: string;
        primary_action?: {
          key: string;
          label: string;
          intent: 'node_detail' | string;
          detail: string;
        };
        source: string;
      }>;
      source: string;
      privacy_boundary: string;
    };
    visible_problem_count: number;
    hidden_problem_count: number;
    problem_nodes?: Array<{
      id: string;
      name: string;
      status: 'ready' | 'watch' | 'blocked' | string;
      risk: 'healthy' | 'warning' | 'critical' | 'info' | string;
      health_status: string;
      public_ip?: string | null;
      region_code?: string | null;
      city?: string | null;
      version?: string | null;
      maintenance_mode: boolean;
      active_sessions: number;
      max_sessions: number;
      capacity_ratio_percent?: number | null;
      last_seen_seconds: number | null;
      policy_sync_status: string;
      rust_placement_reported?: boolean;
      rust_accepting_new_sessions?: boolean | null;
      rust_placement_status?: string;
      rust_placement_reason?: string;
      recent_policy_block: boolean;
      primary_reason: {
        key: string;
        label: string;
        detail: string;
      };
      blockers: Array<{
        key: string;
        label: string;
        detail: string;
      }>;
      warnings: Array<{
        key: string;
        label: string;
        detail: string;
      }>;
      next_step: string;
      primary_action?: {
        key: string;
        label: string;
        intent: 'node_detail' | string;
        detail: string;
      };
      source: string;
    }>;
    source: string;
    privacy_boundary: string;
  };
  command_delivery_health?: {
    total_nodes: number;
    command_ready_nodes: number;
    attention_nodes: number;
    fresh_nodes: number;
    delayed_nodes: number;
    offline_nodes: number;
    operator_reporting_nodes: number;
    problem_nodes?: Array<{
      id: string;
      name: string;
      health_status: string;
      last_seen_seconds: number | null;
      operator_reporting: boolean;
      issue_code: string;
      issue_label: string;
      recommended_action: string;
      primary_action?: {
        key: string;
        label: string;
        intent: 'node_detail' | 'node_commands' | string;
        detail: string;
      };
    }>;
    problem_panel_summary?: {
      status?: string;
      risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
      label: string;
      detail: string;
      next_step?: string;
      count: number;
      visible_count: number;
      hidden_count: number;
      offline_nodes: number;
      delayed_nodes: number;
      operator_pending_nodes: number;
      source: string;
    };
    fresh_seconds: number;
    degraded_seconds: number;
    summary?: {
      status?: string;
      risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
      label: string;
      detail: string;
      next_step?: string;
      count: number;
    };
    source: string;
    privacy_boundary: string;
  };
  runtime_capability_health?: {
    total_nodes: number;
    capable_nodes: number;
    gap_nodes: number;
    operator_reporting_nodes: number;
    cleanup_reporting_nodes: number;
    rollout_reporting_nodes: number;
    critical_nodes: number;
    warning_nodes: number;
    upgrade_safe_nodes?: number;
    upgrade_blocked_nodes?: number;
    upgrade_blocker_counts?: Record<string, number>;
    upgrade_blockers?: Array<{
      key: string;
      label: string;
      status: 'ready' | 'attention' | 'blocked' | 'healthy' | 'warning' | 'critical' | string;
      count: number;
    }>;
    upgrade_blocker_summary?: {
      status?: string;
      risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
      label: string;
      detail: string;
      next_step?: string;
      count: number;
      top_blocker_key?: string;
    };
    problem_panel_summary?: {
      status?: string;
      risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
      label: string;
      detail: string;
      next_step?: string;
      count: number;
      visible_count: number;
      hidden_count: number;
      safe_to_upgrade_nodes: number;
      blocked_upgrade_nodes: number;
      source: string;
    };
    problem_nodes?: Array<{
      id: string;
      name: string;
      health_status: string;
      last_seen_seconds: number | null;
      maintenance_mode: boolean;
      active_sessions: number;
      operator_reporting: boolean;
      cleanup_reported: boolean;
      rollout_reporting: boolean;
      restart_required: boolean;
      missing_capabilities: string[];
      issue_code: string;
      issue_label: string;
      risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
      recommended_action: string;
      primary_action?: {
        key: string;
        label: string;
        intent: 'sessions' | 'node_detail' | 'node_commands' | string;
        detail: string;
      };
      upgrade_gate?: {
        safe_to_upgrade: boolean;
        status: string;
        risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
        label: string;
        detail: string;
        next_step: string;
        user_impact_if_forced: string;
        checklist?: Array<{
          key: string;
          label: string;
          status: 'ready' | 'attention' | 'blocked' | 'healthy' | 'warning' | 'critical' | string;
          detail: string;
        }>;
        checklist_summary?: {
          total: number;
          ready: number;
          blocked: number;
          attention: number;
          blocking_keys: string[];
          ready_to_upgrade: boolean;
        };
        source: 'restart_readiness.drain_eta.cutover_guard' | string;
      };
    }>;
    summary?: {
      status?: string;
      risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
      label: string;
      detail: string;
      next_step?: string;
      count: number;
    };
    source: string;
    privacy_boundary: string;
  };
  drain_activity_health_counts?: {
    status_counts: Record<string, number>;
    risk_counts: Record<string, number>;
    critical_nodes: number;
    warning_nodes: number;
    summary?: {
      status?: string;
      risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
      label: string;
      detail: string;
      next_step?: string;
      count: number;
    };
    source: 'blocked_nodes.drain_activity.activity_health' | string;
  };
  command_lifecycle_counts?: {
    active: number;
    cancelable_active?: number;
    non_cancelable_active?: number;
    stale: number;
    retry_needed: number;
    terminal: number;
    completed: number;
    failed: number;
    cancelled: number;
    timeout: number;
    summary?: {
      status?: string;
      risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
      label: string;
      detail: string;
      next_step?: string;
      count: number;
    };
    outcome_summary?: {
      status?: string;
      risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
      label: string;
      detail: string;
      next_step?: string;
      count: number;
    };
    history_24h?: {
      window_hours: number;
      window_started_at?: string | null;
      window_ended_at?: string | null;
      total: number;
      active: number;
      terminal: number;
      needs_review: number;
      status_counts: Record<string, number>;
      sent: number;
      acked: number;
      success_rate_percent: number | null;
      delivery_rate_percent: number | null;
      ack_rate_percent: number | null;
      average_completion_seconds: number | null;
      latest_created_at?: string | null;
      latest_completed_at?: string | null;
      latest_any_created_at?: string | null;
      latest_any_status?: string;
      summary?: {
        status?: string;
        risk: 'healthy' | 'info' | 'warning' | 'critical' | string;
        label: string;
        detail: string;
        next_step?: string;
        count: number;
      };
      source: string;
      privacy_boundary: string;
    };
    source: 'nodes.system.restart_readiness.restart_command_metadata' | string;
    privacy_boundary: string;
  };
  blocked_nodes: VpnRestartReadinessBlockedNode[];
  source: string;
  privacy_boundary: string;
}

export type OperatorServiceKey =
  | 'privacy_protocol'
  | 'memchain'
  | 'chat_relay'
  | 'sovereign_data_layer'
  | 'supernode'
  | string;

export type OperatorRiskSeverity = 'critical' | 'warning' | 'info' | string;

export interface OperatorServiceStatus {
  key: OperatorServiceKey;
  label: string;
  enabled: boolean;
  status: 'ok' | 'ready' | 'planned' | 'disabled' | 'degraded' | 'failed' | string;
  summary: string;
  metrics: Record<string, unknown>;
}

export interface OperatorRisk {
  severity: OperatorRiskSeverity;
  code: string;
  message: string;
  remediation: string;
}

export interface VpnOperatorActionSummary {
  status: 'ok' | 'info' | 'warning' | 'critical' | string;
  priority: string;
  title: string;
  detail: string;
  next_step: string;
  source: string;
  privacy_boundary?: string | null;
}

export interface RuntimeRolloutStatus {
  executable_path?: string | null;
  executable_replaced: boolean;
  restart_required: boolean;
  detail: string;
  source: string;
  privacy_boundary: string;
}

export interface RustRuntimeStatus {
  version?: string | null;
  git_commit?: string | null;
  build_profile?: string | null;
  build_target?: string | null;
  process_id?: number | null;
  started_at?: number | null;
  uptime_seconds?: number | null;
  rollout?: RuntimeRolloutStatus | null;
  source?: string | null;
  privacy_boundary?: string | null;
}

/**
 * Rust heartbeat source:
 * /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 * /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *
 * Backend API:
 *   GET /api/privacy_network/vpn/overview/
 * Backend files:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 *   /root/aeronyx/privacy_network/services/heartbeat_service.py
 *
 * Backend stores this under heartbeat system_stats.operator_status and exposes
 * the latest snapshot as data.nodes[].system.operator_status. The payload is
 * service/config telemetry only and must not include user plaintext, social
 * graph contents, DNS contents, packet payloads, browsing history, or
 * wallet-level traffic.
 */
export interface NodeOperatorStatus {
  status: 'ok' | 'attention' | 'critical' | 'failed' | string;
  generated_at: number;
  runtime_rollout?: RuntimeRolloutStatus;
  last_reported_at?: string;
  source?: string;
  services: OperatorServiceStatus[];
  risks: OperatorRisk[];
  privacy_boundary: string;
}

export interface NodeboardHealthContract {
  endpoint?: string;
  file: string;
  purpose: string;
}

export interface NodeboardHealthRuntime {
  git_sha: string;
  git_branch?: string | null;
  build_id?: string | null;
  build_time?: string | null;
  deployed_at: string | null;
  source_dir: string;
  port: string;
  env_file: string;
}

/**
 * Backend API:
 *   GET /api/privacy_network/vpn/overview/
 * Backend file:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 * Durable heartbeat fallback:
 *   /root/aeronyx/privacy_network/services/heartbeat_service.py
 *   Node.hardware_info["vpn_health"].placement_readiness
 * Rust producer files:
 *   /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *
 * This is the Rust process-owned admission snapshot for commercial placement.
 * The backend maps heartbeat.system_stats.vpn_health.placement_readiness first
 * and falls back to the durable Node.hardware_info["vpn_health"] snapshot when
 * heartbeat cache/sample payloads do not carry the nested field. Neither path
 * exposes client public IPs, destinations, DNS contents, packet payloads,
 * domains, URLs, browsing history, voucher secrets, or wallet-level traffic.
 *
 * Node detail pairs missing placement_readiness with:
 *   data.nodes[].system.restart_readiness.drain_eta.cutover_guard
 * from /root/aeronyx/privacy_network/api/vpn_observability.py so operators see
 * backend-authored restart/upgrade safety before rolling out the Rust field.
 * The same panel links to /dashboard/sessions?node={id}&status=active&quality=all
 * and #maintenance-drain for backend-guided operator follow-up.
 * Services also renders those actions for
 * data.summary.restart_readiness.commercial_placement_health
 * .rust_placement_rollout_summary.missing_node_list so fleet triage can route
 * directly to active sessions or node detail without duplicating backend rules.
 */
export interface VpnPlacementReadiness {
  reported: boolean;
  accepting_new_sessions: boolean | null;
  status: 'ready' | 'watch' | 'blocked' | 'missing' | string;
  reason: string;
  detail: string;
  active_sessions: number | null;
  max_sessions: number | null;
  session_capacity_remaining: number | null;
  session_capacity_used_percent: number | null;
  maintenance_mode: boolean | null;
  bandwidth_limit_mbps: number | null;
  bandwidth_limit_bytes_per_second: number | null;
  bandwidth_window_bytes: number | null;
  bandwidth_window_used_percent: number | null;
  traffic_capacity_status: 'ok' | 'watch' | 'limited' | 'unlimited' | 'missing' | string;
  source: string;
  privacy_boundary?: string;
}

export interface VpnCapacityNestedUsage {
  used?: number | null;
  max?: number | null;
  soft_limit?: number | null;
  hard_limit?: number | null;
  used_percent?: number | null;
}

export interface VpnCapacityDiskPath {
  reported?: boolean;
  path?: string;
  total_bytes?: number | null;
  used_bytes?: number | null;
  available_bytes?: number | null;
  used_percent?: number | null;
}

export interface VpnCapacityDiskSnapshot {
  root?: VpnCapacityDiskPath | null;
  state?: VpnCapacityDiskPath | null;
  source?: string | null;
  privacy_boundary?: string | null;
}

export interface VpnCapacityInterface {
  interface?: string;
  rx_bytes?: number | null;
  tx_bytes?: number | null;
  rx_packets?: number | null;
  tx_packets?: number | null;
  rx_dropped?: number | null;
  tx_dropped?: number | null;
  packet_drops?: number | null;
  rx_pps?: number | null;
  tx_pps?: number | null;
  total_pps?: number | null;
  rx_bps?: number | null;
  tx_bps?: number | null;
  total_bps?: number | null;
}

export interface VpnCapacityRiskSnapshot {
  severity: 'critical' | 'warning' | string;
  code: string;
  message: string;
  remediation: string;
  recommended_value?: string | null;
  recommended_command?: string | null;
}

/**
 * Rust capacity snapshot shown in node detail.
 *
 * Backend API:
 *   GET /api/privacy_network/vpn/overview/
 * Backend file:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 * Rust producer:
 *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   Rust v2026-06-16+ provides capacity.risks[] as the authoritative
 *   commercial placement risk list. Older Rust nodes may omit it, so
 *   nodeboard keeps legacy client-side risk inference as a fallback only.
 *
 * Privacy boundary: aggregate node capacity only. No client public IPs,
 * destinations, DNS contents, packet payloads, domains, URLs, browsing
 * history, voucher secrets, or wallet-level traffic.
 */
export interface VpnCapacitySnapshot {
  reported: boolean;
  source: string;
  virtual_ip_range: string | null;
  ip_pool_capacity: number | null;
  ip_pool_used: number | null;
  ip_pool_free: number | null;
  max_connections: number | null;
  policy_max_sessions: number | null;
  active_sessions: number | null;
  session_capacity_remaining: number | null;
  bandwidth_limit_mbps?: number | null;
  bandwidth_limit_bytes_per_second?: number | null;
  bandwidth_window_bytes?: number | null;
  bandwidth_window_used_percent?: number | null;
  traffic_capacity_status?: string | null;
  conntrack: VpnCapacityNestedUsage;
  file_descriptors: VpnCapacityNestedUsage;
  disk?: VpnCapacityDiskSnapshot | null;
  interface: VpnCapacityInterface;
  packet_drops_total: number | null;
  risks?: VpnCapacityRiskSnapshot[] | null;
  privacy_boundary?: string;
}

/**
 * Privacy-safe Rust packet handler runtime counters shown in node detail.
 *
 * Backend API:
 *   GET /api/privacy_network/vpn/overview/
 * Backend file:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 * Rust producer:
 *   /root/open/AeroNyx/crates/aeronyx-server/src/handlers/packet.rs
 *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *
 * Main logical flow:
 * 1. Rust increments aggregate counters inside PacketHandler.
 * 2. /api/vpn/health exposes packet_runtime through signed heartbeat.
 * 3. Backend normalizes the snapshot into nodes[].system.packet_runtime.
 * 4. Node detail shows the coarse stale-session status beside capacity data.
 *
 * Privacy boundary: aggregate node process counters only. No session IDs,
 * wallet IDs, client public IPs, destinations, DNS contents, packet payloads,
 * domains, URLs, browsing history, voucher secrets, private keys, chat
 * plaintext, ciphertext, or wallet-level traffic.
 */
export interface VpnPacketRuntimeSnapshot {
  reported: boolean;
  source: string;
  encrypted_vpn_packets: number | null;
  unknown_session_packets: number | null;
  active_sessions: number | null;
  unknown_session_status: 'clear' | 'stale_after_restart' | 'watch' | 'unknown' | string;
  privacy_boundary?: string;
}

export interface VpnRecentErrorEvent {
  timestamp?: string | null;
  severity: 'info' | 'warning' | 'critical' | string;
  source?: string | null;
  message: string;
  privacy_boundary?: string | null;
}

export interface VpnRecentErrorsSnapshot {
  reported: boolean;
  source: string;
  events: VpnRecentErrorEvent[];
  privacy_boundary?: string;
}

/**
 * Privacy-safe Rust install/upgrade workflow status.
 *
 * Backend API:
 *   GET /api/privacy_network/vpn/overview/
 * Backend file:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 * Rust producers:
 *   /root/open/AeroNyx/deploy/node/upgrade.sh
 *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *
 * The payload is an allow-listed operator workflow snapshot. It intentionally
 * excludes registration codes, private keys, client public IPs, destinations,
 * DNS contents, packet payloads, chat plaintext, voucher secrets, and
 * wallet-level traffic.
 */
export interface VpnUpgradeStatusSnapshot {
  reported: boolean;
  status?: 'running' | 'completed' | 'failed' | 'unreadable' | string | null;
  step?: string | null;
  message?: string | null;
  repo_dir?: string | null;
  branch?: string | null;
  service?: string | null;
  config?: string | null;
  no_restart?: boolean | null;
  force?: boolean | null;
  updated_at?: string | null;
  source?: string | null;
  privacy_boundary?: string | null;
}

/**
 * Local nodeboard runtime health response.
 *
 * Frontend endpoint:
 *   GET /api/health
 * Frontend file:
 *   /root/open/nodeboard/app/api/health/route.ts
 *
 * Backend paths returned by this response:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 *   /root/aeronyx/privacy_network/services/heartbeat_service.py
 *   /root/aeronyx/privacy_network/api/vpn_commands.py
 *   data.nodes[].system.capacity.risks is the backend-sanitized Rust-authored
 *   capacity risk contract surfaced by /root/open/nodeboard/app/api/health/route.ts.
 *
 * Rust producer paths returned by this response:
 *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *
 * This payload is deployment metadata only. It does not include node public
 * keys, client public IPs, DNS contents, packet payloads, domains, URLs,
 * browsing history, voucher secrets, wallet-level traffic, or plaintext social
 * graph data.
 */
export interface NodeboardHealthResponse {
  service: string;
  status: 'ok' | 'degraded' | 'error' | string;
  version: string;
  api_base_url: string;
  frontend_paths: string[];
  backend_contracts: NodeboardHealthContract[];
  rust_producers: NodeboardHealthContract[];
  privacy_boundary: string[];
  runtime: NodeboardHealthRuntime;
  generated_at: string;
}

export type VpnTransportKey = 'udp' | 'tcp_tls' | 'websocket_https' | string;

export interface VpnTransportCarrierStatus {
  key: VpnTransportKey;
  enabled: boolean;
  implemented: boolean;
  active: boolean;
  endpoint?: string | null;
  status: 'active' | 'planned' | 'configured_not_active' | 'degraded' | string;
  detail: string;
}

/**
 * Rust VPN transport capability metadata.
 *
 * Backend API:
 *   GET /api/privacy_network/vpn/overview/
 * Backend file:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 * Rust source:
 *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *
 * Privacy boundary: node-level transport capability only. No client public
 * IPs, destinations, DNS contents, packet payloads, domains, URLs, browsing
 * history, voucher secrets, or wallet-level traffic.
 */
export interface VpnTransportHealthStatus {
  supported_transports: VpnTransportKey[];
  configured_transports: VpnTransportKey[];
  preferred_transport: VpnTransportKey;
  effective_transport: VpnTransportKey;
  fallback_available: boolean;
  udp?: VpnTransportCarrierStatus | null;
  tcp_tls?: VpnTransportCarrierStatus | null;
  websocket_https?: VpnTransportCarrierStatus | null;
  source?: string | null;
  privacy_boundary?: string | null;
}

/**
 * AeroNyx privacy protocol runtime metadata.
 *
 * Backend API:
 *   GET /api/privacy_network/vpn/overview/
 * Backend file:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 * Rust source:
 *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *
 * Privacy boundary: aggregate protocol/runtime status only. No client public
 * IPs, destinations, DNS contents, packet payloads, domains, URLs, browsing
 * history, voucher secrets, chat plaintext, private keys, or wallet-level
 * traffic.
 */
export interface PrivacyProtocolRuntimeStatus {
  active: boolean;
  status: 'ok' | 'degraded' | 'failed' | string;
  detail: string;
  source?: string | null;
  privacy_boundary?: string | null;
}

/**
 * AeroNyx privacy protocol health summary for nodeboard.
 *
 * This contract lets node detail and Services display protocol readiness
 * without re-deriving it from checks[], transport_health, service_manager,
 * and session counters. It is intentionally named around the AeroNyx privacy
 * protocol rather than historical VPN or third-party tunnel terminology.
 */
export interface PrivacyProtocolHealthStatus {
  protocol: string;
  label: string;
  status: 'ok' | 'degraded' | 'failed' | string;
  checked_at?: number | null;
  failed_checks?: number | null;
  active_sessions?: number | null;
  active_wallet_devices?: number | null;
  data_plane?: string | null;
  preferred_transport?: VpnTransportKey | string | null;
  effective_transport?: VpnTransportKey | string | null;
  service_active_state?: string | null;
  protocol_runtime?: PrivacyProtocolRuntimeStatus | null;
  source?: string | null;
  privacy_boundary?: string | null;
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
    /**
     * Backend API:
     *   GET /api/privacy_network/vpn/overview/
     * Backend file:
     *   /root/aeronyx/privacy_network/api/vpn_observability.py
     *
     * cache  = fresh Redis heartbeat cache from signed Rust heartbeat.
     * sample = durable NodeHeartbeat fallback used for audit/history when
     *          cache is unavailable.
     *
     * Node detail and Services use this to avoid treating fallback policy
     * counters as live commercial enforcement impact.
     */
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
    runtime_uptime_seconds?: number | null;
    runtime_version?: string | null;
    runtime_git_commit?: string | null;
    runtime_build_profile?: string | null;
    runtime_build_target?: string | null;
    runtime_process_id?: number | null;
    vpn_health_status?: 'ok' | 'degraded' | 'failed' | string | null;
    vpn_health_checked_at?: number | null;
    configured_mtu?: number | null;
    running_mtu?: number | null;
    /**
     * Rust source:
     *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
     * Backend pass-through:
     *   /root/aeronyx/privacy_network/api/vpn_observability.py
     *
     * DNS ownership metadata only. `dns_owner` identifies whether Rust
     * (`rust_dns_proxy`) or an external host resolver
     * (`external_gateway_dns`) owns gateway_ip:53. It never contains DNS
     * contents, domains, destinations, packet payloads, client public IPs,
     * voucher secrets, browsing history, or wallet-level traffic.
     */
    dns_proxy_enabled?: boolean | null;
    dns_owner?: 'rust_dns_proxy' | 'external_gateway_dns' | string | null;
    /**
     * Rust source:
     *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
     * Backend pass-through:
     *   /root/aeronyx/privacy_network/api/vpn_observability.py
     *
     * Transport capability metadata only. Phase 1 reports UDP as active and
     * TCP/TLS/WebSocket as planned until those runtime carriers are deployed.
     */
    supported_transports?: VpnTransportKey[] | null;
    preferred_transport?: VpnTransportKey | null;
    transport_health?: VpnTransportHealthStatus | null;
    /**
     * Rust source:
     *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
     * Backend pass-through:
     *   /root/aeronyx/privacy_network/api/vpn_observability.py
     *
     * Aggregate AeroNyx privacy protocol readiness only. This is the
     * operator-facing health contract for protocol runtime, data plane,
     * transport, service state, failed check count, and active aggregate
     * sessions. It never carries user IPs, destinations, DNS contents,
     * packet payloads, domains, URLs, browsing history, voucher secrets,
     * chat plaintext, private keys, or wallet-level traffic.
     */
    privacy_protocol_health?: PrivacyProtocolHealthStatus | null;
    service_manager?: VpnServiceManagerStatus | null;
    /**
     * Backend API:
     *   GET /api/privacy_network/vpn/overview/
     * Backend file:
     *   /root/aeronyx/privacy_network/api/vpn_observability.py
     * Rust source:
     *   /root/open/AeroNyx/crates/aeronyx-server/src/services/session.rs
     *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
     *
     * Privacy boundary: cleanup policy metadata only. No client public IPs,
     * destinations, DNS contents, packet payloads, domains, URLs, browsing
     * history, voucher secrets, or wallet-level traffic.
     */
    session_cleanup?: VpnSessionCleanupStatus | null;
    runtime?: RustRuntimeStatus | null;
    restart_readiness?: VpnRestartReadiness | null;
    placement_readiness?: VpnPlacementReadiness | null;
    capacity?: VpnCapacitySnapshot | null;
    /**
     * Rust source:
     *   /root/open/AeroNyx/crates/aeronyx-server/src/handlers/packet.rs
     *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
     * Backend pass-through:
     *   /root/aeronyx/privacy_network/api/vpn_observability.py
     *
     * Aggregate packet runtime counters only. The field helps operators see
     * whether packets are being dropped because a Rust node restarted and
     * clients still use stale sessions. It never contains session IDs, client
     * public IPs, destinations, DNS contents, packet payloads, domains, URLs,
     * browsing history, voucher secrets, chat plaintext, ciphertext, private
     * keys, or wallet-level traffic.
     */
    packet_runtime?: VpnPacketRuntimeSnapshot | null;
    recent_errors?: VpnRecentErrorsSnapshot | null;
    upgrade_status?: VpnUpgradeStatusSnapshot | null;
    operator_action?: VpnOperatorActionSummary | null;
    policy_sync?: VpnPolicySync;
    policy_enforcement?: VpnPolicyEnforcement;
    runtime_recovery?: VpnRuntimeRecovery;
    operator_status?: NodeOperatorStatus | null;
    /**
     * Rust source:
     *   /root/open/AeroNyx/crates/aeronyx-server/src/management/client.rs
     *   /root/open/AeroNyx/crates/aeronyx-server/src/server.rs
     *   /root/open/AeroNyx/crates/aeronyx-server/src/services/peer_store.rs
     * Backend pass-through:
     *   /root/aeronyx/privacy_network/api/vpn_observability.py
     *
     * Aggregate AeroNyx node-discovery telemetry only. Contains peer counts,
     * gossip timestamps, and rejected/stale counters. It never contains client
     * public IPs, destinations, DNS contents, packet payloads, chat plaintext,
     * voucher secrets, private keys, or wallet-level traffic.
     */
    discovery_status?: DiscoveryStatus | null;
    /**
     * Rust source:
     *   /root/open/AeroNyx/crates/aeronyx-server/src/management/client.rs
     *   /root/open/AeroNyx/crates/aeronyx-server/src/server.rs
     *   /root/open/AeroNyx/crates/aeronyx-server/src/services/chat_relay.rs
     * Backend pass-through:
     *   /root/aeronyx/privacy_network/api/vpn_observability.py
     *
     * Aggregate encrypted chat peer relay health only. Contains fanout status,
     * accepted/rejected counters, and stable failure buckets. It never
     * contains message IDs, wallet IDs, client public IPs, destinations, DNS
     * contents, packet payloads, chat plaintext, ciphertext, private keys,
     * voucher secrets, or per-user traffic.
     */
    chat_relay_status?: ChatRelayStatus | null;
  };
  checks: VpnHealthCheck[];
}

export interface DiscoveryPeerStoreSnapshot {
  total_peers: number;
  valid_peers: number;
  public_peers: number;
  public_exit_peers: number;
}

export interface DiscoveryRuntimeStats {
  total_imported: number;
  inserted: number;
  unchanged: number;
  stale: number;
  rejected: number;
  capacity_rejected: number;
  policy_rejected: number;
  rate_limited: number;
  last_import_at: number | null;
  last_gossip_at: number | null;
  last_snapshot_at: number | null;
}

export interface DiscoveryPeerStoreStatus {
  snapshot: DiscoveryPeerStoreSnapshot;
  runtime: DiscoveryRuntimeStats;
  max_peers: number | null;
  recent_audit_events?: DiscoveryAuditEvent[];
  bootstrap?: DiscoveryBootstrapStatus;
  /**
   * Rust-authored aggregate readiness gate for using node discovery as a
   * relay/multihop foundation. It intentionally contains only derived
   * health, ages, and boolean recovery metadata.
   */
  stability?: DiscoveryPeerStoreStabilityStatus;
}

export interface DiscoveryPeerStoreStabilityStatus {
  health: 'disabled' | 'pending' | 'healthy' | 'degraded' | 'stale' | 'failed' | string;
  relay_foundation_ready: boolean;
  detail: string;
  next_action: string;
  last_gossip_success_age_seconds: number | null;
  last_gossip_round_age_seconds: number | null;
  seed_recovery_configured: boolean;
  stale_after_seconds: number;
}

export interface DiscoveryAuditEvent {
  at: number;
  action: string;
  outcome: string;
  detail: string;
}

export interface DiscoveryBootstrapStatus {
  enabled: boolean;
  peer_cache_configured: boolean;
  gossip_enabled: boolean;
  seed_endpoints_configured?: number;
  last_source_kind: string | null;
  last_source_status: string | null;
  last_source_detail: string | null;
  last_source_at: number | null;
  self_descriptor_status: string | null;
  self_descriptor_at: number | null;
  last_cache_save_status: string | null;
  last_cache_save_detail: string | null;
  last_cache_save_at: number | null;
  last_gossip_attempted: number;
  last_gossip_seed_attempted?: number;
  last_gossip_succeeded: number;
  last_gossip_failed?: number;
  last_gossip_status?: string | null;
  last_gossip_failure_reason?: string | null;
  consecutive_gossip_failures?: number;
  last_gossip_success_at?: number | null;
  last_gossip_round_at: number | null;
}

export interface DiscoveryStatus {
  generated_at: number;
  peer_store: DiscoveryPeerStoreStatus;
  source?: string;
  privacy_boundary?: string;
}

export interface ChatRelayPeerStatus {
  enabled: boolean;
  outbound_attempted_total: number;
  outbound_accepted_total: number;
  outbound_failed_total: number;
  outbound_rounds: number;
  last_outbound_attempted: number;
  last_outbound_accepted: number;
  last_outbound_failed: number;
  last_outbound_status: 'healthy' | 'degraded' | 'failed' | 'idle' | string | null;
  last_outbound_failure_reason: string | null;
  consecutive_outbound_failures: number;
  last_outbound_success_at: number | null;
  last_outbound_at: number | null;
  inbound_accepted_total: number;
  inbound_duplicate_total: number;
  inbound_delivered_online_total: number;
  inbound_stored_pending_total: number;
  inbound_rejected_total: number;
  last_inbound_status: 'accepted' | 'duplicate' | 'rejected' | string | null;
  last_inbound_failure_reason: string | null;
  last_inbound_at: number | null;
}

export interface ChatRelayStatus {
  generated_at: number;
  peer_relay: ChatRelayPeerStatus;
  source?: string;
  privacy_boundary?: string;
  last_reported_at?: string | null;
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
  restart_readiness?: VpnRestartReadinessSummary;
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

export interface VpnServerCandidate {
  id: string;
  name: string;
  address: string | null;
  port: number;
  country: string;
  country_name: string;
  region_code: string;
  city: string;
  flag: string;
  latency: number | null;
  available: boolean;
  load: number | null;
  health_status: VpnHealthStatus | 'maintenance' | string;
  health_score: number;
  unavailable_reason: string | null;
  capacity_remaining: number | null;
  availability_24h_percent: number | null;
  availability_sample_count: number;
  availability_last_gap_seconds: number | null;
  availability_gap_threshold_seconds: number | null;
  maintenance_mode: boolean;
  node_tier: 'public' | 'premium' | string;
  max_sessions: number;
  bandwidth_limit_mbps: number;
  protocol: string;
  last_seen: string | null;
  current_sessions: number;
  failover_rank: number | null;
}

export interface VpnServerPlacementGroup {
  key: string;
  label: string;
  region_code?: string;
  country?: string;
  country_name?: string;
  flag?: string;
  tier?: string;
  total: number;
  available: number;
  unavailable: number;
  active_sessions: number;
  capacity_remaining: number;
  unlimited_capacity_nodes: number;
  average_health_score: number | null;
  average_load: number | null;
  best_failover_rank: number | null;
  unavailable_reasons: Record<string, number>;
}

export interface VpnServerPlacementSummary {
  available_capacity_remaining: number;
  unlimited_capacity_nodes: number;
  unavailable_reasons: Record<string, number>;
  by_region: VpnServerPlacementGroup[];
  by_tier: VpnServerPlacementGroup[];
  privacy_note: string;
  generated_at: string;
}

export interface VpnServerListResponse {
  servers: VpnServerCandidate[];
  data: VpnServerCandidate[];
  total: number;
  online: number;
  available: number;
  summary?: VpnServerPlacementSummary;
  generated_at: string;
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
    q: string;
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
  | 'apply_policy'
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
  source?: string;
  issued_by: {
    id: string;
    wallet_address?: string;
    wallet_short: string;
    wallet_type: string;
  } | null;
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
  action: 'system_info' | 'collect_logs' | 'kick_session' | 'ban_wallet' | 'unban_wallet' | 'refresh_config' | 'apply_policy' | 'restart_service';
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
