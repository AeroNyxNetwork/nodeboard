/**
 * ============================================
 * AeroNyx VPN Operations Page
 * ============================================
 * File Path: app/dashboard/sessions/page.tsx
 *
 * Modification Reason:
 *   Replace the aggregate-only sessions placeholder with an operator-grade VPN
 *   observability view backed by /vpn/overview/ and /vpn/sessions/.
 *
 * Source Map:
 *   - Frontend API client: lib/api.ts
 *   - React Query hooks: hooks/useNodes.ts (useVpnOverview/useVpnSessions)
 *   - Shared types: types/index.ts (VpnOverview/VpnSession)
 *   - Backend API:
 *       GET /api/privacy_network/vpn/sessions/
 *       /root/aeronyx/privacy_network/api/vpn_observability.py
 *   - Implementation notes: docs/vpn-observability-mvp.md
 *
 * Deep Link Contract:
 *   - Services page blocked-node link:
 *       /dashboard/sessions?node={node_id}&status=active&quality=all
 *   - Nodeboard query params:
 *       node    -> backend node_id
 *       status  -> backend status
 *       quality -> backend quality_status
 *   - Backend files:
 *       /root/aeronyx/privacy_network/api/vpn_observability.py
 *       /root/aeronyx/privacy_network/serializers.py
 *
 * Implementation Notes:
 *   - Session quality is classified by the backend from Rust-reported
 *     last_rx_at, last_tx_at, RTT, packet-loss, replay-window counters, and
 *     keepalive ACK counters.
 *   - Restart drain context reads overview.nodes[].system.restart_readiness
 *     from GET /api/privacy_network/vpn/overview/ so operators can understand
 *     why a Services page restart gate opened this session view.
 *   - The UI intentionally shows operational metadata only. It must not display
 *     traffic destinations, DNS queries, packet payloads, or browsing history.
 *
 * Last Modified: v1.1.2 - Added restart drain deep-link context
 * Previous: v1.1.1 - Documented sessions deep-link contract
 * Previous: v1.1.0 - VPN observability MVP
 * ============================================
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRunNodeCommand, useVpnOverview, useVpnSessions } from '@/hooks/useNodes';
import {
  SessionQualityStatus,
  VpnHealthStatus,
  VpnNodeHealth,
  VpnSession,
  VpnSessionQualitySummary,
} from '@/types';
import { formatBytes, formatDuration, formatRelativeTime, truncateAddress } from '@/lib/api';
import Card, { EmptyState, LoadingCard, StatCard } from '@/components/common/Card';
import Button from '@/components/common/Button';

type SessionFilter = 'all' | 'active' | 'completed' | 'error';
type QualityFilter = 'all' | SessionQualityStatus;
type OperationNotice = {
  message: string;
  nodeId?: string;
  commandId?: string;
  commandAction?: 'kick_session' | 'ban_wallet';
};

const SESSION_FILTERS: SessionFilter[] = ['all', 'active', 'completed', 'error'];
const QUALITY_FILTERS: QualityFilter[] = ['all', 'healthy', 'degraded', 'stale', 'error', 'pending', 'completed'];
const QUALITY_SUMMARY_FILTERS: SessionQualityStatus[] = ['healthy', 'degraded', 'stale', 'error', 'pending', 'completed'];

function parseSessionFilter(value: string | null): SessionFilter {
  return SESSION_FILTERS.includes(value as SessionFilter) ? value as SessionFilter : 'active';
}

function parseQualityFilter(value: string | null): QualityFilter {
  return QUALITY_FILTERS.includes(value as QualityFilter) ? value as QualityFilter : 'all';
}

const healthStyles: Record<VpnHealthStatus, { label: string; badge: string; dot: string }> = {
  healthy: {
    label: 'Healthy',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  degraded: {
    label: 'Degraded',
    badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    dot: 'bg-yellow-400',
  },
  overloaded: {
    label: 'Overloaded',
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    dot: 'bg-orange-400',
  },
  offline: {
    label: 'Offline',
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
  },
};

const healthCheckLabels: Record<string, string> = {
  heartbeat: 'Heartbeat',
  resource_load: 'Resource Load',
  traffic_counters: 'Traffic Counters',
  udp_listener: 'UDP Listener',
  tun_device: 'TUN Device',
  mtu_config: 'MTU Config',
  ip_forward: 'IP Forwarding',
  nat_masquerade: 'NAT Masquerade',
  dns_stub: 'DNS Stub',
  dns_query: 'DNS Query',
  internet_egress: 'Internet Egress',
};

function formatHealthCheckName(name: string): string {
  return healthCheckLabels[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function HealthBadge({ status }: { status: VpnHealthStatus }) {
  const style = healthStyles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

function SessionStatusBadge({ status }: { status: VpnSession['status'] }) {
  const styles = {
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    completed: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
    error: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full border text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

const sessionQualityStyles: Record<SessionQualityStatus, { label: string; badge: string; dot: string }> = {
  healthy: {
    label: 'Healthy',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  degraded: {
    label: 'Degraded',
    badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    dot: 'bg-yellow-400',
  },
  stale: {
    label: 'Stale',
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    dot: 'bg-orange-400',
  },
  error: {
    label: 'Error',
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
  },
  pending: {
    label: 'Pending',
    badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    dot: 'bg-slate-400',
  },
  completed: {
    label: 'Completed',
    badge: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
    dot: 'bg-gray-400',
  },
};

function SessionQualityBadge({ status }: { status: SessionQualityStatus }) {
  const style = sessionQualityStyles[status] || sessionQualityStyles.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

interface QualitySummaryStripProps {
  summary: VpnSessionQualitySummary | null;
  active: QualityFilter;
  filteredCount: number;
  inViewCount: number;
  onSelect: (status: QualityFilter) => void;
}

function QualitySummaryStrip({
  summary,
  active,
  filteredCount,
  inViewCount,
  onSelect,
}: QualitySummaryStripProps) {
  const total = QUALITY_SUMMARY_FILTERS.reduce(
    (sum, status) => sum + (summary?.[status] ?? 0),
    0
  );

  const buttonClass = (isActive: boolean, accent = 'border-white/10 text-gray-300') => `
    min-h-[68px] rounded-lg border px-3 py-2 text-left transition-colors
    ${isActive
      ? 'bg-purple-500/15 border-purple-500/40 text-purple-100'
      : `bg-white/[0.03] hover:bg-white/[0.06] ${accent}`
    }
  `;

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
        <h3 className="text-sm font-semibold text-white">Session Quality</h3>
        <div className="text-xs text-gray-500">
          {filteredCount} matching / {inViewCount} shown
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        <button
          type="button"
          onClick={() => onSelect('all')}
          className={buttonClass(active === 'all')}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">All</div>
          <div className="mt-1 text-xl font-semibold text-white">{total}</div>
        </button>
        {QUALITY_SUMMARY_FILTERS.map((status) => {
          const style = sessionQualityStyles[status];
          const isActive = active === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onSelect(status)}
              className={buttonClass(isActive, style.badge)}
            >
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                <span>{style.label}</span>
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {summary?.[status] ?? 0}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Operator context for Services -> Sessions deep links.
 *
 * Backend API:
 *   GET /api/privacy_network/vpn/overview/
 * Backend file:
 *   /root/aeronyx/privacy_network/api/vpn_observability.py
 *
 * Privacy boundary: restart readiness and active session counts only. No client
 * public IPs, packet payloads, DNS contents, domains, URLs, or wallet-level
 * traffic are shown here.
 */
