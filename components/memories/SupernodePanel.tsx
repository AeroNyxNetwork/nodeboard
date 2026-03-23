/**
 * ============================================
 * AeroNyx Privacy Network - SuperNode Panel
 * ============================================
 * File Path: components/memories/SupernodePanel.tsx
 *
 * Creation Reason: Phase 4 — v2.5.0 SuperNode management panel.
 *   Shows cognitive task queue, LLM usage statistics, and provider health.
 *   Only rendered when status.supernode?.enabled === true.
 *
 * Main Functionality:
 *   - Sub-tab: Tasks | Usage | Health
 *   - Tasks: live-polling task queue with status badges, retry/cancel actions
 *   - Usage: provider × task_type breakdown for current month
 *   - Health: manual-trigger provider ping with latency display
 *   - Toasts for retry/cancel outcomes
 *   - Skeleton loaders
 *
 * Dependencies:
 *   - hooks/useMemories.ts (useSupernodeTasks, useRetrySupernodeTask,
 *     useCancelSupernodeTask, useSupernodeUsage, useSupernodeHealth)
 *   - types/memory.ts (CognitiveTask, CognitiveTaskStatus, etc.)
 *   - lib/constants.ts (SUPERNODE_TASK_STATUS_CONFIG)
 *
 * ⚠️ Important Note for Next Developer:
 * - supernodeEnabled prop comes from useMemoryStatus data.supernode?.enabled
 *   — parent (MemoryOverview) already checks this before rendering panel
 * - useSupernodeTasks polls every 5s by default; polling stops when
 *   the panel is not active (refetchInterval: false passed from parent tab)
 * - useSupernodeHealth never auto-fetches — user clicks "Check Now"
 * - Retry/cancel mutate task IDs as strings — backend uses integer IDs
 *   but we stringify them for hook consistency (api.ts handles conversion)
 * - Usage period defaults to current month (YYYY-MM format)
 *
 * Last Modified: v1.0.0 - Initial creation (Phase 4)
 * ============================================
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  useSupernodeTasks,
  useSupernodeTaskDetail,
  useRetrySupernodeTask,
  useCancelSupernodeTask,
  useSupernodeUsage,
  useSupernodeHealth,
} from '@/hooks/useMemories';
import {
  CognitiveTask,
  CognitiveTaskStatus,
  CognitiveTaskType,
  COGNITIVE_TASK_TYPE_LABELS,
} from '@/types/memory';
import { SUPERNODE_TASK_STATUS_CONFIG } from '@/lib/constants';

// ============================================
// Props
// ============================================

interface SupernodePanelProps {
  nodeId: string;
  supernodeEnabled: boolean;
  /** When false, task polling is paused (tab not active) */
  isActive: boolean;
}

