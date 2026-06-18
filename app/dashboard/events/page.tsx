/**
 * AeroNyx Alerts / Events page.
 *
 * Source path:
 *   /root/open/nodeboard/app/dashboard/events/page.tsx
 *
 * Backend:
 *   GET /api/privacy_network/vpn/events/
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useNodes, useVpnEvents, UseVpnEventsOptions } from '@/hooks/useNodes';
import { VpnEvent, VpnEventSeverity } from '@/types';
import Card, { EmptyState, LoadingCard } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useI18n } from '@/lib/i18n/I18nProvider';

type SeverityFilter = NonNullable<UseVpnEventsOptions['severity']>;
type TranslateFn = (key: string, values?: Record<string, string | number>) => string;
type EventClosureStatus = 'open' | 'watch' | 'recovered';

interface EventClosureItem {
  key: string;
  latestEvent: VpnEvent;
  status: EventClosureStatus;
  severity: VpnEventSeverity;
  repeatCount: number;
  openCount: number;
  firstSeenAt: string | null;
  latestAt: string | null;
  impact: string;
  recommendedAction: string;
  recovery: string;
}

const SEVERITY_OPTIONS: SeverityFilter[] = ['all', 'critical', 'warning', 'info'];
const DAY_OPTIONS = [1, 7, 14, 30, 60, 90];

function initialSeverity(value: string | null): SeverityFilter {
  return SEVERITY_OPTIONS.includes(value as SeverityFilter) ? (value as SeverityFilter) : 'all';
}

function initialDays(value: string | null): number {
  const parsed = Number(value);
  return DAY_OPTIONS.includes(parsed) ? parsed : 7;
}

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
  const { t } = useI18n();
  const style = severityStyles[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {t(`events.severity.${severity}`)}
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
  const { formatNumber } = useI18n();
  const toneClass = {
    critical: 'text-red-300',
    warning: 'text-yellow-300',
    info: 'text-sky-300',
    open: 'text-white',
  }[tone];

  return (
    <Card variant="default" padding="md">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-2 ${toneClass}`}>{formatNumber(value)}</p>
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
  const { t } = useI18n();
  return (
    <Card variant="default" padding="md">
      <div className="grid md:grid-cols-[120px_150px_180px_1fr_auto] gap-3 items-end">
        <label className="block">
          <span className="text-xs text-gray-500">{t('events.filters.days')}</span>
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
          <span className="text-xs text-gray-500">{t('events.filters.severity')}</span>
          <select
            value={severity}
            onChange={(event) => onSeverity(event.target.value as SeverityFilter)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          >
            {SEVERITY_OPTIONS.map((value) => (
              <option key={value} value={value} className="bg-[#111118]">
                {t(`events.severity.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">{t('events.filters.type')}</span>
          <select
            value={eventType}
            onChange={(event) => onType(event.target.value)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          >
            <option value="" className="bg-[#111118]">{t('events.filters.allTypes')}</option>
            {typeOptions.map((value) => (
              <option key={value} value={value} className="bg-[#111118]">
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">{t('events.filters.node')}</span>
          <select
            value={nodeId}
            onChange={(event) => onNode(event.target.value)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          >
            <option value="" className="bg-[#111118]">{t('events.filters.allNodes')}</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id} className="bg-[#111118]">
                {node.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" onClick={onRefresh}>{t('common.refreshNow')}</Button>
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

function detailString(details: Record<string, unknown>, key: string): string {
  const value = details[key];
  return typeof value === 'string' ? value.trim() : '';
}

function eventTimeMs(event: VpnEvent): number {
  if (!event.created_at) return 0;
  const time = new Date(event.created_at).getTime();
  return Number.isFinite(time) ? time : 0;
}

function severityRank(severity: VpnEventSeverity): number {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function isRecoveryEvent(event: VpnEvent): boolean {
  const status = String(event.status || '').toLowerCase();
  if (
    status.includes('resolved') ||
    status.includes('closed') ||
    status.includes('completed') ||
    status.includes('success') ||
    status.includes('recovered') ||
    status === 'clear'
  ) {
    return true;
  }

  return event.type === 'runtime_recovery' || event.type.endsWith('_recovered');
}

function isActionableEvent(event: VpnEvent): boolean {
  if (isRecoveryEvent(event)) return false;
  if (event.severity === 'critical' || event.severity === 'warning') return true;

  const status = String(event.status || '').toLowerCase();
  return status === 'failed' || status === 'timeout';
}

function eventFingerprint(event: VpnEvent): string {
  const details = event.details || {};
  const check = eventCheckName(event);
  const reason = (
    detailString(details, 'degraded_reason') ||
    detailString(details, 'unavailable_reason') ||
    detailString(details, 'last_rejection_reason')
  );
  const command = event.source === 'node_command' ? event.action || '' : '';
  const sessionBucket = event.session_id && event.type.startsWith('session_') ? 'session' : '';
  return [
    event.node_id || 'fleet',
    event.type,
    check || reason || command || sessionBucket || 'general',
  ].join(':');
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

function eventCheckName(event: VpnEvent): string {
  const check = event.details?.check;
  if (typeof check === 'string') return check;
  if (isRecord(check) && typeof check.name === 'string') return check.name;
  return '';
}

function commandActionLabel(action: string | null | undefined, t: TranslateFn): string {
  const labels: Record<string, string> = {
    system_info: t('events.command.systemInfo'),
    collect_logs: t('events.command.collectLogs'),
    refresh_config: t('events.command.refreshConfig'),
    apply_policy: t('events.command.applyPolicy'),
    restart_service: t('events.command.restartService'),
    kick_session: t('events.command.kickSession'),
    ban_wallet: t('events.command.banWallet'),
    unban_wallet: t('events.command.unbanWallet'),
  };
  return action ? labels[action] || action.replace(/_/g, ' ') : t('events.command.generic');
}

function commandAuditLabel(details: Record<string, unknown>) {
  const wallet = typeof details.operator_wallet_short === 'string' ? details.operator_wallet_short : '';
  const walletType = typeof details.operator_wallet_type === 'string' ? details.operator_wallet_type : '';
  const source = typeof details.command_source === 'string' ? details.command_source.replace(/_/g, ' ') : '';
  if (!wallet && !source) return '';
  const actor = wallet ? `${walletType ? `${walletType} ` : ''}${wallet}` : 'system';
  return source ? `${actor} · ${source}` : actor;
}

function sessionQualityFromEvent(event: VpnEvent) {
  if (event.type === 'session_stale') return 'stale';
  if (event.type === 'session_error' || event.type === 'session_reset') return 'error';
  if (
    event.type === 'session_degraded' ||
    event.type === 'session_keepalive_timeout' ||
    typeof event.details?.degraded_reason === 'string'
  ) {
    return 'degraded';
  }
  if (typeof event.details?.quality_status === 'string') return event.details.quality_status;
  return 'all';
}

function sessionStatusFromEvent(event: VpnEvent) {
  if (event.type === 'session_reset' || event.type === 'session_error') return 'all';
  return 'active';
}

function sessionsHref(event: VpnEvent) {
  const params = new URLSearchParams();
  params.set('status', sessionStatusFromEvent(event));
  params.set('quality', sessionQualityFromEvent(event));
  if (event.node_id) params.set('node', event.node_id);
  if (event.session_id) params.set('q', event.session_id);
  return `/dashboard/sessions?${params.toString()}`;
}

function placementReasonLabel(reason: unknown, t: TranslateFn) {
  if (typeof reason !== 'string' || !reason) return t('events.placement.reason.notEligible');
  const labels: Record<string, string> = {
    heartbeat_stale: t('events.placement.reason.heartbeatStale'),
    maintenance_mode: t('events.placement.reason.maintenanceMode'),
    max_sessions_reached: t('events.placement.reason.maxSessionsReached'),
    vpn_health_failed: t('events.placement.reason.vpnHealthFailed'),
    overloaded: t('events.placement.reason.overloaded'),
    low_24h_availability: t('events.placement.reason.lowAvailability'),
  };
  return labels[reason] || reason.replace(/_/g, ' ');
}

function topReasonLabel(reasons: unknown, t: TranslateFn) {
  if (!isRecord(reasons)) return t('events.placement.reason.clear');
  const [reason, count] = Object.entries(reasons)
    .filter(([, value]) => typeof value === 'number')
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0] || [];
  return reason ? `${placementReasonLabel(reason, t)} ${count}` : t('events.placement.reason.clear');
}

function formatDurationSeconds(value: unknown, t: TranslateFn): string {
  const seconds = typeof value === 'number' && Number.isFinite(value) ? value : null;
  if (seconds === null) return t('common.status.pending');
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

function DetailsPreview({ event }: { event: VpnEvent }) {
  const { t } = useI18n();
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
    return <span className="text-xs text-gray-500">{t('events.preview.blocked', { count: total, reason })}</span>;
  }

  if (event.type === 'bandwidth_limit_pressure') {
    const observed = shortValue(event.details?.observed_mbps, 16);
    const limit = shortValue(event.details?.bandwidth_limit_mbps, 16);
    return <span className="text-xs text-gray-500">{observed} / {limit} Mbps</span>;
  }

  if (event.type === 'session_traffic_anomaly') {
    const average = shortValue(event.details?.average_mbps, 16);
    const replay = shortValue(event.details?.replay_rejections, 16);
    return <span className="text-xs text-gray-500">{t('events.preview.replay', { average, replay })}</span>;
  }

  if (event.type === 'health_check_failed') {
    const checkName = eventCheckName(event);
    return <span className="text-xs text-gray-500">{checkName || t('events.preview.healthCheck')}</span>;
  }

  if (event.type === 'client_placement_unavailable') {
    const reason = placementReasonLabel(event.details?.unavailable_reason, t);
    const availability = event.details?.availability_24h_percent;
    const availabilityLabel = typeof availability === 'number' ? `${availability.toFixed(availability >= 99.95 ? 2 : 1)}%` : t('common.status.pending');
    return <span className="text-xs text-gray-500">{t('events.preview.availability24h', { reason, availability: availabilityLabel })}</span>;
  }

  if (event.type === 'placement_capacity_exhausted' || event.type === 'placement_capacity_pressure') {
    const availableCount = shortValue(event.details?.available_candidates, 16);
    const totalCount = shortValue(event.details?.total_candidates, 16);
    const capacity = shortValue(event.details?.capacity_remaining, 16);
    return <span className="text-xs text-gray-500">{t('events.preview.capacity', { available: availableCount, total: totalCount, slots: capacity })}</span>;
  }

  if (event.type === 'runtime_restarted' || event.type === 'runtime_recovery') {
    const interrupted = detailNumber(event.details || {}, 'interrupted_sessions_24h');
    const uptime = formatDurationSeconds(event.details?.runtime_uptime_seconds, t);
    return <span className="text-xs text-gray-500">{t('events.preview.runtime', { interrupted, uptime })}</span>;
  }

  const detailEntries = Object.entries(event.details || {}).filter(([, value]) => (
    value !== null && value !== undefined && typeof value !== 'object'
  ));
  const firstDetail = detailEntries[0];

  if (event.command_id) {
    const audit = commandAuditLabel(event.details || {});
    return (
      <span className="text-xs text-gray-500">
        {commandActionLabel(event.action, t)} · <span className="font-mono">{event.command_id.slice(0, 8)}</span>
        {audit ? ` · ${audit}` : ''}
      </span>
    );
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

function buildDetailRows(event: VpnEvent, t: TranslateFn): DetailRow[] {
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
      { label: t('events.details.changedBy'), value: shortValue(details.changed_by_wallet, 80) },
      { label: t('events.details.source'), value: shortValue(details.source, 80) },
      { label: t('events.details.auditId'), value: shortValue(details.audit_id, 80) }
    );
    return rows.filter((row) => row.value !== '-');
  }

  const preferredKeys = [
    'maintenance_rejections',
    'max_sessions_rejections',
    'bandwidth_drops',
    'last_rejection_reason',
    'last_rejection_at',
    'runtime_id',
    'runtime_started_at',
    'runtime_uptime_seconds',
    'restarted_within_24h',
    'interrupted_sessions_24h',
    'last_interrupted_at',
    'policy_sync_status',
    'mismatched_fields',
    'heartbeat_age_seconds',
    'policy_sync_message',
    'placement_scope',
    'placement_key',
    'placement_label',
    'available_candidates',
    'total_candidates',
    'unavailable_candidates',
    'unlimited_capacity_nodes',
    'active_sessions',
    'average_health_score',
    'average_load',
    'best_failover_rank',
    'unavailable_reasons',
    'unavailable_reason',
    'advertised_to_clients',
    'public_candidate',
    'load',
    'capacity_remaining',
    'current_sessions',
    'max_sessions',
    'maintenance_mode',
    'heartbeat_gap_seconds',
    'availability_24h_percent',
    'availability_sample_count',
    'availability_valid_sample_count',
    'availability_last_gap_seconds',
    'availability_gap_threshold_seconds',
    'vpn_health_status',
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
    'keepalive_probes_sent',
    'keepalive_acks',
    'keepalive_missed',
    'keepalive_pending',
    'configured_mtu',
    'running_mtu',
    'bytes_in',
    'bytes_out',
    'client_wallet',
    'retry_count',
    'operator_wallet_short',
    'operator_wallet_type',
    'command_source',
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

function runbookHint(event: VpnEvent, t: TranslateFn): string {
  const details = event.details || {};
  const check = eventCheckName(event);
  const reason = typeof details.degraded_reason === 'string' ? details.degraded_reason : '';
  const reasonLower = reason.toLowerCase();

  if (event.type === 'node_policy_enforced') {
    return t('events.runbook.nodePolicyEnforced');
  }

  if (event.type === 'node_policy_sync_pending') {
    return t('events.runbook.nodePolicySyncPending');
  }

  if (event.type === 'runtime_recovery') {
    return t('events.runbook.runtimeRecovery');
  }

  if (event.type === 'runtime_restarted') {
    return t('events.runbook.runtimeRestarted');
  }

  if (event.type === 'client_placement_unavailable') {
    const placementReason = placementReasonLabel(details.unavailable_reason, t);
    return t('events.runbook.clientPlacementUnavailable', { reason: placementReason });
  }

  if (event.type === 'placement_capacity_exhausted' || event.type === 'placement_capacity_pressure') {
    const scope = shortValue(details.placement_scope, 24);
    const label = shortValue(details.placement_label, 48);
    const topReason = topReasonLabel(details.unavailable_reasons, t);
    return t('events.runbook.placementCapacity', { label, scope, reason: topReason });
  }

  if (event.type === 'bandwidth_limit_pressure') {
    return t('events.runbook.bandwidthLimitPressure');
  }

  if (event.type === 'node_policy_changed') {
    return t('events.runbook.nodePolicyChanged');
  }

  if (event.type === 'session_keepalive_timeout') {
    return t('events.runbook.sessionKeepaliveTimeout');
  }

  if (event.source === 'node_command' && event.action === 'apply_policy') {
    return t('events.runbook.applyPolicy');
  }

  if (event.type === 'session_degraded' || event.type === 'session_stale') {
    if (reasonLower.includes('keepalive')) {
      return t('events.runbook.sessionDegradedKeepalive');
    }
    if (reasonLower.includes('rtt')) {
      return t('events.runbook.sessionDegradedRtt');
    }
    if (reasonLower.includes('rx') || reasonLower.includes('tx') || reasonLower.includes('stale')) {
      return t('events.runbook.sessionDegradedTraffic');
    }
    return t('events.runbook.sessionDegradedGeneric');
  }

  if (event.source === 'node_command') {
    return t('events.runbook.nodeCommand');
  }

  if (check === 'dns_stub' || check === 'dns_query') {
    return t('events.runbook.dnsFailure');
  }
  if (check === 'nat_masquerade' || check === 'ip_forward') {
    return t('events.runbook.natFailure');
  }
  if (check === 'tun_device' || check === 'mtu_config') {
    return t('events.runbook.tunFailure');
  }
  if (check === 'internet_egress') {
    return t('events.runbook.egressFailure');
  }
  if (check === 'udp_listener') {
    return t('events.runbook.udpListenerFailure');
  }

  if (event.severity === 'critical') {
    return t('events.runbook.criticalDefault');
  }
  if (event.severity === 'warning') {
    return t('events.runbook.warningDefault');
  }

  return '';
}

function eventImpactScope(event: VpnEvent, t: TranslateFn): string {
  const details = event.details || {};
  const nodeName = event.node_name || t('events.table.allNodes');

  if (event.type === 'health_check_failed') {
    return t('events.closure.impact.healthCheck', {
      node: nodeName,
      check: eventCheckName(event) || t('common.status.unknown'),
    });
  }

  if (event.type === 'client_placement_unavailable') {
    return t('events.closure.impact.placement', {
      node: nodeName,
      reason: placementReasonLabel(details.unavailable_reason, t),
    });
  }

  if (event.type === 'placement_capacity_exhausted' || event.type === 'placement_capacity_pressure') {
    return t('events.closure.impact.capacity', {
      scope: shortValue(details.placement_label || details.placement_scope || nodeName, 48),
    });
  }

  if (event.type === 'bandwidth_limit_pressure' || event.type === 'node_policy_enforced') {
    return t('events.closure.impact.policy', { node: nodeName });
  }

  if (event.type.startsWith('session_')) {
    return t('events.closure.impact.session', {
      node: nodeName,
      session: event.session_id ? event.session_id.slice(0, 8) : t('common.status.unknown'),
    });
  }

  if (event.source === 'node_command') {
    return t('events.closure.impact.command', {
      node: nodeName,
      action: commandActionLabel(event.action, t),
    });
  }

  if (event.type === 'runtime_restarted' || event.type === 'runtime_recovery') {
    return t('events.closure.impact.runtime', { node: nodeName });
  }

  return event.node_id
    ? t('events.closure.impact.node', { node: nodeName })
    : t('events.closure.impact.fleet');
}

function eventRecoveryCopy(status: EventClosureStatus, openCount: number, repeatCount: number, t: TranslateFn): string {
  if (status === 'open') {
    return t('events.closure.recovery.open', { count: openCount });
  }
  if (status === 'watch') {
    return t('events.closure.recovery.watch', { count: repeatCount });
  }
  return t('events.closure.recovery.recovered');
}

function buildEventClosureItems(events: VpnEvent[], t: TranslateFn): EventClosureItem[] {
  const grouped = new Map<string, VpnEvent[]>();

  events.forEach((event) => {
    const key = eventFingerprint(event);
    const bucket = grouped.get(key) || [];
    bucket.push(event);
    grouped.set(key, bucket);
  });

  return Array.from(grouped.entries()).map(([key, group]) => {
    const sorted = [...group].sort((a, b) => eventTimeMs(b) - eventTimeMs(a));
    const latestEvent = sorted[0];
    const openCount = group.filter(isActionableEvent).length;
    const latestIsRecovery = isRecoveryEvent(latestEvent);
    const status: EventClosureStatus = openCount > 0 && !latestIsRecovery
      ? 'open'
      : group.length > 1 && !latestIsRecovery
        ? 'watch'
        : 'recovered';
    const highestSeverity = group.reduce<VpnEventSeverity>((current, event) => (
      severityRank(event.severity) > severityRank(current) ? event.severity : current
    ), latestEvent.severity);
    const sortedAsc = [...group].sort((a, b) => eventTimeMs(a) - eventTimeMs(b));
    const hint = runbookHint(latestEvent, t);

    return {
      key,
      latestEvent,
      status,
      severity: highestSeverity,
      repeatCount: group.length,
      openCount,
      firstSeenAt: sortedAsc[0]?.created_at || null,
      latestAt: latestEvent.created_at,
      impact: eventImpactScope(latestEvent, t),
      recommendedAction: hint || t('events.closure.defaultAction'),
      recovery: eventRecoveryCopy(status, openCount, group.length, t),
    };
  }).sort((a, b) => {
    const statusRank = { open: 3, watch: 2, recovered: 1 } as const;
    const statusDelta = statusRank[b.status] - statusRank[a.status];
    if (statusDelta !== 0) return statusDelta;
    const severityDelta = severityRank(b.severity) - severityRank(a.severity);
    if (severityDelta !== 0) return severityDelta;
    const repeatDelta = b.repeatCount - a.repeatCount;
    if (repeatDelta !== 0) return repeatDelta;
    return eventTimeMs(b.latestEvent) - eventTimeMs(a.latestEvent);
  });
}

function closureStatusClass(status: EventClosureStatus) {
  if (status === 'open') return 'border-red-500/25 bg-red-500/[0.07] text-red-100';
  if (status === 'watch') return 'border-yellow-500/25 bg-yellow-500/[0.06] text-yellow-100';
  return 'border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-100';
}

function IncidentClosurePanel({ events, days }: { events: VpnEvent[]; days: number }) {
  const { t, formatNumber, formatRelativeTime } = useI18n();
  const items = useMemo(() => buildEventClosureItems(events, t), [events, t]);
  const openCount = items.filter((item) => item.status === 'open').length;
  const recoveredCount = items.filter((item) => item.status === 'recovered').length;
  const repeatedCount = items.filter((item) => item.repeatCount > 1).length;
  const affectedNodes = new Set(items.map((item) => item.latestEvent.node_id).filter(Boolean)).size;

  return (
    <Card variant="default" padding="md">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">{t('events.closure.title')}</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">{t('events.closure.description', { days })}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[11px] text-gray-500">{t('events.closure.openIncidents')}</p>
            <p className="mt-1 text-lg font-semibold text-red-200">{formatNumber(openCount)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[11px] text-gray-500">{t('events.closure.recoveredIncidents')}</p>
            <p className="mt-1 text-lg font-semibold text-emerald-200">{formatNumber(recoveredCount)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[11px] text-gray-500">{t('events.closure.repeatedIncidents')}</p>
            <p className="mt-1 text-lg font-semibold text-yellow-200">{formatNumber(repeatedCount)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[11px] text-gray-500">{t('events.closure.affectedNodes')}</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatNumber(affectedNodes)}</p>
          </div>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {items.slice(0, 6).map((item) => (
            <div key={item.key} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${closureStatusClass(item.status)}`}>
                  {t(`events.closure.status.${item.status}`)}
                </span>
                <SeverityBadge severity={item.severity} />
                {item.repeatCount > 1 ? (
                  <span className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2 py-1 text-xs text-yellow-100">
                    {t('events.closure.repeatCount', { count: item.repeatCount })}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 min-w-0">
                <p className="text-sm font-semibold text-white">{item.latestEvent.title || item.latestEvent.type}</p>
                <p className="mt-1 text-xs text-gray-500 break-words [overflow-wrap:anywhere]">{item.impact}</p>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-md border border-white/5 bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-600">{t('events.closure.recommendedAction')}</p>
                  <p className="mt-1 text-xs leading-5 text-gray-300">{item.recommendedAction}</p>
                </div>
                <div className="rounded-md border border-white/5 bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-600">{t('events.closure.recoveryState')}</p>
                  <p className="mt-1 text-xs leading-5 text-gray-300">{item.recovery}</p>
                  <p className="mt-1 text-[11px] text-gray-600">
                    {item.latestAt
                      ? t('events.closure.latestAt', { time: formatRelativeTime(item.latestAt) })
                      : t('events.table.now')}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {item.latestEvent.node_id ? (
                  <Link href={`/dashboard/nodes/${item.latestEvent.node_id}`} className="text-xs font-medium text-emerald-300 hover:text-emerald-200">
                    {t('events.table.nodeDetail')}
                  </Link>
                ) : null}
                {item.latestEvent.session_id ? (
                  <Link href={sessionsHref(item.latestEvent)} className="text-xs font-medium text-sky-300 hover:text-sky-200">
                    {t('events.table.openSessions')}
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2 text-xs leading-5 text-emerald-100">
          {t('events.closure.empty')}
        </p>
      )}
    </Card>
  );
}

function EventDetailPanel({ event }: { event: VpnEvent }) {
  const { t } = useI18n();
  const rows = buildDetailRows(event, t);
  const hint = runbookHint(event, t);

  if (!rows.length && !hint) {
    return <div className="text-xs text-gray-600">{t('events.details.noStructured')}</div>;
  }

  return (
    <div className="space-y-3">
      {hint && (
        <div className="rounded-md border border-purple-500/20 bg-purple-500/10 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-purple-300">{t('events.details.runbookHint')}</div>
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
  const { t, formatRelativeTime } = useI18n();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!events.length) {
    return (
      <EmptyState
        icon={<EventIcon />}
        title={t('events.emptyTitle')}
        description={t('events.emptyDescription')}
      />
    );
  }

  return (
    <Card variant="default" padding="none">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">{t('events.table.title')}</h2>
          <p className="text-xs text-gray-500 mt-1">{t('events.table.description')}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-xs uppercase text-gray-500 bg-white/[0.02]">
            <tr>
              <th className="text-left font-medium px-5 py-3">{t('events.table.severity')}</th>
              <th className="text-left font-medium px-4 py-3">{t('events.table.event')}</th>
              <th className="text-left font-medium px-4 py-3">{t('events.table.node')}</th>
              <th className="text-left font-medium px-4 py-3">{t('events.table.source')}</th>
              <th className="text-left font-medium px-4 py-3">{t('events.table.status')}</th>
              <th className="text-left font-medium px-4 py-3">{t('events.table.ref')}</th>
              <th className="text-left font-medium px-5 py-3">{t('events.table.time')}</th>
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
                          {event.node_name || t('events.table.nodeFallback')}
                        </Link>
                      ) : (
                        <div className="text-gray-300">{event.node_name || t('events.table.allNodes')}</div>
                      )}
                      {event.node_id && (
                        <div className="text-xs text-gray-600 font-mono mt-1">{event.node_id.slice(0, 8)}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-400">{event.source}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
                        {event.status || t('events.summary.open')}
                      </span>
                      {event.action && <div className="text-xs text-gray-600 mt-1">{commandActionLabel(event.action, t)}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <DetailsPreview event={event} />
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {event.session_id ? (
                            <Link
                              href={sessionsHref(event)}
                              className="text-xs font-medium text-sky-300 hover:text-sky-200"
                            >
                              {t('events.table.openSessions')}
                            </Link>
                          ) : null}
                          {event.node_id ? (
                            <Link
                              href={`/dashboard/nodes/${event.node_id}`}
                              className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
                            >
                              {t('events.table.nodeDetail')}
                            </Link>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedId(isExpanded ? null : event.id)}
                          className="block text-xs font-medium text-purple-300 hover:text-purple-200"
                        >
                          {isExpanded ? t('events.table.hide') : t('events.table.details')}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-400">
                      {event.created_at ? formatRelativeTime(event.created_at) : t('events.table.now')}
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, formatRelativeTime } = useI18n();
  const [days, setDays] = useState(() => initialDays(searchParams.get('days')));
  const [severity, setSeverity] = useState<SeverityFilter>(() => initialSeverity(searchParams.get('severity')));
  const [eventType, setEventType] = useState(() => searchParams.get('type') || '');
  const [nodeId, setNodeId] = useState(() => searchParams.get('node') || searchParams.get('node_id') || '');

  useEffect(() => {
    const params = new URLSearchParams();
    if (days !== 7) params.set('days', String(days));
    if (severity !== 'all') params.set('severity', severity);
    if (eventType) params.set('type', eventType);
    if (nodeId) params.set('node', nodeId);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [days, eventType, nodeId, pathname, router, severity]);

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
        title={t('events.unavailableTitle')}
        description={error?.message || t('events.unavailableDescription')}
        action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
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
          <h1 className="text-2xl font-bold text-white">{t('events.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {events?.generated_at
              ? t('events.updated', { time: formatRelativeTime(events.generated_at) })
              : t('events.waiting')}
          </p>
        </div>
        <Button variant="secondary" onClick={() => refetch()}>{t('common.refreshNow')}</Button>
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
        <SummaryCard label={t('events.summary.open')} value={summary.open} tone="open" />
        <SummaryCard label={t('events.severity.critical')} value={summary.critical} tone="critical" />
        <SummaryCard label={t('events.severity.warning')} value={summary.warning} tone="warning" />
        <SummaryCard label={t('events.severity.info')} value={summary.info} tone="info" />
      </div>

      <IncidentClosurePanel events={events?.events ?? []} days={days} />

      <EventsTable events={events?.events ?? []} />
    </div>
  );
}
