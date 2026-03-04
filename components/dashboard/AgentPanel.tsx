/**
 * ============================================
 * AeroNyx Privacy Network - Agent Lifecycle Panel
 * ============================================
 * File Path: components/dashboard/AgentPanel.tsx
 *
 * Creation Reason: Phase 1 — Agent Lifecycle Management UI.
 *   Renders different UI states based on the agent state machine:
 *   not_installed → installing (progress) → installed → starting →
 *   running → stopping → stopped, with error handling throughout.
 *
 * Main Functionality:
 *   - Displays agent status with visual indicators
 *   - "Deploy OpenClaw" CTA for not_installed state
 *   - Progress bar + install message for installing state
 *   - Start/Stop/Restart/Uninstall controls for lifecycle management
 *   - Resource usage display (CPU/Memory) when running
 *   - Error display with retry actions
 *   - Confirmation dialogs for destructive actions (stop/uninstall)
 *
 * Dependencies:
 *   - hooks/useAgent.ts (useAgentStatus + mutation hooks)
 *   - types/agent.ts (AgentInfo, AgentStatus, TRANSITIONAL_STATUSES)
 *   - lib/constants.ts (AGENT_STATUS_CONFIG)
 *   - components/common/Card.tsx (Card wrapper)
 *   - components/common/Button.tsx (Button component)
 *   - components/common/Modal.tsx (ConfirmDialog)
 *   - lib/api.ts (formatRelativeTime)
 *
 * Main Logical Flow:
 * 1. useAgentStatus provides agent data with adaptive polling
 * 2. Based on agentStatus, render the appropriate panel view
 * 3. Action buttons trigger mutations → invalidate query → UI updates
 * 4. Transitional states show spinners; progress bar for installing
 * 5. Destructive actions (stop/uninstall) require confirmation dialog
 *
 * ⚠️ Important Note for Next Developer:
 * - Each status maps to a specific UI section — see renderContent()
 * - The progress bar width uses inline style for smooth 0-100% animation
 * - Confirmation dialogs use the existing ConfirmDialog component
 * - "Open Chat" button is placeholder — will link to Phase 2 chat page
 * - Agent resource stats (CPU/Memory) only shown when agent is running
 * - If backend adds new agent statuses, add them to AGENT_STATUS_CONFIG
 *   in constants.ts AND handle them in renderContent()
 *
 * Last Modified: v1.0.0 - Initial AgentPanel for Phase 1
 * ============================================
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  useAgentStatus,
  useInstallAgent,
  useStartAgent,
  useStopAgent,
  useRestartAgent,
  useUninstallAgent,
} from '@/hooks/useAgent';
import { AgentInfo, TRANSITIONAL_STATUSES } from '@/types/agent';
import { AGENT_STATUS_CONFIG } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/api';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/Modal';

// ============================================
// Props
// ============================================

interface AgentPanelProps {
  nodeId: string;
  nodeStatus: string; // 'online' | 'offline' | 'suspended'
  /** Callback to show toast in parent (node detail page) */
  onToast?: (message: string, variant: 'success' | 'error') => void;
}

// ============================================
// Status Badge Sub-Component
// ============================================

function AgentStatusBadge({ agent }: { agent: AgentInfo | null }) {
  const status = agent?.status ?? 'not_installed';
  const config = AGENT_STATUS_CONFIG[status] || AGENT_STATUS_CONFIG.not_installed;

  return (
    <div className={`
      inline-flex items-center gap-2 px-3 py-1.5 rounded-full
      ${config.bgColor} ${config.textColor}
      border ${config.borderColor}
    `}>
      <span className={`
        w-2 h-2 rounded-full ${config.dotColor}
        ${config.animate ? 'animate-pulse' : ''}
      `} />
      <span className="text-xs font-medium">{config.label}</span>
    </div>
  );
}

// ============================================
// Progress Bar Sub-Component (for installing state)
// ============================================

