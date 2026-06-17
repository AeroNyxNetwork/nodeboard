/**
 * ============================================
 * AeroNyx Node Services Page
 * ============================================
 * File Path: app/dashboard/services/page.tsx
 *
 * Creation Reason: Nodeboard is evolving from a VPN-only dashboard into the
 * AeroNyx node operator console. This page gives operators one place to inspect
 * Privacy Protocol, MemChain, ChatRelay, Sovereign Data Layer, and SuperNode
 * readiness.
 *
 * Modification Reason:
 *   v1.1.67 - Added a collapsible VPN DNS module so operators can inspect
 *     gateway DNS ownership, dns_stub, and dns_query readiness per node
 *     without expanding the first-level Services page.
 *   v1.1.66 - Added a collapsible fleet Node Capacity module so operators can
 *     inspect IP pool, session ceiling, conntrack, fd, packet drops, pps, and
 *     bps without crowding the first-level Services page.
 *   v1.1.65 - Prefer Rust-authored data.nodes[].system.capacity.risks so the
 *     Services fleet summary uses the same commercial capacity blockers and
 *     remediation text as node detail, healthcheck.sh, and backend automation.
 *   v1.1.64 - Added first-screen fleet capacity risk summary from
 *     data.nodes[].system.capacity so commercial operators can see IP pool,
 *     session ceiling, conntrack, fd, and packet-drop risks before opening
 *     per-node detail pages.
 *   v1.1.63 - Collapsed secondary operational reports behind detail module
 *     buttons so the first-level Services page answers commercial readiness
 *     before exposing placement, rollout, policy, and node-table diagnostics.
 *   v1.1.62 - Promoted backend commercial_placement_health into a first-screen
 *     fleet commercial operations summary so operators can see Ready,
 *     Degraded, Blocked, Maintenance, and Needs Rust upgrade counts before
 *     entering detailed restart/readiness panels.
 *
 * Backend APIs used on this page:
 *   - GET /api/privacy_network/vpn/overview/
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Provides data.nodes[].checks from Rust /api/vpn/health so Services can
 *     explain placement blockers such as dns_stub and dns_query failures.
 *     Provides data.nodes[].system.service_manager.active_state/load_state
 *     from Rust /api/vpn/health so rollout gates can distinguish systemd
 *     loaded-but-inactive nodes from active service-managed nodes.
 *     Provides data.nodes[].system.restart_readiness.drain_eta so Runtime
 *     Rollout can explain active-session drain status before controlled Rust
 *     restarts.
 *   - GET /api/privacy_network/vpn/servers/
 *     /root/aeronyx/privacy_network/api/vpn_servers.py
 *     Provides client placement capacity summary used by Services to show
 *     available nodes, remaining capped slots, unlimited-capacity nodes, and
 *     region/tier placement health from the same backend failover policy used
 *     by VPN clients.
 *   - PATCH /api/privacy_network/nodes/{id}/
 *     /root/aeronyx/privacy_network/api/nodes.py
 *     Used only for operator-approved maintenance_mode changes from the
 *     restart readiness gate.
 *   - POST /api/privacy_network/nodes/{id}/commands/run/
 *     /root/aeronyx/privacy_network/api/vpn_commands.py
 *     /root/aeronyx/privacy_network/services/command_service.py
 *     Queues restart_service only after the restart readiness gate is ready.
 *   - POST /api/privacy_network/nodes/{id}/commands/{cmd_id}/cancel/
 *     /root/aeronyx/privacy_network/api/vpn_commands.py
 *     Cancels only active restart_service queue entries from fleet triage
 *     before Rust reaches a terminal command state.
 *     data.nodes[].system.restart_readiness.active_restart_command.can_cancel
 *     and cancel_reason are provided by vpn_observability.py from backend
 *     NodeCommand.mark_cancelled rules; the UI does not infer cancel policy.
 *   - data.nodes[].system.restart_readiness.active_restart_command
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Mirrors NodeCommand restart_service pending/sent/executing state so the
 *     fleet view does not offer duplicate restarts. The Action Queue renders
 *     this as a compact command timeline using id/status/created_at only.
 *   - data.nodes[].system.restart_readiness.latest_restart_command
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Exposes terminal restart_service lifecycle metadata for command outcome
 *     closure without returning params, result, or error_message payloads.
 *     Also includes age_seconds/stale_after_seconds/is_stale so operators can
 *     identify restart commands stuck beyond the backend SLA.
 *   - data.nodes[].system.restart_readiness.drain_eta
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Aggregates active ClientSession timing for maintenance drain visibility.
 *     Includes cutover_guard.safe_to_cutover/status/risk/next_step so Services
 *     can show whether replacing or restarting Rust is commercially safe
 *     without parsing backend English copy.
 *   - data.nodes[].city / data.nodes[].region_code / data.nodes[].version
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Joined by node id with blocked_nodes to filter restart queues by
 *     commercial region and Rust node version without expanding backend
 *     blocked-node privacy payloads.
 *   - data.summary.restart_readiness.blocker_counts
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Drives the fleet restart blocker playbook shown in this page.
 *   - data.summary.restart_readiness.blocked_nodes[].recommended_action
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Provides the backend-authored next operator action for each blocked node.
 *     cleanup_policy_pending uses intent=node_detail because the operator must
 *     inspect Rust heartbeat rollout before waiting on stale-session cleanup.
 *   - data.summary.restart_readiness.command_delivery_health
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Aggregates Rust heartbeat freshness and backend operator_reporting so
 *     the Services page can show whether restart commands can be delivered
 *     before operators queue fleet actions. problem_panel_summary and
 *     problem_nodes[].primary_action are backend-authored delivery blocker
 *     triage; nodeboard only maps the intent to operator navigation.
 *   - data.summary.restart_readiness.runtime_capability_health
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Aggregates Rust operator_status and session_cleanup capability reporting
 *     for the Rust Capability card, Rust Capability Gaps panel, and Restart
 *     Action Queue. problem_nodes is backend-authored; React only maps it to
 *     operator navigation. rollout_reporting confirms operator_status includes
 *     runtime_rollout instead of assuming operator_status alone is enough.
 *     problem_nodes[].upgrade_gate mirrors backend cutover_guard so runtime
 *     upgrade tasks show whether replacing/restarting Rust is safe right now.
 *     upgrade_gate.checklist and checklist_summary are backend-authored
 *     upgrade preflight copy and counts. primary_action is the backend-owned
 *     operator intent for the Restart Action Queue button.
 *     upgrade_blockers is backend-authored fleet blocker display order and
 *     copy; upgrade_blocker_summary is the backend-authored card sentence and
 *     next-step copy; problem_panel_summary is backend-authored context for
 *     the Rust Capability Gaps panel; upgrade_blocker_counts remains a
 *     compatibility map.
 *   - data.summary.restart_readiness.policy_sync_health
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Aggregates data.nodes[].system.policy_sync so Services can verify
 *     max_sessions and bandwidth_limit_mbps changes have reached Rust
 *     node_policy before operators trust commercial capacity limits.
 *     problem_panel_summary and problem_nodes[].primary_action are backend
 *     remediation metadata for the Policy Sync attention panel.
 *   - data.summary.restart_readiness.policy_enforcement_health
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Aggregates data.nodes[].system.policy_enforcement so Services can show
 *     whether maintenance, max_sessions, or bandwidth policy is actively
 *     blocking handshakes or packets in Rust node_policy. problem_panel_summary
 *     and problem_nodes[].primary_action drive the Policy Blocks panel.
 *     telemetry_source_counts / telemetry_source_summary show whether the
 *     counters are fresh heartbeat cache, durable sample fallback, or missing.
 *     counter_scope_started_at_min / counter_scope_started_at_max summarize
 *     Rust process-local counter age across the fleet.
 *     counter_scope_summary is backend-authored coverage quality for that
 *     Rust counters_started_at rollout.
 *     dominant_block_reason is backend-authored guidance for whether fleet
 *     policy blocks are mainly maintenance, max_sessions, or bandwidth.
 *   - data.summary.restart_readiness.commercial_placement_health
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Combines data.nodes[], policy_sync_health, and policy_enforcement_health
 *     into backend-authored ready/watch/blocked classification for commercial
 *     AeroNyx Privacy Protocol placement. Services renders the operator
 *     decision and primary_action only; it does not infer paid placement rules.
 *     New Rust runtimes report data.nodes[].system.placement_readiness from
 *     /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs and
 *     /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs, so this
 *     card can show runtime-owned admission coverage.
 *     rust_placement_rollout_summary is backend-authored coverage copy and
 *     next-step guidance for placement_readiness rollout.
 *     rust_placement_rollout_summary.missing_node_list is backend-sorted
 *     rollout work; Services only renders the target nodes and routes actions.
 *     missing_node_list[].restart_safety mirrors backend cutover_guard so
 *     Services can show whether a missing runtime may be restarted now.
 *     missing_node_list[].active_sessions and restart_safety.next_step drive
 *     direct active-session and node-detail follow-up links in the fleet
 *     placement rollout panel.
 *   - data.summary.restart_readiness.blocked_nodes[].drain_activity
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Mirrors node-level drain_eta activity buckets for fleet triage without
 *     exposing client IPs, wallets, destinations, DNS, payloads, or browsing.
 *     Includes keepalive_missed_sessions / keepalive_pending_sessions so large
 *     counters can be interpreted as affected-session counts.
 *     Includes recent_client_rx_sessions / stale_client_rx_sessions /
 *     never_client_rx_sessions so old Rust runtimes that keep server-side TX
 *     timestamps moving do not look like they still have fresh client traffic.
 *     Includes activity_health from backend commercial triage rules.
 *   - data.summary.restart_readiness.drain_activity_health_counts
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Powers the top-level Drain Risk card in the restart readiness panel.
 *     summary is backend-authored copy and next_step so nodeboard does not
 *     reimplement fleet drain risk business rules.
 *   - data.summary.restart_readiness.cutover_guard_counts
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Aggregates data.nodes[].system.restart_readiness.drain_eta.cutover_guard
 *     so Services can show fleet-level safe/blocked Rust cutover state without
 *     parsing backend English copy.
 *     actionable_problem_nodes is backend-authored input for the Cutover
 *     Blockers action queue. problem_nodes remains the full safety accounting
 *     list for the Cutover Safety card.
 *   - data.summary.restart_readiness.command_lifecycle_counts
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Powers the Command SLA card from backend-authored active/stale/retry
 *     restart_service lifecycle counts plus cancelable_active and
 *     non_cancelable_active active command counts. outcome_summary powers the
 *     Restart Outcome Audit panel from latest per-node restart_service terminal
 *     statuses, while history_24h powers the 24h reliability strip and
 *     latest_any restart command context without exposing command params,
 *     result, or error_message.
 *   - data.summary.restart_readiness.maintenance_exit_candidates
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Lists current/drained nodes still in maintenance mode so Services can
 *     recover commercial client placement capacity with PATCH
 *     /api/privacy_network/nodes/{id}/ maintenance_mode=false.
 *     maintenance_exit_summary provides backend-authored visible/hidden
 *     candidate, public entry, and region counts for the recovery panel.
 *     Includes node placement metadata public_ip / region_code / city /
 *     version so operators understand which commercial entry point returns
 *     to client placement before ending maintenance mode.
 *     Candidate selection is sourced from
 *     data.nodes[].system.restart_readiness.operator_action_plan.recommended_actions
 *     key=end_maintenance so Services and node detail share one backend
 *     action policy.
 *   - data.nodes[].system.capacity
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Mirrors Rust /api/vpn/health aggregate capacity telemetry. Services
 *     uses it only for fleet-level commercial capacity risk counts and
 *     node-detail links; it does not expose client public IPs, destinations,
 *     DNS contents, packet payloads, domains, URLs, browsing history,
 *     voucher secrets, or wallet-level traffic.
 *
 * Rust heartbeat source:
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *
 * Data Contract:
 *   Rust reports service readiness under:
 *     heartbeat.system_stats.operator_status
 *   Rust reports maintenance drain cleanup policy under:
 *     heartbeat.system_stats.vpn_health.session_cleanup
 *   Django stores it in:
 *     Node.hardware_info["operator_status"]
 *   Django exposes it to nodeboard as:
 *     GET /api/privacy_network/vpn/overview/
 *       data.nodes[].system.operator_status
 *       data.nodes[].system.session_cleanup
 *
 * Product Requirement:
 *   Treat this as a commercial node readiness console, not a VPN-only page.
 *   Operators need a clear answer to: which nodes can serve AeroNyx Privacy
 *   Protocol traffic today, which service layers are enabled, what risks need
 *   remediation, and whether the backend/Rust heartbeat path is fresh.
 *
 * Last Modified: v1.1.67 - Add VPN DNS ownership detail module
 * Previous: v1.1.66 - Add fleet Node Capacity detail module
 * Previous: v1.1.65 - Prefer Rust-authored capacity risks
 * Previous: v1.1.64 - Show fleet capacity risk summary
 * Previous: v1.1.63 - Collapse secondary detail modules
 * Previous: v1.1.62 - Add fleet commercial operations summary
 * Previous: v1.1.61 - Add placement rollout fleet action links
 * Previous: v1.1.60 - Show Rust placement rollout restart safety
 * Previous: v1.1.59 - Show Rust placement rollout missing nodes
 * Previous: v1.1.58 - Show Rust placement rollout coverage
 * Previous: v1.1.57 - Show Rust placement readiness
 * Previous: v1.1.56 - Show commercial placement health
 * Previous: v1.1.55 - Show dominant policy block reason
 * Previous: v1.1.54 - Show fleet policy counter scope coverage
 * Previous: v1.1.53 - Show fleet policy counter scope
 * Previous: v1.1.52 - Show policy telemetry source quality
 * Previous: v1.1.51 - Show fleet bandwidth limiter bytes
 * Previous: v1.1.50 - Link rollout blockers to active sessions
 * Previous: v1.1.49 - Add drain age chips
 * Previous: v1.1.48 - Show long-tail drain session age
 * Previous: v1.1.47 - Show cleanup policy rollout gate
 * Previous: v1.1.46 - Surface drain activity health in rollout gates
 * Previous: v1.1.45 - Explain staged DNS rollout impact
 * Previous: v1.1.44 - Add DNS gateway gate to rollout cards
 * Previous: v1.1.43 - Show rollout restart gates
 * Previous: v1.1.42 - Add visual drain composition for restart gating
 * Previous: v1.1.41 - Show runtime rollout drain ETA
 * Previous: v1.1.40 - Show Rust service manager active state
 * Previous: v1.1.39 - Explain placement blockers with failed health checks
 * Previous: v1.1.38 - Show placement blocker node triage
 * Previous: v1.1.37 - Refresh placement capacity after maintenance changes
 * Previous: v1.1.36 - Show client placement capacity
 * Previous: v1.1.35 - Show fleet policy enforcement blocks
 * Previous: v1.1.34 - Show fleet policy sync health
 * Previous: v1.1.33 - Show maintenance exit placement context
 * Previous: v1.1.32 - Source maintenance exit from action plan
 * Previous: v1.1.31 - Show maintenance exit candidates
 * Previous: v1.1.30 - Show command delivery issue nodes
 * Previous: v1.1.29 - Show command delivery health
 * Previous: v1.1.28 - Show latest restart command activity context
 * Previous: v1.1.27 - Show 24h restart command reliability
 * Previous: v1.1.26 - Show restart outcome audit summary
 * Previous: v1.1.25 - Show fleet restart cancelability counts
 * Previous: v1.1.24 - Explain backend cancel eligibility in fleet triage
 * Previous: v1.1.23 - Cancel active restart commands from fleet triage
 * Previous: v1.1.22 - Show fleet command SLA summary
 * Previous: v1.1.21 - Show stale restart command SLA
 * Previous: v1.1.20 - Close restart command outcomes
 * Previous: v1.1.19 - Show restart command timeline in action queue
 * Previous: v1.1.18 - Add queue filters and stable impact ordering
 * Previous: v1.1.17 - Add prioritized restart action queue
 * Previous: v1.1.16 - Show backend drain risk next step
 * Previous: v1.1.15 - Use backend-authored fleet drain risk copy
 * Previous: v1.1.14 - Show fleet drain risk summary
 * Previous: v1.1.13 - Show backend drain activity health badge
 * Previous: v1.1.12 - Show keepalive issue session counts
 * Previous: v1.1.11 - Show blocked node drain activity summary
 * Previous: v1.1.10 - Show cleanup rollout blocker action
 * Previous: v1.1.9 - Show backend recommended blocker action
 * Previous: v1.1.8 - Added restart blocker playbook copy
 * Previous: v1.1.7 - Show restart drain ETA
 * Previous: v1.1.6 - Show active restart command state
 * Previous: v1.1.5 - Added restart gate command action
 * Previous: v1.1.4 - Added restart gate maintenance action
 * Previous: v1.1.3 - Added fleet restart readiness decision panel
 * Previous: v1.1.2 - Added live refresh state for drain and rollout monitoring
 * ============================================
 */

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCancelNodeCommand, useRunNodeCommand, useUpdateNode, useVpnOverview, useVpnServers } from '@/hooks/useNodes';
import { formatDuration, formatRelativeTime } from '@/lib/api';
import { POLLING_INTERVALS } from '@/lib/constants';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  NodeOperatorStatus,
  OperatorRisk,
  OperatorServiceStatus,
  RuntimeRolloutStatus,
  VpnNodeHealth,
  VpnRestartCommandState,
  VpnRestartCutoverProblemNode,
  VpnRestartDrainEta,
  VpnRestartReadiness,
  VpnRestartReadinessSummary,
  VpnServiceManagerStatus,
  VpnServerCandidate,
  VpnServerPlacementSummary,
  VpnSessionCleanupStatus,
  VpnTransportHealthStatus,
} from '@/types';

type ServiceKey =
  | 'privacy_protocol'
  | 'memchain'
  | 'chat_relay'
  | 'sovereign_data_layer'
  | 'supernode';

type ServiceDetailSection =
  | 'placement'
  | 'capacity'
  | 'transport'
  | 'dns'
  | 'restart'
  | 'layers'
  | 'risks'
  | 'nodes';

type ServicesTranslateFn = (key: string, values?: Record<string, string | number>) => string;

interface ServiceView {
  key: ServiceKey;
  label: string;
  eyebrow: string;
  status: string;
  summary: string;
  enabledCount: number;
  totalCount: number;
  detail: string;
  reportingCount: number;
  metricChips: string[];
}

interface FleetSummary {
  totalNodes: number;
  reportingNodes: number;
  healthyPrivacyNodes: number;
  attentionNodes: number;
  rolloutRestartRequired: number;
  enabledServices: number;
  totalServiceSlots: number;
}

interface FleetCapacityRisk {
  nodeId: string;
  nodeName: string;
  region: string;
  tone: 'critical' | 'warning';
  label: string;
  detail: string;
  action: string;
  code?: string;
}

interface FleetDnsNode {
  id: string;
  name: string;
  region: string;
  gateway: string;
  ownerLabel: string;
  ownerDetail: string;
  status: 'ok' | 'warning' | 'pending' | 'failed';
  dnsStubOk: boolean | null;
  dnsQueryOk: boolean | null;
  dnsStubDetail: string;
  dnsQueryDetail: string;
  checkedAt: number | null;
}

interface FleetTransportNode {
  id: string;
  name: string;
  region: string;
  supported: string[];
  configured: string[];
  preferred: string;
  effective: string;
  fallbackAvailable: boolean;
  udpStatus: string;
  tcpTlsStatus: string;
  websocketStatus: string;
  status: 'ok' | 'warning' | 'pending' | 'failed';
  source: string;
}

interface PageHeaderProps {
  isFetching: boolean;
  dataUpdatedAt: number;
  refreshIntervalMs: number;
  onRefresh: () => void;
}

interface OperationNotice {
  type: 'success' | 'error';
  message: string;
}

interface RiskView extends OperatorRisk {
  nodeName: string;
}

interface PendingOperatorNode {
  id: string;
  name: string;
  publicIp: string | null;
  activeSessions: number;
  healthStatus: string;
  lastHeartbeat: string | null;
  version: string;
}

interface RuntimeRolloutNode {
  id: string;
  name: string;
  publicIp: string | null;
  activeSessions: number;
  maintenanceMode: boolean;
  healthStatus: string;
  lastHeartbeat: string | null;
  rollout: RuntimeRolloutStatus;
  serviceManager: VpnServiceManagerStatus | null;
  policySync: VpnNodeHealth['system']['policy_sync'] | null;
  dnsChecks: VpnNodeHealth['checks'];
  drainEta: VpnRestartDrainEta | null;
}

interface RestartReadinessNode {
  id: string;
  name: string;
  publicIp: string | null;
  regionLabel: string;
  version: string;
  activeSessions: number;
  maintenanceMode: boolean;
  healthStatus: string;
  lastHeartbeat: string | null;
  operatorReporting: boolean;
  restartRequired: boolean;
  cleanupReported: boolean;
  status: 'ready' | 'blocked' | 'pending' | 'current';
  canRestart: boolean;
  activeRestartCommand: VpnRestartCommandState | null;
  latestRestartCommand: VpnRestartCommandState | null;
  drainEta: VpnRestartDrainEta | null;
  nextStep: string;
  blockers: string[];
  source: string;
}

type RestartActionQueueKey = 'stale' | 'retry' | 'capability' | 'cutover' | 'critical' | 'warning' | 'ready' | 'current';
type RestartQueueStatusFilter = 'all' | 'attention' | 'capability' | 'stale' | 'retry' | 'blocked' | 'ready' | 'current';

interface RestartQueueFilters {
  region: string;
  version: string;
  status: RestartQueueStatusFilter;
}

interface RestartActionQueueItem {
  id: string;
  name: string;
  status: string;
  detail: string;
  meta: string[];
  risk: string;
  regionLabel: string;
  version: string;
  healthStatus: string;
  activeRestartCommand: VpnRestartCommandState | null;
  latestRestartCommand: VpnRestartCommandState | null;
  activeSessions: number;
  maintenanceMode: boolean;
  canEnableMaintenance: boolean;
  canQueueRestart: boolean;
  canCancelRestartCommand: boolean;
  actionHref: string;
  actionLabel: string;
  source: 'backend_blocked_node' | 'backend_cutover_guard' | 'backend_runtime_capability' | 'backend_readiness_node';
}

interface RestartActionQueue {
  key: RestartActionQueueKey;
  label: string;
  description: string;
  status: string;
  emptyState: string;
  items: RestartActionQueueItem[];
}

interface SessionCleanupRolloutNode {
  id: string;
  name: string;
  publicIp: string | null;
  activeSessions: number;
  healthStatus: string;
  lastHeartbeat: string | null;
  cleanup: VpnSessionCleanupStatus | null;
  operatorReporting: boolean;
  restartRequired: boolean;
}

const restartQueueStatusFilters: Array<{ value: RestartQueueStatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'attention', label: 'Needs action' },
  { value: 'capability', label: 'Rust capability' },
  { value: 'stale', label: 'Stale command' },
  { value: 'retry', label: 'Retry needed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'ready', label: 'Ready' },
  { value: 'current', label: 'Current' },
];

const serviceMeta: Record<ServiceKey, { label: string; eyebrow: string }> = {
  privacy_protocol: {
    label: 'AeroNyx Privacy Protocol',
    eyebrow: 'Privacy transport',
  },
  memchain: {
    label: 'MemChain / MPI',
    eyebrow: 'AI memory',
  },
  chat_relay: {
    label: 'Zero-Knowledge Chat Relay',
    eyebrow: 'Encrypted messaging',
  },
  sovereign_data_layer: {
    label: 'Sovereign Data Layer',
    eyebrow: 'Encrypted RPC',
  },
  supernode: {
    label: 'SuperNode Cognitive Worker',
    eyebrow: 'AI worker',
  },
};

const statusStyles: Record<string, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  current: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  healthy: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  attention: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  degraded: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  planned: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  pending: 'border-white/10 bg-white/5 text-gray-300',
  blocked: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  disabled: 'border-white/10 bg-white/5 text-gray-400',
  failed: 'border-red-500/30 bg-red-500/10 text-red-300',
  critical: 'border-red-500/30 bg-red-500/10 text-red-300',
  offline: 'border-red-500/30 bg-red-500/10 text-red-300',
  overloaded: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
};

function statusClass(status: string) {
  return statusStyles[status] ?? statusStyles.pending;
}

function normalizeStatus(status: string | null | undefined) {
  if (!status) return 'pending';
  if (status === 'healthy') return 'ok';
  if (status === 'offline' || status === 'overloaded') return 'failed';
  return status;
}

function collectOperatorStatuses(nodes: VpnNodeHealth[]): NodeOperatorStatus[] {
  return nodes
    .map((node) => node.system?.operator_status)
    .filter((status): status is NodeOperatorStatus => Boolean(status));
}

function nodeOperatorStatus(node: VpnNodeHealth): NodeOperatorStatus | null {
  return node.system?.operator_status ?? null;
}

function nodeRegionLabel(node: VpnNodeHealth) {
  return node.city || node.region_code || 'unknown region';
}

function nodeVersionLabel(version: string | null | undefined) {
  return version?.trim() || 'unknown version';
}

function collectService(statuses: NodeOperatorStatus[], key: ServiceKey): OperatorServiceStatus[] {
  return statuses
    .map((status) => status.services.find((service) => service.key === key))
    .filter((service): service is OperatorServiceStatus => Boolean(service));
}

function serviceStatus(services: OperatorServiceStatus[]) {
  if (services.length === 0) return 'pending';
  if (services.some((service) => ['failed', 'critical'].includes(service.status))) return 'failed';
  if (services.some((service) => ['degraded', 'attention'].includes(service.status))) return 'attention';
  if (services.some((service) => service.status === 'planned')) return 'planned';
  if (services.every((service) => service.status === 'disabled')) return 'disabled';
  if (services.some((service) => ['ok', 'ready'].includes(service.status))) return 'ok';
  return services[0]?.status ?? 'pending';
}

function metricValue(metrics: Record<string, unknown>, key: string): string | null {
  const value = metrics[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }
  if (typeof value === 'string' && value.trim()) {
    return value.length > 28 ? `${value.slice(0, 25)}...` : value;
  }
  return null;
}