function RestartDrainContextPanel({
  node,
  filteredCount,
  onClear,
}: {
  node: VpnNodeHealth;
  filteredCount: number;
  onClear: () => void;
}) {
  const readiness = node.system.restart_readiness;
  const activeSessions = readiness?.active_sessions ?? node.active_sessions;
  const maintenanceMode = readiness?.maintenance_mode ?? node.maintenance_mode;
  const blockers = readiness?.blockers?.map((blocker) => blocker.message) ?? [];
  const nextStep = readiness?.next_step || (
    maintenanceMode
      ? `Drain ${activeSessions.toLocaleString()} active session(s) before restart.`
      : 'Enable maintenance mode before restarting this node.'
  );
  const status = readiness?.status ?? (activeSessions > 0 || !maintenanceMode ? 'blocked' : 'ready');
  const statusClass = status === 'ready'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : status === 'blocked'
      ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
      : 'border-white/10 bg-white/5 text-gray-300';

  return (
    <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.045] px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass}`}>
              Restart {status}
            </span>
            <span className="text-xs text-gray-500">
              Services deep link - {filteredCount.toLocaleString()} matching active session(s)
            </span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-white">
            {node.name} session drain context
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-400">
            {nextStep}
          </p>
          {blockers.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {blockers.slice(0, 3).map((blocker) => (
                <span
                  key={blocker}
                  className="rounded-md border border-yellow-500/20 bg-black/20 px-2 py-1 text-xs text-yellow-100"
                >
                  {blocker}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 sm:flex sm:flex-wrap sm:justify-end">
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <div className="text-gray-600">Active</div>
            <div className="mt-1 text-sm font-semibold text-white">{activeSessions.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <div className="text-gray-600">Maintenance</div>
            <div className="mt-1 text-sm font-semibold text-white">{maintenanceMode ? 'On' : 'Off'}</div>
          </div>
          <Link
            href={`/dashboard/nodes/${node.id}`}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/5"
          >
            Open Node
          </Link>
          <Link
            href="/dashboard/services"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/5"
          >
            Services
          </Link>
          <Button variant="secondary" size="sm" onClick={onClear}>
            Clear Filter
          </Button>
        </div>
      </div>
    </div>
  );
}

function sessionImpactReason(session: VpnSession) {
  if (session.degraded_reason) return session.degraded_reason;
  if (session.quality_status === 'stale') return 'Session activity is stale';
  if (session.quality_status === 'error') return session.last_error || 'Session reported an error';
  if (session.keepalive_missed > 0) return `Keepalive ACK missed ${session.keepalive_missed} times`;
  if (session.keepalive_pending > 0) return `${session.keepalive_pending} keepalive probes pending`;
  if (session.rtt_ms !== null && session.rtt_ms > 250) return `RTT is high at ${session.rtt_ms.toFixed(1)} ms`;
  if (session.packet_loss !== null && session.packet_loss > 2) return `Packet loss is ${session.packet_loss.toFixed(1)}%`;
  return `${session.quality_status} session quality`;
}

function impactedSessions(sessions: VpnSession[]) {
  return sessions.filter((session) => (
    session.status === 'active' &&
    ['degraded', 'stale', 'error'].includes(session.quality_status)
  ));
}

function topSessionGroups<T extends string>(items: VpnSession[], keyOf: (session: VpnSession) => T, limit: number): Array<[string, number]> {
  const groups = items.reduce((acc, session) => {
    const key = keyOf(session);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<T, number>);

  return (Object.entries(groups) as Array<[string, number]>)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function AffectedSessionsPanel({
  sessions,
  onQualityFilter,
}: {
  sessions: VpnSession[];
  onQualityFilter: (status: QualityFilter) => void;
}) {
  const affected = impactedSessions(sessions);
  if (affected.length === 0) {
    return (
      <div className="mb-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Affected Sessions</h3>
            <p className="mt-1 text-xs text-emerald-300">No active degraded, stale, or error sessions in the current view.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onQualityFilter('all')}>
            All Sessions
          </Button>
        </div>
      </div>
    );
  }

  const byReason = topSessionGroups(affected, sessionImpactReason, 4);
  const byNode = topSessionGroups(affected, (session) => session.node_name || session.node_id, 4);
  const severe = [...affected].sort((a, b) => {
    const scoreA = a.quality_score ?? 999;
    const scoreB = b.quality_score ?? 999;
    return scoreA - scoreB || b.keepalive_missed - a.keepalive_missed;
  }).slice(0, 3);

  return (
    <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.05] px-4 py-3">
      <div className="mb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Affected Sessions</h3>
          <p className="mt-1 text-xs text-gray-500">
            {affected.length} active tunnels need attention in the current view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => onQualityFilter('degraded')}>
            Degraded
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onQualityFilter('stale')}>
            Stale
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onQualityFilter('error')}>
            Error
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr_1.2fr] gap-3">
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-600">Top Reasons</p>
          <div className="mt-2 space-y-2">
            {byReason.map(([reason, count]) => (
              <div key={reason} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-gray-300" title={reason}>{reason}</span>
                <span className="shrink-0 text-yellow-300">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-600">Affected Nodes</p>
          <div className="mt-2 space-y-2">
            {byNode.map(([nodeName, count]) => (
              <div key={nodeName} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-gray-300" title={nodeName}>{nodeName}</span>
                <span className="shrink-0 text-yellow-300">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-600">Lowest Quality</p>
          <div className="mt-2 space-y-2">
            {severe.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="truncate text-gray-300">
                    {truncateAddress(session.session_id, 8)} · {session.virtual_ip || 'vip pending'}
                  </p>
                  <p className="mt-0.5 truncate text-gray-600" title={sessionImpactReason(session)}>
                    {sessionImpactReason(session)}
                  </p>
                </div>
                <span className="shrink-0 text-yellow-300">{session.quality_score ?? 'pending'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5v14" />
    </svg>
  );
}

function formatMaybeTime(value: string | null) {
  return value ? formatRelativeTime(value) : 'pending';
}

function formatMetric(value: number | null, suffix: string) {
  return value === null || Number.isNaN(value) ? 'pending' : `${value}${suffix}`;
}

function formatMemory(used: number | null, total: number | null) {
  if (used === null) return 'pending';
  return total ? `${used} / ${total} MB` : `${used} MB`;
}

function formatAvailability(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'pending';
  return `${value.toFixed(value >= 99.95 ? 2 : 1)}%`;
}

function NodeHealthTable({ nodes }: { nodes: VpnNodeHealth[] }) {
  if (nodes.length === 0) {
    return (
      <EmptyState
        icon={<EmptyIcon />}
        title="No VPN Nodes"
        description="VPN nodes will appear here after the first signed heartbeat."
      />
    );
  }

  return (
    <Card variant="default" padding="none">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Node Health</h2>
          <p className="text-xs text-gray-500 mt-1">Live status from signed node heartbeats</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="text-xs uppercase text-gray-500 bg-white/[0.02]">
            <tr>
              <th className="text-left font-medium px-5 py-3">Node</th>
              <th className="text-left font-medium px-4 py-3">Health</th>
              <th className="text-left font-medium px-4 py-3">Availability</th>
              <th className="text-left font-medium px-4 py-3">Sessions</th>
              <th className="text-left font-medium px-4 py-3">Load</th>
              <th className="text-left font-medium px-4 py-3">Traffic</th>
              <th className="text-left font-medium px-4 py-3">Checks</th>
              <th className="text-left font-medium px-5 py-3">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {nodes.map((node) => {
              const failedChecks = node.checks.filter((check) => !check.ok);
              return (
                <tr key={node.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-medium text-white">{node.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {node.public_ip || 'no ip'}:{node.port}
                      {node.region_code ? ` - ${node.region_code}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1.5">
                      <HealthBadge status={node.health_status} />
                      <span className="text-xs text-gray-500">{node.health_score}/100 score</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-white font-medium">
                      {formatAvailability(node.availability_24h?.percent)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {node.availability_24h?.sample_count ?? 0} samples / {node.availability_24h?.window_hours ?? 24}h
                    </div>
                    {node.availability_24h?.last_gap_seconds ? (
                      <div className="text-xs text-yellow-300">
                        gap {formatDuration(node.availability_24h.last_gap_seconds)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-gray-300">
                    <span className="text-white font-medium">{node.active_sessions}</span>
                    <span className="text-gray-500"> active</span>
                    <div className="text-xs text-gray-500">{node.total_sessions} total</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-gray-300">
                      CPU {formatMetric(node.system.cpu_usage, '%')}
                    </div>
                    <div className="text-xs text-gray-500">
                      Mem {formatMemory(node.system.memory_mb, node.system.memory_total_mb)}
                    </div>
                    <div className="text-xs text-gray-600">
                      {node.system.cpu_count ? `${node.system.cpu_count} cores` : 'cores pending'}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-300">
                    <div>{node.traffic_in_mb.toFixed(1)} MB in</div>
                    <div className="text-xs text-gray-500">{node.traffic_out_mb.toFixed(1)} MB out</div>
                    <div className="text-xs text-gray-600">
                      {node.system.source === 'cache' ? 'live heartbeat' : 'sample fallback'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {failedChecks.length === 0 ? (
                      <span className="text-xs text-emerald-300">all clear</span>
                    ) : (
                      <div className="space-y-1">
                        {failedChecks.slice(0, 2).map((check) => (
                          <div key={check.name} className="text-xs text-yellow-300">
                            {formatHealthCheckName(check.name)}: {check.detail}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-gray-400">
                    {node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : 'never'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface SessionTableProps {
  sessions: VpnSession[];
  kickingSessionId: string | null;
  banningSessionId: string | null;
  onKickSession: (session: VpnSession) => void;
  onBanWallet: (session: VpnSession) => void;
}

function SessionTable({ sessions, kickingSessionId, banningSessionId, onKickSession, onBanWallet }: SessionTableProps) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<EmptyIcon />}
        title="No Matching Sessions"
        description="Sessions appear here as nodes report VPN connection events."
      />
    );
  }

  return (
    <Card variant="default" padding="none">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1240px] text-sm">
          <thead className="text-xs uppercase text-gray-500 bg-white/[0.02]">
            <tr>
              <th className="text-left font-medium px-5 py-3">Session</th>
              <th className="text-left font-medium px-4 py-3">Node</th>
              <th className="text-left font-medium px-4 py-3">Client</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-left font-medium px-4 py-3">Duration</th>
              <th className="text-left font-medium px-4 py-3">Traffic</th>
              <th className="text-left font-medium px-4 py-3">Quality</th>
              <th className="text-left font-medium px-5 py-3">Last Activity</th>
              <th className="text-right font-medium px-5 py-3">Operations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sessions.map((session) => (
              <tr key={session.id} className="hover:bg-white/[0.03] transition-colors">
                <td className="px-5 py-4">
                  <div className="font-mono text-xs text-white">{truncateAddress(session.session_id, 8)}</div>
                  <div className="text-xs text-gray-500 mt-1">{session.virtual_ip || 'virtual ip pending'}</div>
                </td>
                <td className="px-4 py-4">
                  <Link href={`/dashboard/nodes/${session.node_id}`} className="text-gray-300 hover:text-purple-300">
                    {session.node_name}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <span className="font-mono text-xs text-gray-300">
                    {truncateAddress(session.client_wallet || 'anonymous', 6)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <SessionStatusBadge status={session.status} />
                  {session.last_error ? (
                    <div className="mt-1 max-w-[180px] truncate text-xs text-red-300" title={session.last_error}>
                      {session.last_error}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-gray-300">
                  {formatDuration(session.duration_seconds)}
                  <div className="text-xs text-gray-500">{formatRelativeTime(session.started_at)}</div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  {session.total_bytes_mb.toFixed(1)} MB
                  <div className="text-xs text-gray-500">
                    {formatBytes(session.bytes_in, 1)} in / {formatBytes(session.bytes_out, 1)} out
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <SessionQualityBadge status={session.quality_status} />
                      {session.quality_score !== null ? (
                        <span className="text-xs text-gray-500">{session.quality_score}/100</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500">
                      RTT {formatMetric(session.rtt_ms, ' ms')} · loss {formatMetric(session.packet_loss, '%')}
                    </div>
                    <div className="text-xs text-gray-500">
                      ACK {session.keepalive_acks}/{session.keepalive_probes_sent} · missed {session.keepalive_missed} · pending {session.keepalive_pending}
                    </div>
                    {session.degraded_reason ? (
                      <div className="max-w-[260px] truncate text-xs text-yellow-300" title={session.degraded_reason}>
                        {session.degraded_reason}
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className="px-5 py-4 text-gray-400">
                  {formatMaybeTime(session.last_activity_at || session.last_rx_at || session.last_tx_at)}
                </td>
                <td className="px-5 py-4 text-right">
                  {session.status === 'active' ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={kickingSessionId === session.id}
                        disabled={Boolean(kickingSessionId || banningSessionId)}
                        onClick={() => onKickSession(session)}
                      >
                        Kick
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={banningSessionId === session.id}
                        disabled={Boolean(kickingSessionId || banningSessionId) || !session.client_wallet}
                        onClick={() => onBanWallet(session)}
                      >
                        Ban Wallet
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function SessionsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<SessionFilter>(() => parseSessionFilter(searchParams.get('status')));
  const [nodeFilter, setNodeFilter] = useState(() => searchParams.get('node') || '');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>(() => parseQualityFilter(searchParams.get('quality')));
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [kickingSessionId, setKickingSessionId] = useState<string | null>(null);
  const [banningSessionId, setBanningSessionId] = useState<string | null>(null);
  const [operationNotice, setOperationNotice] = useState<OperationNotice | null>(null);

  // Keep URL filters shareable with Services blocked-node links while mapping
  // node/status/quality to the backend node_id/status/quality_status filters in
  // lib/api.ts -> api.getVpnSessions() -> /api/privacy_network/vpn/sessions/.
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'active') params.set('status', statusFilter);
    if (nodeFilter) params.set('node', nodeFilter);
    if (qualityFilter !== 'all') params.set('quality', qualityFilter);
    if (query.trim()) params.set('q', query.trim());
    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [nodeFilter, pathname, qualityFilter, query, router, searchParams, statusFilter]);

  const { overview, isLoading: overviewLoading, isError: overviewError, refetch: refetchOverview } = useVpnOverview();
  const {
    sessions,
    count: sessionCount,
    filteredCount: sessionFilteredCount,
    qualitySummary,
    isLoading: sessionsLoading,
    isError: sessionsError,
    refetch: refetchSessions,
  } =
    useVpnSessions({
      status: statusFilter,
      nodeId: nodeFilter || undefined,
      qualityStatus: qualityFilter,
      q: query.trim() || undefined,
      limit: 300,
    });
  const runCommand = useRunNodeCommand();

  const sortedNodes = useMemo(() => {
    const order: Record<VpnHealthStatus, number> = {
      offline: 0,
      overloaded: 1,
      degraded: 2,
      healthy: 3,
    };
    return [...(overview?.nodes ?? [])].sort(
      (a, b) => order[a.health_status] - order[b.health_status] || a.name.localeCompare(b.name)
    );
  }, [overview?.nodes]);
  const focusedNode = useMemo(
    () => sortedNodes.find((node) => node.id === nodeFilter) ?? null,
    [nodeFilter, sortedNodes]
  );

  const summary = overview?.summary;
  const totalTrafficBytes = summary
    ? (summary.traffic_in_mb + summary.traffic_out_mb) * 1024 * 1024
    : 0;

  const handleRefresh = () => {
    refetchOverview();
    refetchSessions();
  };

  const handleKickSession = async (session: VpnSession) => {
    setKickingSessionId(session.id);
    setOperationNotice(null);

    try {
      const response = await runCommand.mutateAsync({
        nodeId: session.node_id,
        data: {
          action: 'kick_session',
          params: {
            session_id: session.session_id,
            reason: 'operator_kick',
          },
          priority: 1,
        },
      });
      setOperationNotice({
        message: `Kick queued for ${truncateAddress(session.session_id, 8)}`,
        nodeId: session.node_id,
        commandId: response.data.command.id,
        commandAction: 'kick_session',
      });
      refetchOverview();
      refetchSessions();
    } catch (error) {
      setOperationNotice({
        message: error instanceof Error ? error.message : 'Failed to queue kick command',
      });
    } finally {
      setKickingSessionId(null);
    }
  };

  const handleBanWallet = async (session: VpnSession) => {
    if (!window.confirm(`Ban wallet ${truncateAddress(session.client_wallet, 6)} on ${session.node_name}? Active tunnels for this wallet will be disconnected.`)) {
      return;
    }

    setBanningSessionId(session.id);
    setOperationNotice(null);

    try {
      const response = await runCommand.mutateAsync({
        nodeId: session.node_id,
        data: {
          action: 'ban_wallet',
          params: {
            session_id: session.session_id,
            reason: 'operator_ban',
          },
          priority: 1,
        },
      });
      setOperationNotice({
        message: `Ban queued for wallet ${truncateAddress(session.client_wallet, 6)}`,
        nodeId: session.node_id,
        commandId: response.data.command.id,
        commandAction: 'ban_wallet',
      });
      refetchOverview();
      refetchSessions();
    } catch (error) {
      setOperationNotice({
        message: error instanceof Error ? error.message : 'Failed to queue wallet ban',
      });
    } finally {
      setBanningSessionId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">VPN Operations</h1>
          <p className="text-sm text-gray-400 mt-1">
            Node health, active tunnels, and operational alerts
          </p>
        </div>
        <Button variant="secondary" onClick={handleRefresh}>
          Refresh
        </Button>
      </div>

      {overviewError || sessionsError ? (
        <Card variant="outline" padding="md" className="mb-6 border-red-500/30">
          <div className="text-sm text-red-300">VPN observability data is unavailable.</div>
        </Card>
      ) : null}

      {operationNotice ? (
        <Card variant="outline" padding="md" className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm text-gray-300">{operationNotice.message}</div>
              {operationNotice.commandId ? (
                <div className="mt-1 text-xs text-gray-600">
                  Command <span className="font-mono">{operationNotice.commandId.slice(0, 8)}</span>
                </div>
              ) : null}
            </div>
            {operationNotice.nodeId ? (
              <Link
                href={`/dashboard/nodes/${operationNotice.nodeId}${operationNotice.commandAction ? `?command_action=${operationNotice.commandAction}` : ''}#vpn-commands`}
                className="text-sm font-medium text-purple-300 hover:text-purple-200"
              >
                Open Node Commands
              </Link>
            ) : null}
          </div>
        </Card>
      ) : null}

      {focusedNode ? (
        <RestartDrainContextPanel
          node={focusedNode}
          filteredCount={sessionFilteredCount}
          onClear={() => setNodeFilter('')}
        />
      ) : null}

      {overviewLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[...Array(5)].map((_, i) => <LoadingCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            label="Healthy Nodes"
            value={`${summary?.healthy_nodes ?? 0}/${summary?.total_nodes ?? 0}`}
            subValue={`${summary?.degraded_nodes ?? 0} degraded, ${summary?.offline_nodes ?? 0} offline`}
          />
          <StatCard
            label="24h Availability"
            value={formatAvailability(summary?.availability_24h_percent)}
            subValue="sampled heartbeat average"
          />
          <StatCard
            label="Active Tunnels"
            value={summary?.active_sessions ?? 0}
            subValue={`${sessionFilteredCount} matching, ${sessionCount} shown`}
          />
          <StatCard
            label="VPN Traffic"
            value={formatBytes(totalTrafficBytes, 1)}
            subValue={`${(summary?.traffic_in_mb ?? 0).toFixed(1)} MB in`}
          />
          <StatCard
            label="Open Alerts"
            value={summary?.open_alerts ?? 0}
            subValue={overview?.generated_at ? `Updated ${formatRelativeTime(overview.generated_at)}` : 'Awaiting data'}
          />
        </div>
      )}

      {overview?.alerts.length ? (
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {overview.alerts.slice(0, 4).map((alert) => (
            <div
              key={alert.id}
              className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-yellow-200">{alert.message}</span>
                <span className="text-xs text-yellow-300">{alert.severity}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {alert.created_at ? formatRelativeTime(alert.created_at) : 'no heartbeat'}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-8">
        {overviewLoading ? <LoadingCard className="h-64" /> : <NodeHealthTable nodes={sortedNodes} />}
      </div>

      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">VPN Sessions</h2>
          <p className="text-xs text-gray-500 mt-1">Session identity is operational only; traffic destinations are not collected.</p>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full xl:w-auto">
          <label className="block">
            <span className="text-xs text-gray-500">Node</span>
            <select
              value={nodeFilter}
              onChange={(event) => setNodeFilter(event.target.value)}
              className="mt-1 w-full min-w-[180px] rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
            >
              <option value="" className="bg-[#111118]">All nodes</option>
              {sortedNodes.map((node) => (
                <option key={node.id} value={node.id} className="bg-[#111118]">
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as SessionFilter)}
              className="mt-1 w-full min-w-[150px] rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
            >
              {SESSION_FILTERS.map((filter) => (
                <option key={filter} value={filter} className="bg-[#111118]">
                  {filter}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Quality</span>
            <select
              value={qualityFilter}
              onChange={(event) => setQualityFilter(event.target.value as QualityFilter)}
              className="mt-1 w-full min-w-[160px] rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
            >
              {QUALITY_FILTERS.map((filter) => (
                <option key={filter} value={filter} className="bg-[#111118]">
                  {filter}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Session / Wallet / VIP</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search operational id"
              className="mt-1 w-full min-w-[200px] rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500/50"
            />
          </label>
        </div>
      </div>

      <QualitySummaryStrip
        summary={qualitySummary}
        active={qualityFilter}
        filteredCount={sessionFilteredCount}
        inViewCount={sessionCount}
        onSelect={setQualityFilter}
      />

      {!sessionsLoading ? (
        <AffectedSessionsPanel
          sessions={sessions}
          onQualityFilter={setQualityFilter}
        />
      ) : null}

      {sessionsLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <LoadingCard key={i} />)}
        </div>
      ) : (
        <SessionTable
          sessions={sessions}
          kickingSessionId={kickingSessionId}
          banningSessionId={banningSessionId}
          onKickSession={handleKickSession}
          onBanWallet={handleBanWallet}
        />
      )}
    </div>
  );
}