function InstallProgress({ agent }: { agent: AgentInfo }) {
  const progress = agent.install_progress ?? 0;
  const message = agent.install_message || 'Preparing installation...';

  return (
    <div className="space-y-3">
      {/* Progress Bar */}
      <div className="relative">
        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-500">{message}</span>
          <span className="text-xs font-mono text-purple-400">{progress}%</span>
        </div>
      </div>

      {/* Spinner + Message */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
        <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin flex-shrink-0" />
        <p className="text-sm text-purple-300">
          Installation in progress — do not close this page
        </p>
      </div>
    </div>
  );
}

// ============================================
// Resource Stats Sub-Component (for running state)
// ============================================

function AgentResourceStats({ agent }: { agent: AgentInfo }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="p-3 rounded-xl bg-white/5 border border-white/10">
        <p className="text-xs text-gray-500 mb-1">CPU</p>
        <p className="text-lg font-semibold text-white">{agent.cpu_usage.toFixed(1)}%</p>
      </div>
      <div className="p-3 rounded-xl bg-white/5 border border-white/10">
        <p className="text-xs text-gray-500 mb-1">Memory</p>
        <p className="text-lg font-semibold text-white">{agent.memory_mb} MB</p>
      </div>
      <div className="p-3 rounded-xl bg-white/5 border border-white/10">
        <p className="text-xs text-gray-500 mb-1">Port</p>
        <p className="text-lg font-semibold text-white">{agent.local_port ?? '—'}</p>
      </div>
      <div className="p-3 rounded-xl bg-white/5 border border-white/10">
        <p className="text-xs text-gray-500 mb-1">Version</p>
        <p className="text-lg font-semibold text-white">{agent.agent_version || '—'}</p>
      </div>
    </div>
  );
}

// ============================================
// Transitional Spinner Sub-Component
// ============================================

function TransitionalSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin flex-shrink-0" />
      <p className="text-sm text-gray-300">{label}</p>
    </div>
  );
}

// ============================================
// Error Display Sub-Component
// ============================================

