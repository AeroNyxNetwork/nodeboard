/**
 * ============================================
 * AeroNyx Node Detail Page
 * ============================================
 * File Path: src/app/dashboard/nodes/[id]/page.tsx
 *
 * Creation Reason: Individual node detail view
 * Modification Reason:
 *   v1.5.0 - Removed non-VPN auxiliary entry points from nodeboard.
 *   v1.4.0 - Added NodeSettings panel.
 *     NodeSettings handles: visibility / region / city / is_vpn_node /
 *     access_password. Name editing remains inline (EditableName).
 *   v1.1.0 - Bug fixes: inline name edit, toast, copy actions.
 *
 * Main Functionality:
 *   1. Node header with inline name editing and delete action
 *   2. NodeSettings — visibility / region / VPN / password config
 *   3. VPN Health panel from /vpn/overview/ for live heartbeat diagnostics
 *   4. Recent VPN Events for node-scoped health/session/command triage
 *   5. Wallet ban policies and VPN command history
 *   6. Stats grid — uptime / sessions / traffic
 *   7. Hardware info + node details
 *   8. Recent sessions table
 *
 * Dependencies:
 *   - hooks/useNodes.ts (useNodeDetail, useNodeStats, useNodeSessions,
 *                        useUpdateNode, useDeleteNode)
 *   - components/dashboard/NodeSettings.tsx
 *   - components/common/Card.tsx
 *   - components/common/Button.tsx
 *   - components/common/Modal.tsx
 *
 * ⚠️ Important Notes for Next Developer:
 *   - NodeSettings calls onSaved() on success → triggers refetch()
 *     so the detail view reflects the latest values immediately
 *   - Name editing (EditableName) is separate from NodeSettings intentionally:
 *     name is a prominent identity field, deserves its own inline UX
 *   - showToast is shared: NodeSettings and page-level VPN controls use it
 *   - Delete navigates to /dashboard/nodes after 1s (user sees toast)
 *
 * Last Modified: v1.5.0 - Focused nodeboard on VPN operations UI
 * Previous: v1.4.0 - Added NodeSettings panel
 * ============================================
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useNodeDetail,
  useNodeStats,
  useNodeSessions,
  useVpnOverview,
  useVpnEvents,
  useVpnNodeMetrics,
  useNodeWalletBans,
  useNodeCommands,
  useRunNodeCommand,
  useCancelNodeCommand,
  useUpdateNode,
  useDeleteNode,
} from '@/hooks/useNodes';
import {
  NodeCommand,
  NodeStatus,
  NodeWalletBan,
  VpnEvent,
  VpnEventSeverity,
  VpnHealthStatus,
  VpnNodeHealth,
  VpnNodeMetrics,
} from '@/types';
import { formatRelativeTime, formatDuration, formatBytes, copyToClipboard } from '@/lib/api';
import { NODE_STATUS_CONFIG } from '@/lib/constants';
import Card, { StatCard } from '@/components/common/Card';
import Button, { CopyButton } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/Modal';
import NodeSettings from '@/components/dashboard/NodeSettings';

// ============================================
// VPN Health Config
// ============================================

const VPN_HEALTH_CONFIG: Record<VpnHealthStatus, {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
}> = {
  healthy: {
    label: 'Healthy',
    bgColor: 'bg-emerald-500/15',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-500/30',
    dotColor: 'bg-emerald-400',
  },
  degraded: {
    label: 'Degraded',
    bgColor: 'bg-yellow-500/15',
    textColor: 'text-yellow-300',
    borderColor: 'border-yellow-500/30',
    dotColor: 'bg-yellow-400',
  },
  overloaded: {
    label: 'Overloaded',
    bgColor: 'bg-orange-500/15',
    textColor: 'text-orange-300',
    borderColor: 'border-orange-500/30',
    dotColor: 'bg-orange-400',
  },
  offline: {
    label: 'Offline',
    bgColor: 'bg-red-500/15',
    textColor: 'text-red-300',
    borderColor: 'border-red-500/30',
    dotColor: 'bg-red-400',
  },
};

const VPN_EVENT_SEVERITY_CONFIG: Record<VpnEventSeverity, {
  label: string;
  badgeClass: string;
  dotClass: string;
}> = {
  critical: {
    label: 'Critical',
    badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30',
    dotClass: 'bg-red-400',
  },
  warning: {
    label: 'Warning',
    badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    dotClass: 'bg-yellow-400',
  },
  info: {
    label: 'Info',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    dotClass: 'bg-sky-400',
  },
};

const HEALTH_CHECK_LABELS: Record<string, string> = {
  heartbeat: 'Heartbeat',
  resource_load: 'Resource Load',
  traffic_counters: 'Traffic Counters',
  udp_listener: 'UDP Listener',
  tun_device: 'TUN Device',
  mtu_config: 'MTU Config',
  ip_forward: 'IP Forwarding',
  nat_masquerade: 'NAT Masquerade',
  dns_stub: 'DNS Stub',
  dns_query: 'DNS Query',
  internet_egress: 'Internet Egress',
};

function formatHealthCheckName(name: string): string {
  return HEALTH_CHECK_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

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

  // onBlur：触发保存（不是取消）
  // 标准内联编辑 UX：移开焦点 = 确认保存，Escape = 取消
  // 若正在保存中则跳过，避免重复提交
  const handleBlur = useCallback(() => {
    if (isSavingRef.current) return;
    handleSave();
  }, [handleSave]);

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
// VPN Health Panel
// ============================================

function VpnHealthBadge({ status }: { status: VpnHealthStatus }) {
  const config = VPN_HEALTH_CONFIG[status];
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium
      ${config.bgColor} ${config.textColor} ${config.borderColor}
    `}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}

function formatMemoryUsage(health: VpnNodeHealth) {
  const used = health.system.memory_mb;
  const total = health.system.memory_total_mb;
  if (used === null) return 'pending';
  return total ? `${used} / ${total} MB` : `${used} MB`;
}

function policyCount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatPolicyReason(reason: string | null | undefined) {
  return reason ? reason.replace(/_/g, ' ') : 'none';
}

function formatAvailability(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'pending';
  return `${value.toFixed(value >= 99.95 ? 2 : 1)}%`;
}

function formatBitsPerSecond(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'pending';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Gbps`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} Mbps`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} Kbps`;
  return `${Math.round(value)} bps`;
}

function commandStatusClass(status: string) {
  if (status === 'completed') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
  if (status === 'failed' || status === 'timeout') return 'bg-red-500/15 text-red-300 border-red-500/25';
  if (status === 'pending' || status === 'sent' || status === 'executing') {
    return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25';
  }
  return 'bg-white/5 text-gray-300 border-white/10';
}

function commandMessage(command: NodeCommand) {
  const message = command.result?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (command.error_message) return command.error_message;
  return 'Waiting for the node heartbeat to pick up this command.';
}

function parseCommandResult(command: NodeCommand) {
  const text = commandMessage(command);
  const lines = text.split('\n');
  const firstLine = lines[0]?.trim() || '';
  const logMatch = firstLine.match(/^recent_logs\(([^)]+)\):$/);

  if (logMatch) {
    return {
      kind: 'logs' as const,
      title: `Recent logs (${logMatch[1]})`,
      summary: command.status === 'completed' ? 'Log tail collected from the VPN service.' : firstLine,
      pairs: [] as Array<{ key: string; value: string }>,
      body: lines.slice(1).join('\n').trim(),
    };
  }

  const pairs: Array<{ key: string; value: string }> = [];
  const bodyLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_(). -]{2,48}):\s*(.*)$/);
    if (match) {
      pairs.push({
        key: match[1].replace(/_/g, ' ').trim(),
        value: match[2].trim() || 'empty',
      });
    } else if (line.trim()) {
      bodyLines.push(line);
    }
  }

  return {
    kind: pairs.length > 0 ? 'diagnostics' as const : 'message' as const,
    title: pairs.length > 0 ? 'Diagnostic Result' : 'Command Result',
    summary: firstLine,
    pairs,
    body: bodyLines.join('\n').trim(),
  };
}

function CommandResultPanel({ command }: { command: NodeCommand }) {
  const parsed = parseCommandResult(command);
  const copyText = parsed.kind === 'logs'
    ? (parsed.body || parsed.summary)
    : commandMessage(command);

  return (
    <div className="mt-3 rounded-xl border border-white/5 bg-black/20 overflow-hidden">
      <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-gray-300">{parsed.title}</span>
        <div className="flex items-center gap-2">
          {command.result?.timestamp ? (
            <span className="text-[11px] text-gray-600">
              node time {String(command.result.timestamp)}
            </span>
          ) : null}
          <CopyButton text={copyText} />
        </div>
      </div>

      {parsed.kind === 'logs' ? (
        <div>
          <p className="px-3 pt-2 text-xs text-gray-500">{parsed.summary}</p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words px-3 pb-3 text-xs text-gray-400 font-mono">
            {parsed.body || 'No log lines returned.'}
          </pre>
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {parsed.pairs.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {parsed.pairs.map((item) => (
                <div key={`${item.key}-${item.value}`} className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5">
                  <p className="text-[11px] uppercase text-gray-600">{item.key}</p>
                  <p className="mt-1 text-xs text-gray-300 whitespace-pre-wrap break-words font-mono">{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 whitespace-pre-wrap break-words">{parsed.summary}</p>
          )}

          {parsed.body ? (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white/[0.03] border border-white/5 p-2 text-xs text-gray-500 font-mono">
              {parsed.body}
            </pre>
          ) : null}
        </div>
      )}
    </div>
  );
}

function commandLabel(command: NodeCommand) {
  const labels: Record<string, string> = {
    system_info: 'System diagnostics',
    collect_logs: 'Recent service logs',
    refresh_config: 'Config refresh',
    restart_service: 'Service restart',
    kick_session: 'Session kick',
    ban_wallet: 'Wallet ban',
    unban_wallet: 'Wallet unban',
  };
  return labels[command.action] || command.action_display || command.action;
}

function canCancelCommand(command: NodeCommand) {
  return command.status === 'pending' || command.status === 'sent';
}

function CommandLifecycle({ command }: { command: NodeCommand }) {
  const steps = [
    { label: 'queued', value: command.created_at },
    { label: 'sent', value: command.sent_at },
    { label: 'acked', value: command.acked_at },
    { label: 'done', value: command.completed_at },
  ];

  return (
    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
      {steps.map((step) => (
        <div key={step.label} className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5">
          <p className="text-[11px] uppercase text-gray-600">{step.label}</p>
          <p className={`text-xs mt-0.5 ${step.value ? 'text-gray-300' : 'text-gray-600'}`}>
            {step.value ? formatRelativeTime(step.value) : 'pending'}
          </p>
        </div>
      ))}
    </div>
  );
}

function formatPolicySource(source: string) {
  if (source === 'nodeboard_vpn_operations') return 'nodeboard';
  if (source === 'codex_smoke_test') return 'smoke test';
  return source.replace(/_/g, ' ');
}

function TrendBars({
  points,
  getValue,
  maxValue,
  colorClass,
  formatValue,
}: {
  points: VpnNodeMetrics['points'];
  getValue: (point: VpnNodeMetrics['points'][number]) => number | null;
  maxValue: number;
  colorClass: string;
  formatValue: (value: number | null) => string;
}) {
  const visiblePoints = points.slice(-36);

  if (visiblePoints.length === 0) {
    return <div className="h-24 rounded-lg bg-white/[0.03]" />;
  }

  return (
    <div className="h-24 flex items-end gap-1 rounded-lg bg-white/[0.03] border border-white/5 px-2 py-2">
      {visiblePoints.map((point) => {
        const value = getValue(point);
        const pct = value === null || maxValue <= 0 ? 0 : Math.max(0.04, Math.min(value / maxValue, 1));
        return (
          <div
            key={`${point.timestamp}-${point.interval_seconds ?? 'sample'}`}
            className="flex-1 min-w-[3px] rounded-t bg-white/10"
            title={`${formatRelativeTime(point.timestamp)} · ${formatValue(value)}`}
            style={{ height: `${pct * 100}%` }}
          >
            <div className={`h-full rounded-t ${value === null ? 'bg-white/10' : colorClass}`} />
          </div>
        );
      })}
    </div>
  );
}

function NodeMetricsTrendPanel({
  metrics,
  isLoading,
}: {
  metrics: VpnNodeMetrics | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mt-5 border-t border-white/5 pt-4">
        <div className="animate-pulse grid md:grid-cols-2 gap-3">
          <div className="h-36 rounded-xl bg-white/5" />
          <div className="h-36 rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (!metrics || metrics.sample_count === 0) {
    return (
      <div className="mt-5 border-t border-white/5 pt-4">
        <h4 className="text-sm font-semibold text-white">24h Metrics</h4>
        <p className="text-sm text-gray-500 mt-2">Metrics history will appear after sampled heartbeats are stored.</p>
      </div>
    );
  }

  const cpuMax = 100;
  const bandwidthMax = Math.max(...metrics.points.map((point) => point.total_bps ?? 0), 1);
  const totalTraffic = metrics.summary.total_rx_bytes + metrics.summary.total_tx_bytes;

  return (
    <div className="mt-5 border-t border-white/5 pt-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-white">24h Metrics</h4>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.sample_count} sampled heartbeats · updated {formatRelativeTime(metrics.generated_at)}
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {metrics.summary.invalid_samples} invalid samples
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">Avg CPU</p>
          <p className="text-lg font-semibold text-white mt-1">
            {metrics.summary.avg_cpu_usage === null ? 'pending' : `${metrics.summary.avg_cpu_usage}%`}
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">Peak Bandwidth</p>
          <p className="text-lg font-semibold text-white mt-1">
            {formatBitsPerSecond(metrics.summary.peak_total_bps)}
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">Traffic Delta</p>
          <p className="text-lg font-semibold text-white mt-1">{formatBytes(totalTraffic, 1)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">Max Sessions</p>
          <p className="text-lg font-semibold text-white mt-1">{metrics.summary.max_active_sessions}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">CPU Load</span>
            <span className="text-xs text-gray-500">{metrics.summary.max_cpu_usage ?? 0}% peak</span>
          </div>
          <TrendBars
            points={metrics.points}
            getValue={(point) => point.cpu_usage}
            maxValue={cpuMax}
            colorClass="bg-emerald-400/80"
            formatValue={(value) => value === null ? 'pending' : `${value}%`}
          />
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">Bandwidth</span>
            <span className="text-xs text-gray-500">{formatBitsPerSecond(metrics.summary.peak_total_bps)} peak</span>
          </div>
          <TrendBars
            points={metrics.points}
            getValue={(point) => point.total_bps}
            maxValue={bandwidthMax}
            colorClass="bg-cyan-400/80"
            formatValue={formatBitsPerSecond}
          />
        </div>
      </div>
    </div>
  );
}

function PolicyEnforcementPanel({ health }: { health: VpnNodeHealth }) {
  const enforcement = health.system.policy_enforcement;
  const maintenance = policyCount(enforcement?.maintenance_rejections);
  const maxSessions = policyCount(enforcement?.max_sessions_rejections);
  const bandwidth = policyCount(enforcement?.bandwidth_drops);
  const total = maintenance + maxSessions + bandwidth;
  const lastAt = enforcement?.last_rejection_at
    ? new Date(enforcement.last_rejection_at * 1000).toISOString()
    : null;

  return (
    <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-white">Policy Enforcement</h4>
          <p className="text-xs text-gray-500 mt-1">
            Node-local policy counters from signed heartbeat health.
          </p>
        </div>
        <div className={total > 0 ? 'text-sm font-semibold text-yellow-300' : 'text-sm font-semibold text-emerald-300'}>
          {total} blocked
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">Maintenance</p>
          <p className="text-base font-semibold text-white mt-1">{maintenance}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">Max Sessions</p>
          <p className="text-base font-semibold text-white mt-1">{maxSessions}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">Bandwidth Drops</p>
          <p className="text-base font-semibold text-white mt-1">{bandwidth}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2 min-w-0">
          <p className="text-[11px] uppercase text-gray-600">Last Rejection</p>
          <p className="text-xs text-gray-300 mt-1 truncate">
            {formatPolicyReason(enforcement?.last_rejection_reason)}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {lastAt ? formatRelativeTime(lastAt) : 'no recent block'}
          </p>
        </div>
      </div>
    </div>
  );
}

function VpnHealthPanel({
  nodeId,
  isVpnNode,
  maintenanceMode,
  isPolicySaving,
  onToggleMaintenance,
  onToast,
}: {
  nodeId: string;
  isVpnNode: boolean;
  maintenanceMode: boolean;
  isPolicySaving: boolean;
  onToggleMaintenance: () => Promise<void>;
  onToast: (message: string, variant?: 'success' | 'error') => void;
}) {
  const { overview, isLoading, isError, refetch } = useVpnOverview();
  const { commands, isLoading: commandsLoading } = useNodeCommands(nodeId, { limit: 20 });
  const { metrics, isLoading: metricsLoading } = useVpnNodeMetrics(nodeId, { hours: 24 });
  const runCommand = useRunNodeCommand();
  const cancelCommand = useCancelNodeCommand();
  const [cancellingCommandId, setCancellingCommandId] = useState<string | null>(null);
  const health = overview?.nodes.find((item) => item.id === nodeId) ?? null;
  const vpnCommands = commands.filter((command) =>
    command.action === 'system_info' ||
    command.action === 'collect_logs' ||
    command.action === 'refresh_config' ||
    command.action === 'restart_service'
  );

  const handleRunCommand = async (action: 'system_info' | 'collect_logs' | 'refresh_config') => {
    const priority = action === 'collect_logs' ? 10 : action === 'refresh_config' ? 3 : 5;
    const successMessage =
      action === 'system_info'
        ? 'System diagnostics queued'
        : action === 'collect_logs'
          ? 'Log collection queued'
          : 'Config refresh queued';

    try {
      await runCommand.mutateAsync({
        nodeId,
        data: {
          action,
          priority,
        },
      });
      onToast(successMessage);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Failed to queue command', 'error');
    }
  };

  const handleRestartService = async () => {
    if (!window.confirm('Restart the VPN service on this node? Active tunnels will reconnect.')) {
      return;
    }

    try {
      await runCommand.mutateAsync({
        nodeId,
        data: {
          action: 'restart_service',
          params: {
            confirm: 'restart',
          },
          priority: 1,
        },
      });
      onToast('VPN service restart queued');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Failed to queue restart', 'error');
    }
  };

  const handleMaintenanceToggle = async () => {
    const actionLabel = maintenanceMode ? 'end maintenance mode' : 'start maintenance mode';
    if (!window.confirm(`Do you want to ${actionLabel} for this VPN node?`)) {
      return;
    }

    try {
      await onToggleMaintenance();
      refetch();
    } catch {
      // The page-level handler owns the toast message.
    }
  };

  const handleCancelCommand = async (command: NodeCommand) => {
    if (!canCancelCommand(command)) return;
    if (!window.confirm(`Cancel queued ${commandLabel(command)}? Commands already executing on the node cannot be interrupted.`)) return;

    setCancellingCommandId(command.id);
    try {
      await cancelCommand.mutateAsync({ nodeId, commandId: command.id });
      onToast('Command cancelled');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Failed to cancel command', 'error');
    } finally {
      setCancellingCommandId(null);
    }
  };

  if (!isVpnNode) {
    return (
      <Card variant="outline" padding="md" className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white">VPN Health</h3>
            <p className="text-sm text-gray-500 mt-1">
              VPN mode is disabled for this node. Enable it in Node Settings to expose tunnel diagnostics.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card variant="default" padding="md" className="mb-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="grid sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (isError || !health) {
    return (
      <Card variant="outline" padding="md" className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white">VPN Health</h3>
            <p className="text-sm text-yellow-300 mt-1">
              Live VPN health is not available yet. The node may not have reported a signed heartbeat.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const failedChecks = health.checks.filter((check) => !check.ok);

  return (
    <Card variant="default" padding="md" className="mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h3 className="font-semibold text-white">VPN Health</h3>
            <VpnHealthBadge status={health.health_status} />
            <span className="text-xs text-gray-500">{health.health_score}/100 score</span>
          </div>
          <p className="text-sm text-gray-500">
            Live tunnel diagnostics from {health.system.source === 'cache' ? 'heartbeat cache' : 'sample fallback'}.
            {health.system.vpn_health_checked_at ? ` VPN checks ran ${formatRelativeTime(new Date(health.system.vpn_health_checked_at * 1000).toISOString())}.` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={runCommand.isPending}
            onClick={() => handleRunCommand('system_info')}
          >
            System Info
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={runCommand.isPending}
            onClick={() => handleRunCommand('collect_logs')}
          >
            Collect Logs
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={runCommand.isPending}
            onClick={() => handleRunCommand('refresh_config')}
          >
            Refresh Config
          </Button>
          <Button
            variant={maintenanceMode ? 'secondary' : 'danger'}
            size="sm"
            disabled={isPolicySaving}
            isLoading={isPolicySaving}
            onClick={handleMaintenanceToggle}
          >
            {maintenanceMode ? 'End Maintenance' : 'Start Maintenance'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={runCommand.isPending}
            onClick={handleRestartService}
          >
            Restart VPN
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">Active Tunnels</p>
          <p className="text-lg font-semibold text-white mt-1">{health.active_sessions}</p>
          <p className="text-xs text-gray-600">{health.total_sessions} total</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">24h Availability</p>
          <p className="text-lg font-semibold text-white mt-1">
            {formatAvailability(health.availability_24h?.percent)}
          </p>
          <p className="text-xs text-gray-600">
            {health.availability_24h?.sample_count ?? 0} samples
            {health.availability_24h?.last_gap_seconds
              ? ` · gap ${formatDuration(health.availability_24h.last_gap_seconds)}`
              : ''}
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">CPU</p>
          <p className="text-lg font-semibold text-white mt-1">
            {health.system.cpu_usage === null ? 'pending' : `${health.system.cpu_usage}%`}
          </p>
          <p className="text-xs text-gray-600">{health.system.cpu_count || 'pending'} cores</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">Memory</p>
          <p className="text-lg font-semibold text-white mt-1">{formatMemoryUsage(health)}</p>
          <p className="text-xs text-gray-600">reported by node</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">Last Heartbeat</p>
          <p className="text-lg font-semibold text-white mt-1">
            {health.last_heartbeat ? formatRelativeTime(health.last_heartbeat) : 'never'}
          </p>
          <p className="text-xs text-gray-600">{health.last_seen_seconds ?? 'pending'}s age</p>
        </div>
      </div>

      <NodeMetricsTrendPanel metrics={metrics} isLoading={metricsLoading} />
      <PolicyEnforcementPanel health={health} />

      <div className="mt-5 grid md:grid-cols-2 gap-3">
        {health.checks.map((check) => (
          <div
            key={check.name}
            className={`
              rounded-xl border px-3 py-2.5
              ${check.ok ? 'bg-emerald-500/[0.04] border-emerald-500/15' : 'bg-yellow-500/[0.06] border-yellow-500/20'}
            `}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">{formatHealthCheckName(check.name)}</span>
              <span className={check.ok ? 'text-xs text-emerald-300' : 'text-xs text-yellow-300'}>
                {check.ok ? 'ok' : 'attention'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{check.detail}</p>
          </div>
        ))}
      </div>

      {failedChecks.length > 0 && (
        <div className="mt-4 rounded-xl bg-yellow-500/[0.06] border border-yellow-500/20 px-4 py-3">
          <p className="text-sm text-yellow-200">
            {failedChecks.length} health check{failedChecks.length === 1 ? '' : 's'} need attention.
          </p>
        </div>
      )}

      <div className="mt-5 border-t border-white/5 pt-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 className="text-sm font-semibold text-white">Recent VPN Commands</h4>
          {commandsLoading && <span className="text-xs text-gray-500">loading</span>}
        </div>
        {vpnCommands.length === 0 ? (
          <p className="text-sm text-gray-500">No VPN diagnostic commands have been queued yet.</p>
        ) : (
          <div className="space-y-2">
            {vpnCommands.map((command) => (
              <div key={command.id} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{commandLabel(command)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Queued {formatRelativeTime(command.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex self-start px-2 py-1 rounded-full border text-xs ${commandStatusClass(command.status)}`}>
                      {command.status_display || command.status}
                    </span>
                    {canCancelCommand(command) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelCommand(command)}
                        disabled={Boolean(cancellingCommandId)}
                        isLoading={cancellingCommandId === command.id}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                <CommandResultPanel command={command} />
                <CommandLifecycle command={command} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================
// Node VPN Events Panel
// ============================================

function eventDetailNumber(details: Record<string, unknown>, key: string): number {
  const value = details[key];
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

function eventReason(event: VpnEvent) {
  const details = event.details || {};

  if (event.type === 'node_policy_enforced') {
    const blocked = (
      eventDetailNumber(details, 'maintenance_rejections') +
      eventDetailNumber(details, 'max_sessions_rejections') +
      eventDetailNumber(details, 'bandwidth_drops')
    );
    const reason = typeof details.last_rejection_reason === 'string'
      ? details.last_rejection_reason.replace(/_/g, ' ')
      : 'policy enforced';
    return `${blocked} blocked · ${reason}`;
  }
  if (typeof details.degraded_reason === 'string') return details.degraded_reason;
  if (typeof details.error_message === 'string') return details.error_message;
  if (typeof details.quality_status === 'string') return `session ${details.quality_status}`;
  if (typeof details.health_status === 'string') return `node ${details.health_status}`;
  if (typeof details.observed_mbps === 'number' && typeof details.bandwidth_limit_mbps === 'number') {
    return `${details.observed_mbps.toFixed(1)} / ${details.bandwidth_limit_mbps.toFixed(1)} Mbps`;
  }
  if (typeof details.rtt_ms === 'number') return `${details.rtt_ms.toFixed(1)} ms RTT`;
  if (Array.isArray(details.changed_fields) && details.changed_fields.length > 0) {
    return details.changed_fields.slice(0, 3).join(', ');
  }
  if (event.session_id) return `session ${event.session_id}`;
  if (event.command_id) return `command ${event.command_id.slice(0, 8)}`;
  return event.type.replace(/_/g, ' ');
}

function eventImpact(event: VpnEvent) {
  const details = event.details || {};

  if (event.type === 'node_policy_enforced') {
    const bandwidthDrops = eventDetailNumber(details, 'bandwidth_drops');
    const maxSessionRejects = eventDetailNumber(details, 'max_sessions_rejections');
    const maintenanceRejects = eventDetailNumber(details, 'maintenance_rejections');
    if (bandwidthDrops > 0) return `${bandwidthDrops} bandwidth drops`;
    if (maxSessionRejects > 0) return `${maxSessionRejects} max-session rejects`;
    if (maintenanceRejects > 0) return `${maintenanceRejects} maintenance rejects`;
  }
  if (typeof details.virtual_ip === 'string' && details.virtual_ip) {
    return `VIP ${details.virtual_ip}`;
  }
  if (typeof details.client_wallet === 'string' && details.client_wallet) {
    return `wallet ${details.client_wallet.slice(0, 10)}...${details.client_wallet.slice(-6)}`;
  }
  if (typeof details.total_bytes === 'number') {
    return formatBytes(details.total_bytes, 1);
  }
  if (event.source) return event.source.replace(/_/g, ' ');
  return 'node event';
}

function VpnEventSeverityBadge({ severity }: { severity: VpnEventSeverity }) {
  const config = VPN_EVENT_SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${config.badgeClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}

function NodeVpnEventsPanel({
  nodeId,
  isVpnNode,
}: {
  nodeId: string;
  isVpnNode: boolean;
}) {
  const { events, isLoading, isError, refetch } = useVpnEvents({
    days: 7,
    nodeId,
    severity: 'all',
    limit: 6,
  });

  if (!isVpnNode) return null;

  const recentEvents = events?.events ?? [];
  const summary = events?.summary;

  return (
    <Card variant="default" padding="md" className="mb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">Recent VPN Events</h3>
          <p className="mt-1 text-sm text-gray-500">
            Node-scoped health, session, command, and policy events from the last 7 days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {summary ? (
            <span className="text-xs text-gray-500">
              {summary.open} open · {summary.critical} critical · {summary.warning} warning
            </span>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] px-4 py-3">
          <p className="text-sm text-yellow-200">Recent VPN events are temporarily unavailable.</p>
        </div>
      ) : recentEvents.length === 0 ? (
        <p className="text-sm text-emerald-300">No VPN events recorded for this node in the last 7 days.</p>
      ) : (
        <div className="space-y-3">
          {recentEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <VpnEventSeverityBadge severity={event.severity} />
                    <span className="truncate text-sm font-medium text-white">{event.title}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">{event.message}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{eventReason(event)}</span>
                    <span>{eventImpact(event)}</span>
                    {event.session_id ? <span className="font-mono">session {event.session_id}</span> : null}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-gray-500">
                  {event.created_at ? formatRelativeTime(event.created_at) : 'now'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============================================
// Wallet Ban Policies
// ============================================

function WalletBanPolicyRow({
  ban,
  onUnban,
  isBusy,
}: {
  ban: NodeWalletBan;
  onUnban: (walletHex: string) => void;
  isBusy: boolean;
}) {
  return (
    <tr className="hover:bg-white/[0.02]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm text-gray-200">{ban.wallet_short}</span>
          <CopyButton text={ban.wallet_hex} />
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-300">{ban.reason || 'operator_ban'}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-400">{formatPolicySource(ban.source)}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-400">{formatRelativeTime(ban.banned_at)}</span>
      </td>
      <td className="px-4 py-3">
        {ban.command_id ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs text-gray-500 truncate max-w-[120px]">
              {ban.command_id.slice(0, 8)}
            </span>
            <CopyButton text={ban.command_id} />
          </div>
        ) : (
          <span className="text-sm text-gray-600">manual</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          variant="secondary"
          size="sm"
          disabled={isBusy}
          onClick={() => onUnban(ban.wallet_hex)}
        >
          Unban
        </Button>
      </td>
    </tr>
  );
}

function WalletBanPolicyPanel({
  nodeId,
  isVpnNode,
  onToast,
}: {
  nodeId: string;
  isVpnNode: boolean;
  onToast: (message: string, variant?: 'success' | 'error') => void;
}) {
  const { bans, isLoading, isError, refetch } = useNodeWalletBans(nodeId, 'active');
  const runCommand = useRunNodeCommand();

  const handleUnban = async (walletHex: string) => {
    if (!window.confirm(`Unban wallet ${walletHex.slice(0, 8)}...?`)) {
      return;
    }

    try {
      await runCommand.mutateAsync({
        nodeId,
        data: {
          action: 'unban_wallet',
          params: { wallet_hex: walletHex },
          priority: 3,
        },
      });
      await refetch();
      onToast('Wallet unban queued');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Failed to queue wallet unban', 'error');
    }
  };

  if (!isVpnNode) return null;

  return (
    <Card variant="default" padding="none" className="mb-6">
      <div className="px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Wallet Ban Policies</h3>
          <p className="text-sm text-gray-500 mt-1">
            Currently enforced wallet blocks for this node.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-6 flex items-center justify-between gap-4">
          <p className="text-sm text-yellow-300">Wallet ban policies could not be loaded.</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : bans.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">No active wallet bans on this node.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Banned</th>
                <th className="px-4 py-3 font-medium">Command</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bans.map((ban) => (
                <WalletBanPolicyRow
                  key={ban.id}
                  ban={ban}
                  isBusy={runCommand.isPending}
                  onUnban={handleUnban}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
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

  const handleToggleMaintenance = useCallback(async () => {
    if (!node) return;
    const nextMaintenance = !node.maintenance_mode;
    try {
      await updateNodeMutation.mutateAsync({
        nodeId,
        data: { maintenance_mode: nextMaintenance },
      });
      refetch();
      showToast(nextMaintenance ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update maintenance mode', 'error');
      throw error;
    }
  }, [node, nodeId, updateNodeMutation, refetch, showToast]);

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

      {/* 2. Node Settings */}
      <NodeSettings
        node={node}
        onSaved={refetch}
        onToast={showToast}
      />

      {/* 3. VPN Health Panel */}
      <VpnHealthPanel
        nodeId={nodeId}
        isVpnNode={node.is_vpn_node}
        maintenanceMode={node.maintenance_mode}
        isPolicySaving={updateNodeMutation.isPending}
        onToggleMaintenance={handleToggleMaintenance}
        onToast={showToast}
      />

      {/* 4. Recent VPN Events */}
      <NodeVpnEventsPanel nodeId={nodeId} isVpnNode={node.is_vpn_node} />

      {/* 5. Wallet Ban Policies */}
      <WalletBanPolicyPanel nodeId={nodeId} isVpnNode={node.is_vpn_node} onToast={showToast} />

      {/* 6. Stats Grid */}
      <StatsGrid nodeId={nodeId} />

      {/* 7. Hardware Info + Node Details */}
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

      {/* 9. Sessions Table */}
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
