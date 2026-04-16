/**
 * ============================================
 * AeroNyx Node Detail Page
 * ============================================
 * File Path: src/app/dashboard/nodes/[id]/page.tsx
 *
 * Creation Reason: Individual node detail view
 * Modification Reason:
 *   v1.4.0 - Added NodeSettings panel between AgentPanel and AI Memory card.
 *     NodeSettings handles: visibility / region / city / is_vpn_node /
 *     access_password. Name editing remains inline (EditableName).
 *   v1.3.0 - Added AI Memory entry card between AgentPanel and StatsGrid.
 *   v1.2.0 - Integrated AgentPanel for Phase 1 Agent Lifecycle Management.
 *   v1.1.0 - Bug fixes: inline name edit, toast, copy actions.
 *
 * Main Functionality:
 *   1. Node header with inline name editing and delete action
 *   2. AgentPanel — OpenClaw lifecycle management
 *   3. NodeSettings — visibility / region / VPN / password config (v1.4.0)
 *   4. AI Memory entry card (online nodes only)
 *   5. Stats grid — uptime / sessions / traffic
 *   6. Hardware info + node details
 *   7. Recent sessions table
 *
 * Dependencies:
 *   - hooks/useNodes.ts (useNodeDetail, useNodeStats, useNodeSessions,
 *                        useUpdateNode, useDeleteNode)
 *   - components/dashboard/AgentPanel.tsx
 *   - components/dashboard/NodeSettings.tsx (v1.4.0)
 *   - components/common/Card.tsx
 *   - components/common/Button.tsx
 *   - components/common/Modal.tsx
 *
 * ⚠️ Important Notes for Next Developer:
 *   - NodeSettings calls onSaved() on success → triggers refetch()
 *     so the detail view reflects the latest values immediately
 *   - Name editing (EditableName) is separate from NodeSettings intentionally:
 *     name is a prominent identity field, deserves its own inline UX
 *   - showToast is shared: AgentPanel, NodeSettings, and page all use it
 *   - Memory card only shows when node.status === 'online'
 *   - Delete navigates to /dashboard/nodes after 1s (user sees toast)
 *
 * Last Modified: v1.4.0 - Added NodeSettings panel
 * Previous: v1.3.0 - Added AI Memory entry card
 * ============================================
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useNodeDetail,
  useNodeStats,
  useNodeSessions,
  useUpdateNode,
  useDeleteNode,
} from '@/hooks/useNodes';
import { NodeStatus } from '@/types';
import { formatRelativeTime, formatDuration, copyToClipboard } from '@/lib/api';
import { NODE_STATUS_CONFIG } from '@/lib/constants';
import Card, { StatCard } from '@/components/common/Card';
import Button, { CopyButton } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/Modal';
import AgentPanel from '@/components/dashboard/AgentPanel';
import NodeSettings from '@/components/dashboard/NodeSettings';

// ============================================
// Toast Component
// ============================================

function Toast({ message, variant = 'success' }: { message: string; variant?: 'success' | 'error' }) {
  return (
    <div className={`
      fixed top-6 left-1/2 -translate-x-1/2 z-50
      px-4 py-2 rounded-lg text-sm font-medium
      ${variant === 'success'
        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
        : 'bg-red-500/20 border border-red-500/30 text-red-300'
      }
    `}>
      {message}
    </div>
  );
}

// ============================================
// Back Button
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
// Editable Name
// ============================================

interface EditableNameProps {
  name: string;
  onSave: (newName: string) => Promise<void>;
  isLoading: boolean;
}


function EditableName({ name, onSave, isLoading }: EditableNameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref 标记：当前是否正在执行保存，避免 onBlur 竞态取消保存
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCancel = useCallback(() => {
    setEditValue(name);
    setIsEditing(false);
    isSavingRef.current = false;
  }, [name]);

  const handleSave = useCallback(async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === name) {
      handleCancel();
      return;
    }
    // 标记正在保存，防止 onBlur 触发 cancel
    isSavingRef.current = true;
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch {
      // 保存失败，保持编辑模式
    } finally {
      isSavingRef.current = false;
    }
  }, [editValue, name, onSave, handleCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') handleCancel();
  }, [handleSave, handleCancel]);

  // onBlur：若正在保存则跳过，避免竞态
  const handleBlur = useCallback(() => {
    if (isSavingRef.current) return;
    handleCancel();
  }, [handleCancel]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}   // 用 handleBlur 替代 handleCancel
          disabled={isLoading}
          maxLength={100}
          className="
            text-2xl font-bold text-white bg-white/5
            border border-purple-500/50 rounded-lg
            px-3 py-1 outline-none
            focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30
          "
        />
        {isLoading && (
          <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => { setEditValue(name); setIsEditing(true); }}
      className="group/name flex items-center gap-2 text-left"
      title="Click to edit name"
    >
      <h1 className="text-2xl font-bold text-white">{name}</h1>
      <svg
        className="w-4 h-4 text-gray-600 opacity-0 group-hover/name:opacity-100 transition-opacity"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      </svg>
    </button>
  );
}

// ============================================
// Node Header
// ============================================

interface NodeHeaderProps {
  node: {
    id: string;
    name: string;
    status: NodeStatus;
    public_ip: string;
    port: number;
    version: string;
    is_verified: boolean;
    last_heartbeat: string;
  };
  onSaveName: (name: string) => Promise<void>;
  isSavingName: boolean;
  onDelete: () => void;
}

function NodeHeader({ node, onSaveName, isSavingName, onDelete }: NodeHeaderProps) {
  const statusConfig = NODE_STATUS_CONFIG[node.status] ?? {
    label: 'Unknown',
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/50',
  };

  return (
    <Card variant="glow" padding="lg" className="mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <EditableName name={node.name} onSave={onSaveName} isLoading={isSavingName} />
              <div className={`
                flex items-center gap-2 px-3 py-1 rounded-full
                ${statusConfig.bgColor} ${statusConfig.textColor} border ${statusConfig.borderColor}
              `}>
                <span className={`w-2 h-2 rounded-full ${
                  node.status === 'online' ? 'bg-emerald-400 animate-pulse' :
                  node.status === 'offline' ? 'bg-gray-400' : 'bg-red-400'
                }`} />
                <span className="text-xs font-medium">{statusConfig.label}</span>
              </div>
              {node.is_verified && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Verified
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span className="font-mono truncate">{node.public_ip}:{node.port}</span>
                <CopyButton text={`${node.public_ip}:${node.port}`} />
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Last seen {formatRelativeTime(node.last_heartbeat)}</span>
              </div>
              <span className="text-gray-600">v{node.version}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="danger" onClick={onDelete}>Delete Node</Button>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Stats Grid
// ============================================

function StatsGrid({ nodeId }: { nodeId: string }) {
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
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      />
      <StatCard
        label="Active Sessions"
        value={stats.active_sessions}
        subValue={`${stats.total_sessions} total`}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
      />
      <StatCard
        label="Total Traffic"
        value={`${stats.total_traffic_gb.toFixed(2)} GB`}
        subValue={`~${stats.avg_session_traffic_mb.toFixed(0)} MB/session`}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>}
      />
      <StatCard
        label="Avg Session"
        value={`${stats.avg_session_duration_minutes.toFixed(0)} min`}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      />
    </div>
  );
}

// ============================================
// Sessions Table
// ============================================

function SessionsTable({ nodeId }: { nodeId: string }) {
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
                    {session.duration_seconds > 0 ? formatDuration(session.duration_seconds) : 'Active'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`
                      inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
                      ${session.status === 'active' ? 'bg-emerald-500/20 text-emerald-400'
                        : session.status === 'completed' ? 'bg-gray-500/20 text-gray-400'
                        : 'bg-red-500/20 text-red-400'}
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
// Node Detail Page
// ============================================

export default function NodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params.id as string;

  const { node, isLoading, isError, refetch } = useNodeDetail(nodeId);
  const updateNodeMutation = useUpdateNode();
  const deleteNodeMutation = useDeleteNode();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSaveName = useCallback(async (newName: string) => {
    try {
      await updateNodeMutation.mutateAsync({ nodeId, data: { name: newName } });
      refetch();
      showToast('Node name updated');
    } catch (err) {
      showToast('Failed to update name', 'error');
      throw err;
    }
  }, [nodeId, updateNodeMutation, refetch, showToast]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteNodeMutation.mutateAsync(nodeId);
      showToast('Node deleted successfully');
      setTimeout(() => router.push('/dashboard/nodes'), 1000);
    } catch {
      showToast('Failed to delete node', 'error');
    }
  }, [nodeId, deleteNodeMutation, router, showToast]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <BackButton />
        <div className="space-y-6">
          <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-20 rounded-2xl bg-white/5 animate-pulse" />
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

  // ── Error state ───────────────────────────────────────────────────────────
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
            <p className="text-gray-400 mb-6">This node doesn&apos;t exist or has been deleted.</p>
            <Button variant="secondary" onClick={() => router.push('/dashboard/nodes')}>
              Back to Nodes
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto">
      {toast && <Toast message={toast.message} variant={toast.variant} />}

      <BackButton />

      {/* 1. Node Header */}
      <NodeHeader
        node={node}
        onSaveName={handleSaveName}
        isSavingName={updateNodeMutation.isPending}
        onDelete={() => setShowDeleteDialog(true)}
      />

      {/* 2. Agent Lifecycle Panel */}
      <AgentPanel
        nodeId={nodeId}
        nodeStatus={node.status}
        onToast={showToast}
      />

      {/* 3. Node Settings (v1.4.0) */}
      <NodeSettings
        node={node}
        onSaved={refetch}
        onToast={showToast}
      />

      {/* 4. AI Memory Entry Card (online only) */}
      {node.status === 'online' && (
        <Card variant="default" padding="md" className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">AI Memory</h3>
                <p className="text-xs text-gray-500">View and manage what the AI remembers about you</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/dashboard/nodes/${nodeId}/memories`)}
            >
              <span className="flex items-center gap-1.5">
                Manage
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Button>
          </div>
        </Card>
      )}

      {/* 5. Stats Grid */}
      <StatsGrid nodeId={nodeId} />

      {/* 6. Hardware Info + Node Details */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card variant="default" padding="md" className="lg:col-span-1">
          <h3 className="font-semibold text-white mb-4">Hardware Info</h3>
          <div className="space-y-4">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">CPU</span>
              <p className="text-sm text-white mt-1 break-words">{node.hardware_info?.cpu || 'Unknown'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Memory</span>
              <p className="text-sm text-white mt-1">{node.hardware_info?.memory || 'Unknown'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">OS</span>
              <p className="text-sm text-white mt-1 break-words">{node.hardware_info?.os || 'Unknown'}</p>
            </div>
          </div>
        </Card>

        <Card variant="default" padding="md" className="lg:col-span-2">
          <h3 className="font-semibold text-white mb-4">Node Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Node ID</span>
              <div className="flex items-center gap-2 mt-1 min-w-0">
                <span className="text-sm font-mono text-gray-300 truncate">{node.id}</span>
                <CopyButton text={node.id} />
              </div>
            </div>
            <div className="min-w-0">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Public Key</span>
              <div className="flex items-center gap-2 mt-1 min-w-0">
                <span className="text-sm font-mono text-gray-300 truncate">
                  {node.public_key?.slice(0, 20)}...
                </span>
                <CopyButton text={node.public_key || ''} />
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Created</span>
              <p className="text-sm text-gray-300 mt-1">
                {new Date(node.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Last Updated</span>
              <p className="text-sm text-gray-300 mt-1">{formatRelativeTime(node.updated_at)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* 7. Sessions Table */}
      <SessionsTable nodeId={nodeId} />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Node"
        message={`Are you sure you want to delete "${node.name}"? This will permanently remove the node and all associated data.`}
        confirmText="Delete Node"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteNodeMutation.isPending}
      />
    </div>
  );
}