function serviceMetricChips(service: OperatorServiceStatus | undefined): string[] {
  if (!service?.metrics) return [];
  const preferredKeys = [
    'active_sessions',
    'active_wallet_devices',
    'configured_mtu',
    'mode',
    'api_listen_addr',
    'enabled',
    'remote_enabled',
    'supernode_enabled',
    'failed_checks',
  ];

  return preferredKeys
    .map((key) => {
      const value = metricValue(service.metrics, key);
      return value ? `${key.replaceAll('_', ' ')}: ${value}` : null;
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
}

function buildFleetSummary(nodes: VpnNodeHealth[], statuses: NodeOperatorStatus[]): FleetSummary {
  const serviceSlots = statuses.flatMap((status) => status.services);
  return {
    totalNodes: nodes.length,
    reportingNodes: statuses.length,
    healthyPrivacyNodes: nodes.filter((node) => node.is_vpn_node && node.health_status === 'healthy').length,
    attentionNodes: nodes.filter((node) => {
      const status = nodeOperatorStatus(node)?.status ?? node.health_status;
      return ['attention', 'degraded', 'failed', 'critical', 'offline', 'overloaded'].includes(status);
    }).length,
    rolloutRestartRequired: statuses.filter((status) => status.runtime_rollout?.restart_required).length,
    enabledServices: serviceSlots.filter((service) => service.enabled).length,
    totalServiceSlots: serviceSlots.length,
  };
}

function capacityPercent(used: number | null | undefined, total: number | null | undefined) {
  if (typeof used !== 'number' || typeof total !== 'number' || total <= 0) return null;
  return Math.max(0, Math.min(100, (used / total) * 100));
}

function collectFleetCapacityRisks(
  nodes: VpnNodeHealth[],
  t: ServicesTranslateFn,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
): FleetCapacityRisk[] {
  const risks: FleetCapacityRisk[] = [];

  nodes.forEach((node) => {
    const capacity = node.system.capacity;
    if (!capacity?.reported) return;

    const base = {
      nodeId: node.id,
      nodeName: node.name,
      region: nodeRegionLabel(node),
    };

    if (Array.isArray(capacity.risks)) {
      capacity.risks.forEach((risk) => {
        const code = typeof risk?.code === 'string' ? risk.code : '';
        const message = typeof risk?.message === 'string' ? risk.message.trim() : '';
        const remediation = typeof risk?.remediation === 'string' ? risk.remediation.trim() : '';
        const severity = typeof risk?.severity === 'string' ? risk.severity : 'warning';
        const tone: FleetCapacityRisk['tone'] = severity === 'critical' ? 'critical' : 'warning';
        if (!message && !remediation && !code) return;
        risks.push({
          ...base,
          tone,
          label: capacityRiskLabelFromCode(code, t),
          detail: message || code || t('services.commercial.capacityRiskDetail'),
          action: remediation || t('services.commercial.capacityRiskDetail'),
          code,
        });
      });
      return;
    }

    const ipPoolCapacity = capacity.ip_pool_capacity;
    const ipPoolFree = capacity.ip_pool_free;
    const maxConnections = capacity.max_connections;
    const policyMaxSessions = capacity.policy_max_sessions;
    const conntrackPercent = capacity.conntrack?.used_percent
      ?? capacityPercent(capacity.conntrack?.used, capacity.conntrack?.max);
    const fdPercent = capacity.file_descriptors?.used_percent
      ?? capacityPercent(capacity.file_descriptors?.used, capacity.file_descriptors?.soft_limit);
    const packetDrops = capacity.packet_drops_total ?? capacity.interface?.packet_drops ?? null;

    if (typeof ipPoolCapacity === 'number' && typeof maxConnections === 'number' && maxConnections > ipPoolCapacity) {
      risks.push({
        ...base,
        tone: 'warning',
        label: t('nodeDetail.capacity.risk.ipPoolMismatch'),
        detail: t('nodeDetail.capacity.risk.ipPoolMismatchDetail', {
          max: formatNumber(maxConnections),
          pool: formatNumber(ipPoolCapacity),
        }),
        action: t('nodeDetail.capacity.risk.ipPoolMismatchAction'),
      });
    }

    if (
      typeof ipPoolCapacity === 'number'
      && typeof policyMaxSessions === 'number'
      && policyMaxSessions > 0
      && policyMaxSessions > ipPoolCapacity
    ) {
      risks.push({
        ...base,
        tone: 'critical',
        label: t('nodeDetail.capacity.risk.policyMismatch'),
        detail: t('nodeDetail.capacity.risk.policyMismatchDetail', {
          policy: formatNumber(policyMaxSessions),
          pool: formatNumber(ipPoolCapacity),
        }),
        action: t('nodeDetail.capacity.risk.policyMismatchAction'),
      });
    }

    if (typeof ipPoolFree === 'number' && ipPoolFree <= 0) {
      risks.push({
        ...base,
        tone: 'critical',
        label: t('nodeDetail.capacity.risk.ipPoolExhausted'),
        detail: t('nodeDetail.capacity.risk.ipPoolExhaustedDetail'),
        action: t('nodeDetail.capacity.risk.ipPoolExhaustedAction'),
      });
    }

    if (typeof conntrackPercent === 'number' && conntrackPercent >= 80) {
      risks.push({
        ...base,
        tone: conntrackPercent >= 90 ? 'critical' : 'warning',
        label: t('nodeDetail.capacity.risk.conntrack'),
        detail: t('nodeDetail.capacity.risk.conntrackDetail', {
          value: formatNumber(conntrackPercent, { maximumFractionDigits: 1 }),
        }),
        action: t('nodeDetail.capacity.risk.conntrackAction'),
      });
    }

    if (typeof fdPercent === 'number' && fdPercent >= 80) {
      risks.push({
        ...base,
        tone: fdPercent >= 90 ? 'critical' : 'warning',
        label: t('nodeDetail.capacity.risk.fileDescriptors'),
        detail: t('nodeDetail.capacity.risk.fileDescriptorsDetail', {
          value: formatNumber(fdPercent, { maximumFractionDigits: 1 }),
        }),
        action: t('nodeDetail.capacity.risk.fileDescriptorsAction'),
      });
    }

    if (typeof packetDrops === 'number' && packetDrops > 0) {
      risks.push({
        ...base,
        tone: 'warning',
        label: t('nodeDetail.capacity.risk.packetDrops'),
        detail: t('nodeDetail.capacity.risk.packetDropsDetail', {
          count: formatNumber(packetDrops),
        }),
        action: t('nodeDetail.capacity.risk.packetDropsAction'),
      });
    }
  });

  return risks.sort((a, b) => {
    const severity = (risk: FleetCapacityRisk) => risk.tone === 'critical' ? 0 : 1;
    return severity(a) - severity(b) || a.nodeName.localeCompare(b.nodeName);
  });
}

function capacityRiskLabelFromCode(code: string, t: ServicesTranslateFn) {
  switch (code) {
    case 'vpn_ip_pool_below_max_connections':
      return t('nodeDetail.capacity.risk.ipPoolMismatch');
    case 'vpn_ip_pool_below_policy_max_sessions':
      return t('nodeDetail.capacity.risk.policyMismatch');
    case 'vpn_ip_pool_exhausted':
      return t('nodeDetail.capacity.risk.ipPoolExhausted');
    case 'conntrack_pressure':
      return t('nodeDetail.capacity.risk.conntrack');
    case 'file_descriptor_pressure':
      return t('nodeDetail.capacity.risk.fileDescriptors');
    case 'packet_drops_detected':
      return t('nodeDetail.capacity.risk.packetDrops');
    default:
      return code ? code.replaceAll('_', ' ') : t('services.commercial.capacityRisks');
  }
}

function formatFleetBytes(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '0 B';
  if (value >= 1024 ** 4) return `${(value / 1024 ** 4).toFixed(2)} TB`;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${Math.round(value).toLocaleString()} B`;
}

function formatFleetBitsPerSecond(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '0 bps';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Gbps`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} Mbps`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} Kbps`;
  return `${Math.round(value).toLocaleString()} bps`;
}

function formatFleetPacketsPerSecond(
  value: number | null | undefined,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${formatNumber(value, { maximumFractionDigits: 1 })} pps`
    : 'pending';
}

function formatCapacityNumber(
  value: number | null | undefined,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
  pending: string,
) {
  return typeof value === 'number' && Number.isFinite(value)
    ? formatNumber(value)
    : pending;
}

function formatCapacityPair(
  used: number | null | undefined,
  total: number | null | undefined,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
  pending: string,
) {
  return `${formatCapacityNumber(used, formatNumber, pending)} / ${formatCapacityNumber(total, formatNumber, pending)}`;
}

function capacityUsageTone(percent: number | null | undefined) {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return 'border-white/10 bg-white/[0.03]';
  if (percent >= 90) return 'border-red-500/30 bg-red-500/[0.08]';
  if (percent >= 75) return 'border-yellow-500/30 bg-yellow-500/[0.08]';
  return 'border-emerald-500/20 bg-emerald-500/[0.06]';
}

function checkByName(node: VpnNodeHealth, name: string): VpnNodeHealth['checks'][number] | null {
  return node.checks.find((check) => check.name === name) ?? null;
}

function privacyProtocolMetrics(node: VpnNodeHealth): Record<string, unknown> {
  const service = node.system.operator_status?.services.find((item) => item.key === 'privacy_protocol');
  return service?.metrics && typeof service.metrics === 'object'
    ? service.metrics as Record<string, unknown>
    : {};
}

function dnsOwnerView(node: VpnNodeHealth, t: ServicesTranslateFn) {
  const metrics = privacyProtocolMetrics(node);
  const owner = node.system.dns_owner
    ?? (typeof metrics.dns_owner === 'string' ? metrics.dns_owner : null);
  const proxyEnabled = typeof node.system.dns_proxy_enabled === 'boolean'
    ? node.system.dns_proxy_enabled
    : typeof metrics.dns_proxy_enabled === 'boolean'
      ? metrics.dns_proxy_enabled
      : null;

  if (owner === 'rust_dns_proxy' || proxyEnabled === true) {
    return {
      label: t('services.dns.owner.rust'),
      detail: t('services.dns.owner.rustDetail'),
    };
  }

  if (owner === 'external_gateway_dns' || proxyEnabled === false) {
    return {
      label: t('services.dns.owner.external'),
      detail: t('services.dns.owner.externalDetail'),
    };
  }

  return {
    label: t('services.dns.owner.unknown'),
    detail: t('services.dns.owner.unknownDetail'),
  };
}

function transportHealthView(node: VpnNodeHealth): VpnTransportHealthStatus {
  const metrics = privacyProtocolMetrics(node);
  const metricsTransport = metrics.transport_health && typeof metrics.transport_health === 'object'
    ? metrics.transport_health as VpnTransportHealthStatus
    : null;
  return node.system.transport_health ?? metricsTransport ?? {
    supported_transports: ['udp'],
    configured_transports: ['udp'],
    preferred_transport: 'udp',
    effective_transport: 'udp',
    fallback_available: false,
    source: 'nodeboard_legacy_udp_default',
  };
}

function transportLabel(key: string, t: ServicesTranslateFn) {
  if (key === 'udp') return t('services.transport.carrier.udp');
  if (key === 'tcp_tls') return t('services.transport.carrier.tcpTls');
  if (key === 'websocket_https') return t('services.transport.carrier.websocket');
  return key.replaceAll('_', ' ');
}

function formatTransportList(values: string[] | null | undefined, t: ServicesTranslateFn) {
  const list = Array.isArray(values) && values.length > 0 ? values : ['udp'];
  return list.map((item) => transportLabel(String(item), t));
}

function collectFleetTransportNodes(nodes: VpnNodeHealth[], t: ServicesTranslateFn): FleetTransportNode[] {
  return nodes.map((node) => {
    const transport = transportHealthView(node);
    const supported = formatTransportList(transport.supported_transports, t);
    const configured = formatTransportList(transport.configured_transports, t);
    const fallbackAvailable = Boolean(transport.fallback_available);
    const udpActive = transport.udp?.active === true || supported.includes(t('services.transport.carrier.udp'));
    const configuredInactive = [transport.tcp_tls, transport.websocket_https]
      .some((carrier) => carrier?.enabled && !carrier.active);
    const status: FleetTransportNode['status'] = udpActive
      ? fallbackAvailable
        ? 'ok'
        : configuredInactive
          ? 'warning'
          : 'pending'
      : 'failed';

    return {
      id: node.id,
      name: node.name,
      region: nodeRegionLabel(node),
      supported,
      configured,
      preferred: transportLabel(String(transport.preferred_transport || 'udp'), t),
      effective: transportLabel(String(transport.effective_transport || 'udp'), t),
      fallbackAvailable,
      udpStatus: transport.udp?.status || (udpActive ? 'active' : 'pending'),
      tcpTlsStatus: transport.tcp_tls?.status || 'planned',
      websocketStatus: transport.websocket_https?.status || 'planned',
      status,
      source: transport.source || 'backend',
    };
  }).sort((a, b) => {
    const severity = (item: FleetTransportNode) => item.status === 'failed' ? 0 : item.status === 'warning' ? 1 : item.status === 'pending' ? 2 : 3;
    return severity(a) - severity(b) || a.name.localeCompare(b.name);
  });
}

function collectFleetDnsNodes(nodes: VpnNodeHealth[], t: ServicesTranslateFn): FleetDnsNode[] {
  return nodes.map((node) => {
    const metrics = privacyProtocolMetrics(node);
    const dnsStub = checkByName(node, 'dns_stub');
    const dnsQuery = checkByName(node, 'dns_query');
    const owner = dnsOwnerView(node, t);
    const gateway = typeof metrics.gateway_ip === 'string' && metrics.gateway_ip.trim()
      ? metrics.gateway_ip
      : '100.64.0.1';
    const dnsStubOk = typeof dnsStub?.ok === 'boolean' ? dnsStub.ok : null;
    const dnsQueryOk = typeof dnsQuery?.ok === 'boolean' ? dnsQuery.ok : null;
    const status: FleetDnsNode['status'] = dnsStubOk === false || dnsQueryOk === false
      ? 'failed'
      : dnsStubOk === true && dnsQueryOk === true
        ? 'ok'
        : node.system.dns_owner || typeof node.system.dns_proxy_enabled === 'boolean'
          ? 'warning'
          : 'pending';

    return {
      id: node.id,
      name: node.name,
      region: nodeRegionLabel(node),
      gateway,
      ownerLabel: owner.label,
      ownerDetail: owner.detail,
      status,
      dnsStubOk,
      dnsQueryOk,
      dnsStubDetail: dnsStub?.detail || t('services.dns.pendingCheck'),
      dnsQueryDetail: dnsQuery?.detail || t('services.dns.pendingCheck'),
      checkedAt: node.system.vpn_health_checked_at ?? null,
    };
  }).sort((a, b) => {
    const severity = (item: FleetDnsNode) => item.status === 'failed' ? 0 : item.status === 'warning' ? 1 : item.status === 'pending' ? 2 : 3;
    return severity(a) - severity(b) || a.name.localeCompare(b.name);
  });
}

function formatPolicyBlockAge(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'no recent timestamp';
  return `${formatDuration(seconds)} ago`;
}

function formatUnixSecondsRelative(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return 'pending';
  return formatRelativeTime(new Date(seconds * 1000).toISOString());
}

function telemetrySourceLabel(source: string | null | undefined) {
  if (source === 'cache') return 'fresh cache';
  if (source === 'sample') return 'durable fallback';
  if (!source || source === 'missing') return 'missing telemetry';
  return source.replaceAll('_', ' ');
}

function buildServiceViews(nodes: VpnNodeHealth[], statuses: NodeOperatorStatus[]): ServiceView[] {
  const privacyNodes = nodes.filter((node) => node.is_vpn_node);
  const healthyPrivacyNodes = privacyNodes.filter((node) => node.health_status === 'healthy');
  const privacyServices = collectService(statuses, 'privacy_protocol');
  const latestPrivacy = privacyServices[0];

  const privacyView: ServiceView = {
    key: 'privacy_protocol',
    label: serviceMeta.privacy_protocol.label,
    eyebrow: serviceMeta.privacy_protocol.eyebrow,
    status: privacyNodes.length === 0
      ? 'pending'
      : healthyPrivacyNodes.length === privacyNodes.length
        ? 'ok'
        : healthyPrivacyNodes.length > 0
          ? 'attention'
          : 'failed',
    summary: latestPrivacy?.summary ?? `${healthyPrivacyNodes.length}/${privacyNodes.length} privacy protocol nodes healthy`,
    enabledCount: privacyNodes.length,
    totalCount: nodes.length,
    reportingCount: privacyServices.length,
    metricChips: serviceMetricChips(latestPrivacy),
    detail: 'Transport health, policy sync, encrypted packet counters, and commercial placement readiness.',
  };

  const rest = (['memchain', 'chat_relay', 'sovereign_data_layer', 'supernode'] as ServiceKey[]).map((key) => {
    const services = collectService(statuses, key);
    const enabledCount = services.filter((service) => service.enabled).length;
    const latest = services[0];
    const meta = serviceMeta[key];

    return {
      key,
      label: meta.label,
      eyebrow: meta.eyebrow,
      status: serviceStatus(services),
      summary: latest?.summary ?? 'Awaiting operator_status from Rust heartbeat',
      enabledCount,
      totalCount: statuses.length || nodes.length,
      reportingCount: services.length,
      metricChips: serviceMetricChips(latest),
      detail: key === 'sovereign_data_layer'
        ? 'Encrypted user-owned records, node RPC, full-network sync readiness, and Ethereum settlement boundary.'
        : 'Reported by signed Rust node heartbeat through the backend overview API.',
    };
  });

  return [privacyView, ...rest];
}

function collectRisks(nodes: VpnNodeHealth[]): RiskView[] {
  return nodes
    .flatMap((node) => {
      const status = nodeOperatorStatus(node);
      return (status?.risks ?? []).map((risk) => ({
        ...risk,
        nodeName: node.name,
      }));
    })
    .slice(0, 10);
}

function collectPendingOperatorNodes(nodes: VpnNodeHealth[]): PendingOperatorNode[] {
  return nodes
    .filter((node) => node.is_vpn_node && !nodeOperatorStatus(node))
    .map((node) => ({
      id: node.id,
      name: node.name,
      publicIp: node.public_ip,
      activeSessions: node.active_sessions,
      healthStatus: node.health_status,
      lastHeartbeat: node.last_heartbeat,
      version: node.version,
    }));
}

function collectRuntimeRolloutNodes(nodes: VpnNodeHealth[]): RuntimeRolloutNode[] {
  return nodes.reduce<RuntimeRolloutNode[]>((items, node) => {
    const rollout = nodeOperatorStatus(node)?.runtime_rollout;
    if (!rollout?.restart_required) return items;

    items.push({
      id: node.id,
      name: node.name,
      publicIp: node.public_ip,
      activeSessions: node.active_sessions,
      maintenanceMode: node.maintenance_mode,
      healthStatus: node.health_status,
      lastHeartbeat: node.last_heartbeat,
      rollout,
      serviceManager: node.system.service_manager ?? null,
      policySync: node.system.policy_sync ?? null,
      dnsChecks: node.checks.filter((check) => check.name === 'dns_stub' || check.name === 'dns_query'),
      drainEta: node.system.restart_readiness?.drain_eta ?? null,
    });
    return items;
  }, []);
}

function collectRestartReadinessNodes(nodes: VpnNodeHealth[]): RestartReadinessNode[] {
  const normalizeBackendStatus = (status: VpnRestartReadiness['status']) => (
    status === 'ready' || status === 'blocked' || status === 'pending' || status === 'current'
      ? status
      : 'pending'
  );

  return nodes
    .filter((node) => node.is_vpn_node)
    .map((node) => {
      const backendReadiness = node.system?.restart_readiness ?? null;
      if (backendReadiness) {
        return {
          id: node.id,
          name: node.name,
          publicIp: node.public_ip,
          regionLabel: nodeRegionLabel(node),
          version: nodeVersionLabel(node.version),
          activeSessions: backendReadiness.active_sessions,
          maintenanceMode: backendReadiness.maintenance_mode,
          healthStatus: node.health_status,
          lastHeartbeat: node.last_heartbeat,
          operatorReporting: backendReadiness.operator_reporting,
          restartRequired: backendReadiness.restart_required,
          cleanupReported: backendReadiness.cleanup_reported,
          status: normalizeBackendStatus(backendReadiness.status),
          canRestart: backendReadiness.can_restart,
          activeRestartCommand: backendReadiness.active_restart_command ?? null,
          latestRestartCommand: backendReadiness.latest_restart_command ?? null,
          drainEta: backendReadiness.drain_eta ?? null,
          nextStep: backendReadiness.next_step,
          blockers: backendReadiness.blockers.map((blocker) => blocker.message),
          source: backendReadiness.source,
        };
      }

      const operatorStatus = nodeOperatorStatus(node);
      const restartRequired = Boolean(operatorStatus?.runtime_rollout?.restart_required);
      const operatorReporting = Boolean(operatorStatus);
      const cleanupReported = Boolean(node.system?.session_cleanup);
      const needsRolloutAttention = restartRequired || !operatorReporting || !cleanupReported;
      const blockers = [
        ...(!node.maintenance_mode ? ['Enable maintenance mode before restart.'] : []),
        ...(node.active_sessions > 0 ? [`Drain ${node.active_sessions.toLocaleString()} active session(s).`] : []),
      ];
      const readyForRestart = needsRolloutAttention && node.maintenance_mode && node.active_sessions === 0;
      const nextStep = readyForRestart
        ? 'restart window open'
        : !needsRolloutAttention
          ? 'current'
          : !node.maintenance_mode
            ? 'enable maintenance'
            : node.active_sessions > 0
              ? `drain ${node.active_sessions.toLocaleString()} session(s)`
              : !operatorReporting
                ? 'restart old Rust process'
                : restartRequired
                  ? 'restart staged binary'
                  : 'await cleanup heartbeat';

      return {
        id: node.id,
        name: node.name,
        publicIp: node.public_ip,
        regionLabel: nodeRegionLabel(node),
        version: nodeVersionLabel(node.version),
        activeSessions: node.active_sessions,
        maintenanceMode: node.maintenance_mode,
        healthStatus: node.health_status,
        lastHeartbeat: node.last_heartbeat,
        operatorReporting,
        restartRequired,
        cleanupReported,
        status: readyForRestart
          ? 'ready'
          : !needsRolloutAttention
            ? 'current'
            : node.active_sessions > 0 || !node.maintenance_mode
              ? 'blocked'
              : 'pending',
        canRestart: readyForRestart,
        activeRestartCommand: null,
        latestRestartCommand: null,
        drainEta: null,
        nextStep,
        blockers: needsRolloutAttention ? blockers : [],
        source: 'nodeboard_fallback_restart_gate',
      };
    });
}

function collectSessionCleanupRolloutNodes(nodes: VpnNodeHealth[]): SessionCleanupRolloutNode[] {
  return nodes
    .filter((node) => node.is_vpn_node)
    .map((node) => {
      const operatorStatus = nodeOperatorStatus(node);
      return {
        id: node.id,
        name: node.name,
        publicIp: node.public_ip,
        activeSessions: node.active_sessions,
        healthStatus: node.health_status,
        lastHeartbeat: node.last_heartbeat,
        cleanup: node.system?.session_cleanup ?? null,
        operatorReporting: Boolean(operatorStatus),
        restartRequired: Boolean(operatorStatus?.runtime_rollout?.restart_required),
      };
    });
}

function latestReportTime(statuses: NodeOperatorStatus[]) {
  const values = statuses
    .map((status) => status.last_reported_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  return values.length > 0 ? values[values.length - 1] : null;
}

function formatRefreshInterval(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1000);
  return `${seconds}s`;
}

function formatDataUpdatedAt(dataUpdatedAt: number) {
  if (!dataUpdatedAt) return 'waiting for first API sync';
  return `last API sync ${formatRelativeTime(new Date(dataUpdatedAt).toISOString())}`;
}

function formatPlacementCapacity(
  capacity: number,
  unlimitedNodes: number,
  labels: { slots?: string; unlimited?: string } = {},
) {
  const slotsLabel = labels.slots ?? 'slots';
  const unlimitedLabel = labels.unlimited ?? 'unlimited';
  if (unlimitedNodes > 0 && capacity > 0) {
    return `${capacity.toLocaleString()} ${slotsLabel} + ${unlimitedNodes.toLocaleString()} ${unlimitedLabel}`;
  }
  if (unlimitedNodes > 0) return `${unlimitedNodes.toLocaleString()} ${unlimitedLabel}`;
  return `${capacity.toLocaleString()} ${slotsLabel}`;
}

function formatPlacementReason(reason: string | null | undefined, t?: (key: string) => string) {
  if (!reason) return t?.('services.placement.clear') ?? 'clear';
  const key = `services.placement.reason.${reason}`;
  const translated = t?.(key);
  if (translated && translated !== key) return translated;
  return reason.replaceAll('_', ' ');
}

function topPlacementReason(reasons: Record<string, number>, t?: (key: string) => string) {
  const [reason, count] = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0] || [];
  return reason ? `${formatPlacementReason(reason, t)} ${count.toLocaleString()}` : (t?.('services.placement.clear') ?? 'clear');
}

function placementReasonEntries(reasons: Record<string, number>) {
  return Object.entries(reasons)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4);
}

function placementBlockerAction(reason: string | null, t?: (key: string) => string) {
  const copy: Record<string, string> = {
    maintenance_mode: 'End maintenance after active sessions drain and restart work is complete.',
    max_sessions_reached: 'Raise max_sessions or wait for sessions to complete.',
    vpn_health_degraded: 'Open node health and inspect Rust VPN checks before returning to placement.',
    vpn_health_failed: 'Inspect Rust VPN health before exposing the node to clients.',
    low_24h_availability: 'Review heartbeat availability before using this node for failover.',
    overloaded: 'Reduce load or increase capacity before routing new sessions.',
    heartbeat_stale: 'Restore fresh Rust heartbeats before exposing this node to clients.',
  };

  const key = `services.placement.action.${reason || 'default'}`;
  const translated = t?.(key);
  if (translated && translated !== key) return translated;
  return copy[reason || ''] ?? 'Open node detail and review backend placement policy inputs.';
}

function placementSessionCopy(server: VpnServerCandidate, t?: (key: string, params?: Record<string, string | number>) => string) {
  const sessions = server.current_sessions.toLocaleString();
  if (server.max_sessions > 0) {
    return t?.('services.placement.sessionsCapped', { sessions, max: server.max_sessions.toLocaleString() })
      ?? `${sessions}/${server.max_sessions.toLocaleString()} sessions`;
  }
  return t?.('services.placement.sessionsUnlimited', { sessions }) ?? `${sessions} sessions, unlimited cap`;
}

function failedPlacementChecks(node: VpnNodeHealth | undefined) {
  return (node?.checks ?? []).filter((check) => !check.ok).slice(0, 3);
}

function formatOptionalPercent(value: number | null | undefined) {
  return typeof value === 'number' ? `${value.toFixed(1)}%` : 'pending';
}

function formatOptionalDuration(value: number | null | undefined) {
  return typeof value === 'number' ? formatDuration(Math.round(value)) : 'pending';
}

function formatDrainEta(eta: VpnRestartDrainEta | null) {
  if (!eta || eta.active_sessions === 0) return 'no active drain';
  if (eta.status === 'cleanup_policy_pending') return 'cleanup policy pending';
  if (eta.status === 'activity_pending') return 'activity pending';
  if (eta.status === 'cleanup_due') return 'cleanup due';
  if (!eta.cleanup_timeout_seconds) return 'cleanup timeout pending';
  if (eta.estimated_seconds_remaining === null) return 'awaiting session activity';
  if (eta.estimated_seconds_remaining <= 0) return 'cleanup due';
  return `${formatDuration(eta.estimated_seconds_remaining)} if idle`;
}

function formatDrainStatus(status: string | undefined) {
  if (!status) return null;
  return status.replaceAll('_', ' ');
}

function DrainComposition({ eta, tone = 'yellow' }: { eta: VpnRestartDrainEta; tone?: 'yellow' | 'neutral' }) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  const activeSessions = Math.max(0, eta.active_sessions ?? 0);
  const recentSessions = Math.max(0, eta.recent_activity_sessions ?? 0);
  const idleSessions = Math.max(0, eta.idle_activity_sessions ?? 0);
  const recentClientRxSessions = Math.max(0, eta.recent_client_rx_sessions ?? recentSessions);
  const neverClientRxSessions = Math.max(0, eta.never_client_rx_sessions ?? 0);
  const staleClientRxSessions = Math.max(
    0,
    (eta.stale_client_rx_sessions ?? activeSessions - recentClientRxSessions) - neverClientRxSessions,
  );
  const pendingSessions = Math.max(
    0,
    eta.activity_pending_sessions ?? activeSessions - recentSessions - idleSessions,
  );
  const keepaliveIssueSessions = Math.max(
    eta.keepalive_missed_sessions ?? 0,
    eta.keepalive_pending_sessions ?? 0,
  );
  const textClass = tone === 'yellow' ? 'text-yellow-100' : 'text-gray-200';
  const mutedClass = tone === 'yellow' ? 'text-yellow-100/45' : 'text-gray-500';
  const chipClass = tone === 'yellow'
    ? 'border-yellow-100/10 bg-yellow-100/[0.04] text-yellow-100/70'
    : 'border-white/10 bg-white/[0.03] text-gray-400';
  const segments = [
    {
      key: 'client-rx',
      label: 'client RX recent',
      value: recentClientRxSessions,
      className: 'bg-emerald-300/80',
    },
    {
      key: 'client-stale',
      label: 'client RX stale',
      value: staleClientRxSessions,
      className: 'bg-yellow-300/75',
    },
    {
      key: 'never-rx',
      label: 'never RX',
      value: neverClientRxSessions,
      className: 'bg-red-300/70',
    },
  ].filter((segment) => segment.value > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={mutedClass}>{t('services.drain.clientRxComposition')}</span>
        <span className={textClass}>{t('services.drain.activeSessions', { count: formatNumber(activeSessions) })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/35">
        {segments.length === 0 ? (
          <div className="h-full w-full bg-emerald-300/70" />
        ) : (
          <div className="flex h-full w-full">
            {segments.map((segment) => (
              <div
                key={segment.key}
                className={`${segment.className} h-full`}
                style={{ flexBasis: 0, flexGrow: segment.value, minWidth: '6px' }}
                title={`${segment.label}: ${segment.value.toLocaleString()}`}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-md border px-2 py-1 ${chipClass}`}>
          {t('services.drain.clientRxRecentCount', { count: formatNumber(recentClientRxSessions) })}
        </span>
        <span className={`rounded-md border px-2 py-1 ${chipClass}`}>
          {t('services.drain.clientRxStaleCount', { count: formatNumber(staleClientRxSessions) })}
        </span>
        <span className={`rounded-md border px-2 py-1 ${chipClass}`}>
          {t('services.drain.neverRxCount', { count: formatNumber(neverClientRxSessions) })}
        </span>
        <span className={`rounded-md border px-2 py-1 ${chipClass}`}>
          {t('services.drain.pendingCount', { count: formatNumber(pendingSessions) })}
        </span>
        <span className={`rounded-md border px-2 py-1 ${chipClass}`}>
          {t('services.drain.keepaliveIssueCount', { count: formatNumber(keepaliveIssueSessions) })}
        </span>
        {eta.oldest_started_at && (
          <span className={`rounded-md border px-2 py-1 ${chipClass}`}>
            {t('services.drain.oldest', { time: formatRelativeTime(eta.oldest_started_at) })}
          </span>
        )}
        {eta.latest_activity_at && (
          <span className={`rounded-md border px-2 py-1 ${chipClass}`}>
            {t('services.drain.runtimeLatest', { time: formatRelativeTime(eta.latest_activity_at) })}
          </span>
        )}
        {eta.latest_client_rx_at && (
          <span className={`rounded-md border px-2 py-1 ${chipClass}`}>
            {t('services.drain.clientRxTime', { time: formatRelativeTime(eta.latest_client_rx_at) })}
          </span>
        )}
      </div>
      <p className={`text-[11px] leading-5 ${mutedClass}`}>
        {t('services.drain.clientRxWindow', { duration: formatDuration(eta.activity_window_seconds || 180) })}
        {typeof eta.estimated_seconds_remaining === 'number'
          ? ` - ${t('services.drain.cleanupIn', { duration: formatDuration(Math.max(0, eta.estimated_seconds_remaining)) })}`
          : ''}
      </p>
    </div>
  );
}

