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
 *   - PATCH /api/privacy_network/nodes/{id}/
 *     /root/aeronyx/privacy_network/api/nodes.py
 *     Used only for operator-approved maintenance_mode changes from the
 *     restart readiness gate.
 *   - POST /api/privacy_network/nodes/{id}/commands/run/
 *     /root/aeronyx/privacy_network/api/vpn_commands.py
 *     /root/aeronyx/privacy_network/services/command_service.py
 *     Queues restart_service only after the restart readiness gate is ready.
 *   - data.nodes[].system.restart_readiness.active_restart_command
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Mirrors NodeCommand restart_service pending/sent/executing state so the
 *     fleet view does not offer duplicate restarts.
 *   - data.nodes[].system.restart_readiness.drain_eta
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Aggregates active ClientSession timing for maintenance drain visibility.
 *   - data.summary.restart_readiness.blocker_counts
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Drives the fleet restart blocker playbook shown in this page.
 *   - data.summary.restart_readiness.blocked_nodes[].recommended_action
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Provides the backend-authored next operator action for each blocked node.
 *     cleanup_policy_pending uses intent=node_detail because the operator must
 *     inspect Rust heartbeat rollout before waiting on stale-session cleanup.
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
 * Last Modified: v1.1.14 - Show fleet drain risk summary
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
import { useRunNodeCommand, useUpdateNode, useVpnOverview } from '@/hooks/useNodes';
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
}

