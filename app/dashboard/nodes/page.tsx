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
import { Node, NodeStatus, VpnHealthStatus, VpnNodeHealth, VpnServerCandidate } from '@/types';
import { formatRelativeTime } from '@/lib/api';
import Button from '@/components/common/Button';
import Card, { EmptyState } from '@/components/common/Card';
import NodeCard, { NodeCardSkeleton } from '@/components/dashboard/NodeCard';
import AddNodeModal from '@/components/dashboard/AddNodeModal';
import { ConfirmDialog } from '@/components/common/Modal';

// ============================================
// Filter Tabs Component
// ============================================

type FilterOption = 'all' | NodeStatus;

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
  const tabs: { id: FilterOption; label: string; count: number }[] = [
    { id: 'all', label: 'All Nodes', count: counts.all },
    { id: 'online', label: 'Online', count: counts.online },
    { id: 'offline', label: 'Offline', count: counts.offline },
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
              {tab.count}
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
          placeholder="Search nodes..."
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
        Add Node
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

function formatAvailability(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'pending';
  return `${value.toFixed(value >= 99.95 ? 2 : 1)}%`;
}

function formatMetric(value: number | null | undefined, suffix: string) {
  return typeof value === 'number' && !Number.isNaN(value) ? `${value}${suffix}` : 'pending';
}

function formatMemory(used: number | null, total: number | null) {
  if (used === null) return 'pending';
  return total ? `${used}/${total} MB` : `${used} MB`;
}

function formatPolicyLimit(value: number, unit: string) {
  return value > 0 ? `${value} ${unit}` : 'unlimited';
}

function PolicyBadge({ node }: { node: VpnNodeHealth }) {
  if (node.maintenance_mode) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/15 text-xs font-medium text-yellow-300">
        Maintenance
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-xs font-medium text-emerald-300">
      Accepting
    </span>
  );
}

function formatCapacityLeft(node: VpnNodeHealth) {
  return node.max_sessions > 0
    ? `${Math.max(0, node.max_sessions - node.active_sessions)} capacity left`
    : `${node.total_sessions} total`;
}

