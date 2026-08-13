/**
 * ============================================
 * AeroNyx Dashboard Overview Page
 * ============================================
 * File Path: app/dashboard/page.tsx
 *
 * Backend APIs used on this page:
 *   - GET /api/privacy_network/nodes/
 *     /root/aeronyx/privacy_network/api/nodes.py
 *   - GET /api/privacy_network/vpn/overview/
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *   - GET /api/privacy_network/vpn/events/
 *     /root/aeronyx/privacy_network/api/vpn_events.py
 *   - GET /api/privacy_network/vpn/billing/
 *     /root/aeronyx/privacy_network/api/vpn_billing.py
 *   - GET /api/privacy_network/vpn/servers/
 *     /root/aeronyx/privacy_network/api/vpn_servers.py
 *   - POST /api/membership/payment/topup-code/
 *     /root/aeronyx/membership/api/payment_alias.py
 *
 * Rust sources behind the VPN snapshot:
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/handlers/packet.rs
 *
 * Last Modified: v1.2.0 - [USDT-CHECKOUT-SESSION 2026-08-13 by Codex]
 *   Added same-device payment resumption and derived the public checkout route
 *   from the validated one-time capability instead of a backend-authored URL.
 * Previous: v1.1.0 - [USDT-DASHBOARD-HANDOFF 2026-08-09 by Codex]
 *   Added authenticated one-time membership checkout handoff.
 * Previous: v1.0.2 - Documented VPN backend/Rust data sources
 * ============================================
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useNodes, useAggregatedStats, useDeleteNode, useVpnOverview, useVpnEvents, useVpnBilling, useVpnServers } from '@/hooks/useNodes';
import { useAuthStore } from '@/stores/authStore';
import { Node, VpnEvent, VpnEventSeverity, VpnHealthStatus, VpnServerPlacementGroup } from '@/types';
import { formatBytes, truncateAddress } from '@/lib/api';
import {
  createMembershipTopUpHandoff,
  membershipCheckoutHref,
  readMembershipPaymentSession,
} from '@/lib/membershipPayments';
import { useI18n } from '@/lib/i18n/I18nProvider';
import Card, { StatCard, EmptyState } from '@/components/common/Card';
import Button from '@/components/common/Button';
import NodeCard, { NodeCardSkeleton } from '@/components/dashboard/NodeCard';
import AddNodeModal from '@/components/dashboard/AddNodeModal';
import { ConfirmDialog } from '@/components/common/Modal';

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;
type FormatNumberFn = (value: number, options?: Intl.NumberFormatOptions) => string;

// ============================================
// Page Header Component
// ============================================

function PageHeader({ onAddNode }: { onAddNode: () => void }) {
  const walletAddress = useAuthStore((state) => state.walletAddress);
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('dashboard.title')}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {t('dashboard.welcome', { wallet: truncateAddress(walletAddress || '', 6) })}
        </p>
      </div>
      <Button
        variant="primary"
        onClick={onAddNode}
        leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        }
      >
        {t('nodes.addNode')}
      </Button>
    </div>
  );
}

// ============================================
// Stats Grid Component
// ============================================

function StatsGrid() {
  const { stats, isLoading } = useAggregatedStats();
  const { t, formatNumber } = useI18n();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard
        label={t('dashboard.stats.totalNodes')}
        value={formatNumber(stats.totalNodes)}
        subValue={t('dashboard.stats.onlineNodes', { count: formatNumber(stats.onlineNodes) })}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        }
      />
      <StatCard
        label={t('dashboard.stats.activeSessions')}
        value={formatNumber(stats.activeSessions)}
        subValue={t('dashboard.stats.totalSessions', { count: formatNumber(stats.totalSessions) })}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      />
      <StatCard
        label={t('dashboard.stats.totalTraffic')}
        value={`${formatNumber(stats.totalTrafficGB, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        }
      />
      <StatCard
        label={t('dashboard.stats.avgUptime')}
        value={t('dashboard.stats.hours', {
          count: formatNumber(stats.avgUptime, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        })}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
}

// ============================================
// Membership Checkout Handoff
// ============================================

function MembershipCheckoutCard() {
  const { t } = useI18n();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isPreparing, setIsPreparing] = useState(false);
  const [notice, setNotice] = useState('');
  const [resumeHref, setResumeHref] = useState<string | null>(null);

  useEffect(() => {
    const saved = readMembershipPaymentSession();
    setResumeHref(saved ? membershipCheckoutHref(saved.code) : null);
  }, []);

  const openCheckout = useCallback(async () => {
    // [USDT-CHECKOUT-SESSION 2026-08-13 by Codex] Resume before minting a new
    // one-time capability. This prevents accidental parallel payment orders
    // when an operator returns to the dashboard during chain confirmation.
    const saved = readMembershipPaymentSession();
    const savedHref = saved ? membershipCheckoutHref(saved.code) : null;
    if (savedHref) {
      window.location.assign(savedHref);
      return;
    }
    setIsPreparing(true);
    setNotice('');
    try {
      const handoff = await createMembershipTopUpHandoff(
        cycle === 'yearly' ? 'premium_yearly' : 'premium_monthly',
      );
      if (!handoff.payment_enabled) {
        setNotice(t('dashboard.membership.unavailable'));
        return;
      }
      // The backend grants the opaque code; the browser owns the fixed local
      // route and keeps the capability in a URL fragment, outside HTTP logs.
      const destination = membershipCheckoutHref(handoff.topup_code);
      if (!destination) {
        throw new Error(t('dashboard.membership.invalidLink'));
      }
      window.location.assign(destination);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('dashboard.membership.error'));
    } finally {
      setIsPreparing(false);
    }
  }, [cycle, t]);

  return (
    <Card variant="outline" padding="md" className="mb-8 border-emerald-400/15">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/80">{t('dashboard.membership.eyebrow')}</p>
          <h2 className="mt-2 text-base font-semibold text-white">{t('dashboard.membership.title')}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-400">{t('dashboard.membership.description')}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          {!resumeHref && (
            <div className="grid h-11 grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1 sm:w-56" aria-label={t('dashboard.membership.billingCycle')}>
              {(['monthly', 'yearly'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={cycle === value}
                  onClick={() => setCycle(value)}
                  className={`rounded-md px-3 text-sm transition-colors ${cycle === value ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {t(`dashboard.membership.${value}`)}
                </button>
              ))}
            </div>
          )}
          <Button variant="primary" onClick={openCheckout} isLoading={isPreparing}>
            {isPreparing
              ? t('dashboard.membership.preparing')
              : resumeHref
                ? t('dashboard.membership.resume')
                : t('dashboard.membership.open')}
          </Button>
        </div>
      </div>
      {resumeHref && <p role="status" className="mt-4 border-t border-emerald-300/10 pt-4 text-sm text-emerald-200">{t('dashboard.membership.resumeNotice')}</p>}
      {notice && <p role="status" className="mt-4 border-t border-white/5 pt-4 text-sm text-amber-200">{notice}</p>}
      <p className="mt-4 text-xs leading-5 text-gray-600">{t('dashboard.membership.privacy')}</p>
    </Card>
  );
}

// ============================================
// AeroNyx Privacy Protocol Operations Snapshot
// ============================================

const healthDotClass: Record<VpnHealthStatus, string> = {
  healthy: 'bg-emerald-400',
  degraded: 'bg-yellow-400',
  overloaded: 'bg-orange-400',
  offline: 'bg-red-400',
};

const eventSeverityClass: Record<VpnEventSeverity, string> = {
  critical: 'bg-red-400',
  warning: 'bg-yellow-400',
  info: 'bg-sky-400',
};

function formatAvailability(value: number | null | undefined, t: TranslateFn, formatNumber: FormatNumberFn) {
  if (typeof value !== 'number' || Number.isNaN(value)) return t('common.status.pending');
  return `${formatNumber(value, { minimumFractionDigits: value >= 99.95 ? 2 : 1, maximumFractionDigits: value >= 99.95 ? 2 : 1 })}%`;
}

function formatPercent(value: number | null | undefined, t: TranslateFn, formatNumber: FormatNumberFn) {
  if (typeof value !== 'number' || Number.isNaN(value)) return t('common.status.pending');
  return `${formatNumber(value, { minimumFractionDigits: value >= 99.5 ? 0 : 1, maximumFractionDigits: value >= 99.5 ? 0 : 1 })}%`;
}

function formatHours(seconds: number | null | undefined, t: TranslateFn, formatNumber: FormatNumberFn) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return t('common.status.pending');
  if (seconds < 3600) return t('dashboard.time.minutes', { count: formatNumber(Math.round(seconds / 60)) });
  return t('dashboard.time.hours', { count: formatNumber(seconds / 3600, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });
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

function formatPlacementCapacity(capacity: number, unlimitedNodes: number, t: TranslateFn, formatNumber: FormatNumberFn) {
  if (unlimitedNodes > 0 && capacity > 0) {
    return t('dashboard.placement.slotsAndUnlimited', {
      slots: formatNumber(capacity),
      unlimited: formatNumber(unlimitedNodes),
    });
  }
  if (unlimitedNodes > 0) return t('dashboard.placement.unlimitedNodes', { count: formatNumber(unlimitedNodes) });
  return t('dashboard.placement.slots', { count: formatNumber(capacity) });
}

function formatPlacementRatio(group: VpnServerPlacementGroup | null, t: TranslateFn, formatNumber: FormatNumberFn) {
  if (!group) return t('common.status.pending');
  return `${formatNumber(group.available)}/${formatNumber(group.total)}`;
}

function formatPlacementGroupLabel(group: VpnServerPlacementGroup | null, fallback: string) {
  if (!group) return fallback;
  return group.label || group.key || fallback;
}

function topPlacementReason(reasons: Record<string, number>, t: TranslateFn, formatNumber: FormatNumberFn) {
  const [reason, count] = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!reason || !count) return t('services.placement.clear');
  return `${reason.replaceAll('_', ' ')} (${formatNumber(count)})`;
}

function formatEventReason(event: VpnEvent, t: TranslateFn, formatNumber: FormatNumberFn) {
  const details = event.details || {};

  if (event.type === 'runtime_recovery' || event.type === 'runtime_restarted') {
    const interrupted = detailNumber(details, 'interrupted_sessions_24h');
    const uptime = typeof details.runtime_uptime_seconds === 'number'
      ? formatHours(details.runtime_uptime_seconds, t, formatNumber)
      : t('common.status.pending');
    if (interrupted > 0) return t('dashboard.events.sessionsInterrupted', { count: formatNumber(interrupted), uptime });
    return t('dashboard.events.runtimeUptime', { uptime });
  }

  if (event.type === 'placement_capacity_exhausted' || event.type === 'placement_capacity_pressure') {
    const scope = typeof details.placement_scope === 'string' ? details.placement_scope : 'placement';
    const label = typeof details.placement_label === 'string' ? details.placement_label : 'Fleet';
    const available = detailNumber(details, 'available_candidates');
    const total = detailNumber(details, 'total_candidates');
    return t('dashboard.events.placementCandidates', {
      label,
      scope,
      available: formatNumber(available),
      total: formatNumber(total),
    });
  }
  if (event.type === 'client_placement_unavailable' && typeof details.unavailable_reason === 'string') {
    return details.unavailable_reason.replaceAll('_', ' ');
  }
  if (event.type === 'node_policy_enforced') {
    const blocked = (
      detailNumber(details, 'maintenance_rejections') +
      detailNumber(details, 'max_sessions_rejections') +
      detailNumber(details, 'bandwidth_drops')
    );
    const reason = typeof details.last_rejection_reason === 'string'
      ? details.last_rejection_reason.replaceAll('_', ' ')
      : 'policy enforced';
    return t('dashboard.events.policyBlocked', { count: formatNumber(blocked), reason });
  }
  if (typeof details.degraded_reason === 'string') return details.degraded_reason;
  if (typeof details.error_message === 'string') return details.error_message;
  if (typeof details.quality_status === 'string') return t('dashboard.events.sessionStatus', { status: details.quality_status });
  if (typeof details.health_status === 'string') return t('dashboard.events.nodeStatus', { status: details.health_status });
  if (typeof details.observed_mbps === 'number' && typeof details.bandwidth_limit_mbps === 'number') {
    return `${details.observed_mbps.toFixed(1)} / ${details.bandwidth_limit_mbps.toFixed(1)} Mbps`;
  }
  if (Array.isArray(details.changed_fields) && details.changed_fields.length > 0) {
    return details.changed_fields.slice(0, 3).join(', ');
  }
  if (event.session_id) return t('dashboard.events.sessionId', { id: event.session_id });
  if (event.command_id) return t('dashboard.events.commandId', { id: event.command_id.slice(0, 8) });
  return event.type.replaceAll('_', ' ');
}

function attentionEventPriority(event: VpnEvent) {
  if (event.type === 'runtime_recovery') return 0;
  if (event.type === 'runtime_restarted') return 1;
  if (event.severity === 'critical') return 2;
  if (event.severity === 'warning') return 3;
  return 4;
}

function VpnOperationsSnapshot() {
  const { t, formatNumber, formatRelativeTime } = useI18n();
  const { overview, isLoading, isError } = useVpnOverview();
  const { events: eventOverview, isLoading: eventsLoading } = useVpnEvents({
    days: 1,
    severity: 'all',
    limit: 12,
  });
  const { billing, isLoading: billingLoading, isError: billingError } = useVpnBilling({
    days: 1,
    status: 'all',
  });
  const {
    summary: placementSummary,
    total: placementTotal,
    available: placementAvailable,
    isLoading: placementLoading,
    isError: placementError,
  } = useVpnServers();
  const summary = overview?.summary;
  const monthlyQuota = billing?.quota.monthly;
  const dailyUsage = billing?.quota.daily_vpn_usage;
  const topRegion = placementSummary?.by_region[0] ?? null;
  const topTier = placementSummary?.by_tier[0] ?? null;
  const placementUnavailable = Math.max(0, placementTotal - placementAvailable);
  const attentionNodes = (overview?.nodes ?? [])
    .filter((node) => node.health_status !== 'healthy')
    .sort((a, b) => a.health_score - b.health_score)
    .slice(0, 4);
  const recentEvents = [...(eventOverview?.events ?? [])]
    .sort((a, b) => {
      const priorityDelta = attentionEventPriority(a) - attentionEventPriority(b);
      if (priorityDelta !== 0) return priorityDelta;
      return (b.created_at || '').localeCompare(a.created_at || '');
    })
    .slice(0, 5);
  const totalTrafficBytes = summary
    ? (summary.traffic_in_mb + summary.traffic_out_mb) * 1024 * 1024
    : 0;

  if (isLoading) {
    return (
      <div className="mb-8 grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />
        <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <Card variant="outline" padding="md" className="mb-8 border-yellow-500/25">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">{t('dashboard.operations.title')}</h2>
            <p className="text-sm text-yellow-300 mt-1">{t('dashboard.operations.unavailable')}</p>
          </div>
          <Link href="/dashboard/sessions" className="text-sm text-purple-300 hover:text-purple-200">
            {t('dashboard.operations.open')}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="mb-8 grid lg:grid-cols-[1.6fr_1fr] gap-4">
      <Card variant="default" padding="md">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">{t('dashboard.operations.title')}</h2>
            <p className="text-xs text-gray-500 mt-1">
              {t('dashboard.operations.updated', { time: formatRelativeTime(overview.generated_at) })}
            </p>
          </div>
          <Link href="/dashboard/sessions" className="text-sm text-purple-300 hover:text-purple-200">
            {t('dashboard.operations.openShort')}
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
            <p className="text-xs text-gray-500">{t('dashboard.operations.healthyNodes')}</p>
            <p className="text-xl font-semibold text-white mt-1">
              {formatNumber(summary?.healthy_nodes ?? 0)}/{formatNumber(summary?.total_nodes ?? 0)}
            </p>
            <p className="text-xs text-gray-600">
              {t('dashboard.operations.degradedCount', { count: formatNumber((summary?.degraded_nodes ?? 0) + (summary?.overloaded_nodes ?? 0)) })}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
            <p className="text-xs text-gray-500">{t('dashboard.operations.availability24h')}</p>
            <p className="text-xl font-semibold text-white mt-1">
              {formatAvailability(summary?.availability_24h_percent, t, formatNumber)}
            </p>
            <p className="text-xs text-gray-600">{t('dashboard.operations.sampledHeartbeats')}</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
            <p className="text-xs text-gray-500">{t('dashboard.operations.activeTunnels')}</p>
            <p className="text-xl font-semibold text-white mt-1">{formatNumber(summary?.active_sessions ?? 0)}</p>
            <p className="text-xs text-gray-600">{t('dashboard.operations.liveSessions')}</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
            <p className="text-xs text-gray-500">{t('dashboard.operations.traffic')}</p>
            <p className="text-xl font-semibold text-white mt-1">{formatBytes(totalTrafficBytes, 1)}</p>
            <p className="text-xs text-gray-600">{t('dashboard.operations.openAlerts', { count: formatNumber(summary?.open_alerts ?? 0) })}</p>
          </div>
        </div>

        <div className="mt-5 border-t border-white/5 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('dashboard.placement.title')}</p>
              <p className="mt-1 text-xs text-gray-500">{t('dashboard.placement.description')}</p>
            </div>
            <Link href="/dashboard/nodes" className="text-sm text-purple-300 hover:text-purple-200">
              {t('dashboard.placement.open')}
            </Link>
          </div>

          {placementLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : placementError || !placementSummary ? (
            <p className="text-sm text-yellow-300">{t('dashboard.placement.unavailable')}</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
                <p className="text-xs text-gray-500">{t('dashboard.placement.availableCapacity')}</p>
                <p className="text-lg font-semibold text-white mt-1">
                  {formatPlacementCapacity(
                    placementSummary.available_capacity_remaining,
                    placementSummary.unlimited_capacity_nodes,
                    t,
                    formatNumber
                  )}
                </p>
                <p className="text-xs text-gray-600">{t('dashboard.placement.candidates', { available: formatNumber(placementAvailable), total: formatNumber(placementTotal) })}</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
                <p className="text-xs text-gray-500">{t('dashboard.placement.topRegion')}</p>
                <p className="text-lg font-semibold text-white mt-1 truncate">
                  {formatPlacementGroupLabel(topRegion, t('dashboard.placement.noRegion'))}
                </p>
                <p className="text-xs text-gray-600">
                  {formatPlacementRatio(topRegion, t, formatNumber)} · {formatPlacementCapacity(
                    topRegion?.capacity_remaining ?? 0,
                    topRegion?.unlimited_capacity_nodes ?? 0,
                    t,
                    formatNumber
                  )}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
                <p className="text-xs text-gray-500">{t('dashboard.placement.topTier')}</p>
                <p className="text-lg font-semibold text-white mt-1 truncate">
                  {formatPlacementGroupLabel(topTier, t('dashboard.placement.noTier'))}
                </p>
                <p className="text-xs text-gray-600">
                  {formatPlacementRatio(topTier, t, formatNumber)} · {formatPercent(topTier?.average_load, t, formatNumber)}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
                <p className="text-xs text-gray-500">{t('dashboard.placement.blockedReasons')}</p>
                <p className="text-lg font-semibold text-white mt-1 truncate">
                  {topPlacementReason(placementSummary.unavailable_reasons, t, formatNumber)}
                </p>
                <p className="text-xs text-gray-600">{t('dashboard.placement.hiddenCount', { count: formatNumber(placementUnavailable) })}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-white/5 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('dashboard.billing.title')}</p>
              <p className="mt-1 text-xs text-gray-500">{t('dashboard.billing.description')}</p>
            </div>
            <Link href="/dashboard/billing" className="text-sm text-purple-300 hover:text-purple-200">
              {t('dashboard.billing.open')}
            </Link>
          </div>

          {billingLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : billingError || !billing ? (
            <p className="text-sm text-yellow-300">{t('dashboard.billing.unavailable')}</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
                <p className="text-xs text-gray-500">{t('dashboard.billing.traffic24h')}</p>
                <p className="text-lg font-semibold text-white mt-1">{formatBytes(billing.summary.total_bytes, 1)}</p>
                <p className="text-xs text-gray-600">{t('dashboard.billing.sessions', { count: formatNumber(billing.summary.total_sessions) })}</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
                <p className="text-xs text-gray-500">{t('dashboard.billing.billableTime')}</p>
                <p className="text-lg font-semibold text-white mt-1">{formatHours(dailyUsage?.billable_seconds, t, formatNumber)}</p>
                <p className="text-xs text-gray-600">{t('dashboard.billing.activeNow', { count: formatNumber(billing.summary.active_sessions) })}</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
                <p className="text-xs text-gray-500">{t('dashboard.billing.monthlyQuota')}</p>
                <p className="text-lg font-semibold text-white mt-1">
                  {monthlyQuota?.is_unlimited ? t('billing.summary.unlimited') : formatPercent(monthlyQuota?.usage_percent, t, formatNumber)}
                </p>
                <p className="text-xs text-gray-600">{monthlyQuota?.tier || dailyUsage?.tier || t('dashboard.placement.noTier')}</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
                <p className="text-xs text-gray-500">{t('dashboard.billing.vouchers')}</p>
                <p className="text-lg font-semibold text-white mt-1">
                  {formatNumber(billing.voucher_accounting.issued_vouchers)}
                </p>
                <p className="text-xs text-gray-600">
                  {billing.voucher_accounting.last_issued_at
                    ? t('dashboard.billing.lastIssued', { time: formatRelativeTime(billing.voucher_accounting.last_issued_at) })
                    : t('dashboard.billing.noneIssued')}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card variant="default" padding="md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">{t('dashboard.attention.title')}</h2>
          <Link href="/dashboard/events" className="text-sm text-purple-300 hover:text-purple-200">
            {t('dashboard.attention.events')}
          </Link>
        </div>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-600">{t('nav.nodes')}</p>
            {attentionNodes.length === 0 ? (
              <p className="text-sm text-emerald-300">{t('dashboard.attention.nodesHealthy')}</p>
            ) : (
              <div className="space-y-3">
                {attentionNodes.map((node) => (
                  <Link
                    key={node.id}
                    href={`/dashboard/nodes/${node.id}`}
                    className="block rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${healthDotClass[node.health_status]}`} />
                          <span className="text-sm font-medium text-white truncate">{node.name}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {node.public_ip || t('dashboard.attention.noIp')} · {node.region_code || t('dashboard.placement.noRegion')}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">{node.health_score}/100</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-600">{t('dashboard.attention.recentEvents')}</p>
            {eventsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="h-11 rounded-xl bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : recentEvents.length === 0 ? (
              <p className="text-sm text-gray-500">{t('dashboard.attention.noEvents24h')}</p>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((event) => (
                  <Link
                    key={event.id}
                    href="/dashboard/events"
                    className="block rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${eventSeverityClass[event.severity]}`} />
                          <span className="truncate text-sm font-medium text-white">{event.title}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-gray-500">
                          {event.node_name || t('dashboard.attention.fleet')} · {formatEventReason(event, t, formatNumber)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-500">
                        {event.created_at ? formatRelativeTime(event.created_at) : t('events.table.now')}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================
// Dashboard Page Component
// ============================================

export default function DashboardPage() {
  const { nodes, isLoading } = useNodes();
  const deleteNodeMutation = useDeleteNode();
  const { t, formatNumber } = useI18n();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<Node | null>(null);

  // Memoize handlers to prevent re-renders
  const handleOpenAddModal = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
  }, []);

  const handleSetNodeToDelete = useCallback((node: Node) => {
    setNodeToDelete(node);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setNodeToDelete(null);
  }, []);

  // Handle node deletion
  const handleDeleteNode = useCallback(async () => {
    if (!nodeToDelete) return;
    
    try {
      await deleteNodeMutation.mutateAsync(nodeToDelete.id);
      setNodeToDelete(null);
    } catch (err) {
      console.error('Failed to delete node:', err);
    }
  }, [nodeToDelete, deleteNodeMutation]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader onAddNode={handleOpenAddModal} />

      {/* Stats Grid */}
      <StatsGrid />

      {/* Authenticated membership checkout handoff */}
      <MembershipCheckoutCard />

      {/* AeroNyx Privacy Protocol Operations Snapshot */}
      <VpnOperationsSnapshot />

      {/* Nodes Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{t('dashboard.nodes.title')}</h2>
          {nodes.length > 0 && (
            <span className="text-sm text-gray-500">
              {t('dashboard.nodes.count', { count: formatNumber(nodes.length) })}
            </span>
          )}
        </div>
        
        {isLoading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <NodeCardSkeleton key={i} />
            ))}
          </div>
        ) : nodes.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            }
            title={t('dashboard.nodes.emptyTitle')}
            description={t('dashboard.nodes.emptyDescription')}
            action={
              <Button variant="primary" onClick={handleOpenAddModal}>
                {t('nodes.addFirstNode')}
              </Button>
            }
          />
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {nodes.map((node) => (
              <NodeCard key={node.id} node={node} onDelete={handleSetNodeToDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {nodes.length > 0 && (
        <Card variant="outline" padding="md" className="mt-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-white">{t('dashboard.capacity.title')}</h3>
              <p className="text-sm text-gray-400">{t('dashboard.capacity.description')}</p>
            </div>
            <Button variant="secondary" onClick={handleOpenAddModal}>
              {t('dashboard.capacity.addAnother')}
            </Button>
          </div>
        </Card>
      )}

      {/* Add Node Modal */}
      <AddNodeModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!nodeToDelete}
        onClose={handleCancelDelete}
        onConfirm={handleDeleteNode}
        title={t('dashboard.delete.title')}
        message={t('dashboard.delete.message', { name: nodeToDelete?.name || '' })}
        confirmText={t('dashboard.delete.confirm')}
        cancelText={t('common.cancel')}
        variant="danger"
        isLoading={deleteNodeMutation.isPending}
      />
    </div>
  );
}
