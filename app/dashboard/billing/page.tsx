/**
 * ============================================
 * AeroNyx Traffic & Billing Page
 * ============================================
 *
 * Source path:
 *   /root/open/nodeboard/app/dashboard/billing/page.tsx
 *
 * Backend:
 *   GET /api/privacy_network/vpn/billing/
 *
 * Main Functionality:
 *   - Quota, traffic, session, and voucher operating summaries
 *   - Debounced server-side filters with authoritative refresh state
 *   - Formula-safe multilingual CSV export
 *   - Responsive node, identity, session, and daily detail views
 *
 * Last Modified: v1.1.0 - [BILLING-UX 2026-08-13 by Codex]
 *   Hardened CSV export, debounced search, surfaced background refresh, and
 *   made filters and detail tabs reliable on narrow operator screens.
 * Previous: v1.0.0 - Initial traffic and billing operations page.
 * ============================================
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useNodes, useVpnBilling, UseVpnBillingOptions } from '@/hooks/useNodes';
import { VpnBillingDailyRow, VpnBillingIdentityRow, VpnBillingNodeRow, VpnBillingSessionRow } from '@/types';
import { formatDuration } from '@/lib/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';

type BillingTab = 'nodes' | 'identities' | 'sessions' | 'daily';

const STATUS_OPTIONS: Array<NonNullable<UseVpnBillingOptions['status']>> = [
  'all',
  'active',
  'completed',
  'error',
];
const BILLING_TABS: BillingTab[] = ['nodes', 'identities', 'sessions', 'daily'];
const SEARCH_DEBOUNCE_MS = 350;

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;
type FormatNumberFn = (value: number, options?: Intl.NumberFormatOptions) => string;

function mb(value: number | null | undefined, formatNumber: FormatNumberFn) {
  return `${formatNumber(value || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
}

function gbFromBytes(value: number | null | undefined, formatNumber: FormatNumberFn) {
  return `${formatNumber((value || 0) / (1024 * 1024 * 1024), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`;
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

function pct(value: number | null | undefined, t: TranslateFn, formatNumber: FormatNumberFn) {
  if (value === null || value === undefined) return t('billing.summary.unlimited');
  return `${formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  // [BILLING-UX 2026-08-13 by Codex] Node names and session fields can be
  // operator-controlled. Neutralize spreadsheet formulas before quoting so
  // opening an export in Excel or Numbers cannot execute the cell as code.
  const safe = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

function downloadCsv(filename: string, rows: object[]) {
  if (!rows.length) return;
  const records = rows as Array<Record<string, unknown>>;
  const headers = Object.keys(records[0]);
  const body = `\uFEFF${[
    headers.join(','),
    ...records.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\r\n')}`;
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari may not consume the object URL until after the click task returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SummaryCards({ billing }: { billing: NonNullable<ReturnType<typeof useVpnBilling>['billing']> }) {
  const { t, formatNumber } = useI18n();
  const monthly = billing.quota.monthly;
  const daily = billing.quota.daily_vpn_usage;
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <Card variant="default" padding="md">
        <p className="text-xs text-gray-500">{t('billing.summary.traffic')}</p>
        <p className="text-2xl font-semibold text-white mt-2">{mb(billing.summary.total_traffic_mb, formatNumber)}</p>
        <p className="text-xs text-gray-600 mt-1">
          {t('billing.summary.sessions', { count: formatNumber(billing.summary.total_sessions) })}
        </p>
      </Card>
      <Card variant="default" padding="md">
        <p className="text-xs text-gray-500">{t('billing.summary.activeSessions')}</p>
        <p className="text-2xl font-semibold text-white mt-2">{formatNumber(billing.summary.active_sessions)}</p>
        <p className="text-xs text-gray-600 mt-1">
          {t('billing.summary.errors', { count: formatNumber(billing.summary.error_sessions) })}
        </p>
      </Card>
      <Card variant="default" padding="md">
        <p className="text-xs text-gray-500">{t('billing.summary.monthlyQuota')}</p>
        <p className="text-2xl font-semibold text-white mt-2">
          {monthly?.is_unlimited ? t('billing.summary.unlimited') : gbFromBytes(monthly?.remaining_bytes, formatNumber)}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {monthly
            ? t('billing.summary.used', { value: pct(monthly.usage_percent, t, formatNumber) })
            : t('billing.summary.notInitialized')}
        </p>
      </Card>
      <Card variant="default" padding="md">
        <p className="text-xs text-gray-500">{t('billing.summary.voucherTime')}</p>
        <p className="text-2xl font-semibold text-white mt-2">
          {daily.is_unlimited ? t('billing.summary.unlimited') : formatDuration(daily.remaining_seconds || 0)}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {t('billing.summary.issuedThisEpoch', { count: formatNumber(billing.voucher_accounting.issued_vouchers) })}
        </p>
      </Card>
    </div>
  );
}

function BillingAttention({ billing }: { billing: NonNullable<ReturnType<typeof useVpnBilling>['billing']> }) {
  const { t, formatNumber } = useI18n();
  const monthly = billing.quota.monthly;
  const daily = billing.quota.daily_vpn_usage;
  const items: Array<{ label: string; value: string; tone: 'red' | 'yellow' | 'green'; note: string }> = [];

  if (monthly?.is_exceeded) {
    items.push({
      label: t('billing.attention.monthlyExceeded'),
      value: pct(monthly.usage_percent, t, formatNumber),
      tone: 'red',
      note: t('billing.attention.monthlyExceededNote'),
    });
  } else if (monthly && !monthly.is_unlimited && (monthly.usage_percent || 0) >= 80) {
    items.push({
      label: t('billing.attention.monthlyPressure'),
      value: pct(monthly.usage_percent, t, formatNumber),
      tone: 'yellow',
      note: t('billing.attention.monthlyPressureNote'),
    });
  }

  if (!daily.can_connect || daily.is_exceeded) {
    items.push({
      label: t('billing.attention.dailyBlocked'),
      value: daily.is_unlimited ? t('billing.summary.unlimited') : formatDuration(daily.remaining_seconds || 0),
      tone: 'red',
      note: t('billing.attention.dailyBlockedNote'),
    });
  } else if (!daily.is_unlimited && (daily.usage_percent || 0) >= 80) {
    items.push({
      label: t('billing.attention.dailyPressure'),
      value: pct(daily.usage_percent, t, formatNumber),
      tone: 'yellow',
      note: t('billing.attention.dailyPressureNote'),
    });
  }

  if (billing.summary.error_sessions > 0) {
    items.push({
      label: t('billing.attention.sessionErrors'),
      value: formatNumber(billing.summary.error_sessions),
      tone: 'yellow',
      note: t('billing.attention.sessionErrorsNote'),
    });
  }

  if (!items.length) {
    items.push({
      label: t('billing.attention.clear'),
      value: t('common.status.ok'),
      tone: 'green',
      note: t('billing.attention.clearNote'),
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
  isRefreshing,
  isUpdating,
  canExport,
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
  isRefreshing: boolean;
  isUpdating: boolean;
  canExport: boolean;
}) {
  const { t } = useI18n();
  return (
    <Card variant="default" padding="md">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[120px_150px_minmax(0,1fr)_minmax(0,1.2fr)] xl:items-end 2xl:grid-cols-[120px_150px_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
        <label className="block">
          <span className="text-xs text-gray-500">{t('billing.filters.days')}</span>
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
          <span className="text-xs text-gray-500">{t('billing.filters.status')}</span>
          <select
            value={status}
            onChange={(event) => onStatus(event.target.value as NonNullable<UseVpnBillingOptions['status']>)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value} className="bg-[#111118]">
                {t(`common.status.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2 xl:col-span-1">
          <span className="text-xs text-gray-500">{t('billing.filters.node')}</span>
          <select
            value={nodeId}
            onChange={(event) => onNode(event.target.value)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          >
            <option value="" className="bg-[#111118]">{t('billing.filters.allNodes')}</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id} className="bg-[#111118]">
                {node.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2 xl:col-span-1">
          <span className="text-xs text-gray-500">{t('billing.filters.walletSession')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={t('billing.filters.searchPlaceholder')}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-busy={isUpdating}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500/50"
          />
        </label>
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 xl:col-span-4 xl:flex xl:justify-end 2xl:col-span-1">
          <Button
            variant="secondary"
            onClick={onRefresh}
            isLoading={isRefreshing}
            disabled={isUpdating}
            className="w-full xl:w-auto"
          >
            {isRefreshing ? t('common.refreshing') : t('common.refreshNow')}
          </Button>
          <Button
            variant="primary"
            onClick={onExport}
            disabled={!canExport}
            className="w-full xl:w-auto"
          >
            {t('billing.filters.exportCsv')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function NodeTable({ rows }: { rows: VpnBillingNodeRow[] }) {
  const { t, formatNumber, formatRelativeTime } = useI18n();
  if (!rows.length) return <EmptyTable label={t('billing.table.emptyNodes')} />;
  return (
    <DataTable
      headers={[t('billing.table.node'), t('billing.table.region'), t('billing.table.tier'), t('billing.table.sessions'), t('billing.table.traffic'), t('billing.table.duration'), t('billing.table.lastSeen'), t('billing.table.ops')]}
      rows={rows.map((row) => [
        <Link href={`/dashboard/nodes/${row.node_id}`} className="text-purple-300 hover:text-purple-200">
          {row.node_name}
        </Link>,
        row.region_code || row.city || t('common.status.unknown'),
        row.node_tier,
        t('billing.table.activeCount', { total: formatNumber(row.sessions), active: formatNumber(row.active_sessions) }),
        mb(row.total_traffic_mb, formatNumber),
        formatDuration(row.duration_seconds),
        row.last_seen ? formatRelativeTime(row.last_seen) : t('billing.table.never'),
        <Link href={vpnSessionsHref({ nodeId: row.node_id })} className="text-sky-300 hover:text-sky-200">
          {t('billing.table.openSessions')}
        </Link>,
      ])}
    />
  );
}

function IdentityTable({ rows }: { rows: VpnBillingIdentityRow[] }) {
  const { t, formatNumber, formatRelativeTime } = useI18n();
  if (!rows.length) return <EmptyTable label={t('billing.table.emptyIdentities')} />;
  return (
    <DataTable
      headers={[t('billing.table.identity'), t('billing.table.tier'), t('billing.table.sessions'), t('billing.table.traffic'), t('billing.table.duration'), t('billing.table.lastSeen'), t('billing.table.ops')]}
      rows={rows.map((row) => [
        row.wallet_short || t('common.status.unknown'),
        row.tier,
        t('billing.table.activeCount', { total: formatNumber(row.sessions), active: formatNumber(row.active_sessions) }),
        mb(row.total_traffic_mb, formatNumber),
        formatDuration(row.duration_seconds),
        row.last_seen ? formatRelativeTime(row.last_seen) : t('billing.table.never'),
        <Link href={vpnSessionsHref({ q: row.client_wallet || row.wallet_short })} className="text-sky-300 hover:text-sky-200">
          {t('billing.table.openSessions')}
        </Link>,
      ])}
      monoFirstColumn
    />
  );
}

function DailyTable({ rows }: { rows: VpnBillingDailyRow[] }) {
  const { t, formatNumber } = useI18n();
  if (!rows.length) return <EmptyTable label={t('billing.table.emptyDaily')} />;
  return (
    <DataTable
      headers={[t('billing.table.day'), t('billing.table.sessions'), t('billing.table.ingress'), t('billing.table.egress'), t('billing.table.total'), t('billing.table.duration')]}
      rows={rows.map((row) => [
        row.day,
        formatNumber(row.sessions),
        gbFromBytes(row.bytes_in, formatNumber),
        gbFromBytes(row.bytes_out, formatNumber),
        mb(row.total_traffic_mb, formatNumber),
        formatDuration(row.duration_seconds),
      ])}
    />
  );
}

function SessionTable({ rows }: { rows: VpnBillingSessionRow[] }) {
  const { t, formatNumber, formatRelativeTime } = useI18n();
  if (!rows.length) return <EmptyTable label={t('billing.table.emptySessions')} />;
  return (
    <DataTable
      headers={[t('billing.table.session'), t('billing.table.vip'), t('billing.table.identity'), t('billing.table.node'), t('billing.table.status'), t('billing.table.traffic'), t('billing.table.duration'), t('billing.table.lastActivity'), t('billing.table.quality'), t('billing.table.ops')]}
      rows={rows.map((row) => {
        const lastActivity = row.last_rx_at || row.last_tx_at || row.updated_at;
        return [
          <Link href={vpnSessionsHref({ nodeId: row.node_id, status: row.status, q: row.session_id })} className="text-sky-300 hover:text-sky-200">
            {row.session_id}
          </Link>,
          row.virtual_ip || t('billing.table.pending'),
          row.wallet_short || t('common.status.unknown'),
          <Link href={`/dashboard/nodes/${row.node_id}`} className="text-purple-300 hover:text-purple-200">
            {row.node_name}
          </Link>,
          t(`common.status.${row.status}`),
          mb(row.total_traffic_mb, formatNumber),
          formatDuration(row.duration_seconds),
          lastActivity ? formatRelativeTime(lastActivity) : t('billing.table.pending'),
          row.last_error || t('billing.table.rtt', { value: row.rtt_ms === null ? t('billing.table.pending') : `${formatNumber(row.rtt_ms)} ms` }),
          <Link href={vpnSessionsHref({ nodeId: row.node_id, status: row.status, q: row.session_id })} className="text-sky-300 hover:text-sky-200">
            {t('billing.table.openSessions')}
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
  const { t, formatNumber, formatRelativeTime } = useI18n();
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState<NonNullable<UseVpnBillingOptions['status']>>('all');
  const [nodeId, setNodeId] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tab, setTab] = useState<BillingTab>('nodes');
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const { nodes } = useNodes();

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  const options = useMemo(() => ({
    days,
    status,
    nodeId: nodeId || undefined,
    q: debouncedQuery || undefined,
  }), [days, status, nodeId, debouncedQuery]);
  const { billing, isLoading, isFetching, isError, refetch } = useVpnBilling(options);
  const isQuerySettled = query.trim() === debouncedQuery;
  const isUpdating = isFetching || !isQuerySettled;

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

  const handleRefresh = async () => {
    // [BILLING-UX 2026-08-13 by Codex] Keep automatic polling quiet while
    // giving an explicit refresh authoritative feedback until it settles.
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: BillingTab,
  ) => {
    const currentIndex = BILLING_TABS.indexOf(currentTab);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % BILLING_TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + BILLING_TABS.length) % BILLING_TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = BILLING_TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = BILLING_TABS[nextIndex];
    setTab(nextTab);
    document.getElementById(`billing-tab-${nextTab}`)?.focus();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('billing.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('billing.subtitle')}
          </p>
        </div>
        {billing?.generated_at && (
          <p className="text-xs text-gray-600">{t('billing.updated', { time: formatRelativeTime(billing.generated_at) })}</p>
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
        onRefresh={handleRefresh}
        onExport={handleExport}
        isRefreshing={isManualRefreshing}
        isUpdating={isUpdating}
        canExport={exportRows.length > 0 && !isUpdating}
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
          <p className="text-sm text-yellow-300 mb-4">{t('billing.error')}</p>
          <Button variant="secondary" onClick={refetch}>{t('common.retry')}</Button>
        </Card>
      ) : (
        <>
          <SummaryCards billing={billing} />
          <BillingAttention billing={billing} />

          <div className="grid lg:grid-cols-3 gap-4">
            <Card variant="default" padding="md">
              <p className="text-xs text-gray-500">{t('billing.extra.voucherEpoch')}</p>
              <p className="text-lg font-semibold text-white mt-2">{billing.voucher_accounting.epoch}</p>
              <p className="text-xs text-gray-600 mt-1">
                {t('billing.extra.issueEvents', { count: formatNumber(billing.voucher_accounting.issue_events) })}
              </p>
            </Card>
            <Card variant="default" padding="md">
              <p className="text-xs text-gray-500">{t('billing.extra.dailyReserved')}</p>
              <p className="text-lg font-semibold text-white mt-2">
                {formatDuration(billing.quota.daily_vpn_usage.reserved_seconds)}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {t('billing.summary.used', { value: pct(billing.quota.daily_vpn_usage.usage_percent, t, formatNumber) })}
              </p>
            </Card>
            <Card variant="default" padding="md">
              <p className="text-xs text-gray-500">{t('billing.extra.identityCount')}</p>
              <p className="text-lg font-semibold text-white mt-2">{formatNumber(billing.known_identity_count)}</p>
              <p className="text-xs text-gray-600 mt-1">
                {billing.tiers.map((item) => `${item.tier}: ${formatNumber(item.sessions)}`).join('  ') || t('billing.extra.noTierMatches')}
              </p>
            </Card>
          </div>

          <Card variant="outline" padding="md">
            <p className="text-xs text-gray-500">{t('billing.extra.privacyBoundary')}</p>
            <p className="text-sm text-gray-300 mt-1">{billing.privacy_note}</p>
          </Card>

          <Card variant="default" padding="none">
            <div className="px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div role="tablist" aria-label={t('billing.title')} className="-mx-1 overflow-x-auto px-1 pb-1 sm:pb-0">
                <div className="flex min-w-max gap-2">
                  {BILLING_TABS.map((value) => (
                    <button
                      key={value}
                      id={`billing-tab-${value}`}
                      type="button"
                      role="tab"
                      aria-controls="billing-detail-panel"
                      aria-selected={tab === value}
                      tabIndex={tab === value ? 0 : -1}
                      onClick={() => setTab(value)}
                      onKeyDown={(event) => handleTabKeyDown(event, value)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400/50 ${
                        tab === value
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : 'bg-white/[0.03] text-gray-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {t(`billing.tabs.${value}`)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-600">
                {t('billing.filterSummary.days', { count: billing.filters.days })} · {t(`common.status.${billing.filters.status}`)}
                {billing.filters.q ? ` · ${t('billing.filterSummary.matches', { count: formatNumber(billing.summary.matched_session_count) })}` : ''}
              </p>
            </div>
            <div
              id="billing-detail-panel"
              role="tabpanel"
              aria-labelledby={`billing-tab-${tab}`}
              tabIndex={0}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-400/50"
            >
              {tab === 'nodes' && <NodeTable rows={billing.nodes} />}
              {tab === 'identities' && <IdentityTable rows={billing.identities} />}
              {tab === 'sessions' && <SessionTable rows={billing.sessions} />}
              {tab === 'daily' && <DailyTable rows={billing.daily} />}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
