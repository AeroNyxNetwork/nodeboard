/**
 * ============================================
 * AeroNyx Node Detail Page
 * ============================================
 * File Path: src/app/dashboard/nodes/[id]/page.tsx
 * 
 * Creation Reason: Individual node detail view
 * Main Functionality: Display detailed node info, real-time stats,
 *                     sessions list, and management actions
 * Dependencies:
 *   - src/hooks/useNodes.ts
 *   - src/components/common/Card.tsx
 *   - src/components/common/Button.tsx
 * 
 * Main Logical Flow:
 * 1. Fetch node detail and stats
 * 2. Display node info header
 * 3. Show real-time statistics
 * 4. List active sessions
 * 5. Provide management actions
 * 
 * ⚠️ Important Note for Next Developer:
 * - Uses dynamic route [id] parameter
 * - Real-time status updates via polling
 * - Edit mode for node name
 * 
 * Last Modified: v1.0.0 - Initial node detail page
 * ============================================
 */

'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  useNodeDetail,
  useNodeStats,
  useNodeSessions,
  useUpdateNode,
  useDeleteNode,
} from '@/hooks/useNodes';
import { formatRelativeTime, formatBytes, formatDuration } from '@/lib/api';
import { NODE_STATUS_CONFIG } from '@/lib/constants';
import Card, { StatCard } from '@/components/common/Card';
import Button, { IconButton, CopyButton } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/Modal';

// ============================================
// Back Button Component
// ============================================

function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span className="text-sm">Back to Nodes</span>
    </button>
  );
}

// ============================================
// Node Header Component
// ============================================

interface NodeHeaderProps {
  node: {
    id: string;
    name: string;
    status: 'online' | 'offline' | 'suspended';
    public_ip: string;
    port: number;
    version: string;
    is_verified: boolean;
    last_heartbeat: string;
  };
  onEdit: () => void;
  onDelete: () => void;
}