function VpnHealthBadge({ status }: { status: VpnHealthStatus }) {
  const style = vpnHealthStyles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

function formatPlacementReason(reason: string | null | undefined) {
  if (!reason) return 'candidate';
  const labels: Record<string, string> = {
    heartbeat_stale: 'heartbeat stale',
    maintenance_mode: 'maintenance',
    max_sessions_reached: 'session cap reached',
    vpn_health_failed: 'VPN health failed',
    overloaded: 'overloaded',
    low_24h_availability: 'low 24h availability',
  };
  return labels[reason] || reason.replace(/_/g, ' ');
}

function placementStatusClass(server: VpnServerCandidate) {
  if (server.available) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
  if (server.unavailable_reason === 'maintenance_mode') {
    return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25';
  }
  return 'bg-red-500/15 text-red-300 border-red-500/25';
}

function ClientPlacementPanel({
  servers,
  isLoading,
  total,
  available,
}: {
  servers: VpnServerCandidate[];
  isLoading: boolean;
  total: number;
  available: number;
}) {
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

  return (
    <Card variant="default" padding="none" className="mb-6">
      <div className="px-5 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Client Placement</h2>
          <p className="text-xs text-gray-500 mt-1">
            Public VPN candidates from backend failover policy. Unavailable nodes hide their address from clients.
          </p>
        </div>
        <div className="text-xs text-gray-500 sm:text-right">
          <span className="text-emerald-300">{available}</span> available · {unavailable} unavailable
        </div>
      </div>

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
                  {server.country_name || server.country} · {server.node_tier || 'public'}
                </p>
              </div>
              <span className={`shrink-0 inline-flex rounded-full border px-2 py-1 text-xs ${placementStatusClass(server)}`}>
                {server.available ? `rank ${server.failover_rank ?? '-'}` : formatPlacementReason(server.unavailable_reason)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-gray-600">Load</p>
                <p className="mt-1 text-gray-300">{server.load === null ? 'pending' : `${server.load}%`}</p>
              </div>
              <div>
                <p className="text-gray-600">24h</p>
                <p className="mt-1 text-gray-300">{formatAvailability(server.availability_24h_percent)}</p>
              </div>
              <div>
                <p className="text-gray-600">Sessions</p>
                <p className="mt-1 text-gray-300">{server.current_sessions}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {server.available
                ? `${server.address || 'hidden'}:${server.port}`
                : `hidden from clients · ${formatPlacementReason(server.unavailable_reason)}`}
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
          <h2 className="text-base font-semibold text-white">VPN Node Operations</h2>
          <p className="text-xs text-gray-500 mt-1">Health, load, sessions, and heartbeat freshness from signed VPN telemetry</p>
        </div>
        <Link href="/dashboard/sessions" className="text-sm text-purple-300 hover:text-purple-200">
          VPN Operations
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="text-xs uppercase text-gray-500 bg-white/[0.02]">
            <tr>
              <th className="text-left font-medium px-5 py-3">Node</th>
              <th className="text-left font-medium px-4 py-3">Region</th>
              <th className="text-left font-medium px-4 py-3">Health</th>
              <th className="text-left font-medium px-4 py-3">Policy</th>
              <th className="text-left font-medium px-4 py-3">Availability</th>
              <th className="text-left font-medium px-4 py-3">Sessions</th>
              <th className="text-left font-medium px-4 py-3">Load</th>
              <th className="text-left font-medium px-4 py-3">Version</th>
              <th className="text-left font-medium px-5 py-3">Last Heartbeat</th>
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
                    {node.public_ip || 'no ip'}:{node.port}
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  {node.region_code || 'pending'}
                  {node.city ? <div className="text-xs text-gray-500">{node.city}</div> : null}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1.5">
                    <VpnHealthBadge status={node.health_status} />
                    <span className="text-xs text-gray-500">{node.health_score}/100 score</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <PolicyBadge node={node} />
                      <span className="text-xs text-gray-500">{node.node_tier || 'public'}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      cap {formatPolicyLimit(node.max_sessions, 'sessions')} ·{' '}
                      {formatPolicyLimit(node.bandwidth_limit_mbps, 'Mbps')}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  <span className="text-white font-medium">{formatAvailability(node.availability_24h?.percent)}</span>
                  <div className="text-xs text-gray-500">
                    {node.availability_24h?.sample_count ?? 0} samples
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  <span className="text-white font-medium">{node.active_sessions}</span>
                  <span className="text-gray-500"> active</span>
                  <div className="text-xs text-gray-500">
                    {formatCapacityLeft(node)}
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">
                  CPU {formatMetric(node.system.cpu_usage, '%')}
                  <div className="text-xs text-gray-500">
                    Mem {formatMemory(node.system.memory_mb, node.system.memory_total_mb)}
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-400">{node.version || 'unknown'}</td>
                <td className="px-5 py-4 text-gray-400">
                  {node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : 'never'}
                  <div className="text-xs text-gray-600">
                    {node.last_seen_seconds === null ? 'age pending' : `${node.last_seen_seconds}s age`}
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
  const { nodes, isLoading } = useNodes();
  const { overview, isLoading: vpnOverviewLoading } = useVpnOverview();
  const { servers, isLoading: vpnServersLoading, total: vpnServerTotal, available: vpnServerAvailable } = useVpnServers();
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
        <h1 className="text-2xl font-bold text-white">Nodes</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage and monitor all your privacy network nodes
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
            title="No Results Found"
            description={`No nodes match "${searchQuery}". Try a different search term.`}
            action={
              <Button variant="secondary" onClick={handleClearSearch}>
                Clear Search
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
            title={activeFilter === 'all' ? 'No Nodes Yet' : `No ${activeFilter} Nodes`}
            description={
              activeFilter === 'all'
                ? 'Get started by adding your first node to the network.'
                : `You don't have any ${activeFilter} nodes at the moment.`
            }
            action={
              activeFilter === 'all' ? (
                <Button variant="primary" onClick={handleOpenAddModal}>
                  Add Your First Node
                </Button>
              ) : (
                <Button variant="secondary" onClick={handleViewAllNodes}>
                  View All Nodes
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
          Showing {filteredNodes.length} of {nodes.length} nodes
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
        title="Delete Node"
        message={`Are you sure you want to delete "${nodeToDelete?.name}"? This action cannot be undone and will remove all associated data.`}
        confirmText="Delete Node"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteNodeMutation.isPending}
      />
    </div>
  );
}
