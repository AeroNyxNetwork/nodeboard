/**
 * ============================================
 * AeroNyx Nodes List Page
 * ============================================
 * File Path: app/dashboard/nodes/page.tsx
 * 
 * Last Modified: v1.0.1 - Removed motion animations to fix re-render loop
 * ============================================
 */

'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useNodes, useDeleteNode, useVpnOverview, useVpnServers } from '@/hooks/useNodes';
import { Node, NodeStatus, VpnHealthStatus, VpnNodeHealth, VpnServerCandidate, VpnServerPlacementSummary } from '@/types';
import Button from '@/components/common/Button';
import Card, { EmptyState } from '@/components/common/Card';
import NodeCard, { NodeCardSkeleton } from '@/components/dashboard/NodeCard';
import AddNodeModal from '@/components/dashboard/AddNodeModal';
import { ConfirmDialog } from '@/components/common/Modal';
import { useI18n } from '@/lib/i18n/I18nProvider';

// ============================================
// Filter Tabs Component
// ============================================

type FilterOption = 'all' | NodeStatus;
type TranslateFn = (key: string, values?: Record<string, string | number>) => string;
type FormatNumberFn = (value: number, options?: Intl.NumberFormatOptions) => string;

interface FilterTabsProps {
  activeFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  counts: {
    all: number;
    online: number;
    offline: number;
    suspended: number;
  };
}