interface RestartReadinessNode {
  id: string;
  name: string;
  publicIp: string | null;
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
  drainEta: VpnRestartDrainEta | null;
  nextStep: string;
  blockers: string[];
  source: string;
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
    };
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
    };
  }
  if (warning > 0) {
    return {
      label: 'Warning',
      detail: `${warning.toLocaleString()} warning`,
      count: issueCount,
      risk: 'warning',
    };
  }
  return {
    label: 'Clear',
    detail: 'no critical drain activity',
    count: 0,
    risk: 'healthy',
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
  restartingNodeId,
  onEnableMaintenance,
  onQueueRestart,
}: {
  nodes: RestartReadinessNode[];
  summary: VpnRestartReadinessSummary | null;
  enablingMaintenanceNodeId: string | null;
  restartingNodeId: string | null;
  onEnableMaintenance: (nodeId: string, nodeName: string) => void;
  onQueueRestart: (nodeId: string, nodeName: string) => void;
}) {
  if (nodes.length === 0) return null;

  const attentionNodes = nodes.filter((node) => node.status !== 'current');
  const readyCount = summary?.ready ?? attentionNodes.filter((node) => node.status === 'ready').length;
  const blockedCount = summary?.blocked ?? attentionNodes.filter((node) => node.status === 'blocked').length;
  const pendingCount = summary?.pending ?? attentionNodes.filter((node) => node.status === 'pending').length;
  const totalActiveSessions = summary?.sessions_blocking_restart
    ?? attentionNodes.reduce((sum, node) => sum + node.activeSessions, 0);
  const blockerCounts = Object.entries(summary?.blocker_counts ?? {});
  const drainRisk = fleetDrainRisk(summary);

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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
        </div>
      </div>

      {summary?.blocked_nodes && summary.blocked_nodes.length > 0 && (
        <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.05] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-yellow-100">Backend Blocked Nodes</h3>
              <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                Owner-scoped blockers from data.summary.restart_readiness.blocked_nodes.
              </p>
            </div>
            <StatusPill status="blocked" />
          </div>
          {blockerCounts.length > 0 && (
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {blockerCounts.map(([code, count]) => {
                const blocker = restartBlockerCopy(code);

                return (
                  <div
                    key={code}
                    className="rounded-lg border border-yellow-300/10 bg-black/20 px-3 py-2 text-xs"
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

          <div className="mt-3 grid gap-2">
            {summary.blocked_nodes.map((node) => {
              const canEnableMaintenance = !node.maintenance_mode && node.blocker_codes.includes('maintenance_required');
              const isEnablingMaintenance = enablingMaintenanceNodeId === node.id;
              const drainStatus = formatDrainStatus(node.drain_status);
              const recommendedAction = node.recommended_action ?? null;
              const drainActivity = formatBlockedDrainActivity(node);
              const drainActivityHealth = node.drain_activity?.activity_health ?? null;

              return (
              <div
                key={node.id}
                className="grid gap-3 rounded-lg border border-yellow-300/10 bg-black/20 p-3 text-xs text-yellow-100/65 md:grid-cols-[minmax(0,1fr)_110px_120px_minmax(0,1.3fr)_minmax(150px,auto)] md:items-center"
              >
                <Link href={`/dashboard/nodes/${node.id}`} className="font-medium text-white hover:text-purple-300">
                  {node.name}
                </Link>
                <span>{node.active_sessions.toLocaleString()} active</span>
                <span>{node.maintenance_mode ? 'maintenance on' : 'maintenance off'}</span>
                <span className="min-w-0 leading-5">
                  <span className="block">{node.next_step}</span>
                  {node.blocker_codes.length > 0 && (
                    <span className="text-yellow-100/35">
                      {node.blocker_codes.join(', ')}
                    </span>
                  )}
                  {drainStatus && (
                    <span className="block text-yellow-100/40">
                      drain {drainStatus}
                      {node.active_restart_command_status
                        ? ` · restart ${node.active_restart_command_status}`
                        : ''}
                      {node.drain_next_step ? ` · ${node.drain_next_step}` : ''}
                    </span>
                  )}
                  {drainActivity && (
                    <span className="block text-yellow-100/45">
                      activity: {drainActivity}
                    </span>
                  )}
                  {drainActivityHealth && (
                    <span className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${drainActivityHealthClass(drainActivityHealth.risk)}`}>
                      {drainActivityHealth.label}
                    </span>
                  )}
                  {recommendedAction?.detail && (
                    <span className="block text-yellow-100/50">
                      next action: {recommendedAction.detail}
                    </span>
                  )}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/sessions?node=${encodeURIComponent(node.id)}&status=active&quality=all`}
                    className="font-medium text-sky-300 hover:text-sky-200"
                  >
                    {recommendedAction?.intent === 'sessions' ? recommendedAction.label : 'Open sessions'}
                  </Link>
                  {recommendedAction?.intent === 'node_detail' && (
                    <Link
                      href={`/dashboard/nodes/${node.id}`}
                      className="font-medium text-purple-300 hover:text-purple-200"
                    >
                      {recommendedAction.label}
                    </Link>
                  )}
                  {recommendedAction?.intent === 'node_commands' && (
                    <Link
                      href={`/dashboard/nodes/${node.id}?command_action=restart_service#vpn-commands`}
                      className="font-medium text-sky-300 hover:text-sky-200"
                    >
                      {recommendedAction.label}
                    </Link>
                  )}
                  {canEnableMaintenance && (
                    <button
                      type="button"
                      onClick={() => onEnableMaintenance(node.id, node.name)}
                      disabled={Boolean(enablingMaintenanceNodeId)}
                      className="rounded-md border border-yellow-300/20 px-2 py-1 font-medium text-yellow-100 transition hover:border-yellow-200/40 hover:bg-yellow-300/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isEnablingMaintenance
                        ? 'Enabling...'
                        : recommendedAction?.intent === 'node_policy'
                          ? recommendedAction.label
                          : 'Enable maintenance'}
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

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
                  <Link
                    href={`/dashboard/nodes/${node.id}?command_action=restart_service#vpn-commands`}
                    className="inline-flex items-center justify-center rounded-lg border border-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-100 transition hover:border-sky-400/40 hover:bg-sky-500/10"
                  >
                    Restart {node.activeRestartCommand.status}
                  </Link>
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
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-yellow-100/60">
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
            </div>
            <p className="mt-3 text-xs leading-5 text-yellow-100/55">{node.rollout.detail}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-yellow-100/45">
        Rust source: /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs reads /proc/self/exe.
        Backend path: /root/aeronyx/privacy_network/services/heartbeat_service.py stores the operator_status snapshot.
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
  const updateNode = useUpdateNode();
  const runCommand = useRunNodeCommand();
  const [enablingMaintenanceNodeId, setEnablingMaintenanceNodeId] = useState<string | null>(null);
  const [restartingNodeId, setRestartingNodeId] = useState<string | null>(null);
  const [operationNotice, setOperationNotice] = useState<OperationNotice | null>(null);

  const handleRefresh = () => {
    void refetch();
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
        message: `${nodeName} maintenance mode enabled. Restart readiness will update after the next backend overview sync.`,
      });
      await refetch();
    } catch (error) {
      setOperationNotice({
        type: 'error',
        message: error instanceof Error ? error.message : `Failed to enable maintenance mode for ${nodeName}.`,
      });
    } finally {
      setEnablingMaintenanceNodeId(null);
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

  const nodes = overview?.nodes ?? [];
  const restartReadinessSummary = overview?.summary.restart_readiness ?? null;
  const operatorStatuses = useMemo(() => collectOperatorStatuses(nodes), [nodes]);
  const fleetSummary = useMemo(() => buildFleetSummary(nodes, operatorStatuses), [nodes, operatorStatuses]);
  const services = useMemo(() => buildServiceViews(nodes, operatorStatuses), [nodes, operatorStatuses]);
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

      <FleetRestartReadinessPanel
        nodes={restartReadinessNodes}
        summary={restartReadinessSummary}
        enablingMaintenanceNodeId={enablingMaintenanceNodeId}
        restartingNodeId={restartingNodeId}
        onEnableMaintenance={handleEnableMaintenance}
        onQueueRestart={handleQueueRestart}
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
