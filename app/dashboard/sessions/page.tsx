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
 *   - Backend API: /root/aeronyx/privacy_network/api/vpn_observability.py
 *   - Implementation notes: docs/vpn-observability-mvp.md
 *
 * Implementation Notes:
 *   - M1 uses existing backend NodeHeartbeat and ClientSession records, so RTT,
 *     packet loss, and exact RX/TX timestamps are shown as pending until M2
 *     Rust telemetry lands.
 *   - The UI intentionally shows operational metadata only. It must not display
 *     traffic destinations, DNS queries, packet payloads, or browsing history.
 *
 * Last Modified: v1.1.0 - VPN observability MVP
 * ============================================
 */

'use client';

import React, { useMemo, useState } from 'react';
import { useRunNodeCommand, useVpnOverview, useVpnSessions } from '@/hooks/useNodes';
import { VpnHealthStatus, VpnNodeHealth, VpnSession } from '@/types';
import { formatBytes, formatDuration, formatRelativeTime, truncateAddress } from '@/lib/api';
import Card, { EmptyState, LoadingCard, StatCard } from '@/components/common/Card';
import Button from '@/components/common/Button';

type SessionFilter = 'all' | 'active' | 'completed' | 'error';

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
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-xs uppercase text-gray-500 bg-white/[0.02]">
            <tr>
              <th className="text-left font-medium px-5 py-3">Node</th>
              <th className="text-left font-medium px-4 py-3">Health</th>
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
                            {check.name}: {check.detail}
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
        <table className="w-full min-w-[1160px] text-sm">
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
                <td className="px-4 py-4 text-gray-300">{session.node_name}</td>
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
                  {formatMetric(session.rtt_ms, ' ms')}
                  <div className="text-xs text-gray-500">
                    loss {formatMetric(session.packet_loss, '%')}
                  </div>
                </td>
                <td className="px-5 py-4 text-gray-400">
                  {formatMaybeTime(session.last_rx_at || session.last_tx_at)}
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
  const [statusFilter, setStatusFilter] = useState<SessionFilter>('active');
  const [kickingSessionId, setKickingSessionId] = useState<string | null>(null);
  const [banningSessionId, setBanningSessionId] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState<string>('');
  const { overview, isLoading: overviewLoading, isError: overviewError, refetch: refetchOverview } = useVpnOverview();
  const { sessions, isLoading: sessionsLoading, isError: sessionsError, refetch: refetchSessions } =
    useVpnSessions({ status: statusFilter, limit: 300 });
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
    setOperationMessage('');

    try {
      await runCommand.mutateAsync({
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
      setOperationMessage(`Kick queued for ${truncateAddress(session.session_id, 8)}`);
      refetchOverview();
      refetchSessions();
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Failed to queue kick command');
    } finally {
      setKickingSessionId(null);
    }
  };

  const handleBanWallet = async (session: VpnSession) => {
    if (!window.confirm(`Ban wallet ${truncateAddress(session.client_wallet, 6)} on ${session.node_name}? Active tunnels for this wallet will be disconnected.`)) {
      return;
    }

    setBanningSessionId(session.id);
    setOperationMessage('');

    try {
      await runCommand.mutateAsync({
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
      setOperationMessage(`Ban queued for wallet ${truncateAddress(session.client_wallet, 6)}`);
      refetchOverview();
      refetchSessions();
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Failed to queue wallet ban');
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

      {operationMessage ? (
        <Card variant="outline" padding="md" className="mb-6">
          <div className="text-sm text-gray-300">{operationMessage}</div>
        </Card>
      ) : null}

      {overviewLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <LoadingCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Healthy Nodes"
            value={`${summary?.healthy_nodes ?? 0}/${summary?.total_nodes ?? 0}`}
            subValue={`${summary?.degraded_nodes ?? 0} degraded, ${summary?.offline_nodes ?? 0} offline`}
          />
          <StatCard
            label="Active Tunnels"
            value={summary?.active_sessions ?? 0}
            subValue={`${sessions.length} sessions in view`}
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">VPN Sessions</h2>
          <p className="text-xs text-gray-500 mt-1">Session identity is operational only; traffic destinations are not collected.</p>
        </div>
        <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
          {(['all', 'active', 'completed', 'error'] as SessionFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === filter
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

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