function drainGatePanelClass(risk: string | undefined) {
  if (risk === 'critical') return 'border-red-300/20 bg-red-300/[0.07]';
  if (risk === 'warning') return 'border-yellow-200/15 bg-yellow-200/[0.05]';
  if (risk === 'healthy') return 'border-emerald-300/15 bg-emerald-300/[0.05]';
  return 'border-sky-200/15 bg-sky-200/[0.04]';
}

function clientRxGateCopy(eta: VpnRestartDrainEta, t: ServicesTranslateFn, formatNumber: (value: number) => string) {
  const guard = eta.cutover_guard ?? null;
  const active = Math.max(0, eta.active_sessions ?? 0);
  const recent = Math.max(0, eta.recent_client_rx_sessions ?? eta.recent_activity_sessions ?? 0);
  const never = Math.max(0, eta.never_client_rx_sessions ?? 0);
  const stale = Math.max(0, (eta.stale_client_rx_sessions ?? active - recent) - never);
  const health = eta.activity_health ?? null;
  const windowLabel = formatDuration(eta.activity_window_seconds || 180);

  if (guard) {
    return {
      title: guard.label,
      detail: guard.detail,
      nextStep: guard.next_step,
      risk: guard.risk,
      status: guard.status,
      safeToCutover: guard.safe_to_cutover,
      forcedImpact: guard.user_impact_if_forced ?? 'unknown',
    };
  }

  if (active === 0) {
    return {
      title: t('services.drain.gateClear'),
      detail: t('services.drain.gateClearDetail'),
      nextStep: eta.next_step,
      risk: health?.risk ?? 'healthy',
      status: health?.status ?? eta.status,
      safeToCutover: true,
      forcedImpact: 'none',
    };
  }

  if (health?.status === 'client_rx_stale' || stale + never > 0) {
    return {
      title: health?.label ?? t('services.drain.gateBlocked'),
      detail: t('services.drain.gateBlockedDetail', {
        recent: formatNumber(recent),
        active: formatNumber(active),
        window: windowLabel,
        stale: formatNumber(stale),
        never: formatNumber(never),
      }),
      nextStep: health?.detail ?? eta.next_step,
      risk: health?.risk ?? 'warning',
      status: health?.status ?? eta.status,
      safeToCutover: false,
      forcedImpact: recent > 0 ? 'will_disconnect_recent_clients' : 'may_drop_stale_tunnel_state',
    };
  }

  return {
    title: health?.label ?? t('services.drain.gatePassing'),
    detail: t('services.drain.gatePassingDetail', {
      active: formatNumber(active),
      window: windowLabel,
    }),
    nextStep: health?.detail ?? eta.next_step,
    risk: health?.risk ?? 'healthy',
    status: health?.status ?? eta.status,
    safeToCutover: active === 0,
    forcedImpact: active === 0 ? 'none' : 'may_disconnect_clients',
  };
}

function RuntimeDrainGatePanel({ eta }: { eta: VpnRestartDrainEta }) {
  const { t, formatNumber } = useI18n();
  const gate = clientRxGateCopy(eta, t, formatNumber);

  return (
    <div className={`mt-3 rounded-lg border p-3 ${drainGatePanelClass(gate.risk)}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-yellow-100/45">{t('services.drain.restartGate')}</p>
          <p className="mt-1 text-sm font-semibold text-yellow-100">{gate.title}</p>
          <p className="mt-1 text-xs leading-5 text-yellow-100/60">{gate.detail}</p>
        </div>
        <StatusPill status={gate.risk} />
      </div>
      <div className="mt-3">
        <DrainComposition eta={eta} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-yellow-100/60 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-yellow-100/35">{t('services.drain.cutoverStatus')}</p>
          <p className="mt-1 text-yellow-100">{gate.status.replaceAll('_', ' ')}</p>
        </div>
        <div>
          <p className="text-yellow-100/35">{t('services.drain.safeCutover')}</p>
          <p className="mt-1 text-yellow-100">{gate.safeToCutover ? t('common.yes') : t('common.no')}</p>
        </div>
        <div>
          <p className="text-yellow-100/35">{t('services.drain.restartEta')}</p>
          <p className="mt-1 text-yellow-100">
            {eta.estimated_seconds_remaining === null
              ? t('common.status.pending')
              : formatDuration(eta.estimated_seconds_remaining)}
          </p>
        </div>
        <div>
          <p className="text-yellow-100/35">{t('services.drain.forcedImpact')}</p>
          <p className="mt-1 text-yellow-100">{gate.forcedImpact.replaceAll('_', ' ')}</p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-yellow-100/45">
        {t('services.drain.keepaliveTotals', {
          missed: formatNumber(eta.keepalive_missed_total ?? 0),
          pending: formatNumber(eta.keepalive_pending_total ?? 0),
        })}
      </p>
      {gate.nextStep && (
        <p className="mt-3 text-xs leading-5 text-yellow-100/55">{gate.nextStep}</p>
      )}
    </div>
  );
}

function rolloutDrainGateDetail(node: RuntimeRolloutNode) {
  if (node.activeSessions === 0) return 'no active sessions';
  const health = node.drainEta?.activity_health;
  if (health) {
    const oldestActive = node.drainEta?.oldest_started_at
      ? ` · oldest ${formatRelativeTime(node.drainEta.oldest_started_at)}`
      : '';
    const latestActivity = node.drainEta?.latest_activity_at
      ? ` · ${formatRelativeTime(node.drainEta.latest_activity_at)}`
      : '';
    return `${health.label}: ${health.detail}${oldestActive}${latestActivity}`;
  }
  return `${node.activeSessions.toLocaleString()} active session${node.activeSessions === 1 ? '' : 's'}`;
}

function rolloutCleanupPolicyGate(node: RuntimeRolloutNode) {
  const eta = node.drainEta;
  if (!eta || node.activeSessions === 0) {
    return {
      status: 'ready',
      detail: 'not required while drain is clear',
    };
  }
  if (typeof eta.cleanup_timeout_seconds === 'number') {
    return {
      status: 'ready',
      detail: `client liveness timeout ${formatDuration(eta.cleanup_timeout_seconds)}`,
    };
  }
  return {
    status: eta.status === 'cleanup_policy_pending' ? 'pending' : 'unknown',
    detail: eta.status === 'cleanup_policy_pending'
      ? 'waiting for upgraded Rust heartbeat to report session_cleanup policy'
      : eta.next_step,
  };
}

function serviceManagerGateDetail(manager: RuntimeRolloutNode['serviceManager']) {
  if (!manager) return 'systemd status pending';
  const states = [manager.active_state, manager.load_state, manager.unit_file_state]
    .filter((state): state is string => Boolean(state));
  const stateLabel = states.length > 0 ? states.join(' · ') : manager.detail;
  return `${manager.manager} ${manager.service_name}: ${stateLabel}`;
}

function RolloutGateStrip({ node }: { node: RuntimeRolloutNode }) {
  const serviceManagerReady = Boolean(node.serviceManager?.restart_supported);
  const policySynced = node.policySync?.status === 'synced';
  const failedDnsCheck = node.dnsChecks.find((check) => !check.ok);
  const dnsChecksReady = node.dnsChecks.length > 0 && !failedDnsCheck;
  const cleanupPolicyGate = rolloutCleanupPolicyGate(node);
  const gates = [
    {
      label: 'Maintenance',
      status: node.maintenanceMode ? 'ready' : 'blocked',
      detail: node.maintenanceMode ? 'new handshakes blocked' : 'enable before restart',
    },
    {
      label: 'Drain',
      status: node.activeSessions === 0 ? 'ready' : 'blocked',
      detail: rolloutDrainGateDetail(node),
    },
    {
      label: 'Policy Sync',
      status: policySynced ? 'ready' : node.policySync ? 'pending' : 'unknown',
      detail: node.policySync?.message ?? 'waiting for backend policy snapshot',
    },
    {
      label: 'Cleanup Policy',
      status: cleanupPolicyGate.status,
      detail: cleanupPolicyGate.detail,
    },
    {
      label: 'DNS Gateway',
      status: dnsChecksReady ? 'ready' : failedDnsCheck ? 'blocked' : 'unknown',
      detail: failedDnsCheck
        ? `${failedDnsCheck.name.replaceAll('_', ' ')}: ${failedDnsCheck.detail}`
        : dnsChecksReady
          ? 'gateway resolver responding'
          : 'waiting for Rust DNS health checks',
    },
    {
      label: 'Service Manager',
      status: serviceManagerReady ? 'ready' : 'pending',
      detail: serviceManagerGateDetail(node.serviceManager),
    },
  ];

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
      {gates.map((gate) => (
        <div key={gate.label} className="rounded-lg border border-yellow-100/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-yellow-100/65">{gate.label}</p>
            <StatusPill status={gate.status} />
          </div>
          <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-yellow-100/45">{gate.detail}</p>
        </div>
      ))}
    </div>
  );
}

function RolloutImpactCallout({ node }: { node: RuntimeRolloutNode }) {
  const { t, formatNumber } = useI18n();
  const failedDnsCheck = node.dnsChecks.find((check) => !check.ok);
  const hasDnsGatewayBlocker = Boolean(failedDnsCheck);
  const restartWindowOpen = node.maintenanceMode && node.activeSessions === 0;
  const impactStatus = restartWindowOpen ? 'ready' : 'blocked';
  const primaryDetail = hasDnsGatewayBlocker
    ? t('services.rollout.restartImpactDns')
    : t('services.rollout.restartImpactDefault');
  const nextStep = restartWindowOpen
    ? t('services.rollout.restartWindowOpen')
    : node.activeSessions > 0
      ? t('services.rollout.drainActiveBeforeRestart', { count: formatNumber(node.activeSessions) })
      : !node.maintenanceMode
        ? t('services.rollout.enableMaintenanceBeforeRestart')
        : t('services.rollout.waitRestartReadiness');

  return (
    <div className="mt-3 rounded-lg border border-yellow-100/10 bg-yellow-100/[0.04] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-yellow-100/45">{t('services.rollout.restartImpact')}</p>
          <p className="mt-1 text-sm leading-6 text-yellow-100">{primaryDetail}</p>
        </div>
        <StatusPill status={impactStatus} />
      </div>
      <p className="mt-2 text-xs leading-5 text-yellow-100/55">
        {nextStep}
        {failedDnsCheck ? ` ${t('services.rollout.currentDnsBlocker', { name: failedDnsCheck.name.replaceAll('_', ' ') })}` : ''}
      </p>
      {node.activeSessions > 0 && (
        <Link
          href={`/dashboard/sessions?node=${node.id}&status=active&quality=all`}
          className="mt-3 inline-flex items-center justify-center rounded-lg border border-yellow-100/15 px-3 py-1.5 text-xs font-medium text-yellow-100 transition hover:border-yellow-100/30 hover:bg-yellow-100/[0.06]"
        >
          {t('nodeDetail.maintenance.openActiveSessions')}
        </Link>
      )}
    </div>
  );
}

function formatBlockedDrainActivity(node: VpnRestartReadinessSummary['blocked_nodes'][number]) {
  const activity = node.drain_activity;
  if (!activity) return null;
  const windowLabel = formatDuration(activity.activity_window_seconds || 180);
  const keepaliveIssueSessions = Math.max(
    activity.keepalive_missed_sessions ?? 0,
    activity.keepalive_pending_sessions ?? 0,
  );
  const clientRecent = activity.recent_client_rx_sessions ?? activity.recent_activity_sessions ?? 0;
  const clientNever = activity.never_client_rx_sessions ?? 0;
  const clientStale = Math.max(
    0,
    (activity.stale_client_rx_sessions ?? activity.idle_activity_sessions ?? 0) - clientNever,
  );
  return [
    `${clientRecent.toLocaleString()} client RX recent/${windowLabel}`,
    `${clientStale.toLocaleString()} client RX stale`,
    `${clientNever.toLocaleString()} never RX`,
    `${keepaliveIssueSessions.toLocaleString()} keepalive issue session${keepaliveIssueSessions === 1 ? '' : 's'}`,
    `${activity.keepalive_missed_total.toLocaleString()} missed total`,
  ].join(' · ');
}

function drainActivityHealthClass(risk: string | undefined) {
  if (risk === 'critical') return 'border-red-400/25 bg-red-400/[0.08] text-red-100';
  if (risk === 'warning') return 'border-yellow-300/25 bg-yellow-300/[0.08] text-yellow-100';
  if (risk === 'healthy') return 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100';
  return 'border-sky-300/25 bg-sky-300/[0.08] text-sky-100';
}

function fleetDrainRisk(summary: VpnRestartReadinessSummary | null) {
  const counts = summary?.drain_activity_health_counts ?? null;
  if (!counts) {
    return {
      label: 'Pending',
      detail: 'waiting for backend summary',
      count: 0,
      risk: 'info',
      next_step: 'Waiting for data.summary.restart_readiness.drain_activity_health_counts.summary.',
    };
  }
  if (counts.summary) {
    return counts.summary;
  }
  const critical = counts.critical_nodes ?? 0;
  const warning = counts.warning_nodes ?? 0;
  const issueCount = critical + warning;

  if (critical > 0) {
    return {
      label: 'Critical',
      detail: `${critical.toLocaleString()} critical · ${warning.toLocaleString()} warning`,
      count: issueCount,
      risk: 'critical',
      next_step: 'Open critical blocked nodes before queueing restarts.',
    };
  }
  if (warning > 0) {
    return {
      label: 'Warning',
      detail: `${warning.toLocaleString()} warning`,
      count: issueCount,
      risk: 'warning',
      next_step: 'Review warning drain nodes before restart.',
    };
  }
  return {
    label: 'Clear',
    detail: 'no critical drain activity',
    count: 0,
    risk: 'healthy',
    next_step: 'Continue normal rollout gate checks.',
  };
}

function fleetCutoverGuard(summary: VpnRestartReadinessSummary | null) {
  const counts = summary?.cutover_guard_counts ?? null;
  if (!counts) {
    return {
      label: 'Pending',
      detail: 'waiting for backend cutover summary',
      count: 0,
      risk: 'info',
      next_step: 'Waiting for data.summary.restart_readiness.cutover_guard_counts.',
      safe: 0,
      blocked: 0,
      actionable: 0,
      observedOnly: 0,
      servingTraffic: 0,
      total: 0,
      impact: 'unknown',
    };
  }
  const summaryCopy = counts.summary;
  const impactEntries = Object.entries(counts.forced_impact_counts ?? {})
    .sort((a, b) => b[1] - a[1]);
  const impact = impactEntries[0]?.[0]?.replaceAll('_', ' ') ?? 'none';
  return {
    label: summaryCopy?.label ?? 'Pending',
    detail: summaryCopy?.detail ?? 'waiting for backend cutover summary',
    count: summaryCopy?.count ?? counts.blocked_nodes ?? 0,
    risk: summaryCopy?.risk ?? 'info',
    next_step: summaryCopy?.next_step ?? 'Open blocked nodes before replacing or restarting Rust.',
    safe: counts.safe_nodes ?? 0,
    blocked: counts.blocked_nodes ?? 0,
    actionable: counts.actionable_blocked_nodes ?? counts.actionable_problem_nodes?.length ?? 0,
    observedOnly: counts.observed_only_nodes ?? 0,
    servingTraffic: counts.serving_traffic_nodes ?? 0,
    total: counts.total_nodes ?? 0,
    impact,
  };
}

function fleetCommandLifecycle(summary: VpnRestartReadinessSummary | null) {
  const counts = summary?.command_lifecycle_counts ?? null;
  if (!counts) {
    return {
      label: 'Pending',
      detail: 'waiting for backend command lifecycle summary',
      count: 0,
      risk: 'info',
      next_step: 'Waiting for data.summary.restart_readiness.command_lifecycle_counts.',
    };
  }
  if (counts.summary) {
    return counts.summary;
  }
  if (counts.stale > 0) {
    return {
      label: 'Stale',
      detail: `${counts.stale.toLocaleString()} stale restart command(s)`,
      count: counts.stale,
      risk: 'critical',
      next_step: 'Open Stale Command queue items.',
    };
  }
  if (counts.retry_needed > 0) {
    return {
      label: 'Retry',
      detail: `${counts.retry_needed.toLocaleString()} restart command(s) need review`,
      count: counts.retry_needed,
      risk: 'warning',
      next_step: 'Open Retry Needed queue items.',
    };
  }
  if (counts.active > 0) {
    return {
      label: 'Active',
      detail: `${counts.active.toLocaleString()} restart command(s) in progress`,
      count: counts.active,
      risk: 'info',
      next_step: 'Monitor command timelines.',
    };
  }
  return {
    label: 'Clear',
    detail: 'no restart command SLA issue',
    count: 0,
    risk: 'healthy',
    next_step: 'No command action required.',
  };
}

function fleetCommandDelivery(summary: VpnRestartReadinessSummary | null) {
  const delivery = summary?.command_delivery_health ?? null;
  if (!delivery) {
    return {
      count: 0,
      ready: 0,
      attention: 0,
      problemPanelSummary: null,
      problemNodes: [],
      label: 'Pending',
      detail: 'waiting for backend command delivery summary',
      risk: 'info',
      next_step: 'Waiting for data.summary.restart_readiness.command_delivery_health.',
    };
  }
  const summaryCopy = delivery.summary ?? {
    label: delivery.command_ready_nodes > 0 ? 'Ready' : 'Blocked',
    detail: `${delivery.command_ready_nodes.toLocaleString()} of ${delivery.total_nodes.toLocaleString()} node(s) command-ready`,
    risk: delivery.attention_nodes > 0 ? 'warning' : 'healthy',
    next_step: 'Review Rust heartbeat and operator reporting before queueing commands.',
  };

  return {
    count: delivery.command_ready_nodes,
    ready: delivery.command_ready_nodes,
    attention: delivery.attention_nodes,
    problemPanelSummary: delivery.problem_panel_summary ?? null,
    problemNodes: delivery.problem_nodes ?? [],
    label: summaryCopy.label,
    detail: summaryCopy.detail,
    risk: summaryCopy.risk,
    next_step: summaryCopy.next_step,
  };
}

function commandDeliveryActionHref(
  node: NonNullable<NonNullable<VpnRestartReadinessSummary['command_delivery_health']>['problem_nodes']>[number],
) {
  const intent = node.primary_action?.intent;
  if (intent === 'node_commands') {
    return `/dashboard/nodes/${node.id}?command_action=restart_service#vpn-commands`;
  }
  return `/dashboard/nodes/${node.id}`;
}

function fleetRuntimeCapability(summary: VpnRestartReadinessSummary | null) {
  const capability = summary?.runtime_capability_health ?? null;
  if (!capability) {
    return {
      count: 0,
      capable: 0,
      gaps: 0,
      total: 0,
      operatorReporting: 0,
      cleanupReporting: 0,
      rolloutReporting: 0,
      upgradeSafe: 0,
      upgradeBlocked: 0,
      blockerSummary: '',
      blockerNextStep: '',
      problemPanelSummary: null,
      problemNodes: [],
      label: 'Pending',
      detail: 'waiting for backend runtime capability summary',
      risk: 'info',
      next_step: 'Waiting for data.summary.restart_readiness.runtime_capability_health.',
    };
  }
  const summaryCopy = capability.summary ?? {
    label: capability.gap_nodes > 0 ? 'Capability gaps' : 'Capable',
    detail: `${capability.capable_nodes.toLocaleString()} of ${capability.total_nodes.toLocaleString()} node(s) report commercial runtime telemetry`,
    risk: capability.gap_nodes > 0 ? 'warning' : 'healthy',
    next_step: 'Review Rust operator_status and session_cleanup reporting before cutover work.',
    count: capability.gap_nodes,
  };
  const backendBlockerSummary = capability.upgrade_blocker_summary ?? null;
  const backendBlockers = capability.upgrade_blockers ?? [];
  const blockerSummary = backendBlockers.length > 0
    ? backendBlockers
      .slice(0, 3)
      .map((item) => `${item.label} ${item.count.toLocaleString()}`)
      .join(' · ')
    : Object.entries(capability.upgrade_blocker_counts ?? {})
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 3)
      .map(([key, count]) => `${key.replaceAll('_', ' ')} ${count.toLocaleString()}`)
      .join(' · ');

  return {
    count: summaryCopy.count ?? capability.gap_nodes,
    capable: capability.capable_nodes,
    gaps: capability.gap_nodes,
    total: capability.total_nodes,
    operatorReporting: capability.operator_reporting_nodes,
    cleanupReporting: capability.cleanup_reporting_nodes,
    rolloutReporting: capability.rollout_reporting_nodes,
    upgradeSafe: capability.upgrade_safe_nodes ?? 0,
    upgradeBlocked: capability.upgrade_blocked_nodes ?? 0,
    blockerSummary: backendBlockerSummary?.detail ?? blockerSummary,
    blockerNextStep: backendBlockerSummary?.next_step ?? '',
    problemPanelSummary: capability.problem_panel_summary ?? null,
    problemNodes: capability.problem_nodes ?? [],
    label: summaryCopy.label,
    detail: summaryCopy.detail,
    risk: summaryCopy.risk,
    next_step: summaryCopy.next_step,
  };
}

function fleetCommandOutcome(summary: VpnRestartReadinessSummary | null) {
  const counts = summary?.command_lifecycle_counts ?? null;
  if (!counts) {
    return {
      label: 'Pending',
      detail: 'waiting for backend restart outcome summary',
      count: 0,
      risk: 'info',
      next_step: 'Waiting for data.summary.restart_readiness.command_lifecycle_counts.outcome_summary.',
    };
  }
  if (counts.outcome_summary) {
    return counts.outcome_summary;
  }
  const needsReview = counts.failed + counts.timeout;
  if (needsReview > 0) {
    return {
      label: 'Review',
      detail: `${counts.failed.toLocaleString()} failed, ${counts.timeout.toLocaleString()} timed out`,
      count: needsReview,
      risk: 'warning',
      next_step: 'Open Retry Needed items and inspect node command history.',
    };
  }
  if (counts.cancelled > 0) {
    return {
      label: 'Cancelled',
      detail: `${counts.cancelled.toLocaleString()} restart command(s) cancelled`,
      count: counts.cancelled,
      risk: 'info',
      next_step: 'Confirm cancelled nodes still match the rollout plan.',
    };
  }
  return {
    label: 'Clean',
    detail: `${counts.completed.toLocaleString()} completed restart outcome(s)`,
    count: counts.completed,
    risk: counts.completed > 0 ? 'healthy' : 'info',
    next_step: counts.completed > 0 ? 'No terminal restart command issue detected.' : 'No terminal restart outcome reported yet.',
  };
}

function restartBlockerCopy(code: string) {
  const copy: Record<string, { label: string; remediation: string }> = {
    maintenance_required: {
      label: 'Maintenance off',
      remediation: 'Enable maintenance so new placements stop before restart.',
    },
    active_sessions: {
      label: 'Active sessions',
      remediation: 'Open sessions and wait for tunnels to drain to zero.',
    },
    cleanup_policy_pending: {
      label: 'Cleanup policy pending',
      remediation: 'Open node detail and confirm Rust reports session_cleanup before relying on drain ETA.',
    },
    restart_command_active: {
      label: 'Restart already queued',
      remediation: 'Open node commands and wait for the active restart_service command.',
    },
  };

  return copy[code] ?? {
    label: code.replaceAll('_', ' '),
    remediation: 'Review the backend restart_readiness blocker message.',
  };
}

function restartBlockedNodeActionHref(node: VpnRestartReadinessSummary['blocked_nodes'][number]) {
  const intent = node.recommended_action?.intent;
  if (intent === 'sessions') {
    return `/dashboard/sessions?node=${encodeURIComponent(node.id)}&status=active&quality=all`;
  }
  if (intent === 'node_commands') {
    return `/dashboard/nodes/${node.id}?command_action=restart_service#vpn-commands`;
  }
  return `/dashboard/nodes/${node.id}`;
}

function restartBlockedNodeActionLabel(node: VpnRestartReadinessSummary['blocked_nodes'][number]) {
  return node.recommended_action?.label ?? 'Open node';
}

function cutoverActionReasonLabel(reason: string | undefined) {
  // Backend contract:
  // GET /api/privacy_network/vpn/overview/
  // data.summary.restart_readiness.cutover_guard_counts.actionable_problem_nodes[].actionable_reason
  // Source: /root/aeronyx/privacy_network/api/vpn_observability.py
  // Keep these labels presentation-only; queue eligibility remains backend-authored.
  const copy: Record<string, string> = {
    active_client_traffic: 'active client traffic',
    cleanup_policy_pending: 'cleanup policy pending',
    active_sessions: 'active sessions',
    operator_reporting_missing: 'operator reporting missing',
    maintenance_mode: 'maintenance mode',
    restart_readiness_blocked: 'restart gate blocked',
    runtime_rollout_required: 'runtime rollout required',
    active_restart_command: 'restart command active',
  };
  return copy[reason || ''] ?? (reason ? reason.replaceAll('_', ' ') : 'backend action');
}

function buildBlockedRestartQueueItem(
  node: VpnRestartReadinessSummary['blocked_nodes'][number],
  readinessNode: RestartReadinessNode | undefined,
): RestartActionQueueItem {
  const activity = formatBlockedDrainActivity(node);
  const drainStatus = formatDrainStatus(node.drain_status);
  const health = node.drain_activity?.activity_health ?? null;
  const risk = health?.risk ?? 'warning';
  const meta = [
    `${node.active_sessions.toLocaleString()} active`,
    readinessNode?.regionLabel ?? 'unknown region',
    `v${readinessNode?.version ?? 'unknown version'}`,
    node.maintenance_mode ? 'maintenance on' : 'maintenance off',
    drainStatus ? `drain ${drainStatus}` : null,
    node.active_restart_command_status ? `restart ${node.active_restart_command_status}` : null,
    activity ? `activity ${activity}` : null,
    node.blocker_codes.length > 0 ? node.blocker_codes.join(', ') : null,
  ].filter((item): item is string => Boolean(item));

  return {
    id: node.id,
    name: node.name,
    status: health?.label ?? 'Blocked',
    detail: node.recommended_action?.detail || node.drain_next_step || node.next_step,
    meta,
    risk,
    regionLabel: readinessNode?.regionLabel ?? 'unknown region',
    version: readinessNode?.version ?? 'unknown version',
    healthStatus: readinessNode?.healthStatus ?? 'blocked',
    activeRestartCommand: readinessNode?.activeRestartCommand ?? null,
    latestRestartCommand: readinessNode?.latestRestartCommand ?? null,
    activeSessions: node.active_sessions,
    maintenanceMode: node.maintenance_mode,
    canEnableMaintenance: !node.maintenance_mode && node.blocker_codes.includes('maintenance_required'),
    canQueueRestart: false,
    canCancelRestartCommand: restartCommandCanCancel(readinessNode?.activeRestartCommand ?? null),
    actionHref: restartBlockedNodeActionHref(node),
    actionLabel: restartBlockedNodeActionLabel(node),
    source: 'backend_blocked_node',
  };
}

function buildCutoverGuardQueueItem(
  node: VpnRestartCutoverProblemNode,
  readinessNode: RestartReadinessNode | undefined,
): RestartActionQueueItem {
  const forcedImpact = node.user_impact_if_forced.replaceAll('_', ' ');
  const actionReason = cutoverActionReasonLabel(node.actionable_reason);
  const meta = [
    `reason ${actionReason}`,
    `${node.active_sessions.toLocaleString()} active`,
    `${node.recent_client_rx_sessions.toLocaleString()} recent client RX`,
    `${node.stale_client_rx_sessions.toLocaleString()} stale client RX`,
    `${node.never_client_rx_sessions.toLocaleString()} never RX`,
    `impact ${forcedImpact}`,
    readinessNode?.regionLabel ?? 'unknown region',
    readinessNode?.version ? `v${readinessNode.version}` : null,
    node.maintenance_mode ? 'maintenance on' : 'maintenance off',
    node.blocker_codes?.length ? `blockers ${node.blocker_codes.join(', ')}` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    id: node.id,
    name: node.name,
    status: node.label,
    detail: node.next_step || node.detail,
    meta,
    risk: node.risk,
    regionLabel: readinessNode?.regionLabel ?? 'unknown region',
    version: readinessNode?.version ?? 'unknown version',
    healthStatus: readinessNode?.healthStatus ?? node.health_status,
    activeRestartCommand: readinessNode?.activeRestartCommand ?? null,
    latestRestartCommand: readinessNode?.latestRestartCommand ?? null,
    activeSessions: node.active_sessions,
    maintenanceMode: node.maintenance_mode,
    canEnableMaintenance: !node.maintenance_mode,
    canQueueRestart: false,
    canCancelRestartCommand: restartCommandCanCancel(readinessNode?.activeRestartCommand ?? null),
    actionHref: node.active_sessions > 0
      ? `/dashboard/sessions?node=${encodeURIComponent(node.id)}&status=active&quality=all`
      : `/dashboard/nodes/${node.id}`,
    actionLabel: node.active_sessions > 0 ? 'Open sessions' : 'Open node',
    source: 'backend_cutover_guard',
  };
}

