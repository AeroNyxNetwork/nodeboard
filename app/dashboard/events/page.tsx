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

function DetailsPreview({ event }: { event: VpnEvent }) {
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

function EventsTable({ events }: { events: VpnEvent[] }) {
  if (!events.length) {
    return (
      <EmptyState
        icon={<EventIcon />}
        title="No Events"
        description="Matching VPN health, session, and command events will appear here."
      />
    );
  }

  return (
    <Card variant="default" padding="none">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Event Stream</h2>
          <p className="text-xs text-gray-500 mt-1">Node health, session errors, and operator commands</p>
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
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-white/[0.03] transition-colors">
                <td className="px-5 py-4">
                  <SeverityBadge severity={event.severity} />
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-white">{event.title}</div>
                  <div className="text-xs text-gray-500 mt-1 max-w-[360px] truncate">{event.message}</div>
                  <div className="text-xs text-gray-600 mt-1">{event.type}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-gray-300">{event.node_name || 'all nodes'}</div>
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
                  <DetailsPreview event={event} />
                </td>
                <td className="px-5 py-4 text-gray-400">
                  {event.created_at ? formatRelativeTime(event.created_at) : 'now'}
                </td>
              </tr>
            ))}
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
