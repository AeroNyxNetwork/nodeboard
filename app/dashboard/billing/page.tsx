/**
 * AeroNyx Traffic & Billing page.
 *
 * Source path:
 *   /root/open/nodeboard/app/dashboard/billing/page.tsx
 *
 * Backend:
 *   GET /api/privacy_network/vpn/billing/
 */

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useNodes, useVpnBilling, UseVpnBillingOptions } from '@/hooks/useNodes';
import { VpnBillingDailyRow, VpnBillingIdentityRow, VpnBillingNodeRow, VpnBillingSessionRow } from '@/types';
import { formatDuration, formatRelativeTime } from '@/lib/api';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';

type BillingTab = 'nodes' | 'identities' | 'sessions' | 'daily';

const STATUS_OPTIONS: Array<NonNullable<UseVpnBillingOptions['status']>> = [
  'all',
  'active',
  'completed',
  'error',
];

function mb(value: number | null | undefined) {
  return `${(value || 0).toFixed(2)} MB`;
}

function gbFromBytes(value: number | null | undefined) {
  return `${((value || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function vpnSessionsHref({
  nodeId,
  status,
  q,
}: {
  nodeId?: string;
  status?: string;
  q?: string;
}) {
  const params = new URLSearchParams();
  params.set('status', status || 'all');
  params.set('quality', 'all');
  if (nodeId) params.set('node', nodeId);
  if (q) params.set('q', q);
  return `/dashboard/sessions?${params.toString()}`;
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return 'unlimited';
  return `${value.toFixed(1)}%`;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, rows: object[]) {
  if (!rows.length) return;
  const records = rows as Array<Record<string, unknown>>;
  const headers = Object.keys(records[0]);
  const body = [
    headers.join(','),
    ...records.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SummaryCards({ billing }: { billing: NonNullable<ReturnType<typeof useVpnBilling>['billing']> }) {
  const monthly = billing.quota.monthly;
  const daily = billing.quota.daily_vpn_usage;
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <Card variant="default" padding="md">
        <p className="text-xs text-gray-500">Traffic</p>
        <p className="text-2xl font-semibold text-white mt-2">{mb(billing.summary.total_traffic_mb)}</p>
        <p className="text-xs text-gray-600 mt-1">
          {billing.summary.total_sessions} sessions
        </p>
      </Card>
      <Card variant="default" padding="md">
        <p className="text-xs text-gray-500">Active Sessions</p>
        <p className="text-2xl font-semibold text-white mt-2">{billing.summary.active_sessions}</p>
        <p className="text-xs text-gray-600 mt-1">
          {billing.summary.error_sessions} errors
        </p>
      </Card>
      <Card variant="default" padding="md">
        <p className="text-xs text-gray-500">Monthly Quota</p>
        <p className="text-2xl font-semibold text-white mt-2">
          {monthly?.is_unlimited ? 'Unlimited' : gbFromBytes(monthly?.remaining_bytes)}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {monthly ? `${pct(monthly.usage_percent)} used` : 'not initialized'}
        </p>
      </Card>
      <Card variant="default" padding="md">
        <p className="text-xs text-gray-500">Voucher Time</p>
        <p className="text-2xl font-semibold text-white mt-2">
          {daily.is_unlimited ? 'Unlimited' : formatDuration(daily.remaining_seconds || 0)}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {billing.voucher_accounting.issued_vouchers} issued this epoch
        </p>
      </Card>
    </div>
  );
}

function BillingAttention({ billing }: { billing: NonNullable<ReturnType<typeof useVpnBilling>['billing']> }) {
  const monthly = billing.quota.monthly;
  const daily = billing.quota.daily_vpn_usage;
  const items: Array<{ label: string; value: string; tone: 'red' | 'yellow' | 'green'; note: string }> = [];

  if (monthly?.is_exceeded) {
    items.push({
      label: 'Monthly quota exceeded',
      value: pct(monthly.usage_percent),
      tone: 'red',
      note: 'Upgrade quota or reduce paid traffic before accepting more voucher-backed sessions.',
    });
  } else if (monthly && !monthly.is_unlimited && (monthly.usage_percent || 0) >= 80) {
    items.push({
      label: 'Monthly quota pressure',
      value: pct(monthly.usage_percent),
      tone: 'yellow',
      note: 'Watch node traffic and identity rows for the largest consumers before quota is exhausted.',
    });
  }

  if (!daily.can_connect || daily.is_exceeded) {
    items.push({
      label: 'Daily VPN access blocked',
      value: daily.is_unlimited ? 'unlimited' : formatDuration(daily.remaining_seconds || 0),
      tone: 'red',
      note: 'The centralized quota service says this operator cannot connect more VPN time today.',
    });
  } else if (!daily.is_unlimited && (daily.usage_percent || 0) >= 80) {
    items.push({
      label: 'Daily VPN time pressure',
      value: pct(daily.usage_percent),
      tone: 'yellow',
      note: 'Review active sessions and voucher reservations before the daily VPN allowance runs out.',
    });
  }

  if (billing.summary.error_sessions > 0) {
    items.push({
      label: 'Session errors in billing window',
      value: String(billing.summary.error_sessions),
      tone: 'yellow',
      note: 'Open the Sessions tab or VPN Operations to inspect last_error, RTT, packet loss, and affected nodes.',
    });
  }

  if (!items.length) {
    items.push({
      label: 'Billing posture clear',
      value: 'ok',
      tone: 'green',
      note: 'Quota and session accounting are within expected operating bounds for the current filters.',
    });
  }

  const toneClass = {
    red: 'border-red-500/30 bg-red-500/10 text-red-200',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  };

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      {items.slice(0, 3).map((item) => (
        <div key={item.label} className={`rounded-lg border px-4 py-3 ${toneClass[item.tone]}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{item.label}</p>
            <span className="text-xs">{item.value}</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">{item.note}</p>
        </div>
      ))}
    </div>
  );
}