function AgentErrorDisplay({ agent }: { agent: AgentInfo }) {
  return (
    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-medium text-red-300">Agent Error</p>
          <p className="text-sm text-red-400/80 mt-1 break-words">
            {agent.last_error || 'An unknown error occurred'}
          </p>
          {agent.error_count > 1 && (
            <p className="text-xs text-red-500/60 mt-2">
              Error count: {agent.error_count}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main AgentPanel Component
// ============================================

export default function AgentPanel({ nodeId, nodeStatus, onToast }: AgentPanelProps) {
  // ---- Hooks ----
  const { agent, agentStatus, isLoading, isError } = useAgentStatus(nodeId);

  const installMutation = useInstallAgent();
  const startMutation = useStartAgent();
  const stopMutation = useStopAgent();
  const restartMutation = useRestartAgent();
  const uninstallMutation = useUninstallAgent();

  // ---- Local State ----
  const [confirmAction, setConfirmAction] = useState<'stop' | 'uninstall' | null>(null);

  // ---- Helpers ----
  const isNodeOffline = nodeStatus !== 'online';
  const isAnyMutationPending =
    installMutation.isPending ||
    startMutation.isPending ||
    stopMutation.isPending ||
    restartMutation.isPending ||
    uninstallMutation.isPending;

  const toast = useCallback(
    (msg: string, variant: 'success' | 'error') => {
      onToast?.(msg, variant);
    },
    [onToast]
  );

  // ---- Action Handlers ----

  const handleInstall = useCallback(async () => {
    try {
      await installMutation.mutateAsync({ nodeId });
      toast('OpenClaw installation started!', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Install failed', 'error');
    }
  }, [nodeId, installMutation, toast]);

  const handleStart = useCallback(async () => {
    try {
      await startMutation.mutateAsync({ nodeId });
      toast('OpenClaw is starting...', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Start failed', 'error');
    }
  }, [nodeId, startMutation, toast]);

  const handleStop = useCallback(async () => {
    try {
      await stopMutation.mutateAsync({ nodeId });
      toast('OpenClaw is stopping...', 'success');
      setConfirmAction(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Stop failed', 'error');
    }
  }, [nodeId, stopMutation, toast]);

  const handleRestart = useCallback(async () => {
    try {
      await restartMutation.mutateAsync({ nodeId });
      toast('OpenClaw is restarting...', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Restart failed', 'error');
    }
  }, [nodeId, restartMutation, toast]);

  const handleUninstall = useCallback(async () => {
    try {
      await uninstallMutation.mutateAsync({ nodeId });
      toast('OpenClaw uninstall started', 'success');
      setConfirmAction(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Uninstall failed', 'error');
    }
  }, [nodeId, uninstallMutation, toast]);

  // ---- Render: Loading ----
  if (isLoading) {
    return (
      <Card variant="default" padding="lg" className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
            <div className="h-3 w-48 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
      </Card>
    );
  }

  // ---- Render: Error fetching status ----
  if (isError) {
    return (
      <Card variant="default" padding="lg" className="mb-6">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm">Failed to load agent status. The node may be offline.</p>
        </div>
      </Card>
    );
  }

  // ---- Render: Main Content ----
  const currentStatus = agentStatus ?? 'not_installed';
  const statusConfig = AGENT_STATUS_CONFIG[currentStatus] || AGENT_STATUS_CONFIG.not_installed;

  return (
    <>
      <Card variant="default" padding="lg" className="mb-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {/* AI Icon */}
            <div className="
              w-10 h-10 rounded-xl
              bg-gradient-to-br from-blue-500/20 to-purple-500/20
              flex items-center justify-center flex-shrink-0
            ">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">OpenClaw AI Engine</h3>
              <p className="text-sm text-gray-500">{statusConfig.description}</p>
            </div>
          </div>

          <AgentStatusBadge agent={agent} />
        </div>

        {/* Node Offline Warning */}
        {isNodeOffline && currentStatus !== 'not_installed' && (
          <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
              <p className="text-sm text-yellow-300">
                Node is offline. Agent controls may not respond until the node reconnects.
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Content Based on Status */}
        {renderContent({
          currentStatus,
          agent,
          isNodeOffline,
          isAnyMutationPending,
          onInstall: handleInstall,
          onStart: handleStart,
          onRestart: handleRestart,
          onRequestStop: () => setConfirmAction('stop'),
          onRequestUninstall: () => setConfirmAction('uninstall'),
        })}

        {/* Metadata Footer (when agent exists) */}
        {agent && agent.status !== 'not_installed' && (
          <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
            {agent.installed_at && (
              <span>Installed {formatRelativeTime(agent.installed_at)}</span>
            )}
            {agent.started_at && agent.status === 'running' && (
              <span>Started {formatRelativeTime(agent.started_at)}</span>
            )}
            {agent.last_health_check && agent.status === 'running' && (
              <span>Health check {formatRelativeTime(agent.last_health_check)}</span>
            )}
            {agent.agent_version && (
              <span>v{agent.agent_version}</span>
            )}
          </div>
        )}
      </Card>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={confirmAction === 'stop'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleStop}
        title="Stop OpenClaw"
        message="This will stop the AI engine on this node. Active conversations will be interrupted. You can restart it later."
        confirmText="Stop Agent"
        cancelText="Cancel"
        variant="warning"
        isLoading={stopMutation.isPending}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'uninstall'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleUninstall}
        title="Uninstall OpenClaw"
        message="This will completely remove OpenClaw from this node. All agent data will be deleted. You can reinstall it later."
        confirmText="Uninstall"
        cancelText="Cancel"
        variant="danger"
        isLoading={uninstallMutation.isPending}
      />
    </>
  );
}

// ============================================
// Content Renderer (maps status → UI)
// ============================================

interface RenderContentProps {
  currentStatus: string;
  agent: AgentInfo | null;
  isNodeOffline: boolean;
  isAnyMutationPending: boolean;
  onInstall: () => void;
  onStart: () => void;
  onRestart: () => void;
  onRequestStop: () => void;
  onRequestUninstall: () => void;
}

function renderContent(props: RenderContentProps): React.ReactNode {
  const {
    currentStatus,
    agent,
    isNodeOffline,
    isAnyMutationPending,
    onInstall,
    onStart,
    onRestart,
    onRequestStop,
    onRequestUninstall,
  } = props;

  const disabled = isNodeOffline || isAnyMutationPending;

  switch (currentStatus) {
    // ---- Not Installed: Big CTA ----
    case 'not_installed':
      return (
        <div className="text-center py-6">
          <div className="
            w-20 h-20 mx-auto mb-4 rounded-2xl
            bg-gradient-to-br from-purple-500/20 to-pink-500/20
            flex items-center justify-center
          ">
            <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-white mb-2">
            Deploy OpenClaw AI
          </h4>
          <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
            Install the OpenClaw AI engine on this node to enable private, decentralized AI conversations powered by your own hardware.
          </p>
          <Button
            variant="primary"
            onClick={onInstall}
            disabled={isNodeOffline || isAnyMutationPending}
          >
            {installButtonContent(isAnyMutationPending)}
          </Button>
          {isNodeOffline && (
            <p className="text-xs text-yellow-400 mt-3">
              Node must be online to install
            </p>
          )}
        </div>
      );

    // ---- Installing: Progress Bar ----
    case 'installing':
      return agent ? <InstallProgress agent={agent} /> : null;

    // ---- Installed: Ready to Start ----
    case 'installed':
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-300">
              OpenClaw is installed and ready to start.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={onStart} disabled={disabled}>
              {startMutationContent(isAnyMutationPending)}
            </Button>
            <Button variant="ghost" onClick={onRequestUninstall} disabled={disabled}>
              Uninstall
            </Button>
          </div>
        </div>
      );

    // ---- Starting ----
    case 'starting':
      return <TransitionalSpinner label="OpenClaw is starting up..." />;

    // ---- Running: Full Controls ----
    case 'running':
      return (
        <div className="space-y-4">
          {/* Resource Stats */}
          {agent && <AgentResourceStats agent={agent} />}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Open Chat — navigates to Phase 2 chat terminal */}
            <Button
              variant="primary"
              onClick={() => {
                window.location.href = `/dashboard/nodes/${nodeId}/chat`;
              }}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                </svg>
                Open Chat
              </span>
            </Button>

            <Button variant="secondary" onClick={onRestart} disabled={disabled}>
              Restart
            </Button>

            <Button variant="ghost" onClick={onRequestStop} disabled={disabled}>
              Stop
            </Button>

            <Button variant="ghost" onClick={onRequestUninstall} disabled={disabled}>
              Uninstall
            </Button>
          </div>
        </div>
      );

    // ---- Stopping ----
    case 'stopping':
      return <TransitionalSpinner label="OpenClaw is shutting down..." />;

    // ---- Stopped: Can Start or Uninstall ----
    case 'stopped':
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-yellow-300">
              OpenClaw is stopped. Start it to resume AI capabilities.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={onStart} disabled={disabled}>
              {startMutationContent(isAnyMutationPending)}
            </Button>
            <Button variant="ghost" onClick={onRequestUninstall} disabled={disabled}>
              Uninstall
            </Button>
          </div>
        </div>
      );

    // ---- Error: Show Error + Retry ----
    case 'error':
      return (
        <div className="space-y-4">
          {agent && <AgentErrorDisplay agent={agent} />}
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={onStart} disabled={disabled}>
              Retry Start
            </Button>
            <Button variant="secondary" onClick={onInstall} disabled={disabled}>
              Reinstall
            </Button>
            <Button variant="ghost" onClick={onRequestUninstall} disabled={disabled}>
              Uninstall
            </Button>
          </div>
        </div>
      );

    // ---- Updating ----
    case 'updating':
      return <TransitionalSpinner label="OpenClaw is being updated..." />;

    // ---- Uninstalling ----
    case 'uninstalling':
      return <TransitionalSpinner label="Removing OpenClaw from this node..." />;

    // ---- Fallback ----
    default:
      return (
        <div className="text-sm text-gray-500">
          Unknown agent status: {currentStatus}
        </div>
      );
  }
}

// ============================================
// Button Content Helpers
// ============================================

function installButtonContent(isPending: boolean) {
  if (isPending) {
    return (
      <span className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Deploying...
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      Deploy OpenClaw
    </span>
  );
}

function startMutationContent(isPending: boolean) {
  if (isPending) {
    return (
      <span className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Starting...
      </span>
    );
  }
  return 'Start Agent';
}