// ============================================
// Helpers
// ============================================

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function relativeTime(unixSecs: number | null): string {
  if (!unixSecs) return '—';
  const diff = Math.floor((Date.now() / 1000) - unixSecs);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ============================================
// Toast (reused pattern from MemoryOverview)
// ============================================

function Toast({ message, variant }: { message: string; variant: 'success' | 'error' }) {
  return (
    <div className={`
      fixed top-6 left-1/2 -translate-x-1/2 z-[60]
      px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl backdrop-blur-lg
      ${variant === 'success'
        ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-300'
        : 'bg-red-500/15 border border-red-500/25 text-red-300'
      }
    `}>
      {message}
    </div>
  );
}

// ============================================
// Sub-tab bar
// ============================================

type SupernodeTab = 'tasks' | 'usage' | 'health';

function TabBar({ active, onChange }: { active: SupernodeTab; onChange: (t: SupernodeTab) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-4">
      {(['tasks', 'usage', 'health'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`
            flex-1 px-3 py-2 rounded-lg text-sm font-medium capitalize
            transition-all duration-150
            ${active === tab
              ? 'bg-white/[0.07] text-white'
              : 'text-gray-500 hover:text-gray-300'
            }
          `}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ============================================
// Status badge
// ============================================

function StatusBadge({ status }: { status: CognitiveTaskStatus }) {
  const cfg = SUPERNODE_TASK_STATUS_CONFIG[status];
  return (
    <span className={`
      inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border
      ${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}
    `}>
      {cfg.animate && (
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor} animate-pulse`} />
      )}
      {cfg.label}
    </span>
  );
}

// ============================================
// Task Row
// ============================================

interface TaskRowProps {
  task: CognitiveTask;
  onRetry: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  isActing: boolean;
}

function TaskRow({ task, onRetry, onCancel, isActing }: TaskRowProps) {
  const taskIdStr = String(task.id);
  const canRetry = task.status === 'failed' || task.status === 'cancelled';
  const canCancel = task.status === 'pending';

  return (
    <div className="px-3 py-2.5 rounded-lg hover:bg-white/[0.02] border border-transparent hover:border-white/[0.05] transition-colors">
      <div className="flex items-start gap-2 mb-1.5">
        <StatusBadge status={task.status} />
        <p className="text-sm text-gray-200 flex-1 min-w-0 truncate">
          {COGNITIVE_TASK_TYPE_LABELS[task.task_type as CognitiveTaskType] ?? task.task_type}
        </p>
        <span className="flex-shrink-0 text-[11px] text-gray-600">
          {relativeTime(task.created_at)}
        </span>
      </div>

      <div className="flex items-center gap-3 ml-0">
        {/* Target */}
        {task.target_id && (
          <span className="text-[11px] text-gray-600 truncate max-w-[140px]">
            → {task.target_id.slice(0, 16)}...
          </span>
        )}

        {/* Token usage */}
        {task.token_usage && (
          <span className="text-[11px] text-gray-600">
            {formatTokens(task.token_usage.input + task.token_usage.output)} tokens
          </span>
        )}

        {/* Provider */}
        {task.provider_used && (
          <span className="text-[11px] text-gray-600">{task.provider_used}</span>
        )}

        {/* Error */}
        {task.error_message && (
          <span className="text-[11px] text-red-400/70 truncate max-w-[160px]" title={task.error_message}>
            {task.error_message.slice(0, 40)}{task.error_message.length > 40 ? '…' : ''}
          </span>
        )}

        <span className="flex-1" />

        {/* Actions */}
        {(canRetry || canCancel) && (
          <span className="flex items-center gap-1.5">
            {canRetry && (
              <button
                onClick={() => onRetry(taskIdStr)}
                disabled={isActing}
                className="text-[11px] text-gray-500 hover:text-purple-400 transition-colors disabled:opacity-40"
              >
                Retry
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => onCancel(taskIdStr)}
                disabled={isActing}
                className="text-[11px] text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Tasks Tab
// ============================================

interface TasksTabProps {
  nodeId: string;
  supernodeEnabled: boolean;
  isActive: boolean;
}

function TasksTab({ nodeId, supernodeEnabled, isActive }: TasksTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, variant: 'success' | 'error') => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const { tasks, total, isLoading } = useSupernodeTasks(
    nodeId,
    supernodeEnabled,
    statusFilter ? { status: statusFilter, limit: 50 } : { limit: 50 },
    { refetchInterval: isActive ? undefined : false }
  );

  const retryMutation = useRetrySupernodeTask(nodeId);
  const cancelMutation = useCancelSupernodeTask(nodeId);
  const isActing = retryMutation.isPending || cancelMutation.isPending;

  const handleRetry = useCallback(async (taskId: string) => {
    try {
      await retryMutation.mutateAsync(taskId);
      showToast('Task queued for retry.', 'success');
    } catch {
      showToast('Failed to retry task.', 'error');
    }
  }, [retryMutation, showToast]);

  const handleCancel = useCallback(async (taskId: string) => {
    try {
      await cancelMutation.mutateAsync(taskId);
      showToast('Task cancelled.', 'success');
    } catch {
      showToast('Failed to cancel task.', 'error');
    }
  }, [cancelMutation, showToast]);

  return (
    <div>
      {toast && <Toast message={toast.message} variant={toast.variant} />}

      {/* Filter + count */}
      <div className="flex items-center justify-between mb-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="
            px-2.5 py-1.5 rounded-lg text-xs
            bg-white/[0.03] border border-white/[0.06] text-gray-400
            outline-none focus:border-purple-500/30 appearance-none cursor-pointer
            transition-colors
          "
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 6px center',
            backgroundSize: '12px',
            paddingRight: '22px',
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <span className="text-xs text-gray-600">{total} tasks</span>
      </div>

      {isLoading ? (
        <div className="space-y-1.5 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-white/[0.03] rounded-lg" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-gray-500">No tasks{statusFilter ? ` with status "${statusFilter}"` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onRetry={handleRetry}
              onCancel={handleCancel}
              isActing={isActing}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Usage Tab
// ============================================

function UsageTab({ nodeId, supernodeEnabled }: { nodeId: string; supernodeEnabled: boolean }) {
  const period = currentMonth();
  const { stats, totals, isLoading } = useSupernodeUsage(nodeId, supernodeEnabled, period);

  if (isLoading) {
    return (
      <div className="space-y-1.5 animate-pulse">
        <div className="h-16 bg-white/[0.03] rounded-lg" />
        {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-white/[0.03] rounded-lg" />)}
      </div>
    );
  }

  if (!totals || stats.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-gray-500">No usage data for {period}.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Totals summary */}
      <div className="px-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05] mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-center">
            <p className="text-lg font-semibold text-white">{totals.total_calls}</p>
            <p className="text-[11px] text-gray-500">Total calls</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white">{formatTokens(totals.total_input_tokens + totals.total_output_tokens)}</p>
            <p className="text-[11px] text-gray-500">Tokens</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white">${totals.estimated_cost_usd.toFixed(3)}</p>
            <p className="text-[11px] text-gray-500">Est. cost</p>
          </div>
        </div>
      </div>

      {/* Per-provider breakdown */}
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">By provider</p>
      <div className="space-y-1">
        {stats.map((stat, i) => (
          <div key={i} className="px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-300 font-medium">{stat.provider}</span>
              <span className="text-xs text-gray-500">${stat.estimated_cost_usd.toFixed(3)}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-600">
              <span>{COGNITIVE_TASK_TYPE_LABELS[stat.task_type as CognitiveTaskType] ?? stat.task_type}</span>
              <span>{stat.total_calls} calls</span>
              <span>{formatTokens(stat.total_input_tokens + stat.total_output_tokens)} tokens</span>
              <span>avg {formatMs(stat.avg_latency_ms)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Health Tab
// ============================================

function HealthTab({ nodeId, supernodeEnabled }: { nodeId: string; supernodeEnabled: boolean }) {
  const { providers, queueSummary, isLoading, hasFetched, checkHealth } = useSupernodeHealth(nodeId, supernodeEnabled);

  return (
    <div>
      {/* Queue summary (shown after first check) */}
      {hasFetched && queueSummary && (
        <div className="flex items-center gap-4 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] mb-4 text-xs text-gray-500">
          <span><span className="text-yellow-400 font-medium">{queueSummary.pending}</span> pending</span>
          <span><span className="text-blue-400 font-medium">{queueSummary.processing}</span> processing</span>
          <span><span className="text-red-400 font-medium">{queueSummary.failed_last_hour}</span> failed (1h)</span>
        </div>
      )}

      {/* Provider list */}
      {isLoading ? (
        <div className="space-y-1.5 animate-pulse">
          {[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded-lg" />)}
        </div>
      ) : hasFetched && providers.length > 0 ? (
        <div className="space-y-1 mb-4">
          {providers.map((p) => (
            <div
              key={p.provider_name}
              className="px-3 py-2.5 rounded-lg flex items-center gap-3 bg-white/[0.02] border border-white/[0.04]"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.is_healthy ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-sm text-gray-300 flex-1 truncate">{p.provider_name}</span>
              <span className="text-xs text-gray-500">{p.model}</span>
              <span className="text-xs text-gray-600">{formatMs(p.latency_ms)}</span>
            </div>
          ))}
        </div>
      ) : !hasFetched ? (
        <p className="text-xs text-gray-600 mb-4 text-center py-4">
          Click below to check provider connectivity.
          <br />
          <span className="text-gray-700">This pings external LLM providers (~15s).</span>
        </p>
      ) : null}

      {/* Check Now button */}
      <button
        onClick={checkHealth}
        disabled={isLoading}
        className="
          w-full px-4 py-2.5 rounded-xl
          bg-white/[0.04] border border-white/[0.08]
          text-sm text-gray-400 hover:text-white hover:bg-white/[0.07]
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
        "
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            Pinging providers...
          </span>
        ) : hasFetched ? 'Re-check providers' : 'Check Now'}
      </button>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function SupernodePanel({ nodeId, supernodeEnabled, isActive }: SupernodePanelProps) {
  const [activeTab, setActiveTab] = useState<SupernodeTab>('tasks');

  if (!supernodeEnabled) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-gray-500">SuperNode is not enabled on this node.</p>
        <p className="text-xs text-gray-600 mt-1">
          Set <code className="text-gray-500">supernode.enabled = true</code> in the node config to activate LLM cognitive enhancement.
        </p>
      </div>
    );
  }

  return (
    <div>
      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'tasks' && (
        <TasksTab nodeId={nodeId} supernodeEnabled={supernodeEnabled} isActive={isActive} />
      )}
      {activeTab === 'usage' && (
        <UsageTab nodeId={nodeId} supernodeEnabled={supernodeEnabled} />
      )}
      {activeTab === 'health' && (
        <HealthTab nodeId={nodeId} supernodeEnabled={supernodeEnabled} />
      )}
    </div>
  );
}