function FilterTabs({ activeFilter, onFilterChange, counts }: FilterTabsProps) {
  const { t, formatNumber } = useI18n();
  const tabs: { id: FilterOption; label: string; count: number }[] = [
    { id: 'all', label: t('nodes.filters.all'), count: counts.all },
    { id: 'online', label: t('nodes.filters.online'), count: counts.online },
    { id: 'offline', label: t('nodes.filters.offline'), count: counts.offline },
  ];

  return (
    <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onFilterChange(tab.id)}
          className={`
            relative px-4 py-2 rounded-lg text-sm font-medium
            transition-all duration-200
            ${activeFilter === tab.id
              ? 'text-white bg-purple-500/20 border border-purple-500/30'
              : 'text-gray-400 hover:text-white'
            }
          `}
        >
          <span className="flex items-center gap-2">
            {tab.label}
            <span className={`
              px-1.5 py-0.5 text-xs rounded-full
              ${activeFilter === tab.id
                ? 'bg-purple-500/30 text-purple-200'
                : 'bg-white/10 text-gray-500'
              }
            `}>
              {formatNumber(tab.count)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================================
// Search & Actions Bar
// ============================================

interface ActionsBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddNode: () => void;
}

function ActionsBar({ searchQuery, onSearchChange, onAddNode }: ActionsBarProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      {/* Search */}
      <div className="relative w-full sm:w-80">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder={t('nodes.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="
            w-full pl-10 pr-4 py-2.5 rounded-xl
            bg-white/5 border border-white/10
            text-white placeholder-gray-500
            focus:outline-none focus:border-purple-500/50
            transition-colors
          "
        />
      </div>

      {/* Add Node Button */}
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
// VPN Node Operations Table
// ============================================

const vpnHealthStyles: Record<VpnHealthStatus, { label: string; badge: string; dot: string }> = {
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

function formatAvailability(value: number | null | undefined, t: TranslateFn) {
  if (typeof value !== 'number' || Number.isNaN(value)) return t('nodes.pending');
  return `${value.toFixed(value >= 99.95 ? 2 : 1)}%`;
}

function formatMetric(value: number | null | undefined, suffix: string, t: TranslateFn) {
  return typeof value === 'number' && !Number.isNaN(value) ? `${value}${suffix}` : t('nodes.pending');
}

function formatMemory(used: number | null, total: number | null, t: TranslateFn, formatNumber: FormatNumberFn) {
  if (used === null) return t('nodes.pending');
  return total ? `${formatNumber(used)}/${formatNumber(total)} MB` : `${formatNumber(used)} MB`;
}

function formatPolicyLimit(value: number, unit: string, t: TranslateFn, formatNumber: FormatNumberFn) {
  return value > 0 ? `${formatNumber(value)} ${unit}` : t('nodes.policy.unlimited');
}

function PolicyBadge({ node }: { node: VpnNodeHealth }) {
  const { t } = useI18n();
  if (node.maintenance_mode) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/15 text-xs font-medium text-yellow-300">
        {t('nodes.policy.maintenance')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-xs font-medium text-emerald-300">
      {t('nodes.policy.accepting')}
    </span>
  );
}

function formatCapacityLeft(node: VpnNodeHealth, t: TranslateFn, formatNumber: FormatNumberFn) {
  return node.max_sessions > 0
    ? t('nodes.capacityLeft', { count: formatNumber(Math.max(0, node.max_sessions - node.active_sessions)) })
    : t('nodes.capacityTotal', { count: formatNumber(node.total_sessions) });
}

function VpnHealthBadge({ status }: { status: VpnHealthStatus }) {
  const { t } = useI18n();
  const style = vpnHealthStyles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {t(`nodes.vpnHealth.${status}`)}
    </span>
  );
}

function formatPlacementReason(reason: string | null | undefined, t: TranslateFn) {
  if (!reason) return t('nodes.placement.reason.candidate');
  const key = `nodes.placement.reason.${reason}`;
  const translated = t(key);
  return translated === key ? reason.replace(/_/g, ' ') : translated;
}

function placementStatusClass(server: VpnServerCandidate) {
  if (server.available) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
  if (server.unavailable_reason === 'maintenance_mode') {
    return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25';
  }
  return 'bg-red-500/15 text-red-300 border-red-500/25';
}

function formatPlacementCapacity(capacity: number, unlimitedNodes: number, t: TranslateFn, formatNumber: FormatNumberFn) {
  if (unlimitedNodes > 0 && capacity > 0) {
    return t('nodes.placement.slotsWithUnlimited', {
      slots: formatNumber(capacity),
      unlimited: formatNumber(unlimitedNodes),
    });
  }
  if (unlimitedNodes > 0) return t('nodes.placement.unlimitedNodes', { count: formatNumber(unlimitedNodes) });
  return t('nodes.placement.slots', { count: formatNumber(capacity) });
}

function topUnavailableReason(reasons: Record<string, number>, t: TranslateFn, formatNumber: FormatNumberFn) {
  const [reason, count] = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0] || [];
  return reason ? `${formatPlacementReason(reason, t)} ${formatNumber(count)}` : t('nodes.placement.allCandidatesClear');
}

function ClientPlacementPanel({
  servers,
  summary,
  isLoading,
  total,
  available,
}: {
  servers: VpnServerCandidate[];
  summary: VpnServerPlacementSummary | null;
  isLoading: boolean;
  total: number;
  available: number;
}) {
  const { t, formatNumber } = useI18n();

  if (isLoading) {
    return (
      <Card variant="default" padding="md" className="mb-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-44 rounded bg-white/10" />
          <div className="grid md:grid-cols-3 gap-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-24 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (servers.length === 0) {
    return null;
  }

  const ranked = [...servers].sort((a, b) => {
    const rankA = a.failover_rank ?? 9999;
    const rankB = b.failover_rank ?? 9999;
    return rankA - rankB || a.name.localeCompare(b.name);
  });
  const unavailable = total - available;
  const regions = summary?.by_region.slice(0, 4) ?? [];
  const tiers = summary?.by_tier.slice(0, 3) ?? [];

  return (
    <Card variant="default" padding="none" className="mb-6">
      <div className="px-5 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{t('nodes.placement.title')}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {t('nodes.placement.description')}
          </p>
        </div>
        <div className="text-xs text-gray-500 sm:text-right">
          <span className="text-emerald-300">{formatNumber(available)}</span> {t('nodes.placement.availableLabel')}
          {' · '}
          {formatNumber(unavailable)} {t('nodes.placement.unavailableLabel')}
          {summary && (
            <div className="mt-1 text-gray-600">
              {formatPlacementCapacity(summary.available_capacity_remaining, summary.unlimited_capacity_nodes, t, formatNumber)}
            </div>
          )}
        </div>
      </div>

      {summary && (
        <div className="border-b border-white/5 px-5 py-4">
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('nodes.placement.regionCapacity')}</p>
              <div className="mt-2 grid sm:grid-cols-2 xl:grid-cols-4 gap-2">
                {regions.map((region) => (
                  <div key={region.key} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-gray-300">
                        {region.flag ? `${region.flag} ` : ''}{region.label}
                      </span>
                      <span className="text-[11px] text-emerald-300">{formatNumber(region.available)}/{formatNumber(region.total)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {formatPlacementCapacity(region.capacity_remaining, region.unlimited_capacity_nodes, t, formatNumber)}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-600">
                      {region.unavailable > 0
                        ? topUnavailableReason(region.unavailable_reasons, t, formatNumber)
                        : t('nodes.placement.allCandidatesClear')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('nodes.placement.tierCapacity')}</p>
              <div className="mt-2 grid sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-2">
                {tiers.map((tier) => (
                  <div key={tier.key} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-gray-300">{tier.tier || tier.label}</span>
                      <span className="text-[11px] text-emerald-300">{formatNumber(tier.available)}/{formatNumber(tier.total)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {formatPlacementCapacity(tier.capacity_remaining, tier.unlimited_capacity_nodes, t, formatNumber)}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-600">
                      {tier.average_load === null
                        ? t('nodes.placement.loadPending')
                        : t('nodes.placement.averageLoad', { value: formatNumber(tier.average_load) })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-gray-600">{summary.privacy_note}</p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3 p-5">
        {ranked.slice(0, 6).map((server) => (
          <Link
            key={server.id}
            href={`/dashboard/nodes/${server.id}`}
            className="rounded-xl border border-white/5 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg leading-none">{server.flag || 'VPN'}</span>
                  <span className="font-medium text-white truncate">{server.name}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {server.country_name || server.country} · {server.node_tier || t('nodes.publicTier')}
                </p>
              </div>
              <span className={`shrink-0 inline-flex rounded-full border px-2 py-1 text-xs ${placementStatusClass(server)}`}>
                {server.available
                  ? t('nodes.placement.rank', { rank: server.failover_rank ?? '-' })
                  : formatPlacementReason(server.unavailable_reason, t)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-gray-600">{t('nodes.placement.load')}</p>
                <p className="mt-1 text-gray-300">{server.load === null ? t('nodes.pending') : `${formatNumber(server.load)}%`}</p>
              </div>
              <div>
                <p className="text-gray-600">24h</p>
                <p className="mt-1 text-gray-300">{formatAvailability(server.availability_24h_percent, t)}</p>
              </div>
              <div>
                <p className="text-gray-600">{t('nodes.placement.sessions')}</p>
                <p className="mt-1 text-gray-300">{formatNumber(server.current_sessions)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {server.available
                ? `${server.address || t('nodes.placement.hiddenAddress')}:${server.port}`
                : t('nodes.placement.hiddenFromClients', { reason: formatPlacementReason(server.unavailable_reason, t) })}
            </p>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function VpnNodeOperationsTable({
  nodes,
  isLoading,
}: {
  nodes: VpnNodeHealth[];
  isLoading: boolean;
}) {
  const { t, formatNumber, formatRelativeTime } = useI18n();

  if (isLoading) {
    return (
      <Card variant="default" padding="md" className="mb-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="h-32 rounded-xl bg-white/5" />
        </div>
      </Card>
    );
  }

  if (nodes.length === 0) {
    return null;
  }

  const sortedNodes = [...nodes].sort((a, b) => {
    const order: Record<VpnHealthStatus, number> = {
      offline: 0,
      overloaded: 1,
      degraded: 2,
      healthy: 3,
    };
    return order[a.health_status] - order[b.health_status] || a.name.localeCompare(b.name);
  });

  return (
    <Card variant="default" padding="none" className="mb-6">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{t('nodes.operations.title')}</h2>
          <p className="text-xs text-gray-500 mt-1">{t('nodes.operations.description')}</p>
        </div>
        <Link href="/dashboard/sessions" className="text-sm text-purple-300 hover:text-purple-200">
          {t('nodes.operations.link')}
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="text-xs uppercase text-gray-500 bg-white/[0.02]">
            <tr>
              <th className="text-left font-medium px-5 py-3">{t('nodes.operations.node')}</th>
              <th className="text-left font-medium px-4 py-3">{t('nodes.operations.region')}</th>
              <th className="text-left font-medium px-4 py-3">{t('nodes.operations.health')}</th>
              <th className="text-left font-medium px-4 py-3">{t('nodes.operations.policy')}</th>
              <th className="text-left font-medium px-4 py-3">{t('nodes.operations.availability')}</th>
              <th className="text-left font-medium px-4 py-3">{t('nodes.operations.sessions')}</th>
              <th className="text-left font-medium px-4 py-3">{t('nodes.operations.load')}</th>
              <th className="text-left font-medium px-4 py-3">{t('nodes.operations.version')}</th>
              <th className="text-left font-medium px-5 py-3">{t('nodes.operations.lastHeartbeat')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedNodes.map((node) => (
              <tr key={node.id} className="hover:bg-white/[0.03] transition-colors">
                <td className="px-5 py-4">
                  <Link href={`/dashboard/nodes/${node.id}`} className="font-medium text-white hover:text-purple-300">
                    {node.name}
                  </Link>
                  <div className="text-xs text-gray-500 mt-1">
                    {node.public_ip || t('nodes.noIp')}:{node.port}
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  {node.region_code || t('nodes.pending')}
                  {node.city ? <div className="text-xs text-gray-500">{node.city}</div> : null}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1.5">
                    <VpnHealthBadge status={node.health_status} />
                    <span className="text-xs text-gray-500">{t('nodes.score', { score: formatNumber(node.health_score) })}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <PolicyBadge node={node} />
                      <span className="text-xs text-gray-500">{node.node_tier || t('nodes.publicTier')}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {t('nodes.policy.cap')} {formatPolicyLimit(node.max_sessions, t('nodes.policy.sessions'), t, formatNumber)} ·{' '}
                      {formatPolicyLimit(node.bandwidth_limit_mbps, t('nodes.policy.mbps'), t, formatNumber)}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  <span className="text-white font-medium">{formatAvailability(node.availability_24h?.percent, t)}</span>
                  <div className="text-xs text-gray-500">
                    {t('nodes.samples', { count: formatNumber(node.availability_24h?.sample_count ?? 0) })}
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  <span className="text-white font-medium">{formatNumber(node.active_sessions)}</span>
                  <span className="text-gray-500"> {t('nodes.active')}</span>
                  <div className="text-xs text-gray-500">
                    {formatCapacityLeft(node, t, formatNumber)}
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  {t('nodes.operations.cpu')} {formatMetric(node.system.cpu_usage, '%', t)}
                  <div className="text-xs text-gray-500">
                    {t('nodes.operations.memory')} {formatMemory(node.system.memory_mb, node.system.memory_total_mb, t, formatNumber)}
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-400">{node.version || t('nodes.unknown')}</td>
                <td className="px-5 py-4 text-gray-400">
                  {node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : t('nodes.never')}
                  <div className="text-xs text-gray-600">
                    {node.last_seen_seconds === null
                      ? t('nodes.agePending')
                      : t('nodes.ageSeconds', { seconds: formatNumber(node.last_seen_seconds) })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================
// Nodes Page Component
// ============================================

export default function NodesPage() {
  const { t, formatNumber } = useI18n();
  const { nodes, isLoading } = useNodes();
  const { overview, isLoading: vpnOverviewLoading } = useVpnOverview();
  const {
    servers,
    summary: vpnPlacementSummary,
    isLoading: vpnServersLoading,
    total: vpnServerTotal,
    available: vpnServerAvailable,
  } = useVpnServers();
  const deleteNodeMutation = useDeleteNode();

  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<Node | null>(null);

  // Calculate counts for filter tabs
  const counts = {
    all: nodes.length,
    online: nodes.filter(n => n.status === 'online').length,
    offline: nodes.filter(n => n.status === 'offline').length,
    suspended: nodes.filter(n => n.status === 'suspended').length,
  };

  // Filter nodes based on active filter and search query
  const filteredNodes = nodes.filter(node => {
    if (activeFilter !== 'all' && node.status !== activeFilter) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        node.name.toLowerCase().includes(query) ||
        node.public_ip.includes(query) ||
        node.id.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Memoized handlers
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

  const handleDeleteNode = useCallback(async () => {
    if (!nodeToDelete) return;

    try {
      await deleteNodeMutation.mutateAsync(nodeToDelete.id);
      setNodeToDelete(null);
    } catch (err) {
      console.error('Failed to delete node:', err);
    }
  }, [nodeToDelete, deleteNodeMutation]);

  const handleFilterChange = useCallback((filter: FilterOption) => {
    setActiveFilter(filter);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleViewAllNodes = useCallback(() => {
    setActiveFilter('all');
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t('nodes.title')}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {t('nodes.subtitle')}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <FilterTabs
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          counts={counts}
        />
      </div>

      {/* Actions Bar */}
      <div className="mb-6">
        <ActionsBar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onAddNode={handleOpenAddModal}
        />
      </div>

      {/* VPN Node Operations */}
      <ClientPlacementPanel
        servers={servers}
        summary={vpnPlacementSummary}
        isLoading={vpnServersLoading}
        total={vpnServerTotal}
        available={vpnServerAvailable}
      />

      <VpnNodeOperationsTable
        nodes={overview?.nodes ?? []}
        isLoading={vpnOverviewLoading}
      />

      {/* Nodes Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <NodeCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredNodes.length === 0 ? (
        searchQuery ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            title={t('nodes.noResultsTitle')}
            description={t('nodes.noResultsDescription', { query: searchQuery })}
            action={
              <Button variant="secondary" onClick={handleClearSearch}>
                {t('nodes.clearSearch')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            }
            title={activeFilter === 'all'
              ? t('nodes.emptyTitle')
              : t('nodes.emptyStatusTitle', { status: t(`common.status.${activeFilter}`) })}
            description={
              activeFilter === 'all'
                ? t('nodes.emptyDescription')
                : t('nodes.emptyStatusDescription', { status: t(`common.status.${activeFilter}`) })
            }
            action={
              activeFilter === 'all' ? (
                <Button variant="primary" onClick={handleOpenAddModal}>
                  {t('nodes.addFirstNode')}
                </Button>
              ) : (
                <Button variant="secondary" onClick={handleViewAllNodes}>
                  {t('nodes.viewAllNodes')}
                </Button>
              )
            }
          />
        )
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredNodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onDelete={handleSetNodeToDelete}
            />
          ))}
        </div>
      )}

      {/* Results Count */}
      {!isLoading && filteredNodes.length > 0 && (
        <div className="mt-6 text-center text-sm text-gray-500">
          {t('nodes.resultsCount', {
            shown: formatNumber(filteredNodes.length),
            total: formatNumber(nodes.length),
          })}
        </div>
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
        title={t('nodes.deleteTitle')}
        message={t('nodes.deleteMessage', { name: nodeToDelete?.name || t('nodes.card.unnamed') })}
        confirmText={t('nodes.deleteTitle')}
        cancelText={t('nodes.cancel')}
        variant="danger"
        isLoading={deleteNodeMutation.isPending}
      />
    </div>
  );
}