function runtimeCapabilityActionHref(
  node: NonNullable<NonNullable<VpnRestartReadinessSummary['runtime_capability_health']>['problem_nodes']>[number],
) {
  const intent = node.primary_action?.intent;
  if (intent === 'sessions') {
    return `/dashboard/sessions?node=${encodeURIComponent(node.id)}&status=active&quality=all`;
  }
  if (intent === 'node_commands') {
    return `/dashboard/nodes/${node.id}?command_action=restart_service#vpn-commands`;
  }
  return `/dashboard/nodes/${node.id}`;
}

function buildRuntimeCapabilityQueueItem(
  node: NonNullable<NonNullable<VpnRestartReadinessSummary['runtime_capability_health']>['problem_nodes']>[number],
  readinessNode: RestartReadinessNode | undefined,
): RestartActionQueueItem {
  // Backend contract:
  // GET /api/privacy_network/vpn/overview/
  // data.summary.restart_readiness.runtime_capability_health.problem_nodes[]
  // Source: /root/aeronyx/privacy_network/api/vpn_observability.py
  // Rust producers: /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
  // and /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs.
  const missing = node.missing_capabilities.map((item) => item.replaceAll('_', ' '));
  const upgradeGate = node.upgrade_gate ?? null;
  const checklistSummary = upgradeGate?.checklist_summary ?? null;
  const meta = [
    `missing ${missing.join(', ')}`,
    upgradeGate ? `upgrade ${upgradeGate.label.toLowerCase()}` : null,
    checklistSummary ? `checks ${checklistSummary.ready}/${checklistSummary.total} ready` : null,
    `${node.active_sessions.toLocaleString()} active`,
    node.maintenance_mode ? 'maintenance on' : 'maintenance off',
    node.operator_reporting ? 'operator reported' : 'operator missing',
    node.cleanup_reported ? 'cleanup reported' : 'cleanup missing',
    node.rollout_reporting ? 'rollout reported' : 'rollout missing',
    upgradeGate?.user_impact_if_forced ? `impact ${upgradeGate.user_impact_if_forced.replaceAll('_', ' ')}` : null,
    node.primary_action?.key ? `action ${node.primary_action.key.replaceAll('_', ' ')}` : null,
    readinessNode?.regionLabel ?? 'unknown region',
    readinessNode?.version ? `v${readinessNode.version}` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    id: node.id,
    name: node.name,
    status: upgradeGate?.label ?? node.issue_label,
    detail: upgradeGate?.next_step ?? node.recommended_action,
    meta,
    risk: upgradeGate?.risk ?? node.risk,
    regionLabel: readinessNode?.regionLabel ?? 'unknown region',
    version: readinessNode?.version ?? 'unknown version',
    healthStatus: readinessNode?.healthStatus ?? node.health_status,
    activeRestartCommand: readinessNode?.activeRestartCommand ?? null,
    latestRestartCommand: readinessNode?.latestRestartCommand ?? null,
    activeSessions: node.active_sessions,
    maintenanceMode: node.maintenance_mode,
    canEnableMaintenance: !node.maintenance_mode,
    canQueueRestart: false,
    canCancelRestartCommand: restartCommandCanCancel(readinessNode?.activeRestartCommand ?? null),
    actionHref: runtimeCapabilityActionHref(node),
    actionLabel: node.primary_action?.label ?? 'Open node',
    source: 'backend_runtime_capability',
  };
}

function buildReadyRestartQueueItem(node: RestartReadinessNode): RestartActionQueueItem {
  return {
    id: node.id,
    name: node.name,
    status: node.status,
    detail: node.canRestart ? 'Restart window open from backend readiness gate.' : node.nextStep,
    meta: [
      `${node.activeSessions.toLocaleString()} active`,
      node.regionLabel,
      `v${node.version}`,
      node.maintenanceMode ? 'maintenance on' : 'maintenance off',
      node.operatorReporting ? 'operator reported' : 'operator pending',
      node.cleanupReported ? 'cleanup reported' : 'cleanup pending',
      node.activeRestartCommand ? `restart ${node.activeRestartCommand.status}` : null,
    ].filter((item): item is string => Boolean(item)),
    risk: node.status === 'ready' ? 'healthy' : 'info',
    regionLabel: node.regionLabel,
    version: node.version,
    healthStatus: node.healthStatus,
    activeRestartCommand: node.activeRestartCommand,
    latestRestartCommand: node.latestRestartCommand,
    activeSessions: node.activeSessions,
    maintenanceMode: node.maintenanceMode,
    canEnableMaintenance: false,
    canQueueRestart: node.canRestart && !node.activeRestartCommand,
    canCancelRestartCommand: restartCommandCanCancel(node.activeRestartCommand),
    actionHref: `/dashboard/nodes/${node.id}`,
    actionLabel: 'Open node',
    source: 'backend_readiness_node',
  };
}

function buildCommandClosureQueueItem(node: RestartReadinessNode): RestartActionQueueItem {
  const command = node.latestRestartCommand;
  const retryNeeded = restartCommandNeedsRetry(command);
  const manualCheck = restartCommandManualCheck(command);
  return {
    ...buildReadyRestartQueueItem(node),
    status: retryNeeded ? 'retry needed' : 'manual check',
    detail: retryNeeded
      ? 'Latest restart_service command did not close cleanly. Review command details before retry.'
      : manualCheck
        ? 'Latest restart_service command was cancelled or timed out. Confirm node runtime before next action.'
        : 'Latest restart_service command reached a terminal state.',
    risk: retryNeeded ? 'critical' : 'warning',
    canQueueRestart: retryNeeded && node.canRestart && !node.activeRestartCommand,
    actionHref: `/dashboard/nodes/${node.id}?command_action=restart_service#vpn-commands`,
    actionLabel: retryNeeded ? 'Review retry' : 'Manual check',
  };
}

function buildStaleCommandQueueItem(node: RestartReadinessNode): RestartActionQueueItem {
  return {
    ...buildReadyRestartQueueItem(node),
    status: 'stale command',
    detail: node.activeRestartCommand?.stale_reason
      || 'Active restart_service command exceeded the backend SLA. Inspect command delivery before retrying.',
    risk: 'critical',
    canQueueRestart: false,
    actionHref: `/dashboard/nodes/${node.id}?command_action=restart_service#vpn-commands`,
    actionLabel: 'Inspect command',
  };
}

function isActionableCutoverBlocker(readinessNode: RestartReadinessNode | undefined) {
  if (!readinessNode) return true;
  return (
    readinessNode.status !== 'current'
    || readinessNode.maintenanceMode
    || readinessNode.restartRequired
    || Boolean(readinessNode.activeRestartCommand)
  );
}

function restartQueueSortScore(item: RestartActionQueueItem) {
  const riskScore = item.risk === 'critical' ? 0 : item.risk === 'warning' ? 1 : item.risk === 'healthy' ? 2 : 3;
  const maintenanceScore = item.maintenanceMode ? 1 : 0;
  const restartScore = item.canQueueRestart ? 0 : 1;
  return [
    riskScore,
    restartScore,
    maintenanceScore,
    -item.activeSessions,
    item.name.toLowerCase(),
  ] as const;
}

function sortRestartQueueItems(items: RestartActionQueueItem[]) {
  return [...items].sort((left, right) => {
    const leftScore = restartQueueSortScore(left);
    const rightScore = restartQueueSortScore(right);
    return (
      leftScore[0] - rightScore[0]
      || leftScore[1] - rightScore[1]
      || leftScore[2] - rightScore[2]
      || leftScore[3] - rightScore[3]
      || leftScore[4].localeCompare(rightScore[4])
    );
  });
}

function filterRestartQueueItems(
  items: RestartActionQueueItem[],
  filters: RestartQueueFilters,
) {
  return items.filter((item) => {
    if (filters.region !== 'all' && item.regionLabel !== filters.region) return false;
    if (filters.version !== 'all' && item.version !== filters.version) return false;
    if (filters.status === 'stale') return restartCommandIsStale(item.activeRestartCommand);
    if (filters.status === 'retry') return restartCommandNeedsRetry(item.latestRestartCommand);
    if (filters.status === 'capability') return item.source === 'backend_runtime_capability';
    if (filters.status === 'blocked') {
      return item.source === 'backend_blocked_node'
        || item.source === 'backend_cutover_guard'
        || item.source === 'backend_runtime_capability';
    }
    if (filters.status === 'ready') return item.canQueueRestart;
    if (filters.status === 'current') return item.status === 'current';
    if (filters.status === 'attention') {
      return item.source === 'backend_blocked_node'
        || item.source === 'backend_cutover_guard'
        || item.source === 'backend_runtime_capability'
        || item.canQueueRestart
        || restartCommandIsStale(item.activeRestartCommand)
        || restartCommandNeedsRetry(item.latestRestartCommand)
        || restartCommandManualCheck(item.latestRestartCommand);
    }
    return true;
  });
}

function restartCommandStageIndex(command: VpnRestartCommandState | null) {
  if (!command) return -1;
  if (command.status === 'pending') return 0;
  if (command.status === 'sent') return 1;
  if (command.status === 'executing') return 2;
  if (command.is_terminal) return 2;
  return 0;
}

function restartCommandStatusClass(command: VpnRestartCommandState | null) {
  if (!command) return 'border-white/10 bg-white/[0.03] text-gray-400';
  if (command.is_stale) return 'border-red-300/25 bg-red-300/[0.08] text-red-100';
  if (command.status === 'failed' || command.status === 'timeout') return 'border-red-300/25 bg-red-300/[0.08] text-red-100';
  if (command.status === 'cancelled') return 'border-yellow-300/25 bg-yellow-300/[0.08] text-yellow-100';
  if (command.status === 'completed') return 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100';
  if (command.status === 'executing') return 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100';
  if (command.status === 'sent') return 'border-sky-300/25 bg-sky-300/[0.08] text-sky-100';
  return 'border-yellow-300/25 bg-yellow-300/[0.08] text-yellow-100';
}

function restartCommandTimelineLabel(command: VpnRestartCommandState | null) {
  if (!command) return 'No active restart command';
  const timestamp = command.completed_at ?? command.acked_at ?? command.sent_at ?? command.created_at;
  const timestampLabel = timestamp ? ` · ${formatRelativeTime(timestamp)}` : '';
  const staleLabel = command.is_stale ? ' · stale' : '';
  return `${command.is_terminal ? 'Last restart command' : 'Restart command'} ${command.status}${timestampLabel}${staleLabel}`;
}

function restartCommandStageLabels(command: VpnRestartCommandState | null) {
  if (command?.is_terminal) return ['Queued', 'Sent', 'Closed'];
  return ['Queued', 'Sent', 'Executing'];
}

function restartCommandNeedsRetry(command: VpnRestartCommandState | null) {
  if (!command) return false;
  return Boolean(command.can_retry) || command.status === 'failed' || command.status === 'timeout';
}

function restartCommandIsStale(command: VpnRestartCommandState | null) {
  return Boolean(command?.is_stale);
}

function restartCommandManualCheck(command: VpnRestartCommandState | null) {
  if (!command) return false;
  return command.status === 'cancelled' || command.status === 'timeout';
}

function restartCommandCanCancel(command: VpnRestartCommandState | null) {
  if (!command) return false;
  if (typeof command.can_cancel === 'boolean') return command.can_cancel;
  return command.status === 'pending' || command.status === 'sent';
}

function restartCommandCancelReason(command: VpnRestartCommandState | null) {
  if (!command) return '';
  return command.cancel_reason || 'Backend cancel policy allows cancellation only while a command is pending or sent.';
}

function restartCommandSlaLabel(command: VpnRestartCommandState | null) {
  if (!command?.age_seconds || !command.stale_after_seconds) return null;
  return `${formatDuration(command.age_seconds)} elapsed / ${formatDuration(command.stale_after_seconds)} SLA`;
}

function restartQueueFilterOptions(nodes: RestartReadinessNode[]) {
  const regions = Array.from(new Set(nodes.map((node) => node.regionLabel))).sort();
  const versions = Array.from(new Set(nodes.map((node) => node.version))).sort();
  return { regions, versions };
}

function buildRestartActionQueues(
  summary: VpnRestartReadinessSummary | null,
  nodes: RestartReadinessNode[],
  filters: RestartQueueFilters,
  t: ServicesTranslateFn,
): RestartActionQueue[] {
  const readinessById = new Map(nodes.map((node) => [node.id, node]));
  const filteredNodeIds = new Set(nodes.map((node) => node.id));
  const blockedItems = (summary?.blocked_nodes ?? [])
    .filter((node) => filteredNodeIds.has(node.id))
    .map((node) => buildBlockedRestartQueueItem(node, readinessById.get(node.id)));
  const backendCutoverNodes = summary?.cutover_guard_counts?.actionable_problem_nodes
    ?? (summary?.cutover_guard_counts?.problem_nodes ?? [])
      .filter((node) => isActionableCutoverBlocker(readinessById.get(node.id)));
  const cutoverGuardItems = backendCutoverNodes
    .filter((node) => filteredNodeIds.has(node.id))
    .map((node) => buildCutoverGuardQueueItem(node, readinessById.get(node.id)));
  const runtimeCapabilityItems = (summary?.runtime_capability_health?.problem_nodes ?? [])
    .filter((node) => filteredNodeIds.has(node.id))
    .map((node) => buildRuntimeCapabilityQueueItem(node, readinessById.get(node.id)));
  const staleCommandItems = nodes
    .filter((node) => restartCommandIsStale(node.activeRestartCommand))
    .map(buildStaleCommandQueueItem);
  const readyItems = nodes
    .filter((node) => (
      node.status === 'ready'
      && !restartCommandIsStale(node.activeRestartCommand)
      && !restartCommandNeedsRetry(node.latestRestartCommand)
      && !restartCommandManualCheck(node.latestRestartCommand)
    ))
    .map(buildReadyRestartQueueItem);
  const commandClosureItems = nodes
    .filter((node) => (
      restartCommandNeedsRetry(node.latestRestartCommand)
      || restartCommandManualCheck(node.latestRestartCommand)
    ))
    .map(buildCommandClosureQueueItem);
  const currentItems = nodes
    .filter((node) => (
      node.status === 'current'
      && !restartCommandIsStale(node.activeRestartCommand)
      && !restartCommandNeedsRetry(node.latestRestartCommand)
      && !restartCommandManualCheck(node.latestRestartCommand)
    ))
    .map(buildReadyRestartQueueItem);
  const filteredBlockedItems = filterRestartQueueItems(blockedItems, filters);
  const filteredCutoverGuardItems = filterRestartQueueItems(cutoverGuardItems, filters);
  const filteredRuntimeCapabilityItems = filterRestartQueueItems(runtimeCapabilityItems, filters);
  const filteredStaleCommandItems = filterRestartQueueItems(staleCommandItems, filters);
  const filteredCommandClosureItems = filterRestartQueueItems(commandClosureItems, filters);
  const filteredReadyItems = filterRestartQueueItems(readyItems, filters);
  const filteredCurrentItems = filterRestartQueueItems(currentItems, filters);
  const unsafeCutoverNodeIds = new Set(filteredCutoverGuardItems.map((item) => item.id));
  const filteredDrainBlockedItems = filteredBlockedItems.filter(
    (item) => !restartCommandIsStale(item.activeRestartCommand) && !unsafeCutoverNodeIds.has(item.id),
  );
  const criticalItems = sortRestartQueueItems(
    filteredDrainBlockedItems.filter((item) => item.risk === 'critical'),
  );
  const warningItems = sortRestartQueueItems(
    filteredDrainBlockedItems.filter((item) => item.risk !== 'critical'),
  );

  return [
    {
      key: 'stale',
      label: t('services.restartQueue.groups.stale.label'),
      description: t('services.restartQueue.groups.stale.description'),
      status: filteredStaleCommandItems.length > 0 ? 'critical' : 'healthy',
      emptyState: t('services.restartQueue.groups.stale.empty'),
      items: sortRestartQueueItems(filteredStaleCommandItems),
    },
    {
      key: 'retry',
      label: t('services.restartQueue.groups.retry.label'),
      description: t('services.restartQueue.groups.retry.description'),
      status: filteredCommandClosureItems.length > 0 ? 'critical' : 'healthy',
      emptyState: t('services.restartQueue.groups.retry.empty'),
      items: sortRestartQueueItems(filteredCommandClosureItems),
    },
    {
      key: 'capability',
      label: t('services.restartQueue.groups.capability.label'),
      description: t('services.restartQueue.groups.capability.description'),
      status: filteredRuntimeCapabilityItems.length > 0
        ? (filteredRuntimeCapabilityItems.some((item) => item.risk === 'critical') ? 'critical' : 'warning')
        : 'healthy',
      emptyState: t('services.restartQueue.groups.capability.empty'),
      items: sortRestartQueueItems(filteredRuntimeCapabilityItems),
    },
    {
      key: 'cutover',
      label: t('services.restartQueue.groups.cutover.label'),
      description: t('services.restartQueue.groups.cutover.description'),
      status: filteredCutoverGuardItems.length > 0
        ? (filteredCutoverGuardItems.some((item) => item.risk === 'critical') ? 'critical' : 'warning')
        : 'healthy',
      emptyState: t('services.restartQueue.groups.cutover.empty'),
      items: sortRestartQueueItems(filteredCutoverGuardItems),
    },
    {
      key: 'critical',
      label: t('services.restartQueue.groups.critical.label'),
      description: t('services.restartQueue.groups.critical.description'),
      status: criticalItems.length > 0 ? 'critical' : 'healthy',
      emptyState: t('services.restartQueue.groups.critical.empty'),
      items: criticalItems,
    },
    {
      key: 'warning',
      label: t('services.restartQueue.groups.warning.label'),
      description: t('services.restartQueue.groups.warning.description'),
      status: warningItems.length > 0 ? 'warning' : 'healthy',
      emptyState: t('services.restartQueue.groups.warning.empty'),
      items: warningItems,
    },
    {
      key: 'ready',
      label: t('services.restartQueue.groups.ready.label'),
      description: t('services.restartQueue.groups.ready.description'),
      status: readyItems.length > 0 ? 'ready' : 'pending',
      emptyState: t('services.restartQueue.groups.ready.empty'),
      items: sortRestartQueueItems(filteredReadyItems),
    },
    {
      key: 'current',
      label: t('services.restartQueue.groups.current.label'),
      description: t('services.restartQueue.groups.current.description'),
      status: 'current',
      emptyState: t('services.restartQueue.groups.current.empty'),
      items: sortRestartQueueItems(filteredCurrentItems).slice(0, 4),
    },
  ];
}

