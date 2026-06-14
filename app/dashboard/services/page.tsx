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
 * Backend APIs used on this page:
 *   - GET /api/privacy_network/vpn/overview/
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Provides data.nodes[].checks from Rust /api/vpn/health so Services can
 *     explain placement blockers such as dns_stub and dns_query failures.
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
 *     before operators queue fleet actions. problem_nodes is a capped triage
 *     list for delivery blockers and links operators to node detail.
 *   - data.summary.restart_readiness.policy_sync_health
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Aggregates data.nodes[].system.policy_sync so Services can verify
 *     max_sessions and bandwidth_limit_mbps changes have reached Rust
 *     node_policy before operators trust commercial capacity limits.
 *   - data.summary.restart_readiness.policy_enforcement_health
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Aggregates data.nodes[].system.policy_enforcement so Services can show
 *     whether maintenance, max_sessions, or bandwidth policy is actively
 *     blocking handshakes or packets in Rust node_policy.
 *   - data.summary.restart_readiness.blocked_nodes[].drain_activity
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Mirrors node-level drain_eta activity buckets for fleet triage without
 *     exposing client IPs, wallets, destinations, DNS, payloads, or browsing.
 *     Includes keepalive_missed_sessions / keepalive_pending_sessions so large
 *     counters can be interpreted as affected-session counts.
 *     Includes activity_health from backend commercial triage rules.
 *   - data.summary.restart_readiness.drain_activity_health_counts
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Powers the top-level Drain Risk card in the restart readiness panel.
 *     summary is backend-authored copy and next_step so nodeboard does not
 *     reimplement fleet drain risk business rules.
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
 *     Includes node placement metadata public_ip / region_code / city /
 *     version so operators understand which commercial entry point returns
 *     to client placement before ending maintenance mode.
 *     Candidate selection is sourced from
 *     data.nodes[].system.restart_readiness.operator_action_plan.recommended_actions
 *     key=end_maintenance so Services and node detail share one backend
 *     action policy.
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
 * Last Modified: v1.1.41 - Show runtime rollout drain ETA
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
import {
  NodeOperatorStatus,
  OperatorRisk,
  OperatorServiceStatus,
  RuntimeRolloutStatus,
  VpnNodeHealth,
  VpnRestartCommandState,
  VpnRestartDrainEta,
  VpnRestartReadiness,
  VpnRestartReadinessSummary,
  VpnServiceManagerStatus,
  VpnServerCandidate,
  VpnServerPlacementSummary,
  VpnSessionCleanupStatus,
} from '@/types';

type ServiceKey =
  | 'privacy_protocol'
  | 'memchain'
  | 'chat_relay'
  | 'sovereign_data_layer'
  | 'supernode';

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
  healthStatus: string;
  lastHeartbeat: string | null;
  rollout: RuntimeRolloutStatus;
  serviceManager: VpnServiceManagerStatus | null;
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

type RestartActionQueueKey = 'stale' | 'retry' | 'critical' | 'warning' | 'ready' | 'current';
type RestartQueueStatusFilter = 'all' | 'attention' | 'stale' | 'retry' | 'blocked' | 'ready' | 'current';

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
  source: 'backend_blocked_node' | 'backend_readiness_node';
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
      healthStatus: node.health_status,
      lastHeartbeat: node.last_heartbeat,
      rollout,
      serviceManager: node.system.service_manager ?? null,
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

function formatPlacementCapacity(capacity: number, unlimitedNodes: number) {
  if (unlimitedNodes > 0 && capacity > 0) return `${capacity.toLocaleString()} slots + ${unlimitedNodes.toLocaleString()} unlimited`;
  if (unlimitedNodes > 0) return `${unlimitedNodes.toLocaleString()} unlimited`;
  return `${capacity.toLocaleString()} slots`;
}

function formatPlacementReason(reason: string | null | undefined) {
  if (!reason) return 'clear';
  return reason.replaceAll('_', ' ');
}

function topPlacementReason(reasons: Record<string, number>) {
  const [reason, count] = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0] || [];
  return reason ? `${formatPlacementReason(reason)} ${count.toLocaleString()}` : 'clear';
}

function placementBlockerAction(reason: string | null) {
  const copy: Record<string, string> = {
    maintenance_mode: 'End maintenance after active sessions drain and restart work is complete.',
    max_sessions_reached: 'Raise max_sessions or wait for sessions to complete.',
    vpn_health_degraded: 'Open node health and inspect Rust VPN checks before returning to placement.',
    vpn_health_failed: 'Inspect Rust VPN health before exposing the node to clients.',
    low_24h_availability: 'Review heartbeat availability before using this node for failover.',
    overloaded: 'Reduce load or increase capacity before routing new sessions.',
    heartbeat_stale: 'Restore fresh Rust heartbeats before exposing this node to clients.',
  };

  return copy[reason || ''] ?? 'Open node detail and review backend placement policy inputs.';
}

