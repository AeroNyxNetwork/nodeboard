/**
 * ============================================
 * AeroNyx Dashboard Overview Page
 * ============================================
 * File Path: app/dashboard/page.tsx
 * 
 * Last Modified: v1.0.1 - Fixed re-render issues
 * ============================================
 */

'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useNodes, useAggregatedStats, useDeleteNode, useVpnOverview, useVpnEvents } from '@/hooks/useNodes';
import { useAuthStore } from '@/stores/authStore';
import { Node, VpnEvent, VpnEventSeverity, VpnHealthStatus } from '@/types';
import { formatBytes, formatRelativeTime, truncateAddress } from '@/lib/api';
import Card, { StatCard, EmptyState } from '@/components/common/Card';
import Button from '@/components/common/Button';
import NodeCard, { NodeCardSkeleton } from '@/components/dashboard/NodeCard';
import AddNodeModal from '@/components/dashboard/AddNodeModal';
import { ConfirmDialog } from '@/components/common/Modal';

// ============================================
// Page Header Component
// ============================================

function PageHeader({ onAddNode }: { onAddNode: () => void }) {
  const walletAddress = useAuthStore((state) => state.walletAddress);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Welcome back, {truncateAddress(walletAddress || '', 6)}
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
        Add Node
      </Button>
    </div>
  );
}

// ============================================
// Stats Grid Component
// ============================================

function StatsGrid() {
  const { stats, isLoading } = useAggregatedStats();

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
        label="Total Nodes"
        value={stats.totalNodes}
        subValue={`${stats.onlineNodes} online`}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        }
      />
      <StatCard
        label="Active Sessions"
        value={stats.activeSessions.toLocaleString()}
        subValue={`${stats.totalSessions.toLocaleString()} total`}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      />
      <StatCard
        label="Total Traffic"
        value={`${stats.totalTrafficGB.toFixed(1)} GB`}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        }
      />
      <StatCard
        label="Avg Uptime"
        value={`${stats.avgUptime.toFixed(1)}h`}
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
// VPN Operations Snapshot
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

function formatAvailability(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'pending';
  return `${value.toFixed(value >= 99.95 ? 2 : 1)}%`;
}

function formatEventReason(event: VpnEvent) {
  const details = event.details || {};

  if (typeof details.degraded_reason === 'string') return details.degraded_reason;
  if (typeof details.error_message === 'string') return details.error_message;
  if (typeof details.quality_status === 'string') return `session ${details.quality_status}`;
  if (typeof details.health_status === 'string') return `node ${details.health_status}`;
  if (typeof details.observed_mbps === 'number' && typeof details.bandwidth_limit_mbps === 'number') {
    return `${details.observed_mbps.toFixed(1)} / ${details.bandwidth_limit_mbps.toFixed(1)} Mbps`;
  }
  if (Array.isArray(details.changed_fields) && details.changed_fields.length > 0) {
    return details.changed_fields.slice(0, 3).join(', ');
  }
  if (event.session_id) return `session ${event.session_id}`;
  if (event.command_id) return `command ${event.command_id.slice(0, 8)}`;
  return event.type.replaceAll('_', ' ');
}

function VpnOperationsSnapshot() {
  const { overview, isLoading, isError } = useVpnOverview();
  const { events: eventOverview, isLoading: eventsLoading } = useVpnEvents({
    days: 1,
    severity: 'all',
    limit: 5,
  });
  const summary = overview?.summary;
  const attentionNodes = (overview?.nodes ?? [])
    .filter((node) => node.health_status !== 'healthy')
    .sort((a, b) => a.health_score - b.health_score)
    .slice(0, 4);
  const recentEvents = eventOverview?.events ?? [];
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
            <h2 className="text-base font-semibold text-white">VPN Operations</h2>
            <p className="text-sm text-yellow-300 mt-1">VPN observability data is temporarily unavailable.</p>
          </div>
          <Link href="/dashboard/sessions" className="text-sm text-purple-300 hover:text-purple-200">
            Open VPN Operations
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
            <h2 className="text-base font-semibold text-white">VPN Operations</h2>
            <p className="text-xs text-gray-500 mt-1">
              Updated {formatRelativeTime(overview.generated_at)}
            </p>
          </div>
          <Link href="/dashboard/sessions" className="text-sm text-purple-300 hover:text-purple-200">
            Open Operations
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
            <p className="text-xs text-gray-500">Healthy VPN Nodes</p>
            <p className="text-xl font-semibold text-white mt-1">
              {summary?.healthy_nodes ?? 0}/{summary?.total_nodes ?? 0}
            </p>
            <p className="text-xs text-gray-600">
              {(summary?.degraded_nodes ?? 0) + (summary?.overloaded_nodes ?? 0)} degraded
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
            <p className="text-xs text-gray-500">24h Availability</p>
            <p className="text-xl font-semibold text-white mt-1">
              {formatAvailability(summary?.availability_24h_percent)}
            </p>
            <p className="text-xs text-gray-600">sampled heartbeats</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
            <p className="text-xs text-gray-500">Active Tunnels</p>
            <p className="text-xl font-semibold text-white mt-1">{summary?.active_sessions ?? 0}</p>
            <p className="text-xs text-gray-600">live sessions</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
            <p className="text-xs text-gray-500">VPN Traffic</p>
            <p className="text-xl font-semibold text-white mt-1">{formatBytes(totalTrafficBytes, 1)}</p>
            <p className="text-xs text-gray-600">{summary?.open_alerts ?? 0} open alerts</p>
          </div>
        </div>
      </Card>

      <Card variant="default" padding="md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Needs Attention</h2>
          <Link href="/dashboard/events" className="text-sm text-purple-300 hover:text-purple-200">
            Events
          </Link>
        </div>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-600">Nodes</p>
            {attentionNodes.length === 0 ? (
              <p className="text-sm text-emerald-300">All VPN nodes are currently healthy.</p>
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
                          {node.public_ip || 'no ip'} · {node.region_code || 'no region'}
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
            <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-600">Recent Events</p>
            {eventsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="h-11 rounded-xl bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : recentEvents.length === 0 ? (
              <p className="text-sm text-gray-500">No VPN events in the last 24 hours.</p>
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
                          {event.node_name || 'Fleet'} · {formatEventReason(event)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-500">
                        {event.created_at ? formatRelativeTime(event.created_at) : 'now'}
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

      {/* VPN Operations Snapshot */}
      <VpnOperationsSnapshot />

      {/* Nodes Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Your Nodes</h2>
          {nodes.length > 0 && (
            <span className="text-sm text-gray-500">
              {nodes.length} node{nodes.length !== 1 ? 's' : ''}
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
            title="No Nodes Yet"
            description="Get started by adding your first node to the network. Generate a registration code and run the setup command on your server."
            action={
              <Button variant="primary" onClick={handleOpenAddModal}>
                Add Your First Node
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
              <h3 className="font-medium text-white">Need more capacity?</h3>
              <p className="text-sm text-gray-400">Add more nodes to increase your network contribution and earnings.</p>
            </div>
            <Button variant="secondary" onClick={handleOpenAddModal}>
              Add Another Node
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
        title="Delete Node"
        message={`Are you sure you want to delete "${nodeToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteNodeMutation.isPending}
      />
    </div>
  );
}