function QueryBar({
  days,
  status,
  nodeId,
  query,
  onDays,
  onStatus,
  onNode,
  onQuery,
  nodes,
  onRefresh,
  onExport,
}: {
  days: number;
  status: NonNullable<UseVpnBillingOptions['status']>;
  nodeId: string;
  query: string;
  onDays: (value: number) => void;
  onStatus: (value: NonNullable<UseVpnBillingOptions['status']>) => void;
  onNode: (value: string) => void;
  onQuery: (value: string) => void;
  nodes: { id: string; name: string }[];
  onRefresh: () => void;
  onExport: () => void;
}) {
  return (
    <Card variant="default" padding="md">
      <div className="grid md:grid-cols-[120px_150px_1fr_1.2fr_auto_auto] gap-3 items-end">
        <label className="block">
          <span className="text-xs text-gray-500">Days</span>
          <select
            value={days}
            onChange={(event) => onDays(Number(event.target.value))}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          >
            {[7, 14, 30, 60, 90].map((value) => (
              <option key={value} value={value} className="bg-[#111118]">
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Status</span>
          <select
            value={status}
            onChange={(event) => onStatus(event.target.value as NonNullable<UseVpnBillingOptions['status']>)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          >
            {STATUS_OPTIONS.map((value) => (
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
        <label className="block">
          <span className="text-xs text-gray-500">Wallet / Session</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search wallet or session_id"
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500/50"
          />
        </label>
        <Button variant="secondary" onClick={onRefresh}>Refresh</Button>
        <Button variant="primary" onClick={onExport}>Export CSV</Button>
      </div>
    </Card>
  );
}

function NodeTable({ rows }: { rows: VpnBillingNodeRow[] }) {
  if (!rows.length) return <EmptyTable label="No node traffic in this range." />;
  return (
    <DataTable
      headers={['Node', 'Region', 'Tier', 'Sessions', 'Traffic', 'Duration', 'Last Seen', 'Ops']}
      rows={rows.map((row) => [
        <Link href={`/dashboard/nodes/${row.node_id}`} className="text-purple-300 hover:text-purple-200">
          {row.node_name}
        </Link>,
        row.region_code || row.city || 'unknown',
        row.node_tier,
        `${row.sessions} (${row.active_sessions} active)`,
        mb(row.total_traffic_mb),
        formatDuration(row.duration_seconds),
        row.last_seen ? formatRelativeTime(row.last_seen) : 'never',
        <Link href={vpnSessionsHref({ nodeId: row.node_id })} className="text-sky-300 hover:text-sky-200">
          Open Sessions
        </Link>,
      ])}
    />
  );
}

function IdentityTable({ rows }: { rows: VpnBillingIdentityRow[] }) {
  if (!rows.length) return <EmptyTable label="No identity traffic in this range." />;
  return (
    <DataTable
      headers={['Identity', 'Tier', 'Sessions', 'Traffic', 'Duration', 'Last Seen', 'Ops']}
      rows={rows.map((row) => [
        row.wallet_short || 'unknown',
        row.tier,
        `${row.sessions} (${row.active_sessions} active)`,
        mb(row.total_traffic_mb),
        formatDuration(row.duration_seconds),
        row.last_seen ? formatRelativeTime(row.last_seen) : 'never',
        <Link href={vpnSessionsHref({ q: row.client_wallet || row.wallet_short })} className="text-sky-300 hover:text-sky-200">
          Open Sessions
        </Link>,
      ])}
      monoFirstColumn
    />
  );
}

function DailyTable({ rows }: { rows: VpnBillingDailyRow[] }) {
  if (!rows.length) return <EmptyTable label="No daily traffic in this range." />;
  return (
    <DataTable
      headers={['Day', 'Sessions', 'Ingress', 'Egress', 'Total', 'Duration']}
      rows={rows.map((row) => [
        row.day,
        row.sessions,
        gbFromBytes(row.bytes_in),
        gbFromBytes(row.bytes_out),
        mb(row.total_traffic_mb),
        formatDuration(row.duration_seconds),
      ])}
    />
  );
}

function SessionTable({ rows }: { rows: VpnBillingSessionRow[] }) {
  if (!rows.length) return <EmptyTable label="No session traffic matches these filters." />;
  return (
    <DataTable
      headers={['Session', 'VIP', 'Identity', 'Node', 'Status', 'Traffic', 'Duration', 'Last Activity', 'Quality', 'Ops']}
      rows={rows.map((row) => {
        const lastActivity = row.last_rx_at || row.last_tx_at || row.updated_at;
        return [
          <Link href={vpnSessionsHref({ nodeId: row.node_id, status: row.status, q: row.session_id })} className="text-sky-300 hover:text-sky-200">
            {row.session_id}
          </Link>,
          row.virtual_ip || 'pending',
          row.wallet_short || 'unknown',
          <Link href={`/dashboard/nodes/${row.node_id}`} className="text-purple-300 hover:text-purple-200">
            {row.node_name}
          </Link>,
          row.status,
          mb(row.total_traffic_mb),
          formatDuration(row.duration_seconds),
          lastActivity ? formatRelativeTime(lastActivity) : 'pending',
          row.last_error || `RTT ${row.rtt_ms === null ? 'pending' : `${row.rtt_ms} ms`}`,
          <Link href={vpnSessionsHref({ nodeId: row.node_id, status: row.status, q: row.session_id })} className="text-sky-300 hover:text-sky-200">
            Open Sessions
          </Link>,
        ];
      })}
      monoFirstColumn
    />
  );
}

function EmptyTable({ label }: { label: string }) {
  return (
    <div className="p-10 text-center">
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

function DataTable({
  headers,
  rows,
  monoFirstColumn = false,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
  monoFirstColumn?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
            {headers.map((header) => (
              <th key={header} className="px-5 py-3 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-white/[0.02]">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}`}
                  className={`px-5 py-4 text-sm ${cellIndex === 0 && monoFirstColumn ? 'font-mono text-gray-200' : 'text-gray-300'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BillingPage() {
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState<NonNullable<UseVpnBillingOptions['status']>>('all');
  const [nodeId, setNodeId] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<BillingTab>('nodes');
  const { nodes } = useNodes();
  const options = useMemo(() => ({
    days,
    status,
    nodeId: nodeId || undefined,
    q: query.trim() || undefined,
  }), [days, status, nodeId, query]);
  const { billing, isLoading, isError, refetch } = useVpnBilling(options);

  const exportRows = useMemo(() => {
    if (!billing) return [];
    if (tab === 'identities') return billing.identities;
    if (tab === 'sessions') return billing.sessions;
    if (tab === 'daily') return billing.daily;
    return billing.nodes;
  }, [billing, tab]);

  const handleExport = () => {
    downloadCsv(`aeronyx-${tab}-billing-${days}d.csv`, exportRows);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Traffic & Billing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Node, identity, quota, and voucher accounting.
          </p>
        </div>
        {billing?.generated_at && (
          <p className="text-xs text-gray-600">Updated {formatRelativeTime(billing.generated_at)}</p>
        )}
      </div>

      <QueryBar
        days={days}
        status={status}
        nodeId={nodeId}
        query={query}
        nodes={nodes.map((node) => ({ id: node.id, name: node.name }))}
        onDays={setDays}
        onStatus={setStatus}
        onNode={setNodeId}
        onQuery={setQuery}
        onRefresh={refetch}
        onExport={handleExport}
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
          <div className="h-96 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      ) : isError || !billing ? (
        <Card variant="outline" padding="lg" className="text-center">
          <p className="text-sm text-yellow-300 mb-4">Billing data could not be loaded.</p>
          <Button variant="secondary" onClick={refetch}>Retry</Button>
        </Card>
      ) : (
        <>
          <SummaryCards billing={billing} />
          <BillingAttention billing={billing} />

          <div className="grid lg:grid-cols-3 gap-4">
            <Card variant="default" padding="md">
              <p className="text-xs text-gray-500">Voucher Epoch</p>
              <p className="text-lg font-semibold text-white mt-2">{billing.voucher_accounting.epoch}</p>
              <p className="text-xs text-gray-600 mt-1">
                {billing.voucher_accounting.issue_events} issue events
              </p>
            </Card>
            <Card variant="default" padding="md">
              <p className="text-xs text-gray-500">Daily Reserved</p>
              <p className="text-lg font-semibold text-white mt-2">
                {formatDuration(billing.quota.daily_vpn_usage.reserved_seconds)}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {pct(billing.quota.daily_vpn_usage.usage_percent)} used
              </p>
            </Card>
            <Card variant="default" padding="md">
              <p className="text-xs text-gray-500">Identity Count</p>
              <p className="text-lg font-semibold text-white mt-2">{billing.known_identity_count}</p>
              <p className="text-xs text-gray-600 mt-1">
                {billing.tiers.map((item) => `${item.tier}: ${item.sessions}`).join('  ') || 'no tier matches'}
              </p>
            </Card>
          </div>

          <Card variant="outline" padding="md">
            <p className="text-xs text-gray-500">Privacy Boundary</p>
            <p className="text-sm text-gray-300 mt-1">{billing.privacy_note}</p>
          </Card>

          <Card variant="default" padding="none">
            <div className="px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex gap-2">
                {(['nodes', 'identities', 'sessions', 'daily'] as BillingTab[]).map((value) => (
                  <button
                    key={value}
                    onClick={() => setTab(value)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      tab === value
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        : 'bg-white/[0.03] text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    {value === 'nodes' ? 'Nodes' : value === 'identities' ? 'Identities' : value === 'sessions' ? 'Sessions' : 'Daily'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600">
                {billing.filters.days}d · {billing.filters.status}
                {billing.filters.q ? ` · ${billing.summary.matched_session_count} matches` : ''}
              </p>
            </div>
            {tab === 'nodes' && <NodeTable rows={billing.nodes} />}
            {tab === 'identities' && <IdentityTable rows={billing.identities} />}
            {tab === 'sessions' && <SessionTable rows={billing.sessions} />}
            {tab === 'daily' && <DailyTable rows={billing.daily} />}
          </Card>
        </>
      )}
    </div>
  );
}