function placementSessionCopy(server: VpnServerCandidate) {
  const sessions = server.current_sessions.toLocaleString();
  if (server.max_sessions > 0) {
    return `${sessions}/${server.max_sessions.toLocaleString()} sessions`;
  }
  return `${sessions} sessions, unlimited cap`;
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

function formatBlockedDrainActivity(node: VpnRestartReadinessSummary['blocked_nodes'][number]) {
  const activity = node.drain_activity;
  if (!activity) return null;
  const windowLabel = formatDuration(activity.activity_window_seconds || 180);
  const keepaliveIssueSessions = Math.max(
    activity.keepalive_missed_sessions ?? 0,
    activity.keepalive_pending_sessions ?? 0,
  );
  return [
    `${activity.recent_activity_sessions.toLocaleString()} recent/${windowLabel}`,
    `${activity.idle_activity_sessions.toLocaleString()} idle`,
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
    problemNodes: delivery.problem_nodes ?? [],
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
    if (filters.status === 'blocked') return item.source === 'backend_blocked_node';
    if (filters.status === 'ready') return item.canQueueRestart;
    if (filters.status === 'current') return item.status === 'current';
    if (filters.status === 'attention') {
      return item.source === 'backend_blocked_node'
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
): RestartActionQueue[] {
  const readinessById = new Map(nodes.map((node) => [node.id, node]));
  const filteredNodeIds = new Set(nodes.map((node) => node.id));
  const blockedItems = (summary?.blocked_nodes ?? [])
    .filter((node) => filteredNodeIds.has(node.id))
    .map((node) => buildBlockedRestartQueueItem(node, readinessById.get(node.id)));
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
  const filteredStaleCommandItems = filterRestartQueueItems(staleCommandItems, filters);
  const filteredCommandClosureItems = filterRestartQueueItems(commandClosureItems, filters);
  const filteredReadyItems = filterRestartQueueItems(readyItems, filters);
  const filteredCurrentItems = filterRestartQueueItems(currentItems, filters);
  const filteredDrainBlockedItems = filteredBlockedItems.filter(
    (item) => !restartCommandIsStale(item.activeRestartCommand),
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
      label: 'Stale Command',
      description: 'Active restart command exceeded backend SLA and needs inspection.',
      status: filteredStaleCommandItems.length > 0 ? 'critical' : 'healthy',
      emptyState: 'No stale active restart command.',
      items: sortRestartQueueItems(filteredStaleCommandItems),
    },
    {
      key: 'retry',
      label: 'Retry Needed',
      description: 'Latest restart command failed, timed out, or needs manual closure.',
      status: filteredCommandClosureItems.length > 0 ? 'critical' : 'healthy',
      emptyState: 'No failed restart command outcome.',
      items: sortRestartQueueItems(filteredCommandClosureItems),
    },
    {
      key: 'critical',
      label: 'Critical Drain',
      description: 'Handle first. Backend activity_health marked these blocked nodes as critical.',
      status: criticalItems.length > 0 ? 'critical' : 'healthy',
      emptyState: 'No critical drain risk.',
      items: criticalItems,
    },
    {
      key: 'warning',
      label: 'Warning Drain',
      description: 'Review before restart. These blocked nodes still need drain or signal work.',
      status: warningItems.length > 0 ? 'warning' : 'healthy',
      emptyState: 'No warning drain items.',
      items: warningItems,
    },
    {
      key: 'ready',
      label: 'Ready to Restart',
      description: 'Maintenance is on, active sessions are drained, and backend gate allows restart.',
      status: readyItems.length > 0 ? 'ready' : 'pending',
      emptyState: 'No node is restart-ready right now.',
      items: sortRestartQueueItems(filteredReadyItems),
    },
    {
      key: 'current',
      label: 'Current',
      description: 'Healthy baseline sample. These nodes do not need rollout action.',
      status: 'current',
      emptyState: 'No current nodes reported in this owner scope.',
      items: sortRestartQueueItems(filteredCurrentItems).slice(0, 4),
    },
  ];
}

function StatusPill({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(normalized)}`}>
      {normalized.replaceAll('_', ' ')}
    </span>
  );
}

function PageHeader({
  isFetching,
  dataUpdatedAt,
  refreshIntervalMs,
  onRefresh,
}: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-300">
          Node Operator Console
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">AeroNyx Service Readiness</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
          Privacy Protocol transport, MemChain memory, encrypted relay, sovereign data RPC,
          and SuperNode worker status from signed Rust heartbeats.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-200">
            Live refresh {formatRefreshInterval(refreshIntervalMs)}
          </span>
          <span className="rounded-md border border-white/10 px-2 py-1">
            {isFetching ? 'updating backend overview' : formatDataUpdatedAt(dataUpdatedAt)}
          </span>
          <span className="rounded-md border border-white/10 px-2 py-1">
            API GET /api/privacy_network/vpn/overview/
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
          {isFetching ? 'Refreshing' : 'Refresh now'}
        </button>
        <Link
          href="/dashboard/nodes"
          className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/5"
        >
          Manage nodes
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
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <SummaryTile
        label="Reporting Nodes"
        value={`${summary.reportingNodes}/${summary.totalNodes}`}
        detail={latestReportedAt ? `Latest operator heartbeat ${formatRelativeTime(latestReportedAt)}` : 'Waiting for Rust operator heartbeat'}
        status={summary.reportingNodes > 0 ? 'ok' : 'pending'}
      />
      <SummaryTile
        label="Privacy Ready"
        value={summary.healthyPrivacyNodes.toLocaleString()}
        detail="AeroNyx Privacy Protocol nodes with healthy tunnel checks."
        status={summary.healthyPrivacyNodes > 0 ? 'ok' : 'attention'}
      />
      <SummaryTile
        label="Enabled Services"
        value={`${summary.enabledServices}/${summary.totalServiceSlots || 0}`}
        detail="Service slots enabled across reporting nodes."
        status={summary.enabledServices > 0 ? 'ok' : 'pending'}
      />
      <SummaryTile
        label="Needs Attention"
        value={summary.attentionNodes.toLocaleString()}
        detail="Nodes reporting degraded, failed, or attention status."
        status={summary.attentionNodes > 0 ? 'attention' : 'ok'}
      />
      <SummaryTile
        label="Rollout Restarts"
        value={summary.rolloutRestartRequired.toLocaleString()}
        detail="Rust processes running a replaced binary and waiting for controlled restart."
        status={summary.rolloutRestartRequired > 0 ? 'warning' : 'ok'}
      />
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceView }) {
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
          <p className="text-xs text-gray-500">Enabled nodes</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {service.enabledCount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Observed nodes</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {service.totalCount.toLocaleString()}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-400">
          reporting {service.reportingCount.toLocaleString()}
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
          <h2 className="text-lg font-semibold text-white">Client Placement Capacity</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Commercial capacity from the same backend failover policy used by VPN clients. Unavailable nodes hide addresses from clients before placement.
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Available Nodes</p>
          <p className="mt-2 text-2xl font-semibold text-white">{available.toLocaleString()} / {total.toLocaleString()}</p>
          <p className="mt-1 text-xs text-gray-500">{unavailable.toLocaleString()} unavailable</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Capacity Remaining</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {summary ? formatPlacementCapacity(summary.available_capacity_remaining, summary.unlimited_capacity_nodes) : 'pending'}
          </p>
          <p className="mt-1 text-xs text-gray-500">capped slots + unlimited nodes</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Top Blocker</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {summary ? topPlacementReason(summary.unavailable_reasons) : 'pending'}
          </p>
          <p className="mt-1 text-xs text-gray-500">from backend placement policy</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Updated</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {summary?.generated_at ? formatRelativeTime(summary.generated_at) : 'pending'}
          </p>
          <p className="mt-1 text-xs text-gray-500">GET /api/privacy_network/vpn/servers/</p>
        </div>
      </div>

      {summary && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Region Capacity</h3>
              <Link href="/dashboard/nodes" className="text-xs text-purple-300 hover:text-purple-200">
                Manage nodes
              </Link>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {regions.map((region) => (
                <div key={region.key} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-gray-200">
                      {region.flag ? `${region.flag} ` : ''}{region.label}
                    </span>
                    <span className="text-emerald-300">{region.available}/{region.total}</span>
                  </div>
                  <p className="mt-1 text-gray-500">
                    {formatPlacementCapacity(region.capacity_remaining, region.unlimited_capacity_nodes)}
                  </p>
                  <p className="mt-1 text-gray-600">
                    {region.unavailable > 0 ? topPlacementReason(region.unavailable_reasons) : 'all candidates clear'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h3 className="text-sm font-semibold text-white">Tier Capacity</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {tiers.map((tier) => (
                <div key={tier.key} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-gray-200">{tier.tier || tier.label}</span>
                    <span className="text-emerald-300">{tier.available}/{tier.total}</span>
                  </div>
                  <p className="mt-1 text-gray-500">
                    {formatPlacementCapacity(tier.capacity_remaining, tier.unlimited_capacity_nodes)}
                  </p>
                  <p className="mt-1 text-gray-600">
                    {tier.average_load === null ? 'load pending' : `${tier.average_load}% avg load`}
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
              <h3 className="text-sm font-semibold text-yellow-100">Placement Blockers</h3>
              <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                Nodes hidden from client placement by backend policy. Address is intentionally null while blocked.
              </p>
            </div>
            <Link href="/dashboard/nodes" className="text-xs text-yellow-100/80 hover:text-yellow-100">
              Manage nodes
            </Link>
          </div>
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
                          {server.city || server.region_code || server.country_name || 'unknown region'} · {placementSessionCopy(server)}
                        </p>
                      </div>
                      <StatusPill status={server.health_status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="rounded-md border border-white/10 px-2 py-1">
                        {formatPlacementReason(server.unavailable_reason)}
                      </span>
                      <span className="rounded-md border border-white/10 px-2 py-1">
                        load {server.load === null ? 'pending' : `${server.load}%`}
                      </span>
                      <span className="rounded-md border border-white/10 px-2 py-1">
                        rank {server.failover_rank ?? 'pending'}
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
                      {placementBlockerAction(server.unavailable_reason)}
                    </p>
                  </Link>
                );
              })()
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-gray-600">
        Backend contract: GET /api/privacy_network/vpn/servers/ from
        /root/aeronyx/privacy_network/api/vpn_servers.py. {summary?.privacy_note ?? 'Placement summary is owner-scoped operational metadata only.'}
      </p>
    </section>
  );
}

function NodeReadinessRow({ node }: { node: VpnNodeHealth }) {
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
            {node.city || node.region_code || 'unknown region'} · {node.public_ip ?? 'no public IP'}
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
        {node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : 'pending'}
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
  const commandLifecycle = fleetCommandLifecycle(summary);
  const commandDelivery = fleetCommandDelivery(summary);
  const commandOutcome = fleetCommandOutcome(summary);
  const commandCounts = summary?.command_lifecycle_counts ?? null;
  const commandHistory = commandCounts?.history_24h ?? null;
  const policySyncHealth = summary?.policy_sync_health ?? null;
  const policyEnforcementHealth = summary?.policy_enforcement_health ?? null;
  const maintenanceExitCandidates = summary?.maintenance_exit_candidates ?? [];
  const maintenanceExitCandidateCount = summary?.maintenance_exit_candidate_count ?? maintenanceExitCandidates.length;
  const commandCancelability = {
    cancelable: commandCounts?.cancelable_active ?? 0,
    locked: commandCounts?.non_cancelable_active ?? 0,
  };
  const filterOptions = useMemo(() => restartQueueFilterOptions(nodes), [nodes]);
  const actionQueues = useMemo(
    () => buildRestartActionQueues(summary, nodes, queueFilters),
    [summary, nodes, queueFilters],
  );
  const queueItemCount = actionQueues.reduce((sum, queue) => sum + queue.items.length, 0);

  if (nodes.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Fleet Restart Readiness</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Commercial restart gate for staged Rust rollouts from the backend overview API. A node is
            restart-ready only when it needs rollout attention, maintenance mode is enabled, and active
            sessions have drained to zero.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill status={readyCount > 0 ? 'ready' : 'pending'} />
          {blockedCount > 0 && <StatusPill status="blocked" />}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Ready Now</p>
          <p className="mt-2 text-2xl font-semibold text-white">{readyCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Blocked</p>
          <p className="mt-2 text-2xl font-semibold text-white">{blockedCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Pending Signal</p>
          <p className="mt-2 text-2xl font-semibold text-white">{pendingCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Sessions Blocking</p>
          <p className="mt-2 text-2xl font-semibold text-white">{totalActiveSessions.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(drainRisk.risk)}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">Drain Risk</p>
          <p className="mt-2 text-2xl font-semibold">{drainRisk.count.toLocaleString()}</p>
          <p className="mt-1 text-xs opacity-70">{drainRisk.label} · {drainRisk.detail}</p>
          {drainRisk.next_step && (
            <p className="mt-2 text-xs leading-5 opacity-80">{drainRisk.next_step}</p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(commandDelivery.risk)}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">Command Delivery</p>
          <p className="mt-2 text-2xl font-semibold">{commandDelivery.count.toLocaleString()}</p>
          <p className="mt-1 text-xs opacity-70">{commandDelivery.label} · {commandDelivery.detail}</p>
          {commandDelivery.attention > 0 && (
            <p className="mt-2 text-xs leading-5 opacity-80">
              Attention {commandDelivery.attention.toLocaleString()} · Ready {commandDelivery.ready.toLocaleString()}
            </p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(commandLifecycle.risk)}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">Command SLA</p>
          <p className="mt-2 text-2xl font-semibold">{commandLifecycle.count.toLocaleString()}</p>
          <p className="mt-1 text-xs opacity-70">{commandLifecycle.label} · {commandLifecycle.detail}</p>
          {(commandCancelability.cancelable > 0 || commandCancelability.locked > 0) && (
            <p className="mt-2 text-xs leading-5 opacity-80">
              Cancelable {commandCancelability.cancelable.toLocaleString()} · Locked{' '}
              {commandCancelability.locked.toLocaleString()}
            </p>
          )}
          {commandLifecycle.next_step && (
            <p className="mt-2 text-xs leading-5 opacity-80">{commandLifecycle.next_step}</p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(policySyncHealth?.risk ?? 'info')}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">Policy Sync</p>
          <p className="mt-2 text-2xl font-semibold">
            {(policySyncHealth?.attention_nodes ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs opacity-70">
            {policySyncHealth?.label ?? 'Pending'} · {policySyncHealth?.detail ?? 'waiting for backend policy sync summary'}
          </p>
          <p className="mt-2 text-xs leading-5 opacity-80">
            Synced {(policySyncHealth?.synced_nodes ?? 0).toLocaleString()} / {(policySyncHealth?.total_nodes ?? 0).toLocaleString()}
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${drainActivityHealthClass(policyEnforcementHealth?.risk ?? 'info')}`}>
          <p className="text-xs uppercase tracking-[0.16em] opacity-70">Policy Blocks</p>
          <p className="mt-2 text-2xl font-semibold">
            {(policyEnforcementHealth?.total_blocks ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs opacity-70">
            {policyEnforcementHealth?.label ?? 'Pending'} · {policyEnforcementHealth?.detail ?? 'waiting for backend policy enforcement summary'}
          </p>
          <p className="mt-2 text-xs leading-5 opacity-80">
            Max sessions {(policyEnforcementHealth?.max_sessions_rejections ?? 0).toLocaleString()} ·
            bandwidth {(policyEnforcementHealth?.bandwidth_drops ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      {policyEnforcementHealth?.problem_nodes?.length ? (
        <div className="mt-4 rounded-xl border border-yellow-300/20 bg-yellow-500/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-yellow-100">Policy Blocks</h3>
              <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                Rust node_policy is actively blocking handshakes or packets. Confirm whether this is expected protection or a commercial capacity shortage.
              </p>
            </div>
            <StatusPill status={policyEnforcementHealth.risk} />
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {policyEnforcementHealth.problem_nodes.map((node) => (
              <div key={node.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/nodes/${node.id}`} className="min-w-0 truncate font-medium text-white hover:text-purple-300">
                    {node.name}
                  </Link>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 ${statusClass(node.severity)}`}>
                    {node.severity}
                  </span>
                </div>
                <p className="mt-2 leading-5 text-yellow-100/60">
                  Total {node.total_blocks.toLocaleString()} · maintenance {node.maintenance_rejections.toLocaleString()} ·
                  max sessions {node.max_sessions_rejections.toLocaleString()} · bandwidth {node.bandwidth_drops.toLocaleString()}
                </p>
                <p className="mt-1 leading-5 text-yellow-100/50">
                  Last reason {node.last_rejection_reason ?? 'policy_enforced'} ·
                  heartbeat {typeof node.last_seen_seconds === 'number' ? `${formatDuration(node.last_seen_seconds)} ago` : 'pending'}
                </p>
                <p className="mt-1 leading-5 text-yellow-100/50">{node.next_step}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-yellow-100/45">
            Backend contract: GET /api/privacy_network/vpn/overview/ exposes
            data.summary.restart_readiness.policy_enforcement_health from /root/aeronyx/privacy_network/api/vpn_observability.py.
            Rust source: /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs and
            /root/open/AeroNyx/crates/aeronyx-server/src/handlers/packet.rs.
          </p>
        </div>
      ) : null}

      {policySyncHealth?.problem_nodes?.length ? (
        <div className="mt-4 rounded-xl border border-yellow-300/20 bg-yellow-500/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-yellow-100">Policy Sync Attention</h3>
              <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                Backend found capacity policy that Rust has not confirmed yet. Wait for signed heartbeat before trusting new max_sessions or bandwidth limits.
              </p>
            </div>
            <StatusPill status={policySyncHealth.risk} />
          </div>
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
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-yellow-100/45">
            Backend contract: GET /api/privacy_network/vpn/overview/ exposes
            data.summary.restart_readiness.policy_sync_health from /root/aeronyx/privacy_network/api/vpn_observability.py.
            Rust source: /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs.
          </p>
        </div>
      ) : null}

      {commandDelivery.problemNodes.length > 0 && (
        <div className="mt-4 rounded-xl border border-yellow-300/20 bg-yellow-500/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-yellow-100">Command Delivery Issues</h3>
              <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                Nodes below need fresh Rust heartbeat and operator reporting before restart commands are reliable.
              </p>
            </div>
            <StatusPill status={commandDelivery.risk} />
          </div>
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
              </div>
            ))}
          </div>
        </div>
      )}

      {maintenanceExitCandidateCount > 0 && (
        <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-emerald-100">Maintenance Exit Candidates</h3>
              <p className="mt-1 text-xs leading-5 text-emerald-100/60">
                Backend found current, drained nodes still in maintenance mode. Ending maintenance restores client placement capacity.
              </p>
            </div>
            <StatusPill status="ready" />
          </div>
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
              Showing {maintenanceExitCandidates.length.toLocaleString()} of {maintenanceExitCandidateCount.toLocaleString()} candidates.
            </p>
          )}
        </div>
      )}

      <div className={`mt-4 rounded-xl border p-4 ${drainActivityHealthClass(commandOutcome.risk)}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Restart Outcome Audit</h3>
            <p className="mt-1 text-xs leading-5 opacity-70">
              Latest per-node restart_service terminal outcomes from backend lifecycle metadata.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill status={commandOutcome.risk} />
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs opacity-80">
              {commandOutcome.count.toLocaleString()} item{commandOutcome.count === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Completed', commandCounts?.completed ?? 0],
            ['Failed', commandCounts?.failed ?? 0],
            ['Timed out', commandCounts?.timeout ?? 0],
            ['Cancelled', commandCounts?.cancelled ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.14em] opacity-60">{label}</p>
              <p className="mt-1 text-lg font-semibold">{Number(value).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] opacity-60">24h Reliability</p>
              <p className="mt-1 text-xs leading-5 opacity-70">
                Aggregate restart_service lifecycle timing from backend command history.
              </p>
            </div>
            {commandHistory?.summary && <StatusPill status={commandHistory.summary.risk} />}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Commands', (commandHistory?.total ?? 0).toLocaleString()],
              ['Success', formatOptionalPercent(commandHistory?.success_rate_percent)],
              ['Delivery', formatOptionalPercent(commandHistory?.delivery_rate_percent)],
              ['Rust ACK', formatOptionalPercent(commandHistory?.ack_rate_percent)],
              ['Avg complete', formatOptionalDuration(commandHistory?.average_completion_seconds)],
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
            <h3 className="text-sm font-semibold text-white">Restart Action Queue</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Prioritized from data.summary.restart_readiness.blocked_nodes and
              data.nodes[].system.restart_readiness.
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Showing {queueItemCount.toLocaleString()} item{queueItemCount === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={queueFilters.region}
              onChange={(event) => setQueueFilters((current) => ({ ...current, region: event.target.value }))}
              className="h-9 rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-gray-200 outline-none transition hover:border-white/20 focus:border-emerald-400/40"
              aria-label="Restart queue region filter"
            >
              <option value="all">All regions</option>
              {filterOptions.regions.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
            <select
              value={queueFilters.version}
              onChange={(event) => setQueueFilters((current) => ({ ...current, version: event.target.value }))}
              className="h-9 rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-gray-200 outline-none transition hover:border-white/20 focus:border-emerald-400/40"
              aria-label="Restart queue version filter"
            >
              <option value="all">All versions</option>
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
              aria-label="Restart queue status filter"
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
                              Open
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
                              Cancel unavailable: {cancelUnavailableReason}
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
                            {isEnablingMaintenance ? 'Enabling...' : 'Enable maintenance'}
                          </button>
                        )}
                        {item.canQueueRestart && (
                          <button
                            type="button"
                            onClick={() => onQueueRestart(item.id, item.name)}
                            disabled={Boolean(restartingNodeId)}
                            className="inline-flex items-center justify-center rounded-md border border-emerald-300/20 px-2.5 py-1 font-medium text-emerald-100 transition hover:border-emerald-200/40 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isRestarting ? 'Queueing...' : 'Queue restart'}
                          </button>
                        )}
                        {cancellableRestartCommand && (
                          <button
                            type="button"
                            onClick={() => onCancelRestartCommand(item.id, item.name, cancellableRestartCommand.id)}
                            disabled={Boolean(cancellingCommandId)}
                            className="inline-flex items-center justify-center rounded-md border border-red-300/20 px-2.5 py-1 font-medium text-red-100 transition hover:border-red-200/40 hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isCancellingCommand ? 'Cancelling...' : 'Cancel command'}
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
                        {cancellingCommandId === node.activeRestartCommand.id ? 'Cancelling...' : 'Cancel command'}
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
                    {enablingMaintenanceNodeId === node.id ? 'Enabling...' : 'Enable maintenance'}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400 lg:grid-cols-4">
              <div>
                <p className="text-gray-600">Active Sessions</p>
                <p className="mt-1 text-gray-200">{node.activeSessions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Operator Signal</p>
                <p className="mt-1 text-gray-200">{node.operatorReporting ? 'reported' : 'pending'}</p>
              </div>
              <div>
                <p className="text-gray-600">Next Step</p>
                <p className="mt-1 text-gray-200">{node.nextStep}</p>
              </div>
              <div>
                <p className="text-gray-600">Drain ETA</p>
                <p className="mt-1 text-gray-200">{formatDrainEta(node.drainEta)}</p>
                {node.drainEta?.next_step && (
                  <p className="mt-1 text-[11px] text-gray-600">
                    {node.drainEta.next_step}
                  </p>
                )}
                {node.drainEta?.latest_activity_at && (
                  <p className="mt-1 text-[11px] text-gray-600">
                    activity {formatRelativeTime(node.drainEta.latest_activity_at)}
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
  if (nodes.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.07] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-yellow-100">Controlled Restart Required</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-yellow-100/70">
            These Rust nodes are running an executable that was replaced on disk. Drain active sessions,
            keep maintenance mode on, then restart the node so the staged binary takes effect.
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
                  {node.publicIp ?? 'no public IP'} · {node.rollout.executable_path ?? 'executable path pending'}
                </p>
              </div>
              <StatusPill status={node.healthStatus} />
            </div>
            <div className="mt-4 grid gap-2 text-xs text-yellow-100/60 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-yellow-100/35">Active Sessions</p>
                <p className="mt-1 text-yellow-100">{node.activeSessions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-yellow-100/35">Heartbeat</p>
                <p className="mt-1 text-yellow-100">
                  {node.lastHeartbeat ? formatRelativeTime(node.lastHeartbeat) : 'pending'}
                </p>
              </div>
              <div>
                <p className="text-yellow-100/35">Next Step</p>
                <p className="mt-1 text-yellow-100">
                  {node.activeSessions > 0 ? 'drain first' : 'restart node'}
                </p>
              </div>
              <div>
                <p className="text-yellow-100/35">Systemd State</p>
                <p className="mt-1 text-yellow-100">
                  {node.serviceManager
                    ? `${node.serviceManager.active_state ?? 'unknown'} / ${node.serviceManager.load_state}`
                    : 'pending'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-yellow-100/55">{node.rollout.detail}</p>
            {node.serviceManager && (
              <p className="mt-2 text-xs leading-5 text-yellow-100/50">
                {node.serviceManager.detail}
              </p>
            )}
            {node.drainEta && (
              <div className="mt-3 rounded-lg border border-yellow-200/10 bg-yellow-200/[0.04] p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-yellow-100/45">Drain ETA</p>
                    <p className="mt-1 text-sm text-yellow-100">{node.drainEta.next_step}</p>
                  </div>
                  <StatusPill status={node.drainEta.activity_health?.risk ?? node.drainEta.status} />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-yellow-100/60 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-yellow-100/35">Status</p>
                    <p className="mt-1 text-yellow-100">{node.drainEta.status.replaceAll('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-yellow-100/35">Remaining</p>
                    <p className="mt-1 text-yellow-100">
                      {node.drainEta.estimated_seconds_remaining === null
                        ? 'pending'
                        : formatDuration(node.drainEta.estimated_seconds_remaining)}
                    </p>
                  </div>
                  <div>
                    <p className="text-yellow-100/35">Activity</p>
                    <p className="mt-1 text-yellow-100">
                      {(node.drainEta.recent_activity_sessions ?? 0).toLocaleString()} recent · {(node.drainEta.idle_activity_sessions ?? 0).toLocaleString()} idle
                    </p>
                  </div>
                  <div>
                    <p className="text-yellow-100/35">Keepalive Issues</p>
                    <p className="mt-1 text-yellow-100">
                      {(node.drainEta.keepalive_missed_sessions ?? 0).toLocaleString()} missed · {(node.drainEta.keepalive_pending_sessions ?? 0).toLocaleString()} pending
                    </p>
                  </div>
                </div>
                {node.drainEta.activity_health && (
                  <p className="mt-2 text-xs leading-5 text-yellow-100/50">
                    {node.drainEta.activity_health.label}: {node.drainEta.activity_health.detail}
                  </p>
                )}
              </div>
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
  if (nodes.length === 0) return null;

  const readyCount = nodes.filter((node) => node.cleanup).length;
  const pendingCount = nodes.length - readyCount;

  return (
    <section className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-emerald-100">Session Cleanup Rollout</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100/70">
            Fleet view of the Rust drain-cleanup policy used by Maintenance Drain. Nodes reporting this field
            can explain how stale client tunnels are expired before a controlled restart.
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
            ? 'restart after drain'
            : node.operatorReporting
              ? 'await next Rust heartbeat'
              : 'operator rollout pending';

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
                    {node.publicIp ?? 'no public IP'} · {node.cleanup?.source ?? pendingReason}
                  </p>
                </div>
                <StatusPill status={node.cleanup ? 'ok' : 'pending'} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-emerald-100/60">
                <div>
                  <p className="text-emerald-100/35">Cleanup Window</p>
                  <p className="mt-1 text-emerald-100">
                    {timeoutSeconds ? formatDuration(timeoutSeconds) : 'pending'}
                  </p>
                </div>
                <div>
                  <p className="text-emerald-100/35">Active Sessions</p>
                  <p className="mt-1 text-emerald-100">{node.activeSessions.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-emerald-100/35">Next Step</p>
                  <p className="mt-1 text-emerald-100">
                    {node.cleanup ? 'monitor drain' : pendingReason}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-5 text-emerald-100/50">
                Heartbeat {node.lastHeartbeat ? formatRelativeTime(node.lastHeartbeat) : 'pending'} ·
                privacy boundary: cleanup policy metadata only, no payloads, DNS contents, destinations, or wallet-level traffic.
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-emerald-100/45">
        Backend contract: GET /api/privacy_network/vpn/overview/ exposes data.nodes[].system.session_cleanup from
        /root/aeronyx/privacy_network/api/vpn_observability.py. Rust source:
        /root/open/AeroNyx/crates/aeronyx-server/src/services/session.rs and
        /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs.
      </p>
    </section>
  );
}

function PendingOperatorRolloutPanel({ nodes }: { nodes: PendingOperatorNode[] }) {
  if (nodes.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-sky-100">Operator Status Rollout Pending</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-100/70">
            These privacy protocol nodes are healthy enough to heartbeat, but they are not reporting
            <span className="font-mono"> system_stats.operator_status</span>. In production this usually means the Rust
            binary has not been upgraded or the process has not restarted after the operator-status build.
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
                  {node.publicIp ?? 'no public IP'} · v{node.version}
                </p>
              </div>
              <StatusPill status={node.healthStatus} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-sky-100/60">
              <div>
                <p className="text-sky-100/35">Active Sessions</p>
                <p className="mt-1 text-sky-100">{node.activeSessions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sky-100/35">Heartbeat</p>
                <p className="mt-1 text-sky-100">
                  {node.lastHeartbeat ? formatRelativeTime(node.lastHeartbeat) : 'pending'}
                </p>
              </div>
              <div>
                <p className="text-sky-100/35">Next Step</p>
                <p className="mt-1 text-sky-100">
                  {node.activeSessions > 0 ? 'drain first' : 'restart node'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-sky-100/45">
        Backend contract: GET /api/privacy_network/vpn/overview/ from
        /root/aeronyx/privacy_network/api/vpn_observability.py. Rust producer:
        /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs and
        /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs.
      </p>
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
          <h2 className="text-lg font-semibold text-red-200">Service data unavailable</h2>
          <p className="mt-2 text-sm text-red-100/70">
            The operator console could not load service overview data from the backend.
          </p>
          <button
            onClick={handleRefresh}
            className="mt-4 rounded-lg border border-red-300/20 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-400/10"
          >
            Retry
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

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <ServiceCard key={service.key} service={service} />
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Operator Signal</h2>
            <p className="mt-1 text-sm text-gray-400">
              {operatorStatuses.length > 0
                ? `${operatorStatuses.length} node(s) reporting operator_status through signed Rust heartbeat`
                : 'Waiting for system_stats.operator_status from Rust heartbeats'}
            </p>
          </div>
          <StatusPill status={operatorStatuses.length > 0 ? 'ok' : 'pending'} />
        </div>
      </div>

      <PlacementCapacityPanel
        summary={placementSummary}
        servers={placementServers}
        nodesById={nodesById}
        available={placementAvailable}
        total={placementTotal}
        isLoading={isPlacementLoading}
      />

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

      {risks.length > 0 && (
        <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
          <h2 className="text-lg font-semibold text-yellow-100">Service Risks</h2>
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
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Node Readiness</h2>
          <p className="mt-1 text-sm text-gray-400">
            Per-node service readiness from Django overview snapshots and Rust operator heartbeats.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.12em] text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Node</th>
                <th className="px-4 py-3 font-medium">Privacy</th>
                <th className="px-4 py-3 font-medium">MemChain</th>
                <th className="px-4 py-3 font-medium">ChatRelay</th>
                <th className="px-4 py-3 font-medium">Data Layer</th>
                <th className="px-4 py-3 font-medium">Operator</th>
                <th className="px-4 py-3 font-medium">Rollout</th>
                <th className="px-4 py-3 font-medium">Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {nodes.length > 0 ? (
                nodes.map((node) => <NodeReadinessRow key={node.id} node={node} />)
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    No nodes are reporting yet.
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
    </div>
  );
}