function NodeHeader({ node, onEdit, onDelete }: NodeHeaderProps) {
  const statusConfig = NODE_STATUS_CONFIG[node.status];

  return (
    <Card variant="glow" padding="lg" className="mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Node Info */}
        <div className="flex items-start gap-4">
          <div className="
            w-16 h-16 rounded-2xl
            bg-gradient-to-br from-purple-500/20 to-pink-500/20
            flex items-center justify-center flex-shrink-0
          ">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{node.name}</h1>
              <div className={`
                flex items-center gap-2 px-3 py-1 rounded-full
                ${statusConfig.bgColor} ${statusConfig.textColor}
                border ${statusConfig.borderColor}
              `}>
                <span className={`
                  w-2 h-2 rounded-full
                  ${node.status === 'online' ? 'bg-emerald-400 animate-pulse' : 
                    node.status === 'offline' ? 'bg-gray-400' : 'bg-red-400'}
                `} />
                <span className="text-xs font-medium">{statusConfig.label}</span>
              </div>
              {node.is_verified && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span className="font-mono">{node.public_ip}:{node.port}</span>
                <CopyButton text={`${node.public_ip}:${node.port}`} />
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Last seen {formatRelativeTime(node.last_heartbeat)}</span>
              </div>
              <span className="text-gray-600">v{node.version}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Stats Grid Component
// ============================================

interface StatsGridProps {
  nodeId: string;
}

function StatsGrid({ nodeId }: StatsGridProps) {
  const { stats, isLoading } = useNodeStats(nodeId, { days: 7 });

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Uptime"
        value={`${stats.uptime_percentage.toFixed(1)}%`}
        subValue={`${stats.total_uptime_hours.toFixed(1)} hours`}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <StatCard
        label="Active Sessions"
        value={stats.active_sessions}
        subValue={`${stats.total_sessions} total`}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      />
      <StatCard
        label="Total Traffic"
        value={`${stats.total_traffic_gb.toFixed(2)} GB`}
        subValue={`~${stats.avg_session_traffic_mb.toFixed(0)} MB/session`}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        }
      />
      <StatCard
        label="Avg Session"
        value={`${stats.avg_session_duration_minutes.toFixed(0)} min`}
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
// Sessions Table Component
// ============================================

interface SessionsTableProps {
  nodeId: string;
}

function SessionsTable({ nodeId }: SessionsTableProps) {
  const { sessions, isLoading } = useNodeSessions(nodeId, { limit: 10 });

  return (
    <Card variant="default" padding="none">
      <div className="px-6 py-4 border-b border-white/5">
        <h3 className="font-semibold text-white">Recent Sessions</h3>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-gray-500">No sessions recorded yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">Session ID</th>
                <th className="px-6 py-3 font-medium">Client</th>
                <th className="px-6 py-3 font-medium">Traffic</th>
                <th className="px-6 py-3 font-medium">Duration</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-white/[0.02]">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-300">
                      {session.session_id.slice(0, 12)}...
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-400">
                      {session.client_wallet.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {session.total_bytes_mb.toFixed(2)} MB
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {session.duration_seconds > 0
                      ? formatDuration(session.duration_seconds)
                      : 'Active'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`
                      inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
                      ${session.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : session.status === 'completed'
                        ? 'bg-gray-500/20 text-gray-400'
                        : 'bg-red-500/20 text-red-400'
                      }
                    `}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        session.status === 'active' ? 'bg-emerald-400 animate-pulse' :
                        session.status === 'completed' ? 'bg-gray-400' : 'bg-red-400'
                      }`} />
                      {session.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ============================================
// Node Detail Page Component
// ============================================

export default function NodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params.id as string;

  const { node, isLoading, isError } = useNodeDetail(nodeId);
  const updateNodeMutation = useUpdateNode();
  const deleteNodeMutation = useDeleteNode();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Handle delete
  const handleDelete = async () => {
    try {
      await deleteNodeMutation.mutateAsync(nodeId);
      router.push('/dashboard/nodes');
    } catch (err) {
      console.error('Failed to delete node:', err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <BackButton />
        <div className="space-y-6">
          <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
          <div className="h-96 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !node) {
    return (
      <div className="max-w-7xl mx-auto">
        <BackButton />
        <Card variant="outline" padding="lg" className="text-center">
          <div className="py-12">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-white mb-2">Node Not Found</h2>
            <p className="text-gray-400 mb-6">The node you're looking for doesn't exist or has been deleted.</p>
            <Button variant="secondary" onClick={() => router.push('/dashboard/nodes')}>
              Back to Nodes
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <BackButton />

      {/* Node Header */}
      <NodeHeader
        node={node}
        onEdit={() => {/* TODO: Implement edit modal */}}
        onDelete={() => setShowDeleteDialog(true)}
      />

      {/* Stats Grid */}
      <StatsGrid nodeId={nodeId} />

      {/* Hardware Info */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card variant="default" padding="md" className="lg:col-span-1">
          <h3 className="font-semibold text-white mb-4">Hardware Info</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">CPU</span>
              <span className="text-sm text-white">{node.hardware_info?.cpu || 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Memory</span>
              <span className="text-sm text-white">{node.hardware_info?.memory || 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">OS</span>
              <span className="text-sm text-white">{node.hardware_info?.os || 'Unknown'}</span>
            </div>
          </div>
        </Card>

        <Card variant="default" padding="md" className="lg:col-span-2">
          <h3 className="font-semibold text-white mb-4">Node Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Node ID</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-mono text-gray-300 truncate">{node.id}</span>
                <CopyButton text={node.id} />
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Public Key</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-mono text-gray-300 truncate">{node.public_key?.slice(0, 20)}...</span>
                <CopyButton text={node.public_key || ''} />
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Created</span>
              <p className="text-sm text-gray-300 mt-1">{new Date(node.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Last Updated</span>
              <p className="text-sm text-gray-300 mt-1">{formatRelativeTime(node.updated_at)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sessions Table */}
      <SessionsTable nodeId={nodeId} />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Node"
        message={`Are you sure you want to delete "${node.name}"? This will remove the node from your account permanently.`}
        confirmText="Delete Node"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteNodeMutation.isPending}
      />
    </div>
  );
}