function StatusPill({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  const { t } = useI18n();
  const key = `common.status.${normalized}`;
  const translated = t(key);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(normalized)}`}>
      {translated === key ? normalized.replaceAll('_', ' ') : translated}
    </span>
  );
}

function PageHeader({
  isFetching,
  dataUpdatedAt,
  refreshIntervalMs,
  onRefresh,
}: PageHeaderProps) {
  const { t } = useI18n();
  return (
    <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-300">
          {t('services.pageEyebrow')}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">{t('services.pageTitle')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
          {t('services.pageDescription')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-200">
            {t('services.liveRefresh', { interval: formatRefreshInterval(refreshIntervalMs) })}
          </span>
          <span className="rounded-md border border-white/10 px-2 py-1">
            {isFetching ? t('services.updatingOverview') : formatDataUpdatedAt(dataUpdatedAt)}
          </span>
          <span className="rounded-md border border-white/10 px-2 py-1">
            {t('services.apiOverview')}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFetching ? t('common.refreshing') : t('common.refreshNow')}
        </button>
        <Link
          href="/dashboard/nodes"
          className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/5"
        >
          {t('common.manageNodes')}
        </Link>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail: string;
  status: string;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
        <StatusPill status={status} />
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500">{detail}</p>
    </section>
  );
}

function FleetSummaryGrid({
  summary,
  latestReportedAt,
}: {
  summary: FleetSummary;
  latestReportedAt: string | null;
}) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <SummaryTile
        label={t('services.summary.reportingNodes')}
        value={`${summary.reportingNodes}/${summary.totalNodes}`}
        detail={latestReportedAt
          ? t('services.summary.latestHeartbeat', { time: i18nRelativeTime(latestReportedAt) })
          : t('services.summary.waitingHeartbeat')}
        status={summary.reportingNodes > 0 ? 'ok' : 'pending'}
      />
      <SummaryTile
        label={t('services.summary.privacyReady')}
        value={formatNumber(summary.healthyPrivacyNodes)}
        detail={t('services.summary.privacyReadyDetail')}
        status={summary.healthyPrivacyNodes > 0 ? 'ok' : 'attention'}
      />
      <SummaryTile
        label={t('services.summary.enabledServices')}
        value={`${summary.enabledServices}/${summary.totalServiceSlots || 0}`}
        detail={t('services.summary.enabledServicesDetail')}
        status={summary.enabledServices > 0 ? 'ok' : 'pending'}
      />
      <SummaryTile
        label={t('services.summary.needsAttention')}
        value={formatNumber(summary.attentionNodes)}
        detail={t('services.summary.needsAttentionDetail')}
        status={summary.attentionNodes > 0 ? 'attention' : 'ok'}
      />
      <SummaryTile
        label={t('services.summary.rolloutRestarts')}
        value={formatNumber(summary.rolloutRestartRequired)}
        detail={t('services.summary.rolloutRestartsDetail')}
        status={summary.rolloutRestartRequired > 0 ? 'warning' : 'ok'}
      />
    </div>
  );
}

/**
 * First-screen commercial fleet decision panel.
 *
 * Backend contract:
 *   GET /api/privacy_network/vpn/overview/
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *   data.summary.restart_readiness.commercial_placement_health is the
 *   backend-authored paid-placement policy summary. Nodeboard only presents
 *   counts and routes operators to node detail; it does not infer client
 *   placement policy in React.
 *
 * Rust producers:
 *   /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 */
function FleetCommercialOperationsPanel({
  nodes,
  summary,
}: {
  nodes: VpnNodeHealth[];
  summary: VpnRestartReadinessSummary | null;
}) {
  const { t, formatNumber } = useI18n();
  const commercial = summary?.commercial_placement_health ?? null;
  const policySync = summary?.policy_sync_health ?? null;
  const policyBlocks = summary?.policy_enforcement_health ?? null;
  const runtimeCapability = summary?.runtime_capability_health ?? null;
  const rollout = commercial?.rust_placement_rollout_summary ?? null;
  const maintenanceCandidates = summary?.maintenance_exit_candidate_count ?? 0;
  const ready = commercial?.ready_nodes ?? 0;
  const degraded = (commercial?.watch_nodes ?? 0)
    + (commercial?.policy_sync_attention_nodes ?? 0)
    + (commercial?.recent_policy_problem_nodes ?? 0);
  const blocked = commercial?.blocked_nodes ?? 0;
  const needsRustUpgrade = commercial?.rust_placement_missing_nodes
    ?? rollout?.missing_nodes
    ?? runtimeCapability?.gap_nodes
    ?? 0;
  const total = commercial?.total_nodes ?? summary?.total_vpn_nodes ?? 0;
  const problemNodes = commercial?.problem_nodes ?? [];
  const primaryProblem = problemNodes[0] ?? null;
  const capacityRisks = collectFleetCapacityRisks(nodes, t, formatNumber);
  const capacityRiskNodes = new Set(capacityRisks.map((risk) => risk.nodeId));
  const topCapacityRisk = capacityRisks[0] ?? null;
  const capacityRiskTone = capacityRisks.some((risk) => risk.tone === 'critical') ? 'critical' : 'warning';
  const statusCards = [
    {
      label: t('services.commercial.ready'),
      value: ready,
      detail: t('services.commercial.readyDetail'),
      status: ready > 0 ? 'ok' : 'pending',
    },
    {
      label: t('services.commercial.degraded'),
      value: degraded,
      detail: t('services.commercial.degradedDetail'),
      status: degraded > 0 ? 'warning' : 'ok',
    },
    {
      label: t('common.status.blocked'),
      value: blocked,
      detail: t('services.commercial.blockedDetail'),
      status: blocked > 0 ? 'critical' : 'ok',
    },
    {
      label: t('settings.policyEditor.maintenanceMode'),
      value: maintenanceCandidates,
      detail: t('services.commercial.maintenanceDetail'),
      status: maintenanceCandidates > 0 ? 'info' : 'ok',
    },
    {
      label: t('services.commercial.needsRustUpgrade'),
      value: needsRustUpgrade,
      detail: t('services.commercial.needsRustUpgradeDetail'),
      status: needsRustUpgrade > 0 ? 'warning' : 'ok',
    },
  ];

  if (!summary && !commercial) {
    return (
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('services.commercial.title')}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              {t('services.commercial.waitingSummary')}
            </p>
          </div>
          <StatusPill status="pending" />
        </div>
      </section>
    );
  }

  return (
    <section className={`mb-6 rounded-2xl border p-5 ${drainActivityHealthClass(commercial?.risk ?? 'info')}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-white">{t('services.commercial.title')}</h2>
            <StatusPill status={commercial?.risk ?? 'info'} />
            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-gray-300">
              {t('services.commercial.readyCount', { ready: formatNumber(ready), total: formatNumber(total) })}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-300">
            {commercial?.label ?? t('common.status.pending')} · {commercial?.detail ?? t('services.commercial.collectingPlacement')}
          </p>
          <p className="mt-1 text-sm leading-6 text-gray-400">
            {commercial?.next_step
              ?? t('services.commercial.waitBeforePolicyChange')}
          </p>
        </div>
        <div className="grid min-w-full grid-cols-2 gap-2 text-xs sm:grid-cols-4 xl:min-w-[520px]">
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-gray-500">{t('services.commercial.capacityScore')}</p>
            <p className="mt-1 text-base font-semibold text-white">
              {(commercial?.capacity_score_percent ?? 0).toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-gray-500">{t('services.commercial.publicEntries')}</p>
            <p className="mt-1 text-base font-semibold text-white">
              {(commercial?.public_entry_nodes ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-gray-500">{t('services.commercial.remainingSlots')}</p>
            <p className="mt-1 text-base font-semibold text-white">
              {(commercial?.bounded_capacity_remaining ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-gray-500">{t('services.commercial.rustCoverage')}</p>
            <p className="mt-1 text-base font-semibold text-white">
              {(commercial?.rust_placement_coverage_percent ?? 0).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {capacityRisks.length > 0 && (
        <div className={`mt-4 rounded-xl border p-4 ${capacityRiskTone === 'critical' ? 'border-red-500/25 bg-red-500/[0.07]' : 'border-yellow-500/25 bg-yellow-500/[0.06]'}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-white">{t('services.commercial.capacityRisks')}</p>
                <StatusPill status={capacityRiskTone} />
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-gray-200">
                  {t('services.commercial.capacityRiskCount', {
                    risks: formatNumber(capacityRisks.length),
                    nodes: formatNumber(capacityRiskNodes.size),
                  })}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-300">
                {t('services.commercial.capacityRiskDetail')}
              </p>
            </div>
            {topCapacityRisk && (
              <Link
                href={`/dashboard/nodes/${topCapacityRisk.nodeId}`}
                className="inline-flex w-fit items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/20 hover:bg-white/5"
              >
                {t('services.commercial.openCapacityRisk')}
              </Link>
            )}
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {capacityRisks.slice(0, 3).map((risk) => (
              <div key={`${risk.nodeId}:${risk.label}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/nodes/${risk.nodeId}`} className="min-w-0 truncate font-medium text-white hover:text-purple-300">
                    {risk.nodeName}
                  </Link>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 ${statusClass(risk.tone)}`}>
                    {risk.tone}
                  </span>
                </div>
                <p className="mt-1 text-gray-500">{risk.region}</p>
                <p className="mt-2 leading-5 text-gray-200">{risk.label} · {risk.detail}</p>
                <p className="mt-1 leading-5 text-gray-500">{risk.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statusCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] opacity-60">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold">{formatNumber(card.value)}</p>
              </div>
              <StatusPill status={card.status} />
            </div>
            <p className="mt-3 text-xs leading-5 opacity-70">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] opacity-60">{t('settings.policySync.title')}</p>
          <p className="mt-2 text-sm font-semibold">
            {policySync?.label ?? t('common.status.pending')}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-70">
            {policySync?.detail ?? t('services.commercial.waitingPolicySync')}
          </p>
          <p className="mt-2 text-xs leading-5 opacity-70">
            {t('services.commercial.policySyncCounts', {
              attention: formatNumber(policySync?.attention_nodes ?? 0),
              synced: formatNumber(policySync?.synced_nodes ?? 0),
              total: formatNumber(policySync?.total_nodes ?? 0),
            })}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] opacity-60">{t('services.commercial.policyBlocks')}</p>
          <p className="mt-2 text-sm font-semibold">
            {policyBlocks?.label ?? t('common.status.pending')}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-70">
            {policyBlocks?.detail ?? t('services.commercial.waitingEnforcement')}
          </p>
          <p className="mt-2 text-xs leading-5 opacity-70">
            {t('services.commercial.policyBlockCounts', {
              recent: formatNumber(policyBlocks?.recent_problem_nodes ?? 0),
              total: formatNumber(policyBlocks?.total_blocks ?? 0),
              dropped: formatFleetBytes(policyBlocks?.bandwidth_drop_bytes),
            })}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] opacity-60">{t('services.commercial.runtimeRollout')}</p>
          <p className="mt-2 text-sm font-semibold">
            {rollout?.label ?? t('services.commercial.rustPlacementReadiness')}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-70">
            {rollout?.detail
              ?? runtimeCapability?.upgrade_blocker_summary?.detail
              ?? runtimeCapability?.problem_panel_summary?.detail
              ?? t('services.commercial.waitingRustCoverage')}
          </p>
          <p className="mt-2 text-xs leading-5 opacity-70">
            {t('services.commercial.runtimeRolloutCounts', {
              reporting: formatNumber(rollout?.reporting_nodes ?? commercial?.rust_placement_reporting_nodes ?? 0),
              accepting: formatNumber(rollout?.accepting_nodes ?? commercial?.rust_placement_accepting_nodes ?? 0),
              missing: formatNumber(needsRustUpgrade),
            })}
          </p>
        </div>
      </div>

      {problemNodes.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{t('services.commercial.topPlacementBlockers')}</p>
              <p className="mt-1 text-xs leading-5 opacity-70">
                {t('services.commercial.showingBackendActions', { count: formatNumber(Math.min(problemNodes.length, 3)) })}
              </p>
            </div>
            {primaryProblem && (
              <Link
                href={`/dashboard/nodes/${primaryProblem.id}`}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/20 hover:bg-white/5"
              >
                {t('services.commercial.openTopIssue')}
              </Link>
            )}
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {problemNodes.slice(0, 3).map((node) => (
              <div key={node.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/nodes/${node.id}`} className="min-w-0 truncate font-medium text-white hover:text-purple-300">
                    {node.name}
                  </Link>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 ${statusClass(node.risk)}`}>
                    {node.status}
                  </span>
                </div>
                <p className="mt-2 leading-5 opacity-75">
                  {node.primary_reason.label} · {node.primary_reason.detail}
                </p>
                <p className="mt-1 leading-5 opacity-60">
                  {node.next_step}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </section>
  );
}

function FleetCapacityPanel({ nodes }: { nodes: VpnNodeHealth[] }) {
  const { t, formatNumber } = useI18n();
  const pending = t('common.status.pending');
  const reportingNodes = nodes.filter((node) => node.system.capacity?.reported);
  const capacityRisks = collectFleetCapacityRisks(nodes, t, formatNumber);
  const risksByNode = new Map<string, FleetCapacityRisk[]>();

  capacityRisks.forEach((risk) => {
    const existing = risksByNode.get(risk.nodeId) ?? [];
    existing.push(risk);
    risksByNode.set(risk.nodeId, existing);
  });

  const totals = reportingNodes.reduce((acc, node) => {
    const capacity = node.system.capacity;
    acc.ipPoolCapacity += capacity?.ip_pool_capacity ?? 0;
    acc.ipPoolUsed += capacity?.ip_pool_used ?? 0;
    acc.ipPoolFree += capacity?.ip_pool_free ?? 0;
    acc.maxConnections += capacity?.max_connections ?? 0;
    acc.policyMaxSessions += capacity?.policy_max_sessions && capacity.policy_max_sessions > 0
      ? capacity.policy_max_sessions
      : 0;
    acc.activeSessions += capacity?.active_sessions ?? node.active_sessions ?? 0;
    acc.conntrackUsed += capacity?.conntrack?.used ?? 0;
    acc.conntrackMax += capacity?.conntrack?.max ?? 0;
    acc.fdUsed += capacity?.file_descriptors?.used ?? 0;
    acc.fdSoftLimit += capacity?.file_descriptors?.soft_limit ?? 0;
    acc.packetDrops += capacity?.packet_drops_total ?? capacity?.interface?.packet_drops ?? 0;
    acc.totalPps += capacity?.interface?.total_pps ?? 0;
    acc.totalBps += capacity?.interface?.total_bps ?? 0;
    return acc;
  }, {
    ipPoolCapacity: 0,
    ipPoolUsed: 0,
    ipPoolFree: 0,
    maxConnections: 0,
    policyMaxSessions: 0,
    activeSessions: 0,
    conntrackUsed: 0,
    conntrackMax: 0,
    fdUsed: 0,
    fdSoftLimit: 0,
    packetDrops: 0,
    totalPps: 0,
    totalBps: 0,
  });

  const sortedNodes = [...nodes].sort((a, b) => {
    const aRisk = risksByNode.has(a.id) ? 0 : 1;
    const bRisk = risksByNode.has(b.id) ? 0 : 1;
    return aRisk - bRisk || a.name.localeCompare(b.name);
  });
  const conntrackPercent = capacityPercent(totals.conntrackUsed, totals.conntrackMax);
  const fdPercent = capacityPercent(totals.fdUsed, totals.fdSoftLimit);
  const hasReporting = reportingNodes.length > 0;
  const summaryCards = [
    {
      label: t('services.capacity.reportingNodes'),
      value: `${formatNumber(reportingNodes.length)} / ${formatNumber(nodes.length)}`,
      detail: t('services.capacity.reportingDetail'),
      status: hasReporting ? 'ok' : 'pending',
    },
    {
      label: t('services.capacity.ipPool'),
      value: formatCapacityPair(totals.ipPoolUsed, totals.ipPoolCapacity, formatNumber, pending),
      detail: t('services.capacity.ipPoolDetail', { free: formatNumber(totals.ipPoolFree) }),
      status: totals.ipPoolFree <= 0 && hasReporting ? 'critical' : 'ok',
    },
    {
      label: t('services.capacity.sessions'),
      value: formatCapacityPair(totals.activeSessions, totals.maxConnections, formatNumber, pending),
      detail: t('services.capacity.sessionsDetail', { policy: formatNumber(totals.policyMaxSessions) }),
      status: capacityRisks.some((risk) => risk.code?.includes('ip_pool')) ? 'warning' : 'ok',
    },
    {
      label: t('services.capacity.kernel'),
      value: `${conntrackPercent === null ? pending : `${formatNumber(conntrackPercent, { maximumFractionDigits: 1 })}%`} / ${fdPercent === null ? pending : `${formatNumber(fdPercent, { maximumFractionDigits: 1 })}%`}`,
      detail: t('services.capacity.kernelDetail'),
      status: (conntrackPercent ?? 0) >= 80 || (fdPercent ?? 0) >= 80 ? 'warning' : 'ok',
    },
    {
      label: t('services.capacity.interface'),
      value: formatFleetBitsPerSecond(totals.totalBps),
      detail: t('services.capacity.interfaceDetail', {
        pps: formatFleetPacketsPerSecond(totals.totalPps, formatNumber),
        drops: formatNumber(totals.packetDrops),
      }),
      status: totals.packetDrops > 0 ? 'warning' : 'ok',
    },
  ];

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('services.capacity.title')}</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-400">
              {t('services.capacity.description')}
            </p>
          </div>
          <StatusPill status={capacityRisks.length > 0 ? 'warning' : hasReporting ? 'ok' : 'pending'} />
        </div>
      </div>

      <div className="grid gap-3 border-b border-white/10 p-5 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 ${capacityUsageTone(card.status === 'warning' ? 80 : card.status === 'critical' ? 95 : 0)}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{card.label}</p>
              <StatusPill status={card.status} />
            </div>
            <p className="mt-3 break-words text-xl font-semibold text-white">{card.value}</p>
            <p className="mt-2 text-xs leading-5 text-gray-400">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1240px] text-left">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.12em] text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t('services.capacity.table.node')}</th>
              <th className="px-4 py-3 font-medium">{t('services.capacity.table.ipPool')}</th>
              <th className="px-4 py-3 font-medium">{t('services.capacity.table.sessions')}</th>
              <th className="px-4 py-3 font-medium">{t('services.capacity.table.kernel')}</th>
              <th className="px-4 py-3 font-medium">{t('services.capacity.table.interface')}</th>
              <th className="px-4 py-3 font-medium">{t('services.capacity.table.risk')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedNodes.length > 0 ? (
              sortedNodes.map((node) => {
                const capacity = node.system.capacity;
                const nodeRisks = risksByNode.get(node.id) ?? [];
                const nodeConntrackPercent = capacity?.conntrack?.used_percent
                  ?? capacityPercent(capacity?.conntrack?.used, capacity?.conntrack?.max);
                const nodeFdPercent = capacity?.file_descriptors?.used_percent
                  ?? capacityPercent(capacity?.file_descriptors?.used, capacity?.file_descriptors?.soft_limit);
                const packetDrops = capacity?.packet_drops_total ?? capacity?.interface?.packet_drops ?? null;
                const policyMax = capacity?.policy_max_sessions === 0
                  ? t('nodes.policy.unlimited')
                  : formatCapacityNumber(capacity?.policy_max_sessions, formatNumber, pending);

                return (
                  <tr key={node.id} className="border-t border-white/10 align-top text-sm">
                    <td className="px-4 py-4">
                      <Link href={`/dashboard/nodes/${node.id}`} className="font-medium text-white hover:text-purple-300">
                        {node.name}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500">{node.city || node.region_code || t('services.placement.unknownRegion')}</p>
                      <p className="mt-1 text-xs text-gray-600">{capacity?.reported ? capacity.source : t('services.capacity.waitingTelemetry')}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-white">
                        {formatCapacityPair(capacity?.ip_pool_used, capacity?.ip_pool_capacity, formatNumber, pending)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('services.capacity.freeRange', {
                          free: formatCapacityNumber(capacity?.ip_pool_free, formatNumber, pending),
                          range: capacity?.virtual_ip_range || pending,
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-white">
                        {formatCapacityPair(capacity?.active_sessions ?? node.active_sessions, capacity?.max_connections, formatNumber, pending)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('services.capacity.policyMax', { value: policyMax })}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-white">
                        {t('services.capacity.conntrackShort', {
                          value: typeof nodeConntrackPercent === 'number'
                            ? `${formatNumber(nodeConntrackPercent, { maximumFractionDigits: 1 })}%`
                            : pending,
                        })}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('services.capacity.fdShort', {
                          value: typeof nodeFdPercent === 'number'
                            ? `${formatNumber(nodeFdPercent, { maximumFractionDigits: 1 })}%`
                            : pending,
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-white">{formatFleetBitsPerSecond(capacity?.interface?.total_bps)}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatFleetPacketsPerSecond(capacity?.interface?.total_pps, formatNumber)} · {t('services.capacity.drops', {
                          count: formatCapacityNumber(packetDrops, formatNumber, pending),
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      {nodeRisks.length > 0 ? (
                        <div className="space-y-2">
                          {nodeRisks.slice(0, 2).map((risk) => (
                            <div key={`${risk.nodeId}:${risk.label}:${risk.detail}`} className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.07] px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium text-yellow-100">{risk.label}</p>
                                <StatusPill status={risk.tone} />
                              </div>
                              <p className="mt-1 text-xs leading-5 text-yellow-100/70">{risk.detail}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                          {t('services.capacity.noRisk')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  {t('services.capacity.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DnsCheckBadge({ ok }: { ok: boolean | null }) {
  if (ok === true) return <StatusPill status="ok" />;
  if (ok === false) return <StatusPill status="failed" />;
  return <StatusPill status="pending" />;
}

function FleetTransportPanel({ nodes }: { nodes: VpnNodeHealth[] }) {
  const { t, formatNumber } = useI18n();
  const transportNodes = useMemo(() => collectFleetTransportNodes(nodes, t), [nodes, t]);
  const udpReady = transportNodes.filter((node) => node.udpStatus === 'active').length;
  const fallbackReady = transportNodes.filter((node) => node.fallbackAvailable).length;
  const attention = transportNodes.filter((node) => node.status !== 'ok').length;
  const plannedOnly = Math.max(transportNodes.length - fallbackReady, 0);
  const overallStatus = attention > 0 ? 'warning' : fallbackReady > 0 ? 'ok' : 'pending';
  const summaryCards = [
    {
      label: t('services.transport.summary.udpReady'),
      value: `${formatNumber(udpReady)} / ${formatNumber(transportNodes.length)}`,
      detail: t('services.transport.summary.udpReadyDetail'),
      status: udpReady > 0 ? 'ok' : 'failed',
    },
    {
      label: t('services.transport.summary.fallbackReady'),
      value: formatNumber(fallbackReady),
      detail: t('services.transport.summary.fallbackReadyDetail'),
      status: fallbackReady > 0 ? 'ok' : 'warning',
    },
    {
      label: t('services.transport.summary.plannedOnly'),
      value: formatNumber(plannedOnly),
      detail: t('services.transport.summary.plannedOnlyDetail'),
      status: plannedOnly > 0 ? 'warning' : 'ok',
    },
    {
      label: t('services.transport.summary.attention'),
      value: formatNumber(attention),
      detail: t('services.transport.summary.attentionDetail'),
      status: attention > 0 ? 'warning' : 'ok',
    },
  ];

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('services.transport.title')}</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-400">
              {t('services.transport.description')}
            </p>
          </div>
          <StatusPill status={overallStatus} />
        </div>
      </div>

      <div className="grid gap-3 border-b border-white/10 p-5 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{card.label}</p>
              <StatusPill status={card.status} />
            </div>
            <p className="mt-3 text-xl font-semibold text-white">{card.value}</p>
            <p className="mt-2 text-xs leading-5 text-gray-400">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.12em] text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t('services.transport.table.node')}</th>
              <th className="px-4 py-3 font-medium">{t('services.transport.table.supported')}</th>
              <th className="px-4 py-3 font-medium">{t('services.transport.table.preferred')}</th>
              <th className="px-4 py-3 font-medium">{t('services.transport.table.fallback')}</th>
              <th className="px-4 py-3 font-medium">{t('services.transport.table.carriers')}</th>
              <th className="px-4 py-3 font-medium">{t('services.transport.table.source')}</th>
            </tr>
          </thead>
          <tbody>
            {transportNodes.length > 0 ? (
              transportNodes.map((node) => (
                <tr key={node.id} className="border-t border-white/10 align-top text-sm">
                  <td className="px-4 py-4">
                    <Link href={`/dashboard/nodes/${node.id}`} className="font-medium text-white hover:text-purple-300">
                      {node.name}
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">{node.region}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{node.supported.join(', ')}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('services.transport.configured', { value: node.configured.join(', ') })}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{node.preferred}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('services.transport.effective', { value: node.effective })}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs leading-5 text-gray-300">
                        {node.fallbackAvailable
                          ? t('services.transport.fallbackAvailable')
                          : t('services.transport.fallbackPlanned')}
                      </p>
                      <StatusPill status={node.fallbackAvailable ? 'ok' : 'warning'} />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-300">
                        UDP: {node.udpStatus}
                      </span>
                      <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-300">
                        TLS: {node.tcpTlsStatus}
                      </span>
                      <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-300">
                        WS: {node.websocketStatus}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs leading-5 text-gray-500">{node.source}</p>
                      <StatusPill status={node.status} />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  {t('services.transport.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FleetDnsPanel({ nodes }: { nodes: VpnNodeHealth[] }) {
  const { t, formatNumber } = useI18n();
  const dnsNodes = useMemo(() => collectFleetDnsNodes(nodes, t), [nodes, t]);
  const healthy = dnsNodes.filter((node) => node.status === 'ok').length;
  const failed = dnsNodes.filter((node) => node.status === 'failed').length;
  const rustOwned = dnsNodes.filter((node) => node.ownerLabel === t('services.dns.owner.rust')).length;
  const externalOwned = dnsNodes.filter((node) => node.ownerLabel === t('services.dns.owner.external')).length;
  const unknownOwned = Math.max(dnsNodes.length - rustOwned - externalOwned, 0);
  const overallStatus = failed > 0 ? 'failed' : healthy === dnsNodes.length && dnsNodes.length > 0 ? 'ok' : 'pending';
  const summaryCards = [
    {
      label: t('services.dns.summary.healthy'),
      value: `${formatNumber(healthy)} / ${formatNumber(dnsNodes.length)}`,
      detail: t('services.dns.summary.healthyDetail'),
      status: overallStatus,
    },
    {
      label: t('services.dns.summary.rustOwned'),
      value: formatNumber(rustOwned),
      detail: t('services.dns.owner.rustDetail'),
      status: rustOwned > 0 ? 'ok' : 'pending',
    },
    {
      label: t('services.dns.summary.externalOwned'),
      value: formatNumber(externalOwned),
      detail: t('services.dns.owner.externalDetail'),
      status: externalOwned > 0 ? 'info' : 'pending',
    },
    {
      label: t('services.dns.summary.unknownOwned'),
      value: formatNumber(unknownOwned),
      detail: t('services.dns.owner.unknownDetail'),
      status: unknownOwned > 0 ? 'warning' : 'ok',
    },
  ];

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('services.dns.title')}</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-400">
              {t('services.dns.description')}
            </p>
          </div>
          <StatusPill status={overallStatus} />
        </div>
      </div>

      <div className="grid gap-3 border-b border-white/10 p-5 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{card.label}</p>
              <StatusPill status={card.status} />
            </div>
            <p className="mt-3 text-xl font-semibold text-white">{card.value}</p>
            <p className="mt-2 text-xs leading-5 text-gray-400">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.12em] text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t('services.dns.table.node')}</th>
              <th className="px-4 py-3 font-medium">{t('services.dns.table.owner')}</th>
              <th className="px-4 py-3 font-medium">{t('services.dns.table.stub')}</th>
              <th className="px-4 py-3 font-medium">{t('services.dns.table.query')}</th>
              <th className="px-4 py-3 font-medium">{t('services.dns.table.checked')}</th>
            </tr>
          </thead>
          <tbody>
            {dnsNodes.length > 0 ? (
              dnsNodes.map((node) => (
                <tr key={node.id} className="border-t border-white/10 align-top text-sm">
                  <td className="px-4 py-4">
                    <Link href={`/dashboard/nodes/${node.id}`} className="font-medium text-white hover:text-purple-300">
                      {node.name}
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">{node.region}</p>
                    <p className="mt-1 text-xs text-gray-600">{node.gateway}:53</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{node.ownerLabel}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">{node.ownerDetail}</p>
                      </div>
                      <StatusPill status={node.status} />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs leading-5 text-gray-300">{node.dnsStubDetail}</p>
                      <DnsCheckBadge ok={node.dnsStubOk} />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs leading-5 text-gray-300">{node.dnsQueryDetail}</p>
                      <DnsCheckBadge ok={node.dnsQueryOk} />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500">
                    {node.checkedAt ? formatUnixSecondsRelative(node.checkedAt) : t('common.status.pending')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  {t('services.dns.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DetailModulesPanel({
  activeSection,
  onSelect,
  placementAvailable,
  placementTotal,
  capacityReporting,
  capacityRiskCount,
  transportReady,
  transportTotal,
  transportAttention,
  dnsHealthy,
  dnsTotal,
  dnsAttention,
  restartAttention,
  rolloutAttention,
  serviceCount,
  riskCount,
  nodeCount,
}: {
  activeSection: ServiceDetailSection | null;
  onSelect: (section: ServiceDetailSection | null) => void;
  placementAvailable: number;
  placementTotal: number;
  capacityReporting: number;
  capacityRiskCount: number;
  transportReady: number;
  transportTotal: number;
  transportAttention: number;
  dnsHealthy: number;
  dnsTotal: number;
  dnsAttention: number;
  restartAttention: number;
  rolloutAttention: number;
  serviceCount: number;
  riskCount: number;
  nodeCount: number;
}) {
  const { t, formatNumber } = useI18n();
  const modules: Array<{
    key: ServiceDetailSection;
    label: string;
    eyebrow: string;
    count: string;
    detail: string;
    status: string;
  }> = [
    {
      key: 'placement',
      label: t('services.modules.placement.label'),
      eyebrow: t('services.modules.placement.eyebrow'),
      count: `${formatNumber(placementAvailable)} / ${formatNumber(placementTotal)}`,
      detail: t('services.modules.placement.detail'),
      status: placementAvailable > 0 ? 'ok' : 'warning',
    },
    {
      key: 'capacity',
      label: t('services.modules.capacity.label'),
      eyebrow: t('services.modules.capacity.eyebrow'),
      count: `${formatNumber(capacityReporting)} / ${formatNumber(nodeCount)}`,
      detail: t('services.modules.capacity.detail'),
      status: capacityRiskCount > 0 ? 'warning' : capacityReporting > 0 ? 'ok' : 'pending',
    },
    {
      key: 'transport',
      label: t('services.modules.transport.label'),
      eyebrow: t('services.modules.transport.eyebrow'),
      count: `${formatNumber(transportReady)} / ${formatNumber(transportTotal)}`,
      detail: t('services.modules.transport.detail'),
      status: transportAttention > 0 ? 'warning' : transportReady > 0 ? 'ok' : 'pending',
    },
    {
      key: 'dns',
      label: t('services.modules.dns.label'),
      eyebrow: t('services.modules.dns.eyebrow'),
      count: `${formatNumber(dnsHealthy)} / ${formatNumber(dnsTotal)}`,
      detail: t('services.modules.dns.detail'),
      status: dnsAttention > 0 ? 'warning' : dnsHealthy > 0 ? 'ok' : 'pending',
    },
    {
      key: 'restart',
      label: t('services.modules.restart.label'),
      eyebrow: t('services.modules.restart.eyebrow'),
      count: formatNumber(restartAttention + rolloutAttention),
      detail: t('services.modules.restart.detail'),
      status: restartAttention + rolloutAttention > 0 ? 'warning' : 'ok',
    },
    {
      key: 'layers',
      label: t('services.modules.layers.label'),
      eyebrow: t('services.modules.layers.eyebrow'),
      count: formatNumber(serviceCount),
      detail: t('services.modules.layers.detail'),
      status: serviceCount > 0 ? 'ok' : 'pending',
    },
    {
      key: 'risks',
      label: t('services.modules.risks.label'),
      eyebrow: t('services.modules.risks.eyebrow'),
      count: formatNumber(riskCount),
      detail: t('services.modules.risks.detail'),
      status: riskCount > 0 ? 'warning' : 'ok',
    },
    {
      key: 'nodes',
      label: t('services.modules.nodes.label'),
      eyebrow: t('services.modules.nodes.eyebrow'),
      count: formatNumber(nodeCount),
      detail: t('services.modules.nodes.detail'),
      status: nodeCount > 0 ? 'info' : 'pending',
    },
  ];

  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('services.detailModules.title')}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-400">
            {t('services.detailModules.description')}
          </p>
        </div>
        {activeSection && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/5"
          >
            {t('common.collapseDetails')}
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {modules.map((module) => {
          const active = activeSection === module.key;
          return (
            <button
              key={module.key}
              type="button"
              onClick={() => onSelect(active ? null : module.key)}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? 'border-purple-400/40 bg-purple-500/[0.10]'
                  : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">{module.eyebrow}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{module.label}</p>
                </div>
                <StatusPill status={module.status} />
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">{module.count}</p>
              <p className="mt-2 text-xs leading-5 text-gray-500">{module.detail}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ServiceCard({ service }: { service: ServiceView }) {
  const { t, formatNumber } = useI18n();
  return (
    <section className="min-h-[210px] rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
            {service.eyebrow}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">{service.label}</h2>
        </div>
        <StatusPill status={service.status} />
      </div>
      <p className="mt-4 text-sm leading-6 text-gray-300">{service.summary}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500">{t('services.card.enabledNodes')}</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {formatNumber(service.enabledCount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('services.card.observedNodes')}</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {formatNumber(service.totalCount)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-400">
          {t('services.card.reportingCount', { count: formatNumber(service.reportingCount) })}
        </span>
        {service.metricChips.map((chip) => (
          <span
            key={chip}
            className="max-w-full truncate rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-400"
          >
            {chip}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-500">{service.detail}</p>
    </section>
  );
}

function PlacementCapacityPanel({
  summary,
  servers,
  nodesById,
  available,
  total,
  isLoading,
}: {
  summary: VpnServerPlacementSummary | null;
  servers: VpnServerCandidate[];
  nodesById: Map<string, VpnNodeHealth>;
  available: number;
  total: number;
  isLoading: boolean;
}) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  const placementLabels = {
    slots: t('services.placement.slots'),
    unlimited: t('services.placement.unlimited'),
  };

  if (isLoading) {
    return (
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 rounded bg-white/10" />
          <div className="grid gap-3 md:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-20 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!summary && total === 0) return null;

  const unavailable = Math.max(0, total - available);
  const regions = summary?.by_region.slice(0, 4) ?? [];
  const tiers = summary?.by_tier.slice(0, 3) ?? [];
  const blockerReasons = placementReasonEntries(summary?.unavailable_reasons ?? {});
  const blockedServers = servers
    .filter((server) => !server.available)
    .sort((a, b) => {
      const reasonCompare = (a.unavailable_reason || '').localeCompare(b.unavailable_reason || '');
      if (reasonCompare !== 0) return reasonCompare;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 4);
  const status = available > 0 ? 'ok' : total > 0 ? 'attention' : 'pending';

  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('services.placement.title')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            {t('services.placement.description')}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{t('services.placement.availableNodes')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(available)} / {formatNumber(total)}</p>
          <p className="mt-1 text-xs text-gray-500">{t('services.placement.unavailableCount', { count: formatNumber(unavailable) })}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{t('services.placement.capacityRemaining')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {summary ? formatPlacementCapacity(summary.available_capacity_remaining, summary.unlimited_capacity_nodes, placementLabels) : t('common.status.pending')}
          </p>
          <p className="mt-1 text-xs text-gray-500">{t('services.placement.capacityHint')}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{t('services.placement.topBlocker')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {summary ? topPlacementReason(summary.unavailable_reasons, t) : t('common.status.pending')}
          </p>
          <p className="mt-1 text-xs text-gray-500">{t('services.placement.backendPolicy')}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{t('services.placement.updated')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {summary?.generated_at ? i18nRelativeTime(summary.generated_at) : t('common.status.pending')}
          </p>
          <p className="mt-1 text-xs text-gray-500">GET /api/privacy_network/vpn/servers/</p>
        </div>
      </div>

      {summary && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">{t('services.placement.regionCapacity')}</h3>
              <Link href="/dashboard/nodes" className="text-xs text-purple-300 hover:text-purple-200">
                {t('common.manageNodes')}
              </Link>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {regions.map((region) => (
                <div key={region.key} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-gray-200">
                      {region.flag ? `${region.flag} ` : ''}{region.label}
                    </span>
                    <span className="text-emerald-300">{formatNumber(region.available)}/{formatNumber(region.total)}</span>
                  </div>
                  <p className="mt-1 text-gray-500">
                    {formatPlacementCapacity(region.capacity_remaining, region.unlimited_capacity_nodes, placementLabels)}
                  </p>
                  <p className="mt-1 text-gray-600">
                    {region.unavailable > 0 ? topPlacementReason(region.unavailable_reasons, t) : t('services.placement.allCandidatesClear')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h3 className="text-sm font-semibold text-white">{t('services.placement.tierCapacity')}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {tiers.map((tier) => (
                <div key={tier.key} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-gray-200">{tier.tier || tier.label}</span>
                    <span className="text-emerald-300">{formatNumber(tier.available)}/{formatNumber(tier.total)}</span>
                  </div>
                  <p className="mt-1 text-gray-500">
                    {formatPlacementCapacity(tier.capacity_remaining, tier.unlimited_capacity_nodes, placementLabels)}
                  </p>
                  <p className="mt-1 text-gray-600">
                    {tier.average_load === null
                      ? t('services.placement.loadPending')
                      : t('services.placement.avgLoad', { value: tier.average_load })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {blockedServers.length > 0 && (
        <div className="mt-4 rounded-xl border border-yellow-300/15 bg-yellow-300/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-yellow-100">{t('services.placement.blockersTitle')}</h3>
              <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                {t('services.placement.blockersDescription')}
              </p>
            </div>
            <Link href="/dashboard/nodes" className="text-xs text-yellow-100/80 hover:text-yellow-100">
              {t('common.manageNodes')}
            </Link>
          </div>
          {blockerReasons.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {blockerReasons.map(([reason, count]) => (
                <div key={reason} className="rounded-md border border-yellow-100/10 bg-black/20 px-3 py-2 text-xs">
                  <p className="uppercase tracking-[0.12em] text-yellow-100/35">{formatPlacementReason(reason, t)}</p>
                  <p className="mt-1 font-semibold text-yellow-100">{t('services.placement.nodeCount', { count: formatNumber(count) })}</p>
                  <p className="mt-1 leading-5 text-yellow-100/45">{placementBlockerAction(reason, t)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {blockedServers.map((server) => (
              (() => {
                const failedChecks = failedPlacementChecks(nodesById.get(server.id));
                return (
                  <Link
                    key={server.id}
                    href={`/dashboard/nodes/${server.id}`}
                    className="rounded-lg border border-yellow-200/10 bg-black/20 p-3 transition hover:border-yellow-200/25 hover:bg-yellow-200/[0.04]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{server.name}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {server.city || server.region_code || server.country_name || t('services.placement.unknownRegion')} · {placementSessionCopy(server, t)}
                        </p>
                      </div>
                      <StatusPill status={server.health_status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="rounded-md border border-white/10 px-2 py-1">
                        {formatPlacementReason(server.unavailable_reason, t)}
                      </span>
                      <span className="rounded-md border border-white/10 px-2 py-1">
                        {server.load === null ? t('services.placement.loadPending') : t('services.placement.loadValue', { value: server.load })}
                      </span>
                      <span className="rounded-md border border-white/10 px-2 py-1">
                        {t('services.placement.rankValue', { value: server.failover_rank ?? t('common.status.pending') })}
                      </span>
                    </div>
                    {failedChecks.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {failedChecks.map((check) => (
                          <p key={check.name} className="text-xs leading-5 text-red-200/80">
                            {check.name.replaceAll('_', ' ')}: {check.detail}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-xs leading-5 text-yellow-100/65">
                      {placementBlockerAction(server.unavailable_reason, t)}
                    </p>
                  </Link>
                );
              })()
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-gray-600">
        {t('services.placement.contractNote')}
        {summary?.privacy_note ?? ` ${t('services.placement.privacyNote')}`}
      </p>
    </section>
  );
}

function NodeReadinessRow({ node }: { node: VpnNodeHealth }) {
  const { t, formatRelativeTime: i18nRelativeTime } = useI18n();
  const operatorStatus = nodeOperatorStatus(node);
  const services = operatorStatus?.services ?? [];
  const serviceByKey = (key: ServiceKey) => services.find((service) => service.key === key);
  const rolloutStatus = operatorStatus?.runtime_rollout?.restart_required
    ? 'warning'
    : operatorStatus
      ? 'ok'
      : 'pending';

  return (
    <tr className="border-t border-white/5">
      <td className="px-4 py-4">
        <div className="min-w-0">
          <Link href={`/dashboard/nodes/${node.id}`} className="font-medium text-white hover:text-purple-300">
            {node.name}
          </Link>
          <p className="mt-1 truncate text-xs text-gray-500">
            {node.city || node.region_code || t('services.placement.unknownRegion')} · {node.public_ip ?? t('services.placement.noPublicIp')}
          </p>
        </div>
      </td>
      <td className="px-4 py-4"><StatusPill status={node.health_status} /></td>
      <td className="px-4 py-4"><StatusPill status={serviceByKey('memchain')?.status ?? 'pending'} /></td>
      <td className="px-4 py-4"><StatusPill status={serviceByKey('chat_relay')?.status ?? 'pending'} /></td>
      <td className="px-4 py-4"><StatusPill status={serviceByKey('sovereign_data_layer')?.status ?? 'pending'} /></td>
      <td className="px-4 py-4"><StatusPill status={operatorStatus?.status ?? 'pending'} /></td>
      <td className="px-4 py-4"><StatusPill status={rolloutStatus} /></td>
      <td className="px-4 py-4 text-sm text-gray-400">
        {node.last_heartbeat ? i18nRelativeTime(node.last_heartbeat) : t('common.status.pending')}
      </td>
    </tr>
  );
}

function FleetRestartReadinessPanel({
  nodes,
  summary,
  enablingMaintenanceNodeId,
  endingMaintenanceNodeId,
  restartingNodeId,
  cancellingCommandId,
  onEnableMaintenance,
  onEndMaintenance,
  onQueueRestart,
  onCancelRestartCommand,
}: {
  nodes: RestartReadinessNode[];
  summary: VpnRestartReadinessSummary | null;
  enablingMaintenanceNodeId: string | null;
  endingMaintenanceNodeId: string | null;
  restartingNodeId: string | null;
  cancellingCommandId: string | null;
  onEnableMaintenance: (nodeId: string, nodeName: string) => void;
  onEndMaintenance: (nodeId: string, nodeName: string) => void;
  onQueueRestart: (nodeId: string, nodeName: string) => void;
  onCancelRestartCommand: (nodeId: string, nodeName: string, commandId: string) => void;
}) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  const [queueFilters, setQueueFilters] = useState<RestartQueueFilters>({
    region: 'all',
    version: 'all',
    status: 'attention',
  });
  const attentionNodes = nodes.filter((node) => node.status !== 'current');
  const readyCount = summary?.ready ?? attentionNodes.filter((node) => node.status === 'ready').length;
  const blockedCount = summary?.blocked ?? attentionNodes.filter((node) => node.status === 'blocked').length;
  const pendingCount = summary?.pending ?? attentionNodes.filter((node) => node.status === 'pending').length;
  const totalActiveSessions = summary?.sessions_blocking_restart
    ?? attentionNodes.reduce((sum, node) => sum + node.activeSessions, 0);
  const blockerCounts = Object.entries(summary?.blocker_counts ?? {});
  const drainRisk = fleetDrainRisk(summary);
  const cutoverGuard = fleetCutoverGuard(summary);
  const commandLifecycle = fleetCommandLifecycle(summary);
  const commandDelivery = fleetCommandDelivery(summary);
  const runtimeCapability = fleetRuntimeCapability(summary);
  const commandOutcome = fleetCommandOutcome(summary);
  const commandCounts = summary?.command_lifecycle_counts ?? null;
  const commandHistory = commandCounts?.history_24h ?? null;
  const policySyncHealth = summary?.policy_sync_health ?? null;
  const policyEnforcementHealth = summary?.policy_enforcement_health ?? null;
  const commercialPlacementHealth = summary?.commercial_placement_health ?? null;
  const maintenanceExitCandidates = summary?.maintenance_exit_candidates ?? [];
  const maintenanceExitCandidateCount = summary?.maintenance_exit_candidate_count ?? maintenanceExitCandidates.length;
  const maintenanceExitSummary = summary?.maintenance_exit_summary ?? null;
  const commandCancelability = {
    cancelable: commandCounts?.cancelable_active ?? 0,
    locked: commandCounts?.non_cancelable_active ?? 0,
  };
  const filterOptions = useMemo(() => restartQueueFilterOptions(nodes), [nodes]);
  const actionQueues = useMemo(
    () => buildRestartActionQueues(summary, nodes, queueFilters, t),
    [summary, nodes, queueFilters, t],
  );
  const queueItemCount = actionQueues.reduce((sum, queue) => sum + queue.items.length, 0);

  if (nodes.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('services.restartReadiness.title')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            {t('services.restartReadiness.description')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill status={readyCount > 0 ? 'ready' : 'pending'} />
          {blockedCount > 0 && <StatusPill status="blocked" />}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{t('services.restartReadiness.readyNow')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(readyCount)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{t('common.status.blocked')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(blockedCount)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{t('services.restartReadiness.pendingSignal')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(pendingCount)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{t('services.restartReadiness.sessionsBlocking')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(totalActiveSessions)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(cutoverGuard.risk)}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">{t('services.restartReadiness.cutoverSafety')}</p>
          <p className="mt-2 text-2xl font-semibold">{t('services.restartReadiness.unsafeCount', { count: formatNumber(cutoverGuard.count) })}</p>
          <p className="mt-1 text-xs opacity-70">{cutoverGuard.label} · {cutoverGuard.detail}</p>
          <p className="mt-2 text-xs leading-5 opacity-80">
            {t('services.restartReadiness.cutoverCounts', {
              actionable: formatNumber(cutoverGuard.actionable),
              safe: formatNumber(cutoverGuard.safe),
              total: formatNumber(cutoverGuard.total),
              unsafe: formatNumber(cutoverGuard.blocked),
              impact: cutoverGuard.impact,
            })}
          </p>
          {(cutoverGuard.observedOnly > 0 || cutoverGuard.servingTraffic > 0) && (
            <p className="mt-1 text-xs leading-5 opacity-75">
              {t('services.restartReadiness.cutoverObserved', {
                observed: formatNumber(cutoverGuard.observedOnly),
                serving: formatNumber(cutoverGuard.servingTraffic),
              })}
            </p>
          )}
          {cutoverGuard.next_step && (
            <p className="mt-2 text-xs leading-5 opacity-80">{cutoverGuard.next_step}</p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(drainRisk.risk)}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">{t('services.restartReadiness.drainRisk')}</p>
          <p className="mt-2 text-2xl font-semibold">{formatNumber(drainRisk.count)}</p>
          <p className="mt-1 text-xs opacity-70">{drainRisk.label} · {drainRisk.detail}</p>
          {drainRisk.next_step && (
            <p className="mt-2 text-xs leading-5 opacity-80">{drainRisk.next_step}</p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(commandDelivery.risk)}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">{t('services.restartReadiness.commandDelivery')}</p>
          <p className="mt-2 text-2xl font-semibold">{formatNumber(commandDelivery.count)}</p>
          <p className="mt-1 text-xs opacity-70">{commandDelivery.label} · {commandDelivery.detail}</p>
          {commandDelivery.attention > 0 && (
            <p className="mt-2 text-xs leading-5 opacity-80">
              {t('services.restartReadiness.attentionReady', {
                attention: formatNumber(commandDelivery.attention),
                ready: formatNumber(commandDelivery.ready),
              })}
            </p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(runtimeCapability.risk)}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">{t('services.restartReadiness.rustCapability')}</p>
          <p className="mt-2 text-2xl font-semibold">{t('services.restartReadiness.gapsCount', { count: formatNumber(runtimeCapability.gaps) })}</p>
          <p className="mt-1 text-xs opacity-70">{runtimeCapability.label} · {runtimeCapability.detail}</p>
          <p className="mt-2 text-xs leading-5 opacity-80">
            {t('services.restartReadiness.runtimeCapabilityCounts', {
              operator: formatNumber(runtimeCapability.operatorReporting),
              cleanup: formatNumber(runtimeCapability.cleanupReporting),
              rollout: formatNumber(runtimeCapability.rolloutReporting),
              total: formatNumber(runtimeCapability.total),
            })}
          </p>
          {(runtimeCapability.upgradeSafe > 0 || runtimeCapability.upgradeBlocked > 0) && (
            <p className="mt-1 text-xs leading-5 opacity-75">
              {t('services.restartReadiness.upgradeCounts', {
                safe: formatNumber(runtimeCapability.upgradeSafe),
                blocked: formatNumber(runtimeCapability.upgradeBlocked),
              })}
            </p>
          )}
          {runtimeCapability.blockerSummary && (
            <p className="mt-1 text-xs leading-5 opacity-75">
              {runtimeCapability.blockerSummary}
            </p>
          )}
          {runtimeCapability.blockerNextStep && (
            <p className="mt-1 text-xs leading-5 opacity-75">{runtimeCapability.blockerNextStep}</p>
          )}
          {runtimeCapability.next_step && (
            <p className="mt-2 text-xs leading-5 opacity-80">{runtimeCapability.next_step}</p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(commandLifecycle.risk)}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">{t('services.restartReadiness.commandSla')}</p>
          <p className="mt-2 text-2xl font-semibold">{formatNumber(commandLifecycle.count)}</p>
          <p className="mt-1 text-xs opacity-70">{commandLifecycle.label} · {commandLifecycle.detail}</p>
          {(commandCancelability.cancelable > 0 || commandCancelability.locked > 0) && (
            <p className="mt-2 text-xs leading-5 opacity-80">
              {t('services.restartReadiness.cancelableLocked', {
                cancelable: formatNumber(commandCancelability.cancelable),
                locked: formatNumber(commandCancelability.locked),
              })}
            </p>
          )}
          {commandLifecycle.next_step && (
            <p className="mt-2 text-xs leading-5 opacity-80">{commandLifecycle.next_step}</p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(policySyncHealth?.risk ?? 'info')}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">{t('settings.policySync.title')}</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatNumber(policySyncHealth?.attention_nodes ?? 0)}
          </p>
          <p className="mt-1 text-xs opacity-70">
            {policySyncHealth?.label ?? t('common.status.pending')} · {policySyncHealth?.detail ?? t('services.restartReadiness.waitingPolicySync')}
          </p>
          <p className="mt-2 text-xs leading-5 opacity-80">
            {t('services.restartReadiness.syncedCount', {
              synced: formatNumber(policySyncHealth?.synced_nodes ?? 0),
              total: formatNumber(policySyncHealth?.total_nodes ?? 0),
            })}
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(commercialPlacementHealth?.risk ?? 'info')}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">{t('services.restartReadiness.commercialPlacement')}</p>
          <p className="mt-2 text-2xl font-semibold">
            {t('services.commercial.readyValue', { count: formatNumber(commercialPlacementHealth?.ready_nodes ?? 0) })}
          </p>
          <p className="mt-1 text-xs opacity-70">
            {commercialPlacementHealth?.label ?? t('common.status.pending')} · {commercialPlacementHealth?.detail ?? t('services.restartReadiness.waitingPlacement')}
          </p>
          <p className="mt-2 text-xs leading-5 opacity-80">
            {t('services.restartReadiness.commercialScoreCounts', {
              score: (commercialPlacementHealth?.capacity_score_percent ?? 0).toFixed(1),
              watch: formatNumber(commercialPlacementHealth?.watch_nodes ?? 0),
              blocked: formatNumber(commercialPlacementHealth?.blocked_nodes ?? 0),
            })}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-75">
            {t('services.restartReadiness.publicEntriesRegions', {
              public: formatNumber(commercialPlacementHealth?.public_entry_nodes ?? 0),
              total: formatNumber(commercialPlacementHealth?.total_nodes ?? 0),
              regions: formatNumber(commercialPlacementHealth?.regions_count ?? 0),
            })}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-75">
            {t('services.restartReadiness.capacityLine', {
              sessions: formatNumber(commercialPlacementHealth?.active_sessions ?? 0),
              capped: formatNumber(commercialPlacementHealth?.max_capacity_slots ?? 0),
              remaining: formatNumber(commercialPlacementHealth?.bounded_capacity_remaining ?? 0),
              unlimited: formatNumber(commercialPlacementHealth?.unlimited_capacity_nodes ?? 0),
            })}
          </p>
          {(commercialPlacementHealth?.policy_sync_attention_nodes || commercialPlacementHealth?.recent_policy_problem_nodes) ? (
            <p className="mt-1 text-xs leading-5 opacity-75">
              {t('services.restartReadiness.policyAttentionLine', {
                attention: formatNumber(commercialPlacementHealth?.policy_sync_attention_nodes ?? 0),
                recent: formatNumber(commercialPlacementHealth?.recent_policy_problem_nodes ?? 0),
              })}
            </p>
          ) : null}
          <p className="mt-1 text-xs leading-5 opacity-75">
            {t('services.restartReadiness.rustRuntimeLine', {
              reporting: formatNumber(commercialPlacementHealth?.rust_placement_reporting_nodes ?? 0),
              accepting: formatNumber(commercialPlacementHealth?.rust_placement_accepting_nodes ?? 0),
              coverage: (commercialPlacementHealth?.rust_placement_coverage_percent ?? 0).toFixed(1),
            })}
          </p>
          {commercialPlacementHealth?.rust_placement_rollout_summary && (
            <p className="mt-1 text-xs leading-5 opacity-75">
              {commercialPlacementHealth.rust_placement_rollout_summary.label} ·
              {t('services.restartReadiness.missingCount', {
                count: formatNumber(commercialPlacementHealth.rust_placement_rollout_summary.missing_nodes),
              })}
            </p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(policyEnforcementHealth?.risk ?? 'info')}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">{t('services.commercial.policyBlocks')}</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatNumber(policyEnforcementHealth?.total_blocks ?? 0)}
          </p>
          <p className="mt-1 text-xs opacity-70">
            {policyEnforcementHealth?.label ?? t('common.status.pending')} · {policyEnforcementHealth?.detail ?? t('services.restartReadiness.waitingPolicyEnforcement')}
          </p>
          <p className="mt-2 text-xs leading-5 opacity-80">
            {t('services.restartReadiness.policyBlockLine', {
              sessions: formatNumber(policyEnforcementHealth?.max_sessions_rejections ?? 0),
              bandwidth: formatNumber(policyEnforcementHealth?.bandwidth_drops ?? 0),
            })}
          </p>
          {policyEnforcementHealth?.dominant_block_reason && (
            <p className="mt-1 text-xs leading-5 opacity-75">
              {t('services.restartReadiness.mainBlockReason', {
                reason: policyEnforcementHealth.dominant_block_reason.label,
                count: formatNumber(policyEnforcementHealth.dominant_block_reason.count),
                share: policyEnforcementHealth.dominant_block_reason.share_percent.toFixed(1),
              })}
            </p>
          )}
          <p className="mt-1 text-xs leading-5 opacity-75">
            {t('services.restartReadiness.droppedLine', {
              bytes: formatFleetBytes(policyEnforcementHealth?.bandwidth_drop_bytes),
            })}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-75">
            {t('services.restartReadiness.recentHistoricalLine', {
              recent: formatNumber(policyEnforcementHealth?.recent_problem_nodes ?? 0),
              historical: formatNumber(policyEnforcementHealth?.historical_problem_nodes ?? 0),
            })}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-75">
            Fresh {(policyEnforcementHealth?.telemetry_source_counts?.cache ?? 0).toLocaleString()} ·
            Fallback {(policyEnforcementHealth?.telemetry_source_counts?.sample ?? 0).toLocaleString()} ·
            Missing {(policyEnforcementHealth?.telemetry_source_counts?.missing ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-75">
            Scope oldest {formatUnixSecondsRelative(policyEnforcementHealth?.counter_scope_started_at_min)} ·
            newest {formatUnixSecondsRelative(policyEnforcementHealth?.counter_scope_started_at_max)}
          </p>
          {policyEnforcementHealth?.counter_scope_summary && (
            <p className="mt-1 text-xs leading-5 opacity-75">
              Scope covered {policyEnforcementHealth.counter_scope_summary.covered_nodes.toLocaleString()} /{' '}
              {policyEnforcementHealth.counter_scope_summary.reporting_nodes.toLocaleString()} ·
              missing {policyEnforcementHealth.counter_scope_summary.missing_nodes.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {commercialPlacementHealth?.problem_nodes?.length ? (
        <div className="mt-4 rounded-xl border border-sky-300/20 bg-sky-500/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-sky-100">
                {commercialPlacementHealth.label}
              </h3>
              <p className="mt-1 text-xs leading-5 text-sky-100/60">
                {commercialPlacementHealth.detail}
              </p>
              <p className="mt-1 text-xs leading-5 text-sky-100/50">
                {commercialPlacementHealth.next_step}
              </p>
            </div>
            <StatusPill status={commercialPlacementHealth.risk} />
          </div>
          <div className="mt-3 grid gap-x-4 gap-y-2 border-y border-sky-100/10 py-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <p className="uppercase tracking-[0.14em] text-sky-100/35">{t('services.labels.ready')}</p>
              <p className="mt-1 font-semibold text-sky-100">{commercialPlacementHealth.ready_nodes.toLocaleString()}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.14em] text-sky-100/35">{t('services.labels.watch')}</p>
              <p className="mt-1 font-semibold text-sky-100">{commercialPlacementHealth.watch_nodes.toLocaleString()}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.14em] text-sky-100/35">{t('services.labels.blocked')}</p>
              <p className="mt-1 font-semibold text-sky-100">{commercialPlacementHealth.blocked_nodes.toLocaleString()}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.14em] text-sky-100/35">{t('services.labels.publicEntries')}</p>
              <p className="mt-1 font-semibold text-sky-100">{commercialPlacementHealth.public_entry_nodes.toLocaleString()}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.14em] text-sky-100/35">{t('services.labels.policySync')}</p>
              <p className="mt-1 font-semibold text-sky-100">{commercialPlacementHealth.policy_sync_attention_nodes.toLocaleString()}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.14em] text-sky-100/35">{t('services.labels.recentBlocks')}</p>
              <p className="mt-1 font-semibold text-sky-100">{commercialPlacementHealth.recent_policy_problem_nodes.toLocaleString()}</p>
            </div>
          </div>
          {commercialPlacementHealth.rust_placement_rollout_summary && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-sky-100">
                    {commercialPlacementHealth.rust_placement_rollout_summary.label}
                  </p>
                  <p className="mt-1 leading-5 text-sky-100/55">
                    {commercialPlacementHealth.rust_placement_rollout_summary.detail}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-0.5 ${statusClass(commercialPlacementHealth.rust_placement_rollout_summary.risk)}`}>
                  {commercialPlacementHealth.rust_placement_rollout_summary.status}
                </span>
              </div>
              <p className="mt-1 leading-5 text-sky-100/45">
                Coverage {commercialPlacementHealth.rust_placement_rollout_summary.coverage_percent.toFixed(1)}% ·
                reporting {commercialPlacementHealth.rust_placement_rollout_summary.reporting_nodes.toLocaleString()} /{' '}
                {commercialPlacementHealth.rust_placement_rollout_summary.total_nodes.toLocaleString()} ·
                accepting {commercialPlacementHealth.rust_placement_rollout_summary.accepting_nodes.toLocaleString()} ·
                missing {commercialPlacementHealth.rust_placement_rollout_summary.missing_nodes.toLocaleString()}
              </p>
              <p className="mt-1 leading-5 text-sky-100/45">
                {commercialPlacementHealth.rust_placement_rollout_summary.next_step}
              </p>
              {commercialPlacementHealth.rust_placement_rollout_summary.missing_node_list?.length ? (
                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  {commercialPlacementHealth.rust_placement_rollout_summary.missing_node_list.map((node) => (
                    <div key={node.id} className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/dashboard/nodes/${node.id}`} className="min-w-0 truncate font-medium text-white hover:text-purple-300">
                          {node.name}
                        </Link>
                        <span className="shrink-0 rounded-md border border-sky-100/20 px-2 py-0.5 text-sky-100/70">
                          missing
                        </span>
                      </div>
                      <p className="mt-1 leading-5 text-sky-100/45">
                        Region {node.region_code || node.city || 'unknown'} ·
                        version {node.version || 'unknown'} ·
                        sessions {node.active_sessions.toLocaleString()} ·
                        heartbeat {typeof node.last_seen_seconds === 'number' ? `${formatDuration(node.last_seen_seconds)} ago` : 'pending'}
                      </p>
                      {node.restart_safety && (
                        <div className="mt-1 rounded-md border border-white/10 bg-black/20 px-2 py-2">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <p className="leading-5 text-sky-100/45">
                              Restart safety {node.restart_safety.label} · {node.restart_safety.detail}
                            </p>
                            <span className={`shrink-0 rounded-md border px-2 py-0.5 ${statusClass(node.restart_safety.risk)}`}>
                              {node.restart_safety.safe_to_cutover ? 'safe' : node.restart_safety.status}
                            </span>
                          </div>
                          <p className="mt-1 leading-5 text-sky-100/40">
                            {node.restart_safety.next_step}
                          </p>
                        </div>
                      )}
                      <p className="mt-1 leading-5 text-sky-100/45">{node.next_step}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/sessions?node=${encodeURIComponent(node.id)}&status=active&quality=all`}
                          className="inline-flex items-center justify-center rounded-md border border-sky-100/20 px-2.5 py-1.5 font-medium text-sky-100 transition hover:border-sky-100/40 hover:bg-sky-100/10"
                        >
                          Active sessions
                        </Link>
                        <Link
                          href={`/dashboard/nodes/${node.id}#maintenance-drain`}
                          className="inline-flex items-center justify-center rounded-md border border-white/10 px-2.5 py-1.5 font-medium text-sky-100/75 transition hover:border-white/20 hover:bg-white/[0.06]"
                        >
                          Maintenance drain
                        </Link>
                      </div>
                      {node.primary_action && (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="leading-5 text-sky-100/35">
                            Action {node.primary_action.key} · {node.primary_action.detail}
                          </p>
                          {/* Backend primary_action owns rollout work; nodeboard only routes to node detail. */}
                          <Link
                            href={`/dashboard/nodes/${node.id}`}
                            className="inline-flex shrink-0 items-center justify-center rounded-md border border-sky-100/20 px-2.5 py-1.5 font-medium text-sky-100 transition hover:border-sky-100/40 hover:bg-sky-100/10"
                          >
                            {node.primary_action.label}
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
          <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {commercialPlacementHealth.problem_nodes.map((node) => (
              <div key={node.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/nodes/${node.id}`} className="min-w-0 truncate font-medium text-white hover:text-purple-300">
                    {node.name}
                  </Link>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 ${statusClass(node.risk)}`}>
                    {node.status}
                  </span>
                </div>
                <p className="mt-2 leading-5 text-sky-100/65">
                  {node.primary_reason.label} · {node.primary_reason.detail}
                </p>
                <p className="mt-1 leading-5 text-sky-100/50">
                  Region {node.region_code || node.city || 'unknown'} · public entry {node.public_ip ? 'yes' : 'missing'} ·
                  health {node.health_status}
                </p>
                <p className="mt-1 leading-5 text-sky-100/50">
                  Sessions {node.active_sessions.toLocaleString()} /{' '}
                  {node.max_sessions > 0 ? node.max_sessions.toLocaleString() : 'unlimited'} ·
                  capacity {typeof node.capacity_ratio_percent === 'number' ? `${node.capacity_ratio_percent.toFixed(1)}%` : 'unlimited'}
                </p>
                <p className="mt-1 leading-5 text-sky-100/45">
                  Policy sync {node.policy_sync_status} · recent policy block {node.recent_policy_block ? 'yes' : 'no'} ·
                  heartbeat {typeof node.last_seen_seconds === 'number' ? `${formatDuration(node.last_seen_seconds)} ago` : 'pending'}
                </p>
                <p className="mt-1 leading-5 text-sky-100/45">
                  Rust admission {node.rust_placement_reported ? (node.rust_accepting_new_sessions ? 'accepting' : 'blocked') : 'missing'} ·
                  status {node.rust_placement_status ?? 'missing'} · reason {node.rust_placement_reason ?? 'not_reported'}
                </p>
                <p className="mt-1 leading-5 text-sky-100/50">{node.next_step}</p>
                {node.primary_action && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="leading-5 text-sky-100/40">
                      Action {node.primary_action.key} · {node.primary_action.detail}
                    </p>
                    {/* Backend primary_action owns placement remediation; nodeboard only routes to node detail. */}
                    <Link
                      href={`/dashboard/nodes/${node.id}`}
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-sky-100/20 px-2.5 py-1.5 font-medium text-sky-100 transition hover:border-sky-100/40 hover:bg-sky-100/10"
                    >
                      {node.primary_action.label}
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {policyEnforcementHealth?.problem_nodes?.length ? (
        <div className="mt-4 rounded-xl border border-yellow-300/20 bg-yellow-500/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-yellow-100">
                {policyEnforcementHealth.problem_panel_summary?.label ?? t('services.commercial.policyBlocks')}
              </h3>
              <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                {policyEnforcementHealth.problem_panel_summary?.detail
                  ?? t('services.restartReadiness.policyBlocksFallback')}
              </p>
              {policyEnforcementHealth.problem_panel_summary?.next_step && (
                <p className="mt-1 text-xs leading-5 text-yellow-100/50">
                  {policyEnforcementHealth.problem_panel_summary.next_step}
                </p>
              )}
            </div>
            <StatusPill status={policyEnforcementHealth.problem_panel_summary?.risk ?? policyEnforcementHealth.risk} />
          </div>
          {policyEnforcementHealth.telemetry_source_summary && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-yellow-100">
                    {policyEnforcementHealth.telemetry_source_summary.label}
                  </p>
                  <p className="mt-1 leading-5 text-yellow-100/55">
                    {policyEnforcementHealth.telemetry_source_summary.detail}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-0.5 ${statusClass(policyEnforcementHealth.telemetry_source_summary.risk)}`}>
                  {policyEnforcementHealth.telemetry_source_summary.status}
                </span>
              </div>
              <p className="mt-1 leading-5 text-yellow-100/45">
                {policyEnforcementHealth.telemetry_source_summary.next_step}
              </p>
            </div>
          )}
          {policyEnforcementHealth.counter_scope_summary && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-yellow-100">
                    {policyEnforcementHealth.counter_scope_summary.label}
                  </p>
                  <p className="mt-1 leading-5 text-yellow-100/55">
                    {policyEnforcementHealth.counter_scope_summary.detail}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-0.5 ${statusClass(policyEnforcementHealth.counter_scope_summary.risk)}`}>
                  {policyEnforcementHealth.counter_scope_summary.status}
                </span>
              </div>
              <p className="mt-1 leading-5 text-yellow-100/45">
                {policyEnforcementHealth.counter_scope_summary.next_step}
              </p>
            </div>
          )}
          {policyEnforcementHealth.dominant_block_reason && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-yellow-100">
                    {t('services.restartReadiness.mainPolicyReason', {
                      reason: policyEnforcementHealth.dominant_block_reason.label,
                    })}
                  </p>
                  <p className="mt-1 leading-5 text-yellow-100/55">
                    {t('services.restartReadiness.mainPolicyReasonDetail', {
                      count: formatNumber(policyEnforcementHealth.dominant_block_reason.count),
                      share: policyEnforcementHealth.dominant_block_reason.share_percent.toFixed(1),
                      detail: policyEnforcementHealth.dominant_block_reason.detail,
                    })}
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-yellow-100/70">
                  {policyEnforcementHealth.dominant_block_reason.key}
                </span>
              </div>
              <p className="mt-1 leading-5 text-yellow-100/45">
                {policyEnforcementHealth.dominant_block_reason.next_step}
              </p>
            </div>
          )}
          {policyEnforcementHealth.problem_panel_summary && (
            <div className="mt-3 grid gap-x-4 gap-y-2 border-y border-yellow-100/10 py-3 text-xs sm:grid-cols-3 lg:grid-cols-7">
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.restartReadiness.nodesLabel')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{formatNumber(policyEnforcementHealth.problem_panel_summary.count)}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('common.status.critical')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{formatNumber(policyEnforcementHealth.problem_panel_summary.critical_nodes)}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.restartReadiness.maxSessions')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{formatNumber(policyEnforcementHealth.problem_panel_summary.max_sessions_rejections)}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.restartReadiness.bandwidth')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{formatNumber(policyEnforcementHealth.problem_panel_summary.bandwidth_drops)}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.restartReadiness.droppedBytes')}</p>
                <p className="mt-1 font-semibold text-yellow-100">
                  {formatFleetBytes(policyEnforcementHealth.problem_panel_summary.bandwidth_drop_bytes)}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.restartReadiness.recent')}</p>
                <p className="mt-1 font-semibold text-yellow-100">
                  {formatNumber(policyEnforcementHealth.problem_panel_summary.recent_problem_nodes ?? 0)}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.restartReadiness.historical')}</p>
                <p className="mt-1 font-semibold text-yellow-100">
                  {formatNumber(policyEnforcementHealth.problem_panel_summary.historical_problem_nodes ?? 0)}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.restartReadiness.scopeNodes')}</p>
                <p className="mt-1 font-semibold text-yellow-100">
                  {formatNumber(policyEnforcementHealth.problem_panel_summary.counter_scope_reporting_nodes ?? 0)}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.restartReadiness.oldestScope')}</p>
                <p className="mt-1 font-semibold text-yellow-100">
                  {formatUnixSecondsRelative(policyEnforcementHealth.problem_panel_summary.counter_scope_started_at_min)}
                </p>
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {policyEnforcementHealth.problem_nodes.map((node) => (
              <div key={node.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/nodes/${node.id}`} className="min-w-0 truncate font-medium text-white hover:text-purple-300">
                    {node.name}
                  </Link>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 ${statusClass(node.severity)}`}>
                    {node.recent_block_active ? node.severity : 'historical'}
                  </span>
                </div>
                <p className="mt-2 leading-5 text-yellow-100/60">
                  {t('services.restartReadiness.policyNodeTotals', {
                    total: formatNumber(node.total_blocks),
                    maintenance: formatNumber(node.maintenance_rejections),
                    sessions: formatNumber(node.max_sessions_rejections),
                    bandwidth: formatNumber(node.bandwidth_drops),
                  })}
                </p>
                <p className="mt-1 leading-5 text-yellow-100/50">
                  {t('services.restartReadiness.policyNodeDropped', {
                    dropped: formatFleetBytes(node.bandwidth_drop_bytes),
                    window: formatFleetBytes(node.bandwidth_window_bytes),
                  })}
                </p>
                <p className="mt-1 leading-5 text-yellow-100/50">
                  {t('services.restartReadiness.policyNodeLast', {
                    reason: node.last_rejection_reason ?? 'policy_enforced',
                    block: formatPolicyBlockAge(node.last_rejection_age_seconds),
                    heartbeat: typeof node.last_seen_seconds === 'number'
                      ? t('services.restartReadiness.durationAgo', { duration: formatDuration(node.last_seen_seconds) })
                      : t('common.status.pending'),
                  })}
                </p>
                <p className="mt-1 leading-5 text-yellow-100/45">
                  {t('services.restartReadiness.telemetryScope', {
                    source: telemetrySourceLabel(node.telemetry_source),
                    scope: formatUnixSecondsRelative(node.counters_started_at),
                  })}
                </p>
                {!node.recent_block_active && (
                  <p className="mt-1 leading-5 text-sky-100/55">
                    {t('services.restartReadiness.historicalOnly', {
                      window: formatDuration(node.recent_block_window_seconds ?? policyEnforcementHealth.recent_block_window_seconds ?? 3600),
                    })}
                  </p>
                )}
                <p className="mt-1 leading-5 text-yellow-100/50">{node.next_step}</p>
                {node.primary_action && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="leading-5 text-yellow-100/45">
                      {t('services.restartReadiness.primaryAction', {
                        label: node.primary_action.label,
                        detail: node.primary_action.detail,
                      })}
                    </p>
                    {/* Backend primary_action.intent owns policy remediation; nodeboard only maps it to node detail. */}
                    <Link
                      href={`/dashboard/nodes/${node.id}`}
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-yellow-100/20 px-2.5 py-1.5 font-medium text-yellow-100 transition hover:border-yellow-100/40 hover:bg-yellow-100/10"
                    >
                      {node.primary_action.label}
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {policySyncHealth?.problem_nodes?.length ? (
        <div className="mt-4 rounded-xl border border-yellow-300/20 bg-yellow-500/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-yellow-100">
                {policySyncHealth.problem_panel_summary?.label ?? t('services.fallback.policySyncAttention')}
              </h3>
              <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                {policySyncHealth.problem_panel_summary?.detail
                  ?? t('services.fallback.policySyncAttentionDetail')}
              </p>
              {policySyncHealth.problem_panel_summary?.next_step && (
                <p className="mt-1 text-xs leading-5 text-yellow-100/50">
                  {policySyncHealth.problem_panel_summary.next_step}
                </p>
              )}
            </div>
            <StatusPill status={policySyncHealth.problem_panel_summary?.risk ?? policySyncHealth.risk} />
          </div>
          {policySyncHealth.problem_panel_summary && (
            <div className="mt-3 grid gap-x-4 gap-y-2 border-y border-yellow-100/10 py-3 text-xs sm:grid-cols-4">
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.labels.attention')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{policySyncHealth.problem_panel_summary.count.toLocaleString()}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.labels.shown')}</p>
                <p className="mt-1 font-semibold text-yellow-100">
                  {policySyncHealth.problem_panel_summary.visible_count.toLocaleString()}
                  {policySyncHealth.problem_panel_summary.hidden_count > 0
                    ? ` / +${policySyncHealth.problem_panel_summary.hidden_count.toLocaleString()} hidden`
                    : ''}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('common.status.pending')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{policySyncHealth.problem_panel_summary.pending_nodes.toLocaleString()}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('common.status.unknown')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{policySyncHealth.problem_panel_summary.unknown_nodes.toLocaleString()}</p>
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {policySyncHealth.problem_nodes.map((node) => (
              <div key={node.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/nodes/${node.id}`} className="min-w-0 truncate font-medium text-white hover:text-purple-300">
                    {node.name}
                  </Link>
                  <span className="shrink-0 rounded-md border border-yellow-200/20 px-2 py-0.5 text-yellow-100/80">
                    {node.status}
                  </span>
                </div>
                <p className="mt-2 leading-5 text-yellow-100/60">
                  Health {node.health_status} · heartbeat {typeof node.last_seen_seconds === 'number' ? `${formatDuration(node.last_seen_seconds)} ago` : 'pending'}
                </p>
                {node.mismatched_fields.length > 0 && (
                  <p className="mt-1 leading-5 text-yellow-100/50">
                    Pending fields: {node.mismatched_fields.map((field) => field.replaceAll('_', ' ')).join(', ')}
                  </p>
                )}
                <p className="mt-1 leading-5 text-yellow-100/50">{node.next_step}</p>
                {node.primary_action && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="leading-5 text-yellow-100/45">
                      {t('services.restartReadiness.primaryAction', {
                        label: node.primary_action.label,
                        detail: node.primary_action.detail,
                      })}
                    </p>
                    {/* Backend primary_action.intent owns policy sync remediation; nodeboard only maps it to node detail. */}
                    <Link
                      href={`/dashboard/nodes/${node.id}`}
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-yellow-100/20 px-2.5 py-1.5 font-medium text-yellow-100 transition hover:border-yellow-100/40 hover:bg-yellow-100/10"
                    >
                      {node.primary_action.label}
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {runtimeCapability.problemNodes.length > 0 && (
        <div className="mt-4 rounded-xl border border-yellow-300/20 bg-yellow-500/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-yellow-100">
                {runtimeCapability.problemPanelSummary?.label ?? t('services.fallback.rustCapabilityGaps')}
              </h3>
              <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                {runtimeCapability.problemPanelSummary?.detail
                  ?? t('services.fallback.rustCapabilityGapsDetail')}
              </p>
              {runtimeCapability.problemPanelSummary?.next_step && (
                <p className="mt-1 text-xs leading-5 text-yellow-100/50">
                  {runtimeCapability.problemPanelSummary.next_step}
                </p>
              )}
            </div>
            <StatusPill status={runtimeCapability.problemPanelSummary?.risk ?? runtimeCapability.risk} />
          </div>
          {runtimeCapability.problemPanelSummary && (
            <div className="mt-3 grid gap-x-4 gap-y-2 border-y border-yellow-100/10 py-3 text-xs sm:grid-cols-4">
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.labels.gaps')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{runtimeCapability.problemPanelSummary.count.toLocaleString()}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.labels.shown')}</p>
                <p className="mt-1 font-semibold text-yellow-100">
                  {runtimeCapability.problemPanelSummary.visible_count.toLocaleString()}
                  {runtimeCapability.problemPanelSummary.hidden_count > 0
                    ? ` / +${runtimeCapability.problemPanelSummary.hidden_count.toLocaleString()} hidden`
                    : ''}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.labels.safeUpgrade')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{runtimeCapability.problemPanelSummary.safe_to_upgrade_nodes.toLocaleString()}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.labels.blocked')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{runtimeCapability.problemPanelSummary.blocked_upgrade_nodes.toLocaleString()}</p>
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {runtimeCapability.problemNodes.map((node) => (
              <div key={node.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/nodes/${node.id}`} className="min-w-0 truncate font-medium text-white hover:text-purple-300">
                    {node.name}
                  </Link>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 ${statusClass(node.risk)}`}>
                    {node.issue_label}
                  </span>
                </div>
                <p className="mt-2 leading-5 text-yellow-100/60">
                  Missing {node.missing_capabilities.map((item) => item.replaceAll('_', ' ')).join(', ')} ·
                  active {node.active_sessions.toLocaleString()} · {node.maintenance_mode ? 'maintenance on' : 'maintenance off'}
                </p>
                <p className="mt-1 leading-5 text-yellow-100/50">
                  Operator {node.operator_reporting ? 'reported' : 'missing'} ·
                  cleanup {node.cleanup_reported ? 'reported' : 'missing'} ·
                  rollout {node.rollout_reporting ? 'reported' : 'missing'} ·
                  heartbeat {typeof node.last_seen_seconds === 'number' ? `${formatDuration(node.last_seen_seconds)} ago` : 'pending'}
                </p>
                {node.upgrade_gate && (
                  <div className="mt-2 rounded-md border border-yellow-100/10 bg-black/20 p-2">
                    <p className="leading-5 text-yellow-100/60">
                      Upgrade gate {node.upgrade_gate.label} · {node.upgrade_gate.next_step}
                    </p>
                    {node.upgrade_gate.checklist?.length ? (
                      <div className="mt-2 grid gap-1.5">
                        {node.upgrade_gate.checklist.map((item) => (
                          <div key={item.key} className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-yellow-100/70">{item.label}</p>
                              <p className="mt-0.5 leading-5 text-yellow-100/45">{item.detail}</p>
                            </div>
                            <span className={`shrink-0 rounded-md border px-2 py-0.5 ${statusClass(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
                <p className="mt-1 leading-5 text-yellow-100/50">{node.recommended_action}</p>
                {node.primary_action && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="leading-5 text-yellow-100/45">
                      {t('services.restartReadiness.primaryAction', {
                        label: node.primary_action.label,
                        detail: node.primary_action.detail,
                      })}
                    </p>
                    {/* Backend primary_action.intent owns the remediation; nodeboard only maps it to a route. */}
                    <Link
                      href={runtimeCapabilityActionHref(node)}
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-yellow-100/20 px-2.5 py-1.5 font-medium text-yellow-100 transition hover:border-yellow-100/40 hover:bg-yellow-100/10"
                    >
                      {node.primary_action.label}
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {commandDelivery.problemNodes.length > 0 && (
        <div className="mt-4 rounded-xl border border-yellow-300/20 bg-yellow-500/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-yellow-100">
                {commandDelivery.problemPanelSummary?.label ?? t('services.fallback.commandDeliveryIssues')}
              </h3>
              <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                {commandDelivery.problemPanelSummary?.detail
                  ?? t('services.fallback.commandDeliveryIssuesDetail')}
              </p>
              {commandDelivery.problemPanelSummary?.next_step && (
                <p className="mt-1 text-xs leading-5 text-yellow-100/50">
                  {commandDelivery.problemPanelSummary.next_step}
                </p>
              )}
            </div>
            <StatusPill status={commandDelivery.problemPanelSummary?.risk ?? commandDelivery.risk} />
          </div>
          {commandDelivery.problemPanelSummary && (
            <div className="mt-3 grid gap-x-4 gap-y-2 border-y border-yellow-100/10 py-3 text-xs sm:grid-cols-4">
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.labels.attention')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{commandDelivery.problemPanelSummary.count.toLocaleString()}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.labels.shown')}</p>
                <p className="mt-1 font-semibold text-yellow-100">
                  {commandDelivery.problemPanelSummary.visible_count.toLocaleString()}
                  {commandDelivery.problemPanelSummary.hidden_count > 0
                    ? ` / +${commandDelivery.problemPanelSummary.hidden_count.toLocaleString()} hidden`
                    : ''}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('common.status.offline')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{commandDelivery.problemPanelSummary.offline_nodes.toLocaleString()}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-yellow-100/35">{t('services.labels.operatorPending')}</p>
                <p className="mt-1 font-semibold text-yellow-100">{commandDelivery.problemPanelSummary.operator_pending_nodes.toLocaleString()}</p>
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {commandDelivery.problemNodes.map((node) => (
              <div key={node.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/nodes/${node.id}`} className="min-w-0 truncate font-medium text-white hover:text-purple-300">
                    {node.name}
                  </Link>
                  <span className="shrink-0 rounded-md border border-yellow-200/20 px-2 py-0.5 text-yellow-100/80">
                    {node.issue_label}
                  </span>
                </div>
                <p className="mt-2 leading-5 text-yellow-100/60">
                  Heartbeat {typeof node.last_seen_seconds === 'number' ? `${formatDuration(node.last_seen_seconds)} ago` : 'missing'} ·
                  operator {node.operator_reporting ? 'reported' : 'pending'} · health {node.health_status}
                </p>
                <p className="mt-1 leading-5 text-yellow-100/50">{node.recommended_action}</p>
                {node.primary_action && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="leading-5 text-yellow-100/45">
                      {t('services.restartReadiness.primaryAction', {
                        label: node.primary_action.label,
                        detail: node.primary_action.detail,
                      })}
                    </p>
                    {/* Backend primary_action.intent owns command-delivery triage; nodeboard only maps it to a route. */}
                    <Link
                      href={commandDeliveryActionHref(node)}
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-yellow-100/20 px-2.5 py-1.5 font-medium text-yellow-100 transition hover:border-yellow-100/40 hover:bg-yellow-100/10"
                    >
                      {node.primary_action.label}
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {maintenanceExitCandidateCount > 0 && (
        <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-emerald-100">
                {maintenanceExitSummary?.label ?? t('services.fallback.maintenanceExitCandidates')}
              </h3>
              <p className="mt-1 text-xs leading-5 text-emerald-100/60">
                {maintenanceExitSummary?.detail
                  ?? t('services.fallback.maintenanceExitCandidatesDetail')}
              </p>
              {maintenanceExitSummary?.next_step && (
                <p className="mt-1 text-xs leading-5 text-emerald-100/50">
                  {maintenanceExitSummary.next_step}
                </p>
              )}
            </div>
            <StatusPill status={maintenanceExitSummary?.risk ?? 'ready'} />
          </div>
          {maintenanceExitSummary && (
            <div className="mt-3 grid gap-x-4 gap-y-2 border-y border-emerald-100/10 py-3 text-xs sm:grid-cols-4">
              <div>
                <p className="uppercase tracking-[0.14em] text-emerald-100/35">{t('services.labels.candidates')}</p>
                <p className="mt-1 font-semibold text-emerald-100">{maintenanceExitSummary.count.toLocaleString()}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-emerald-100/35">{t('services.labels.shown')}</p>
                <p className="mt-1 font-semibold text-emerald-100">
                  {maintenanceExitSummary.visible_count.toLocaleString()}
                  {maintenanceExitSummary.hidden_count > 0
                    ? ` / +${maintenanceExitSummary.hidden_count.toLocaleString()} hidden`
                    : ''}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-emerald-100/35">{t('services.labels.publicEntries')}</p>
                <p className="mt-1 font-semibold text-emerald-100">{maintenanceExitSummary.public_entry_count.toLocaleString()}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.14em] text-emerald-100/35">{t('services.labels.regions')}</p>
                <p className="mt-1 font-semibold text-emerald-100">{maintenanceExitSummary.regions_count.toLocaleString()}</p>
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {maintenanceExitCandidates.map((node) => {
              const isEndingMaintenance = endingMaintenanceNodeId === node.id;
              const placementLabel = [node.city, node.region_code].filter(Boolean).join(', ') || 'unknown region';
              const entryLabel = node.public_ip ?? 'no public IP';
              const versionLabel = node.version ? `v${node.version}` : 'version pending';

              return (
                <div key={node.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/dashboard/nodes/${node.id}`} className="min-w-0 truncate font-medium text-white hover:text-purple-300">
                      {node.name}
                    </Link>
                    <span className="shrink-0 rounded-md border border-emerald-200/20 px-2 py-0.5 text-emerald-100/80">
                      {node.recommended_action?.label ?? 'End maintenance'}
                    </span>
                  </div>
                  <p className="mt-1 truncate leading-5 text-emerald-100/50">
                    {placementLabel} · {entryLabel} · {versionLabel}
                  </p>
                  <p className="mt-2 leading-5 text-emerald-100/60">
                    Health {node.health_status} · sessions {node.active_sessions.toLocaleString()} ·
                    heartbeat {typeof node.last_seen_seconds === 'number' ? `${formatDuration(node.last_seen_seconds)} ago` : 'pending'}
                  </p>
                  <p className="mt-1 leading-5 text-emerald-100/50">
                    {node.next_step}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEndMaintenance(node.id, node.name)}
                      disabled={Boolean(endingMaintenanceNodeId)}
                      className="inline-flex items-center justify-center rounded-md border border-emerald-300/20 px-2.5 py-1 font-medium text-emerald-100 transition hover:border-emerald-200/40 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isEndingMaintenance ? 'Ending...' : node.recommended_action?.label ?? 'End maintenance'}
                    </button>
                    <Link
                      href={`/dashboard/nodes/${node.id}`}
                      className="inline-flex items-center justify-center rounded-md border border-white/10 px-2.5 py-1 font-medium text-gray-300 transition hover:border-white/20 hover:bg-white/5"
                    >
                      Open node
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          {maintenanceExitCandidateCount > maintenanceExitCandidates.length && (
            <p className="mt-2 text-xs leading-5 text-emerald-100/50">
              {t('services.labels.showingCandidates', {
                shown: formatNumber(maintenanceExitCandidates.length),
                total: formatNumber(maintenanceExitCandidateCount),
              })}
            </p>
          )}
        </div>
      )}

      <div className={`mt-4 rounded-xl border p-4 ${drainActivityHealthClass(commandOutcome.risk)}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">{t('services.restartOutcome.title')}</h3>
            <p className="mt-1 text-xs leading-5 opacity-70">
              {t('services.restartOutcome.description')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill status={commandOutcome.risk} />
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs opacity-80">
              {t('services.restartOutcome.itemCount', { count: formatNumber(commandOutcome.count) })}
            </span>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [t('common.status.completed'), commandCounts?.completed ?? 0],
            [t('common.status.failed'), commandCounts?.failed ?? 0],
            [t('common.status.timeout'), commandCounts?.timeout ?? 0],
            [t('common.status.cancelled'), commandCounts?.cancelled ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.14em] opacity-60">{label}</p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(Number(value))}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] opacity-60">{t('services.restartOutcome.reliability24h')}</p>
              <p className="mt-1 text-xs leading-5 opacity-70">
                {t('services.restartOutcome.reliabilityDescription')}
              </p>
            </div>
            {commandHistory?.summary && <StatusPill status={commandHistory.summary.risk} />}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [t('services.restartOutcome.commands'), formatNumber(commandHistory?.total ?? 0)],
              [t('services.restartOutcome.success'), formatOptionalPercent(commandHistory?.success_rate_percent)],
              [t('services.restartOutcome.delivery'), formatOptionalPercent(commandHistory?.delivery_rate_percent)],
              [t('services.restartOutcome.rustAck'), formatOptionalPercent(commandHistory?.ack_rate_percent)],
              [t('services.restartOutcome.avgComplete'), formatOptionalDuration(commandHistory?.average_completion_seconds)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] opacity-50">{label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
          {commandHistory?.summary && (
            <p className="mt-3 text-xs leading-5 opacity-75">
              {commandHistory.summary.label} · {commandHistory.summary.detail}
            </p>
          )}
          <p className="mt-2 text-xs leading-5 opacity-60">
            Last command{' '}
            {commandHistory?.latest_any_created_at
              ? `${formatRelativeTime(commandHistory.latest_any_created_at)} · ${commandHistory.latest_any_status || 'unknown'}`
              : 'not reported yet'}
          </p>
        </div>
        <p className="mt-3 text-xs leading-5 opacity-75">
          {commandOutcome.label} · {commandOutcome.detail}
        </p>
        {commandOutcome.next_step && (
          <p className="mt-2 text-xs leading-5 opacity-75">{commandOutcome.next_step}</p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">{t('services.restartQueue.title')}</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {t('services.restartQueue.description')}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              {t('services.restartQueue.showingItems', { count: formatNumber(queueItemCount) })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={queueFilters.region}
              onChange={(event) => setQueueFilters((current) => ({ ...current, region: event.target.value }))}
              className="h-9 rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-gray-200 outline-none transition hover:border-white/20 focus:border-emerald-400/40"
              aria-label={t('services.restartQueue.regionFilter')}
            >
              <option value="all">{t('services.restartQueue.allRegions')}</option>
              {filterOptions.regions.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
            <select
              value={queueFilters.version}
              onChange={(event) => setQueueFilters((current) => ({ ...current, version: event.target.value }))}
              className="h-9 rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-gray-200 outline-none transition hover:border-white/20 focus:border-emerald-400/40"
              aria-label={t('services.restartQueue.versionFilter')}
            >
              <option value="all">{t('services.restartQueue.allVersions')}</option>
              {filterOptions.versions.map((version) => (
                <option key={version} value={version}>v{version}</option>
              ))}
            </select>
            <select
              value={queueFilters.status}
              onChange={(event) => setQueueFilters((current) => ({
                ...current,
                status: event.target.value as RestartQueueStatusFilter,
              }))}
              className="h-9 rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-gray-200 outline-none transition hover:border-white/20 focus:border-emerald-400/40"
              aria-label={t('services.restartQueue.statusFilter')}
            >
              {restartQueueStatusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>{filter.label}</option>
              ))}
            </select>
            <StatusPill status={blockedCount > 0 ? 'blocked' : readyCount > 0 ? 'ready' : 'current'} />
          </div>
        </div>

        {blockerCounts.length > 0 && (
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {blockerCounts.map(([code, count]) => {
              const blocker = restartBlockerCopy(code);

              return (
                <div
                  key={code}
                  className="rounded-lg border border-yellow-300/10 bg-yellow-500/[0.04] px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 text-yellow-100/80">
                    <span className="font-medium">{blocker.label}</span>
                    <span className="text-yellow-100">{count.toLocaleString()}</span>
                  </div>
                  <p className="mt-1 leading-5 text-yellow-100/45">
                    {blocker.remediation}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 grid gap-3 xl:grid-cols-3 2xl:grid-cols-6">
          {actionQueues.map((queue) => (
            <div
              key={queue.key}
              className={`rounded-xl border p-3 ${queue.items.length > 0 ? drainActivityHealthClass(queue.status) : 'border-white/10 bg-white/[0.03] text-gray-400'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
                    {queue.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{queue.items.length.toLocaleString()}</p>
                </div>
                <StatusPill status={queue.status} />
              </div>
              <p className="mt-2 min-h-[40px] text-xs leading-5 opacity-70">{queue.description}</p>

              <div className="mt-3 space-y-2">
                {queue.items.length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs opacity-60">
                    {queue.emptyState}
                  </p>
                ) : queue.items.map((item) => {
                  const isEnablingMaintenance = enablingMaintenanceNodeId === item.id;
                  const isRestarting = restartingNodeId === item.id;
                  const visibleCommand = item.activeRestartCommand ?? item.latestRestartCommand;
                  const cancellableRestartCommand = item.canCancelRestartCommand ? item.activeRestartCommand : null;
                  const isCancellingCommand = cancellableRestartCommand?.id === cancellingCommandId;
                  const cancelUnavailableReason = item.activeRestartCommand && !cancellableRestartCommand
                    ? restartCommandCancelReason(item.activeRestartCommand)
                    : '';
                  const commandStageIndex = restartCommandStageIndex(visibleCommand);
                  const commandStageLabels = restartCommandStageLabels(visibleCommand);
                  const commandSlaLabel = restartCommandSlaLabel(visibleCommand);

                  return (
                    <div
                      key={`${queue.key}-${item.id}`}
                      className="rounded-lg border border-white/10 bg-black/25 p-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/dashboard/nodes/${item.id}`}
                          className="min-w-0 truncate font-medium text-white hover:text-purple-300"
                        >
                          {item.name}
                        </Link>
                        <span className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 opacity-70">
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-2 leading-5 opacity-75">{item.detail}</p>
                      <p className="mt-2 line-clamp-2 leading-5 opacity-45">
                        {item.meta.join(' · ')}
                      </p>
                      {visibleCommand && (
                        <div className={`mt-3 rounded-lg border px-3 py-2 ${restartCommandStatusClass(visibleCommand)}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {restartCommandTimelineLabel(visibleCommand)}
                            </span>
                            <Link
                              href={`/dashboard/nodes/${item.id}?command_action=restart_service#vpn-commands`}
                              className="shrink-0 text-sky-200 hover:text-sky-100"
                            >
                              {t('services.restartQueue.openCommand')}
                            </Link>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-1">
                            {commandStageLabels.map((stage, index) => (
                              <div
                                key={stage}
                                className={`rounded-md px-2 py-1 text-center text-[11px] ${
                                  index <= commandStageIndex
                                    ? 'bg-white/15 text-white'
                                    : 'bg-black/20 opacity-50'
                                }`}
                              >
                                {stage}
                              </div>
                            ))}
                          </div>
                          {commandSlaLabel && (
                            <p className="mt-2 text-[11px] opacity-75">
                              {commandSlaLabel}
                              {visibleCommand.stale_reason ? ` · ${visibleCommand.stale_reason}` : ''}
                            </p>
                          )}
                          {cancelUnavailableReason && (
                            <p className="mt-2 text-[11px] leading-5 opacity-70">
                              {t('services.restartQueue.cancelUnavailable', { reason: cancelUnavailableReason })}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={item.actionHref}
                          className="inline-flex items-center justify-center rounded-md border border-sky-400/20 px-2.5 py-1 font-medium text-sky-200 transition hover:border-sky-300/40 hover:bg-sky-400/10"
                        >
                          {item.actionLabel}
                        </Link>
                        {item.canEnableMaintenance && (
                          <button
                            type="button"
                            onClick={() => onEnableMaintenance(item.id, item.name)}
                            disabled={Boolean(enablingMaintenanceNodeId)}
                            className="inline-flex items-center justify-center rounded-md border border-yellow-300/20 px-2.5 py-1 font-medium text-yellow-100 transition hover:border-yellow-200/40 hover:bg-yellow-300/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isEnablingMaintenance ? t('services.restartQueue.enabling') : t('services.restartQueue.enableMaintenance')}
                          </button>
                        )}
                        {item.canQueueRestart && (
                          <button
                            type="button"
                            onClick={() => onQueueRestart(item.id, item.name)}
                            disabled={Boolean(restartingNodeId)}
                            className="inline-flex items-center justify-center rounded-md border border-emerald-300/20 px-2.5 py-1 font-medium text-emerald-100 transition hover:border-emerald-200/40 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isRestarting ? t('services.restartQueue.queueing') : t('services.restartQueue.queueRestart')}
                          </button>
                        )}
                        {cancellableRestartCommand && (
                          <button
                            type="button"
                            onClick={() => onCancelRestartCommand(item.id, item.name, cancellableRestartCommand.id)}
                            disabled={Boolean(cancellingCommandId)}
                            className="inline-flex items-center justify-center rounded-md border border-red-300/20 px-2.5 py-1 font-medium text-red-100 transition hover:border-red-200/40 hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isCancellingCommand ? t('services.restartQueue.cancelling') : t('services.restartQueue.cancelCommand')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {nodes.map((node) => (
          <div key={node.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Link href={`/dashboard/nodes/${node.id}`} className="font-medium text-white hover:text-purple-300">
                  {node.name}
                </Link>
                <p className="mt-1 truncate text-xs text-gray-500">
                  {node.publicIp ?? 'no public IP'} · {node.maintenanceMode ? 'maintenance on' : 'maintenance off'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={node.status} />
                {node.activeRestartCommand ? (
                  <>
                    <Link
                      href={`/dashboard/nodes/${node.id}?command_action=restart_service#vpn-commands`}
                      className="inline-flex items-center justify-center rounded-lg border border-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-100 transition hover:border-sky-400/40 hover:bg-sky-500/10"
                    >
                      Restart {node.activeRestartCommand.status}
                    </Link>
                    {restartCommandCanCancel(node.activeRestartCommand) && (
                      <button
                        type="button"
                        onClick={() => onCancelRestartCommand(node.id, node.name, node.activeRestartCommand!.id)}
                        disabled={Boolean(cancellingCommandId)}
                        className="inline-flex items-center justify-center rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:border-red-400/40 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancellingCommandId === node.activeRestartCommand.id ? t('services.restartQueue.cancelling') : t('services.restartQueue.cancelCommand')}
                      </button>
                    )}
                  </>
                ) : node.canRestart ? (
                  <button
                    type="button"
                    onClick={() => onQueueRestart(node.id, node.name)}
                    disabled={Boolean(restartingNodeId)}
                    className="inline-flex items-center justify-center rounded-lg border border-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:border-emerald-400/40 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {restartingNodeId === node.id ? 'Queueing...' : 'Queue restart'}
                  </button>
                ) : null}
                {!node.maintenanceMode && node.status !== 'current' && (
                  <button
                    type="button"
                    onClick={() => onEnableMaintenance(node.id, node.name)}
                    disabled={Boolean(enablingMaintenanceNodeId)}
                    className="inline-flex items-center justify-center rounded-lg border border-yellow-500/20 px-3 py-1.5 text-xs font-medium text-yellow-100 transition hover:border-yellow-400/40 hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {enablingMaintenanceNodeId === node.id ? t('services.actions.enablingMaintenance') : t('services.actions.enableMaintenance')}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400 lg:grid-cols-4">
              <div>
                <p className="text-gray-600">{t('nodeDetail.stats.activeSessions')}</p>
                <p className="mt-1 text-gray-200">{formatNumber(node.activeSessions)}</p>
              </div>
              <div>
                <p className="text-gray-600">{t('services.labels.operatorSignal')}</p>
                <p className="mt-1 text-gray-200">{node.operatorReporting ? t('services.labels.reported') : t('common.status.pending')}</p>
              </div>
              <div>
                <p className="text-gray-600">{t('nodeDetail.commercial.nextStep')}</p>
                <p className="mt-1 text-gray-200">{node.nextStep}</p>
              </div>
              <div>
                <p className="text-gray-600">{t('services.labels.drainEta')}</p>
                <p className="mt-1 text-gray-200">{formatDrainEta(node.drainEta)}</p>
                {node.drainEta?.next_step && (
                  <p className="mt-1 text-[11px] text-gray-600">
                    {node.drainEta.next_step}
                  </p>
                )}
                {node.drainEta?.latest_activity_at && (
                  <p className="mt-1 text-[11px] text-gray-600">
                    {t('services.labels.activityAt', { time: i18nRelativeTime(node.drainEta.latest_activity_at) })}
                  </p>
                )}
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-gray-600">
              Heartbeat {node.lastHeartbeat ? formatRelativeTime(node.lastHeartbeat) : 'pending'} ·
              cleanup policy {node.cleanupReported ? 'reported' : 'pending'} ·
              rollout {node.restartRequired ? 'restart required' : node.operatorReporting ? 'current signal' : 'operator pending'} ·
              {node.activeRestartCommand ? ` restart ${node.activeRestartCommand.status} ·` : ''}
              {node.drainEta?.cleanup_timeout_seconds ? ` cleanup ${formatDuration(node.drainEta.cleanup_timeout_seconds)} ·` : ''}
              source {node.source}.
            </p>
            {node.drainEta && node.drainEta.active_sessions > 0 && (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <DrainComposition eta={node.drainEta} tone="neutral" />
              </div>
            )}
            {node.blockers.length > 0 && (
              <p className="mt-2 text-xs leading-5 text-yellow-100/60">
                Blockers: {node.blockers.join(' ')}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-gray-600">
        UI path: /root/open/nodeboard/app/dashboard/services/page.tsx. Backend API:
        GET /api/privacy_network/vpn/overview/ exposes data.summary.restart_readiness and
        data.nodes[].system.restart_readiness from /root/aeronyx/privacy_network/api/vpn_observability.py.
        PATCH /api/privacy_network/nodes/{'{id}'}/ updates maintenance_mode through
        /root/aeronyx/privacy_network/api/nodes.py.
        POST /api/privacy_network/nodes/{'{id}'}/commands/run/ queues restart_service through
        /root/aeronyx/privacy_network/api/vpn_commands.py and
        /root/aeronyx/privacy_network/services/command_service.py.
        Rust producers: /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs,
        /root/open/AeroNyx/crates/aeronyx-server/src/services/session.rs, and
        /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs.
      </p>
      {summary?.privacy_boundary && (
        <p className="mt-2 text-xs leading-5 text-gray-600">
          Summary source {summary.source}: {summary.privacy_boundary}
        </p>
      )}
    </section>
  );
}

function RuntimeRolloutPanel({ nodes }: { nodes: RuntimeRolloutNode[] }) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  if (nodes.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.07] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-yellow-100">{t('services.rollout.controlledRestartTitle')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-yellow-100/70">
            {t('services.rollout.controlledRestartDescription')}
          </p>
        </div>
        <StatusPill status="warning" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {nodes.map((node) => (
          <div key={node.id} className="rounded-xl border border-yellow-300/10 bg-black/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Link href={`/dashboard/nodes/${node.id}`} className="font-medium text-white hover:text-purple-300">
                  {node.name}
                </Link>
                <p className="mt-1 truncate text-xs text-yellow-100/50">
                  {node.publicIp ?? t('services.placement.noPublicIp')} · {node.rollout.executable_path ?? t('services.rollout.executablePathPending')}
                </p>
              </div>
              <StatusPill status={node.healthStatus} />
            </div>
            <div className="mt-4 grid gap-2 text-xs text-yellow-100/60 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-yellow-100/35">{t('services.rollout.activeSessions')}</p>
                <p className="mt-1 text-yellow-100">{formatNumber(node.activeSessions)}</p>
              </div>
              <div>
                <p className="text-yellow-100/35">{t('services.rollout.heartbeat')}</p>
                <p className="mt-1 text-yellow-100">
                  {node.lastHeartbeat ? i18nRelativeTime(node.lastHeartbeat) : t('common.status.pending')}
                </p>
              </div>
              <div>
                <p className="text-yellow-100/35">{t('services.rollout.nextStep')}</p>
                <p className="mt-1 text-yellow-100">
                  {node.activeSessions > 0 ? t('services.rollout.drainFirst') : t('services.rollout.restartNode')}
                </p>
              </div>
              <div>
                <p className="text-yellow-100/35">{t('services.rollout.systemdState')}</p>
                <p className="mt-1 text-yellow-100">
                  {node.serviceManager
                    ? `${node.serviceManager.active_state ?? t('common.status.unknown')} / ${node.serviceManager.load_state}`
                    : t('common.status.pending')}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-yellow-100/55">{node.rollout.detail}</p>
            {node.serviceManager && (
              <p className="mt-2 text-xs leading-5 text-yellow-100/50">
                {node.serviceManager.detail}
              </p>
            )}
            <RolloutGateStrip node={node} />
            <RolloutImpactCallout node={node} />
            {node.drainEta && (
              <RuntimeDrainGatePanel eta={node.drainEta} />
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-yellow-100/45">
        Rust source: /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs reads /proc/self/exe.
        Backend path: /root/aeronyx/privacy_network/api/vpn_observability.py exposes
        data.nodes[].system.service_manager and restart_readiness.drain_eta from Rust heartbeat and ClientSession aggregates.
      </p>
    </section>
  );
}

function SessionCleanupRolloutPanel({ nodes }: { nodes: SessionCleanupRolloutNode[] }) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  if (nodes.length === 0) return null;

  const readyCount = nodes.filter((node) => node.cleanup).length;
  const pendingCount = nodes.length - readyCount;

  return (
    <section className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-emerald-100">{t('services.rollout.cleanupTitle')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100/70">
            {t('services.rollout.cleanupDescription')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill status={readyCount > 0 ? 'ok' : 'pending'} />
          {pendingCount > 0 && <StatusPill status="info" />}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {nodes.map((node) => {
          const timeoutSeconds = node.cleanup?.client_liveness_timeout_seconds ?? null;
          const pendingReason = node.restartRequired
            ? t('services.rollout.restartAfterDrain')
            : node.operatorReporting
              ? t('services.rollout.awaitRustHeartbeat')
              : t('services.rollout.operatorRolloutPending');

          return (
            <div
              key={node.id}
              className={`rounded-xl border p-4 ${
                node.cleanup
                  ? 'border-emerald-300/10 bg-black/20'
                  : 'border-sky-300/10 bg-sky-500/[0.04]'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/dashboard/nodes/${node.id}`} className="font-medium text-white hover:text-purple-300">
                    {node.name}
                  </Link>
                  <p className="mt-1 truncate text-xs text-emerald-100/50">
                    {node.publicIp ?? t('services.placement.noPublicIp')} · {node.cleanup?.source ?? pendingReason}
                  </p>
                </div>
                <StatusPill status={node.cleanup ? 'ok' : 'pending'} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-emerald-100/60">
                <div>
                  <p className="text-emerald-100/35">{t('services.rollout.cleanupWindow')}</p>
                  <p className="mt-1 text-emerald-100">
                    {timeoutSeconds ? formatDuration(timeoutSeconds) : t('common.status.pending')}
                  </p>
                </div>
                <div>
                  <p className="text-emerald-100/35">{t('services.rollout.activeSessions')}</p>
                  <p className="mt-1 text-emerald-100">{formatNumber(node.activeSessions)}</p>
                </div>
                <div>
                  <p className="text-emerald-100/35">{t('services.rollout.nextStep')}</p>
                  <p className="mt-1 text-emerald-100">
                    {node.cleanup ? t('services.rollout.monitorDrain') : pendingReason}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-5 text-emerald-100/50">
                {t('services.rollout.cleanupFooter', {
                  heartbeat: node.lastHeartbeat ? i18nRelativeTime(node.lastHeartbeat) : t('common.status.pending'),
                })}
              </p>
            </div>
          );
        })}
      </div>

    </section>
  );
}

function PendingOperatorRolloutPanel({ nodes }: { nodes: PendingOperatorNode[] }) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  if (nodes.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-sky-100">{t('services.rollout.operatorPendingTitle')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-100/70">
            {t('services.rollout.operatorPendingDescriptionPrefix')}
            <span className="font-mono"> system_stats.operator_status</span>
            {t('services.rollout.operatorPendingDescriptionSuffix')}
          </p>
        </div>
        <StatusPill status="info" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {nodes.map((node) => (
          <div key={node.id} className="rounded-xl border border-sky-300/10 bg-black/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Link href={`/dashboard/nodes/${node.id}`} className="font-medium text-white hover:text-purple-300">
                  {node.name}
                </Link>
                <p className="mt-1 truncate text-xs text-sky-100/50">
                  {node.publicIp ?? t('services.placement.noPublicIp')} · v{node.version}
                </p>
              </div>
              <StatusPill status={node.healthStatus} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-sky-100/60">
              <div>
                <p className="text-sky-100/35">{t('services.rollout.activeSessions')}</p>
                <p className="mt-1 text-sky-100">{formatNumber(node.activeSessions)}</p>
              </div>
              <div>
                <p className="text-sky-100/35">{t('services.rollout.heartbeat')}</p>
                <p className="mt-1 text-sky-100">
                  {node.lastHeartbeat ? i18nRelativeTime(node.lastHeartbeat) : t('common.status.pending')}
                </p>
              </div>
              <div>
                <p className="text-sky-100/35">{t('services.rollout.nextStep')}</p>
                <p className="mt-1 text-sky-100">
                  {node.activeSessions > 0 ? t('services.rollout.drainFirst') : t('services.rollout.restartNode')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

    </section>
  );
}

function NodeDetailCard({ node }: { node: VpnNodeHealth }) {
  const operatorStatus = nodeOperatorStatus(node);
  const services = operatorStatus?.services ?? [];
  const privacyBoundary = operatorStatus?.privacy_boundary;

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={`/dashboard/nodes/${node.id}`} className="font-semibold text-white hover:text-purple-300">
            {node.name}
          </Link>
          <p className="mt-1 truncate text-xs text-gray-500">
            {node.city || node.region_code || 'unknown region'} · {node.public_ip ?? 'no public IP'}
          </p>
        </div>
        <StatusPill status={operatorStatus?.status ?? node.health_status} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(['privacy_protocol', 'memchain', 'chat_relay', 'sovereign_data_layer'] as ServiceKey[]).map((key) => {
          const service = services.find((item) => item.key === key);
          return (
            <div key={key} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-gray-300">
                  {service?.label ?? serviceMeta[key].label}
                </p>
                <StatusPill status={service?.status ?? 'pending'} />
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
                {service?.summary ?? 'Awaiting signed Rust service snapshot'}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
        <span className="rounded-md border border-white/10 px-2 py-1">
          heartbeat {node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : 'pending'}
        </span>
        <span className="rounded-md border border-white/10 px-2 py-1">
          source {operatorStatus?.source ?? node.system?.source ?? 'pending'}
        </span>
        <span className={`rounded-md border px-2 py-1 ${
          operatorStatus?.runtime_rollout?.restart_required
            ? 'border-yellow-500/25 text-yellow-300'
            : 'border-white/10 text-gray-500'
        }`}>
          rollout {operatorStatus?.runtime_rollout?.restart_required ? 'restart required' : operatorStatus ? 'current' : 'pending'}
        </span>
        {operatorStatus?.last_reported_at && (
          <span className="rounded-md border border-white/10 px-2 py-1">
            operator {formatRelativeTime(operatorStatus.last_reported_at)}
          </span>
        )}
      </div>

      {privacyBoundary && (
        <p className="mt-3 text-xs leading-5 text-gray-600">{privacyBoundary}</p>
      )}
    </section>
  );
}

export default function NodeServicesPage() {
  const { t, formatNumber } = useI18n();
  const refreshIntervalMs = POLLING_INTERVALS.SERVICE_READINESS;
  const {
    overview,
    isLoading,
    isFetching,
    isError,
    dataUpdatedAt,
    refetch,
  } = useVpnOverview({ refetchIntervalMs: refreshIntervalMs });
  const {
    servers: placementServers,
    summary: placementSummary,
    total: placementTotal,
    available: placementAvailable,
    isLoading: isPlacementLoading,
    refetch: refetchPlacement,
  } = useVpnServers();
  const updateNode = useUpdateNode();
  const runCommand = useRunNodeCommand();
  const cancelCommand = useCancelNodeCommand();
  const [enablingMaintenanceNodeId, setEnablingMaintenanceNodeId] = useState<string | null>(null);
  const [endingMaintenanceNodeId, setEndingMaintenanceNodeId] = useState<string | null>(null);
  const [restartingNodeId, setRestartingNodeId] = useState<string | null>(null);
  const [cancellingCommandId, setCancellingCommandId] = useState<string | null>(null);
  const [operationNotice, setOperationNotice] = useState<OperationNotice | null>(null);
  const [activeDetailSection, setActiveDetailSection] = useState<ServiceDetailSection | null>(null);

  const refreshOperationalSnapshots = async () => {
    await refetch();
    await refetchPlacement();
  };

  const handleRefresh = () => {
    void refreshOperationalSnapshots();
  };

  const handleEnableMaintenance = async (nodeId: string, nodeName: string) => {
    if (!window.confirm(`Enable maintenance mode for ${nodeName}? New placement should stop while active sessions drain before restart.`)) {
      return;
    }

    setEnablingMaintenanceNodeId(nodeId);
    setOperationNotice(null);

    try {
      await updateNode.mutateAsync({
        nodeId,
        data: { maintenance_mode: true },
      });
      setOperationNotice({
        type: 'success',
        message: `${nodeName} maintenance mode enabled. Restart readiness and client placement capacity were refreshed from backend snapshots.`,
      });
      await refreshOperationalSnapshots();
    } catch (error) {
      setOperationNotice({
        type: 'error',
        message: error instanceof Error ? error.message : `Failed to enable maintenance mode for ${nodeName}.`,
      });
    } finally {
      setEnablingMaintenanceNodeId(null);
    }
  };

  const handleEndMaintenance = async (nodeId: string, nodeName: string) => {
    if (!window.confirm(`End maintenance mode for ${nodeName}? This returns the node to client placement if policy and health remain eligible.`)) {
      return;
    }

    setEndingMaintenanceNodeId(nodeId);
    setOperationNotice(null);

    try {
      await updateNode.mutateAsync({
        nodeId,
        data: { maintenance_mode: false },
      });
      setOperationNotice({
        type: 'success',
        message: `${nodeName} maintenance mode ended. Restart readiness and client placement capacity were refreshed from backend snapshots.`,
      });
      await refreshOperationalSnapshots();
    } catch (error) {
      setOperationNotice({
        type: 'error',
        message: error instanceof Error ? error.message : `Failed to end maintenance mode for ${nodeName}.`,
      });
    } finally {
      setEndingMaintenanceNodeId(null);
    }
  };

  const handleQueueRestart = async (nodeId: string, nodeName: string) => {
    if (!window.confirm(`Queue a controlled Rust restart for ${nodeName}? The backend gate reports this node is restart-ready.`)) {
      return;
    }

    setRestartingNodeId(nodeId);
    setOperationNotice(null);

    try {
      await runCommand.mutateAsync({
        nodeId,
        data: {
          action: 'restart_service',
          params: {
            confirm: 'restart',
          },
          priority: 1,
        },
      });
      setOperationNotice({
        type: 'success',
        message: `${nodeName} restart_service command queued. Watch command status on the node detail page before ending maintenance mode.`,
      });
      await refetch();
    } catch (error) {
      setOperationNotice({
        type: 'error',
        message: error instanceof Error ? error.message : `Failed to queue restart for ${nodeName}.`,
      });
    } finally {
      setRestartingNodeId(null);
    }
  };

  const handleCancelRestartCommand = async (nodeId: string, nodeName: string, commandId: string) => {
    if (!window.confirm(`Cancel the active restart_service command for ${nodeName}? Only commands that have not reached a terminal state can be cancelled.`)) {
      return;
    }

    setCancellingCommandId(commandId);
    setOperationNotice(null);

    try {
      await cancelCommand.mutateAsync({ nodeId, commandId });
      setOperationNotice({
        type: 'success',
        message: `${nodeName} restart_service command cancellation requested. The fleet overview will refresh after backend acknowledgement.`,
      });
      await refetch();
    } catch (error) {
      setOperationNotice({
        type: 'error',
        message: error instanceof Error ? error.message : `Failed to cancel restart command for ${nodeName}.`,
      });
    } finally {
      setCancellingCommandId(null);
    }
  };

  const nodes = overview?.nodes ?? [];
  const restartReadinessSummary = overview?.summary.restart_readiness ?? null;
  const operatorStatuses = useMemo(() => collectOperatorStatuses(nodes), [nodes]);
  const fleetSummary = useMemo(() => buildFleetSummary(nodes, operatorStatuses), [nodes, operatorStatuses]);
  const services = useMemo(() => buildServiceViews(nodes, operatorStatuses), [nodes, operatorStatuses]);
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const risks = useMemo(() => collectRisks(nodes), [nodes]);
  const restartReadinessNodes = useMemo(() => collectRestartReadinessNodes(nodes), [nodes]);
  const pendingOperatorNodes = useMemo(() => collectPendingOperatorNodes(nodes), [nodes]);
  const runtimeRolloutNodes = useMemo(() => collectRuntimeRolloutNodes(nodes), [nodes]);
  const sessionCleanupRolloutNodes = useMemo(() => collectSessionCleanupRolloutNodes(nodes), [nodes]);
  const latestReportedAt = useMemo(() => latestReportTime(operatorStatuses), [operatorStatuses]);
  const transportNodes = useMemo(() => collectFleetTransportNodes(nodes, t), [nodes, t]);
  const transportReadyCount = transportNodes.filter((node) => node.udpStatus === 'active').length;
  const transportAttentionCount = transportNodes.filter((node) => node.status !== 'ok').length;
  const dnsNodes = useMemo(() => collectFleetDnsNodes(nodes, t), [nodes, t]);
  const dnsHealthyCount = dnsNodes.filter((node) => node.status === 'ok').length;
  const dnsAttentionCount = dnsNodes.filter((node) => node.status !== 'ok').length;
  const capacityReportingCount = nodes.filter((node) => node.system.capacity?.reported).length;
  const capacityRiskCount = useMemo(
    () => collectFleetCapacityRisks(nodes, t, formatNumber).length,
    [nodes, t, formatNumber],
  );
  const restartAttentionCount = restartReadinessNodes.filter((node) => node.status !== 'current').length;
  const rolloutAttentionCount = (
    sessionCleanupRolloutNodes.length
    + pendingOperatorNodes.length
    + runtimeRolloutNodes.length
  );

  if (isLoading) {
    return (
      <div>
        <PageHeader
          isFetching={isFetching}
          dataUpdatedAt={dataUpdatedAt}
          refreshIntervalMs={refreshIntervalMs}
          onRefresh={handleRefresh}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-[210px] rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageHeader
          isFetching={isFetching}
          dataUpdatedAt={dataUpdatedAt}
          refreshIntervalMs={refreshIntervalMs}
          onRefresh={handleRefresh}
        />
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <h2 className="text-lg font-semibold text-red-200">{t('services.dataUnavailableTitle')}</h2>
          <p className="mt-2 text-sm text-red-100/70">
            {t('services.dataUnavailableDescription')}
          </p>
          <button
            onClick={handleRefresh}
            className="mt-4 rounded-lg border border-red-300/20 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-400/10"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        isFetching={isFetching}
        dataUpdatedAt={dataUpdatedAt}
        refreshIntervalMs={refreshIntervalMs}
        onRefresh={handleRefresh}
      />

      {operationNotice && (
        <div className={`mb-6 rounded-xl border p-4 text-sm ${
          operationNotice.type === 'success'
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
            : 'border-red-500/20 bg-red-500/10 text-red-100'
        }`}>
          {operationNotice.message}
        </div>
      )}

      <FleetSummaryGrid summary={fleetSummary} latestReportedAt={latestReportedAt} />
      <FleetCommercialOperationsPanel nodes={nodes} summary={restartReadinessSummary} />

      <DetailModulesPanel
        activeSection={activeDetailSection}
        onSelect={setActiveDetailSection}
        placementAvailable={placementAvailable}
        placementTotal={placementTotal}
        capacityReporting={capacityReportingCount}
        capacityRiskCount={capacityRiskCount}
        transportReady={transportReadyCount}
        transportTotal={transportNodes.length}
        transportAttention={transportAttentionCount}
        dnsHealthy={dnsHealthyCount}
        dnsTotal={dnsNodes.length}
        dnsAttention={dnsAttentionCount}
        restartAttention={restartAttentionCount}
        rolloutAttention={rolloutAttentionCount}
        serviceCount={operatorStatuses.length}
        riskCount={risks.length}
        nodeCount={nodes.length}
      />

      {activeDetailSection === 'placement' && (
        <PlacementCapacityPanel
          summary={placementSummary}
          servers={placementServers}
          nodesById={nodesById}
          available={placementAvailable}
          total={placementTotal}
          isLoading={isPlacementLoading}
        />
      )}

      {activeDetailSection === 'capacity' && (
        <FleetCapacityPanel nodes={nodes} />
      )}

      {activeDetailSection === 'transport' && (
        <FleetTransportPanel nodes={nodes} />
      )}

      {activeDetailSection === 'dns' && (
        <FleetDnsPanel nodes={nodes} />
      )}

      {activeDetailSection === 'restart' && (
        <>
          <FleetRestartReadinessPanel
            nodes={restartReadinessNodes}
            summary={restartReadinessSummary}
            enablingMaintenanceNodeId={enablingMaintenanceNodeId}
            endingMaintenanceNodeId={endingMaintenanceNodeId}
            restartingNodeId={restartingNodeId}
            cancellingCommandId={cancellingCommandId}
            onEnableMaintenance={handleEnableMaintenance}
            onEndMaintenance={handleEndMaintenance}
            onQueueRestart={handleQueueRestart}
            onCancelRestartCommand={handleCancelRestartCommand}
          />
          <SessionCleanupRolloutPanel nodes={sessionCleanupRolloutNodes} />
          <PendingOperatorRolloutPanel nodes={pendingOperatorNodes} />
          <RuntimeRolloutPanel nodes={runtimeRolloutNodes} />
        </>
      )}

      {activeDetailSection === 'layers' && (
        <>
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{t('services.operatorSignal.title')}</h2>
                <p className="mt-1 text-sm text-gray-400">
                  {operatorStatuses.length > 0
                    ? t('services.operatorSignal.reporting', { count: operatorStatuses.length })
                    : t('services.operatorSignal.waiting')}
                </p>
              </div>
              <StatusPill status={operatorStatuses.length > 0 ? 'ok' : 'pending'} />
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <ServiceCard key={service.key} service={service} />
            ))}
          </div>
        </>
      )}

      {activeDetailSection === 'risks' && (
        <div className={`mb-6 rounded-2xl border p-5 ${
          risks.length > 0
            ? 'border-yellow-500/20 bg-yellow-500/10'
            : 'border-white/10 bg-white/[0.04]'
        }`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className={`text-lg font-semibold ${risks.length > 0 ? 'text-yellow-100' : 'text-white'}`}>
                {t('services.risks.title')}
              </h2>
              <p className={`mt-1 text-sm ${risks.length > 0 ? 'text-yellow-100/65' : 'text-gray-400'}`}>
                {risks.length > 0
                  ? t('services.risks.summary', { count: risks.length })
                  : t('services.risks.empty')}
              </p>
            </div>
            <StatusPill status={risks.length > 0 ? 'warning' : 'ok'} />
          </div>
          {risks.length > 0 && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {risks.map((risk, index) => (
                <div key={`${risk.code}-${index}`} className="rounded-xl border border-yellow-300/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-yellow-100">
                      {risk.nodeName}: {risk.message}
                    </p>
                    <StatusPill status={risk.severity} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-yellow-100/70">{risk.remediation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeDetailSection === 'nodes' && (
        <>
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">{t('services.nodeReadiness.title')}</h2>
              <p className="mt-1 text-sm text-gray-400">
                {t('services.nodeReadiness.description')}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.12em] text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('services.nodeReadiness.node')}</th>
                    <th className="px-4 py-3 font-medium">{t('services.nodeReadiness.privacy')}</th>
                    <th className="px-4 py-3 font-medium">MemChain</th>
                    <th className="px-4 py-3 font-medium">ChatRelay</th>
                    <th className="px-4 py-3 font-medium">{t('services.nodeReadiness.dataLayer')}</th>
                    <th className="px-4 py-3 font-medium">{t('services.nodeReadiness.operator')}</th>
                    <th className="px-4 py-3 font-medium">{t('services.nodeReadiness.rollout')}</th>
                    <th className="px-4 py-3 font-medium">{t('services.nodeReadiness.heartbeat')}</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.length > 0 ? (
                    nodes.map((node) => <NodeReadinessRow key={node.id} node={node} />)
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                        {t('services.nodeReadiness.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {nodes.length > 0 && (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {nodes.map((node) => (
                <NodeDetailCard key={node.id} node={node} />
              ))}
            </div>
          )}
        </>
      )}

      {!activeDetailSection && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{t('services.detailModules.collapsedTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-gray-400">
                {t('services.detailModules.collapsedDescription')}
              </p>
            </div>
            <StatusPill status="info" />
          </div>
        </section>
      )}
    </div>
  );
}
