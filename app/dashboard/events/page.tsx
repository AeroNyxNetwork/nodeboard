/**
 * AeroNyx VPN Alerts / Events page.
 *
 * Source path:
 *   /root/open/nodeboard/app/dashboard/events/page.tsx
 *
 * Backend:
 *   GET /api/privacy_network/vpn/events/
 */

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useNodes, useVpnEvents, UseVpnEventsOptions } from '@/hooks/useNodes';
import { VpnEvent, VpnEventSeverity } from '@/types';
import { formatRelativeTime } from '@/lib/api';
import Card, { EmptyState, LoadingCard } from '@/components/common/Card';
import Button from '@/components/common/Button';

type SeverityFilter = NonNullable<UseVpnEventsOptions['severity']>;

const SEVERITY_OPTIONS: SeverityFilter[] = ['all', 'critical', 'warning', 'info'];
const DAY_OPTIONS = [1, 7, 14, 30, 60, 90];

const severityStyles: Record<VpnEventSeverity, { label: string; badge: string; dot: string }> = {
  critical: {
    label: 'Critical',
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
  },
  warning: {
    label: 'Warning',
    badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    dot: 'bg-yellow-400',
  },
  info: {
    label: 'Info',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    dot: 'bg-sky-400',
  },
};

function EventIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m0 3.75h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function SeverityBadge({ severity }: { severity: VpnEventSeverity }) {
  const style = severityStyles[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'critical' | 'warning' | 'info' | 'open';
}) {
  const toneClass = {
    critical: 'text-red-300',
    warning: 'text-yellow-300',
    info: 'text-sky-300',
    open: 'text-white',
  }[tone];

  return (
    <Card variant="default" padding="md">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-2 ${toneClass}`}>{value}</p>
    </Card>
  );
}

function QueryBar({
  days,
  severity,
  eventType,
  nodeId,
  nodes,
  typeOptions,
  onDays,
  onSeverity,
  onType,
  onNode,
  onRefresh,
}: {
  days: number;
  severity: SeverityFilter;
  eventType: string;
  nodeId: string;
  nodes: { id: string; name: string }[];
  typeOptions: string[];
  onDays: (value: number) => void;
  onSeverity: (value: SeverityFilter) => void;
  onType: (value: string) => void;
  onNode: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <Card variant="default" padding="md">
      <div className="grid md:grid-cols-[120px_150px_180px_1fr_auto] gap-3 items-end">
        <label className="block">
          <span className="text-xs text-gray-500">Days</span>
          <select
            value={days}
            onChange={(event) => onDays(Number(event.target.value))}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          >
            {DAY_OPTIONS.map((value) => (
              <option key={value} value={value} className="bg-[#111118]">
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Severity</span>
          <select
            value={severity}
            onChange={(event) => onSeverity(event.target.value as SeverityFilter)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          >
            {SEVERITY_OPTIONS.map((value) => (
              <option key={value} value={value} className="bg-[#111118]">
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Type</span>
          <select
            value={eventType}
            onChange={(event) => onType(event.target.value)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          >
            <option value="" className="bg-[#111118]">All types</option>
            {typeOptions.map((value) => (
              <option key={value} value={value} className="bg-[#111118]">
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Node</span>
          <select
            value={nodeId}
            onChange={(event) => onNode(event.target.value)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          >
            <option value="" className="bg-[#111118]">All nodes</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id} className="bg-[#111118]">
                {node.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" onClick={onRefresh}>Refresh</Button>
      </div>
    </Card>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '-';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function shortValue(value: unknown, maxLength = 120): string {
  const text = formatDetailValue(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function detailNumber(details: Record<string, unknown>, key: string): number {
  const value = details[key];
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

function policyEnforcementTotal(details: Record<string, unknown>): number {
  return (
    detailNumber(details, 'maintenance_rejections') +
    detailNumber(details, 'max_sessions_rejections') +
    detailNumber(details, 'bandwidth_drops')
  );
}

function getChangedFields(event: VpnEvent): string[] {
  const fields = event.details?.changed_fields;
  if (Array.isArray(fields)) {
    return fields.filter((field): field is string => typeof field === 'string');
  }
  const changes = event.details?.changes;
  return isRecord(changes) ? Object.keys(changes) : [];
}

function DetailsPreview({ event }: { event: VpnEvent }) {
  const changedFields = getChangedFields(event);
  if (event.type === 'node_policy_changed' && changedFields.length) {
    return (
      <span className="text-xs text-gray-500">
        {changedFields.slice(0, 3).join(', ')}
        {changedFields.length > 3 ? ` +${changedFields.length - 3}` : ''}
      </span>
    );
  }

  if (event.type === 'node_policy_enforced') {
    const total = policyEnforcementTotal(event.details || {});
    const reason = shortValue(event.details?.last_rejection_reason, 32);
    return <span className="text-xs text-gray-500">{total} blocked · {reason}</span>;
  }

  if (event.type === 'bandwidth_limit_pressure') {
    const observed = shortValue(event.details?.observed_mbps, 16);
    const limit = shortValue(event.details?.bandwidth_limit_mbps, 16);
    return <span className="text-xs text-gray-500">{observed} / {limit} Mbps</span>;
  }

  if (event.type === 'session_traffic_anomaly') {
    const average = shortValue(event.details?.average_mbps, 16);
    const replay = shortValue(event.details?.replay_rejections, 16);
    return <span className="text-xs text-gray-500">{average} Mbps · replay {replay}</span>;
  }

  const detailEntries = Object.entries(event.details || {}).filter(([, value]) => (
    value !== null && value !== undefined && typeof value !== 'object'
  ));
  const firstDetail = detailEntries[0];

  if (event.command_id) {
    return <span className="font-mono text-xs text-gray-500">{event.command_id.slice(0, 8)}</span>;
  }
  if (event.session_id) {
    return <span className="font-mono text-xs text-gray-500">{event.session_id}</span>;
  }
  if (!firstDetail) {
    return <span className="text-xs text-gray-600">-</span>;
  }
  return (
    <span className="text-xs text-gray-500">
      {firstDetail[0]}: {String(firstDetail[1]).slice(0, 36)}
    </span>
  );
}

type DetailRow = {
  label: string;
  value: React.ReactNode;
};

function buildDetailRows(event: VpnEvent): DetailRow[] {
  const details = event.details || {};
  const rows: DetailRow[] = [];

  if (event.type === 'node_policy_changed') {
    const changes = isRecord(details.changes) ? details.changes : {};
    Object.entries(changes).slice(0, 10).forEach(([field, value]) => {
      const change = isRecord(value) ? value : {};
      rows.push({
        label: field,
        value: (
          <span className="font-mono">
            {shortValue(change.old, 48)}
            <span className="mx-2 text-gray-600">-&gt;</span>
            {shortValue(change.new, 48)}
          </span>
        ),
      });
    });

    rows.push(
      { label: 'Changed by', value: shortValue(details.changed_by_wallet, 80) },
      { label: 'Source', value: shortValue(details.source, 80) },
      { label: 'Audit ID', value: shortValue(details.audit_id, 80) }
    );
    return rows.filter((row) => row.value !== '-');
  }

  const preferredKeys = [
    'maintenance_rejections',
    'max_sessions_rejections',
    'bandwidth_drops',
    'last_rejection_reason',
    'last_rejection_at',
    'observed_mbps',
    'bandwidth_limit_mbps',
    'limit_ratio',
    'average_mbps',
    'total_bytes',
    'duration_seconds',
    'virtual_ip',
    'replay_rejections',
    'too_old_rejections',
    'rx_delta_bytes',
    'tx_delta_bytes',
    'privacy_boundary',
    'error_message',
    'degraded_reason',
    'quality_status',
    'quality_score',
    'last_activity_age_seconds',
    'rtt_ms',
    'packet_loss',
    'bytes_in',
    'bytes_out',
    'client_wallet',
    'retry_count',
    'expires_at',
    'params',
    'result',
    'check',
    'health_status',
    'health_score',
    'last_seen_seconds',
  ];

  preferredKeys.forEach((key) => {
    if (details[key] !== undefined && details[key] !== null && details[key] !== '') {
      rows.push({ label: key, value: shortValue(details[key], 180) });
    }
  });

  if (!rows.length) {
    Object.entries(details).slice(0, 8).forEach(([key, value]) => {
      rows.push({ label: key, value: shortValue(value, 180) });
    });
  }

  return rows;
}

function runbookHint(event: VpnEvent): string {
  const details = event.details || {};
  const check = typeof details.check === 'string' ? details.check : '';
  const reason = typeof details.degraded_reason === 'string' ? details.degraded_reason : '';

  if (event.type === 'node_policy_enforced') {
    return 'Review Settings for maintenance, max sessions, or bandwidth caps before changing the Rust node. These are expected policy blocks, not packet inspection.';
  }

  if (event.type === 'bandwidth_limit_pressure') {
    return 'Check whether the node is intentionally capped in Settings. Increase bandwidth_limit_mbps or move traffic to another region/tier if paid users are affected.';
  }

  if (event.type === 'node_policy_changed') {
    return 'Use this audit trail to confirm who changed placement, tier, maintenance, session caps, bandwidth, or heartbeat policy before correlating later health events.';
  }

  if (event.type === 'session_degraded' || event.type === 'session_stale') {
    if (reason.includes('rtt')) {
      return 'High RTT usually points to route congestion or bad regional placement. Compare the node region with the user cohort and check bandwidth pressure events.';
    }
    if (reason.includes('rx') || reason.includes('tx') || reason.includes('stale')) {
      return 'Stale RX/TX usually means the tunnel stopped carrying traffic. Check node heartbeat freshness, then use VPN Operations to kick the affected session if it remains active.';
    }
    return 'Open VPN Operations to identify the affected session, virtual IP, last activity, RTT, and packet loss before deciding whether to kick or ban.';
  }

  if (event.source === 'node_command') {
    return 'Open Node Detail command history for lifecycle timing and structured output. Retry only after the previous command is completed, failed, cancelled, or timed out.';
  }

  if (check === 'dns_stub' || check === 'dns_query') {
    return 'DNS failure usually breaks browsing while the tunnel is up. Use Collect Logs on Node Detail, then check local resolver and firewall configuration on the node.';
  }
  if (check === 'nat_masquerade' || check === 'ip_forward') {
    return 'NAT or forwarding failure means clients can connect but cannot exit to the Internet. Check forwarding/NAT config and consider maintenance mode while fixing.';
  }
  if (check === 'tun_device' || check === 'mtu_config') {
    return 'TUN or MTU failure points to local VPN interface configuration. Use System Info and Collect Logs, then restart VPN only if diagnostics confirm the service is wedged.';
  }
  if (check === 'internet_egress') {
    return 'Egress failure means the node cannot reach the Internet. Move traffic away from this node and verify provider networking before accepting new sessions.';
  }
  if (check === 'udp_listener') {
    return 'UDP listener failure means new clients cannot connect. Check service status from Node Detail and use Restart VPN if the process is unhealthy.';
  }

  if (event.severity === 'critical') {
    return 'Start with Node Detail health checks, then use maintenance mode to stop new handshakes while you confirm whether active sessions are affected.';
  }
  if (event.severity === 'warning') {
    return 'Correlate this warning with recent Settings audits, session quality, and policy enforcement before taking disruptive action.';
  }

  return '';
}

function EventDetailPanel({ event }: { event: VpnEvent }) {
  const rows = buildDetailRows(event);
  const hint = runbookHint(event);

  if (!rows.length && !hint) {
    return <div className="text-xs text-gray-600">No structured details for this event.</div>;
  }

  return (
    <div className="space-y-3">
      {hint && (
        <div className="rounded-md border border-purple-500/20 bg-purple-500/10 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-purple-300">Runbook Hint</div>
          <div className="mt-1 text-xs text-gray-300">{hint}</div>
        </div>
      )}
      {rows.length > 0 && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0 rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-gray-600">{row.label}</div>
              <div className="mt-1 text-xs text-gray-300 break-words">{row.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventsTable({ events }: { events: VpnEvent[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!events.length) {
    return (
      <EmptyState
        icon={<EventIcon />}
        title="No Events"
        description="Matching VPN health, session, command, and policy events will appear here."
      />
    );
  }

  return (
    <Card variant="default" padding="none">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Event Stream</h2>
          <p className="text-xs text-gray-500 mt-1">Node health, session errors, operator commands, and policy changes</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-xs uppercase text-gray-500 bg-white/[0.02]">
            <tr>
              <th className="text-left font-medium px-5 py-3">Severity</th>
              <th className="text-left font-medium px-4 py-3">Event</th>
              <th className="text-left font-medium px-4 py-3">Node</th>
              <th className="text-left font-medium px-4 py-3">Source</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-left font-medium px-4 py-3">Ref</th>
              <th className="text-left font-medium px-5 py-3">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {events.map((event) => {
              const isExpanded = expandedId === event.id;
              return (
                <React.Fragment key={event.id}>
                  <tr className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-4">
                      <SeverityBadge severity={event.severity} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{event.title}</div>
                      <div className="text-xs text-gray-500 mt-1 max-w-[360px] truncate">{event.message}</div>
                      <div className="text-xs text-gray-600 mt-1">{event.type}</div>
                    </td>
                    <td className="px-4 py-4">
                      {event.node_id ? (
                        <Link href={`/dashboard/nodes/${event.node_id}`} className="text-gray-300 hover:text-purple-300">
                          {event.node_name || 'node'}
                        </Link>
                      ) : (
                        <div className="text-gray-300">{event.node_name || 'all nodes'}</div>
                      )}
                      {event.node_id && (
                        <div className="text-xs text-gray-600 font-mono mt-1">{event.node_id.slice(0, 8)}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-400">{event.source}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
                        {event.status || 'open'}
                      </span>
                      {event.action && <div className="text-xs text-gray-600 mt-1">{event.action}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <DetailsPreview event={event} />
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedId(isExpanded ? null : event.id)}
                          className="block text-xs font-medium text-purple-300 hover:text-purple-200"
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-400">
                      {event.created_at ? formatRelativeTime(event.created_at) : 'now'}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-white/[0.015]">
                      <td colSpan={7} className="px-5 py-4">
                        <EventDetailPanel event={event} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function VpnEventsPage() {
  const [days, setDays] = useState(7);
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [eventType, setEventType] = useState('');
  const [nodeId, setNodeId] = useState('');

  const options = useMemo<UseVpnEventsOptions>(() => ({
    days,
    severity,
    type: eventType || undefined,
    nodeId: nodeId || undefined,
    limit: 250,
  }), [days, severity, eventType, nodeId]);

  const { nodes } = useNodes();
  const { events, isLoading, isError, error, refetch } = useVpnEvents(options);

  const typeOptions = useMemo(() => {
    const types = new Set((events?.events ?? []).map((event) => event.type));
    if (eventType) types.add(eventType);
    return Array.from(types).sort();
  }, [events, eventType]);

  if (isLoading && !events) {
    return (
      <div className="space-y-6">
        <LoadingCard />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<EventIcon />}
        title="Events Unavailable"
        description={error?.message || 'Unable to load VPN events.'}
        action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  const summary = events?.summary ?? {
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    open: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts / Events</h1>
          <p className="text-sm text-gray-500 mt-1">
            {events?.generated_at ? `Updated ${formatRelativeTime(events.generated_at)}` : 'Waiting for event data'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => refetch()}>Refresh</Button>
      </div>

      <QueryBar
        days={days}
        severity={severity}
        eventType={eventType}
        nodeId={nodeId}
        nodes={nodes.map((node) => ({ id: node.id, name: node.name }))}
        typeOptions={typeOptions}
        onDays={setDays}
        onSeverity={setSeverity}
        onType={setEventType}
        onNode={setNodeId}
        onRefresh={() => refetch()}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard label="Open" value={summary.open} tone="open" />
        <SummaryCard label="Critical" value={summary.critical} tone="critical" />
        <SummaryCard label="Warning" value={summary.warning} tone="warning" />
        <SummaryCard label="Info" value={summary.info} tone="info" />
      </div>

      <EventsTable events={events?.events ?? []} />
    </div>
  );
}
