/**
 * ============================================
 * AeroNyx Node Detail Page
 * ============================================
 * File Path: app/dashboard/nodes/[id]/page.tsx
 *
 * Creation Reason: Individual node detail view
 * Modification Reason:
 *   v1.6.2 - Consumes backend system.restart_readiness so detail-page restart
 *     actions use the same controlled-restart gate as services fleet view.
 *   v1.6.1 - Added maintenance restart readiness guard so every restart
 *     entry point respects maintenance drain, active-session, and command
 *     queue state before issuing restart_service.
 *   v1.5.0 - Removed non-VPN auxiliary entry points from nodeboard.
 *   v1.4.0 - Added NodeSettings panel.
 *     NodeSettings handles: visibility / region / city / is_vpn_node /
 *     access_password. Name editing remains inline (EditableName).
 *   v1.1.0 - Bug fixes: inline name edit, toast, copy actions.
 *
 * Main Functionality:
 *   1. Node header with inline name editing and delete action
 *   2. NodeSettings — visibility / region / VPN / password config
 *   3. Service Readiness panel from /vpn/overview/ operator_status
 *   4. VPN Health panel from /vpn/overview/ for live heartbeat diagnostics
 *   5. Commercial readiness panel from /vpn/overview/ + /vpn/servers/
 *   6. Recent VPN Events for node-scoped health/session/command triage
 *   7. Wallet ban policies and VPN command history
 *   8. Stats grid — uptime / sessions / traffic
 *   9. Hardware info + node details
 *   10. Recent sessions table
 *
 * Backend APIs and file paths used by this page:
 *   - GET /api/privacy_network/nodes/{id}/
 *     /root/aeronyx/privacy_network/api/nodes.py
 *   - PATCH /api/privacy_network/nodes/{id}/
 *     /root/aeronyx/privacy_network/api/nodes.py
 *   - GET /api/privacy_network/vpn/overview/
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Exposes data.nodes[].system.session_cleanup for drain ETA context.
 *     Exposes data.nodes[].system.service_manager.active_state/load_state
 *     from Rust /api/vpn/health so the VPN Health panel shows whether the
 *     node is actively managed by systemd after a controlled restart.
 *     Exposes data.nodes[].system.restart_readiness for backend-authoritative
 *     controlled-restart gating.
 *     Exposes data.nodes[].system.restart_readiness.operator_action_plan as
 *     a backend-authored node detail preflight summary built from restart
 *     gate, command delivery, drain ETA, and restart command lifecycle state.
 *     The contextual actions under that plan reuse these existing backend
 *     APIs: PATCH /api/privacy_network/nodes/{id}/, GET
 *     /api/privacy_network/vpn/sessions/?node_id=&status=, and POST
 *     /api/privacy_network/nodes/{id}/commands/run/.
 *     operator_action_plan.recommended_actions is backend-ordered so the UI
 *     can highlight the current safest operation without duplicating workflow
 *     rules in React.
 *     Exposes data.nodes[].last_seen_seconds and
 *     data.nodes[].system.restart_readiness.operator_reporting for node-level
 *     command delivery readiness in the Maintenance Drain panel. Backend
 *     data.nodes[].system.restart_readiness.command_delivery is preferred so
 *     node detail shares the same policy as Services command_delivery_health.
 *     Exposes data.nodes[].system.restart_readiness.active_restart_command
 *     and latest_restart_command for restart command SLA/outcome visibility
 *     without command params, result, or error_message payloads.
 *     active_restart_command.can_cancel mirrors backend NodeCommand
 *     mark_cancelled eligibility so the Maintenance Drain card only offers
 *     cancellation while the backend accepts it. cancel_reason explains why
 *     an active restart command is not cancellable.
 *     Exposes data.nodes[].system.restart_readiness.drain_eta for active
 *     ClientSession aggregate timing used by the Maintenance Drain panel.
 *     The AeroNyx Service Readiness fallback also uses drain_eta when older
 *     Rust runtimes have not reported operator_status yet, so operators still
 *     see active-session blockers and cleanup rollout state before restart.
 *     recent_client_rx_sessions / stale_client_rx_sessions /
 *     never_client_rx_sessions distinguish client-originated tunnel packets
 *     from server-side last_tx/update activity during staged Rust rollouts.
 *     drain_eta also carries node-level active-session activity buckets:
 *     recent_activity_sessions / idle_activity_sessions /
 *     activity_pending_sessions / keepalive issue session counts /
 *     keepalive aggregate totals.
 *     activity_health is backend-authored drain risk triage for operators.
 *     cleanup_policy_pending means Rust has not reported
 *     heartbeat.system_stats.vpn_health.session_cleanup yet.
 *     data.nodes[].system.source tells the page whether node-level policy
 *     and health counters came from fresh Redis heartbeat cache or durable
 *     NodeHeartbeat sample fallback, so commercial operators do not confuse
 *     stale audit counters with live enforcement impact.
 *     data.nodes[].system.policy_enforcement includes Rust node_policy
 *     aggregate bandwidth_drop_bytes / bandwidth_limit_bytes_per_second /
 *     bandwidth_window_bytes for commercial limiter diagnostics, plus
 *     backend-authored recent_block_active / impact_status so the page can
 *     distinguish active commercial blocking from historical process counters.
 *     counters_started_at is produced by Rust node_policy and shows the
 *     process-local counter scope after service restarts.
 *     Exposes data.nodes[].system.placement_readiness from Rust
 *     /api/vpn/health so Commercial Readiness can separate backend placement
 *     eligibility from runtime-owned admission decisions:
 *     accepting_new_sessions / reason / session capacity / bandwidth window.
 *     Exposes data.nodes[].system.restart_readiness.drain_eta.cutover_guard
 *     so Rust Admission can show whether a placement_readiness rollout target
 *     may be safely upgraded/restarted now without React guessing cutover
 *     safety from active-session counts.
 *   - GET /api/privacy_network/vpn/servers/
 *     /root/aeronyx/privacy_network/api/vpn_servers.py
 *     Exposes per-node placement eligibility, capacity_remaining,
 *     failover_rank, availability_24h_percent, and unavailable_reason for the
 *     Commercial Readiness panel. This endpoint only returns owner-scoped
 *     operational placement metadata; it does not expose client destinations,
 *     DNS contents, packet payloads, browsing history, voucher secrets, or
 *     wallet-level traffic.
 *   - GET /api/privacy_network/nodes/{id}/sessions/?status=active
 *     /root/aeronyx/privacy_network/api/sessions.py
 *     /root/aeronyx/privacy_network/serializers.py
 *   - POST /api/privacy_network/nodes/{id}/commands/run/
 *     /root/aeronyx/privacy_network/api/vpn_commands.py
 *   - POST /api/privacy_network/nodes/{id}/commands/{cmd_id}/cancel/
 *     /root/aeronyx/privacy_network/api/vpn_commands.py
 *   - GET /api/privacy_network/nodes/{id}/commands/?status=&action=&limit=
 *     /root/aeronyx/privacy_network/api/vpn_commands.py
 *     The Recent VPN Commands panel uses command_status / command_action URL
 *     params as the source of truth so fleet-level service links can deep-link
 *     directly into a filtered node command timeline.
 *   - Rust client-liveness cleanup feeding session drain:
 *     /root/open/AeroNyx/crates/aeronyx-server/src/services/session.rs
 *     /root/open/AeroNyx/crates/aeronyx-server/src/handlers/packet.rs
 *
 * Rust service readiness source:
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 *
 * Data contract:
 *   Rust heartbeat reports system_stats.operator_status.
 *   Django persists Node.hardware_info["operator_status"] and exposes it as:
 *     data.nodes[].system.operator_status
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
 * Last Modified: v1.6.22 - Show placement rollout cutover safety
 * Previous: v1.6.21 - Show Rust placement admission readiness
 * Previous: v1.6.20 - Show Rust policy counter scope
 * Previous: v1.6.19 - Show node policy block current impact
 * Previous: v1.6.18 - Show node telemetry source quality
 * Previous: v1.6.17 - Add commercial readiness panel
 * Previous: v1.6.16 - Render backend recommended operator actions
 * Previous: v1.6.15 - Add operator action contextual controls
 * Previous: v1.6.14 - Show backend operator action plan
 * Previous: v1.6.13 - Use backend node command delivery policy
 * Previous: v1.6.12 - Show node command delivery readiness
 * Previous: v1.6.11 - Explain backend restart cancel eligibility
 * Previous: v1.6.10 - Use backend cancel eligibility in restart card
 * Previous: v1.6.9 - Make command deep-link filters URL authoritative
 * Previous: v1.6.8 - Show restart command SLA in node detail
 * Previous: v1.6.7 - Show backend drain activity health
 * Previous: v1.6.6 - Show keepalive issue session counts
 * Previous: v1.6.5 - Show aggregate drain activity buckets
 * Previous: v1.6.4 - Explain cleanup rollout pending in node detail
 * Previous: v1.6.3 - Node detail consumes backend restart drain ETA
 * Previous: v1.6.2 - Backend restart_readiness gate for restart actions
 * Previous: v1.6.1 - Guarded restart actions with maintenance drain readiness
 * Previous: v1.5.0 - Focused nodeboard on VPN operations UI
 * Previous: v1.4.0 - Added NodeSettings panel
 * ============================================
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  useNodeDetail,
  useNodeStats,
  useNodeSessions,
  useVpnOverview,
  useVpnServers,
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
  NodeOperatorStatus,
  Session,
  NodeStatus,
  NodeWalletBan,
  OperatorRisk,
  OperatorServiceStatus,
  VpnEvent,
  VpnEventSeverity,
  VpnHealthStatus,
  VpnNodeHealth,
  VpnNodeMetrics,
  VpnRestartCommandState,
  VpnRestartDrainEta,
  VpnRestartReadiness,
  VpnServerCandidate,
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

const COMMAND_DELIVERY_FRESH_SECONDS = 120;
const COMMAND_DELIVERY_DEGRADED_SECONDS = 300;

type OperatorPlanAction = NonNullable<
  NonNullable<VpnRestartReadiness['operator_action_plan']>['recommended_actions']
>[number];

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

const NODE_DETAIL_VPN_COMMAND_ACTIONS = new Set([
  'system_info',
  'collect_logs',
  'refresh_config',
  'apply_policy',
  'restart_service',
  'kick_session',
  'ban_wallet',
  'unban_wallet',
]);

const COMMAND_STATUS_FILTERS = [
  'all',
  'pending',
  'sent',
  'executing',
  'completed',
  'failed',
  'cancelled',
  'timeout',
];

const COMMAND_ACTION_FILTERS = [
  'all',
  ...Array.from(NODE_DETAIL_VPN_COMMAND_ACTIONS),
];

function initialCommandStatusFilter(value: string | null) {
  return value && COMMAND_STATUS_FILTERS.includes(value) ? value : 'all';
}

function initialCommandActionFilter(value: string | null) {
  return value && COMMAND_ACTION_FILTERS.includes(value) ? value : 'all';
}

function formatHealthCheckName(name: string): string {
  return HEALTH_CHECK_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function healthCheckRunbook(name: string): string {
  const hints: Record<string, string> = {
    heartbeat: 'Check heartbeat age first. If stale, use maintenance mode before restarting the VPN service.',
    resource_load: 'High CPU or memory usually affects tunnel quality. Review 24h metrics, then drain or lower session caps in Settings.',
    traffic_counters: 'Missing traffic counters reduce billing confidence. Run System Info and Refresh Config to confirm telemetry setup.',
    udp_listener: 'New clients cannot connect when the UDP listener is down. Collect logs, then restart VPN if the service is wedged.',
    tun_device: 'TUN failures point to local interface setup. Run System Info and Collect Logs before changing node networking.',
    mtu_config: 'MTU mismatch can cause stalls or packet loss. Compare configured MTU with the running TUN MTU before changing clients.',
    ip_forward: 'Forwarding failure means tunnels may connect but cannot route. Enable forwarding or put the node into maintenance while fixing.',
    nat_masquerade: 'NAT failure blocks Internet exit. Check masquerade rules and move traffic away from this node if sessions are active.',
    dns_stub: 'DNS listener failure breaks name resolution while the tunnel is up. Collect logs and verify the local resolver.',
    dns_query: 'DNS query failure usually means resolver or egress trouble. Check DNS config, then Internet egress.',
    internet_egress: 'Egress failure means the node cannot reach the Internet. Stop new handshakes and verify provider networking.',
  };
  return hints[name] || 'Use Collect Logs and recent VPN events to decide whether to drain, refresh config, or restart the service.';
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

function formatTunnelMtu(health: VpnNodeHealth) {
  const configured = health.system.configured_mtu;
  const running = health.system.running_mtu;
  if (typeof configured !== 'number' && typeof running !== 'number') return 'pending';
  if (typeof configured === 'number' && typeof running === 'number') {
    return running === configured ? `${running}` : `${running} / ${configured}`;
  }
  return typeof running === 'number' ? `${running}` : `${configured}`;
}

function tunnelMtuDetail(health: VpnNodeHealth) {
  const configured = health.system.configured_mtu;
  const running = health.system.running_mtu;
  if (typeof running === 'number' && typeof configured === 'number') {
    return running === configured ? 'matches config' : `config ${configured}`;
  }
  if (typeof configured === 'number') return 'configured only';
  if (typeof running === 'number') return 'runtime only';
  return 'reported by health check';
}

function formatServiceManagerName(health: VpnNodeHealth) {
  const manager = health.system.service_manager;
  if (!manager) return 'pending';
  return manager.manager || 'service';
}

function serviceManagerRuntimeDetail(health: VpnNodeHealth) {
  const manager = health.system.service_manager;
  if (!manager) return 'waiting for Rust health';
  const states = [manager.active_state, manager.load_state, manager.unit_file_state]
    .filter((state): state is string => Boolean(state));
  if (states.length > 0) return states.join(' · ');
  return manager.restart_supported ? 'restart supported' : manager.detail;
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

function formatPlacementReason(reason: string | null | undefined) {
  if (!reason) return 'candidate';
  const labels: Record<string, string> = {
    heartbeat_stale: 'heartbeat stale',
    maintenance_mode: 'maintenance',
    max_sessions_reached: 'session cap reached',
    vpn_health_failed: 'VPN health failed',
    overloaded: 'overloaded',
    low_24h_availability: 'low 24h availability',
    vpn_health_degraded: 'VPN health degraded',
  };
  return labels[reason] || reason.replace(/_/g, ' ');
}

function placementNextAction(reason: string | null | undefined) {
  const actions: Record<string, string> = {
    heartbeat_stale: 'Check Rust service heartbeat and command delivery before advertising this node.',
    maintenance_mode: 'End maintenance after active sessions are drained and restart checks are clear.',
    max_sessions_reached: 'Raise max_sessions in Node Settings or wait for active sessions to close.',
    vpn_health_failed: 'Run diagnostics, inspect health checks, then restart under maintenance if needed.',
    vpn_health_degraded: 'Review failed checks and recent events before increasing placement traffic.',
    overloaded: 'Lower load, raise capacity, or keep this node behind healthier candidates.',
    low_24h_availability: 'Wait for more healthy samples or inspect heartbeat/service stability.',
  };
  return reason ? actions[reason] || 'Review placement health, policy sync, and recent events for this node.' : 'Keep monitoring capacity and policy counters while this node receives clients.';
}

function readinessToneClass(status: 'ready' | 'attention' | 'blocked' | 'pending') {
  if (status === 'ready') return 'border-emerald-500/20 bg-emerald-500/[0.05]';
  if (status === 'blocked') return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  if (status === 'attention') return 'border-sky-500/20 bg-sky-500/[0.05]';
  return 'border-white/5 bg-white/[0.02]';
}

function readinessBadgeClass(status: 'ready' | 'attention' | 'blocked' | 'pending') {
  if (status === 'ready') return 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300';
  if (status === 'blocked') return 'border-yellow-500/25 bg-yellow-500/15 text-yellow-300';
  if (status === 'attention') return 'border-sky-500/25 bg-sky-500/15 text-sky-300';
  return 'border-white/10 bg-white/5 text-gray-300';
}

function sessionCapacityValue(activeSessions: number, maxSessions: number, remaining: number | null | undefined) {
  if (maxSessions > 0) return `${activeSessions} / ${maxSessions}`;
  if (typeof remaining === 'number') return `${activeSessions} active`;
  return `${activeSessions} / unlimited`;
}

function telemetrySourceLabel(source: string | null | undefined) {
  if (source === 'cache') return 'fresh heartbeat';
  if (source === 'sample') return 'sample fallback';
  if (!source || source === 'missing') return 'missing telemetry';
  return source.replace(/_/g, ' ');
}

function telemetrySourceClass(source: string | null | undefined) {
  if (source === 'cache') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
  if (source === 'sample') return 'border-sky-500/25 bg-sky-500/10 text-sky-300';
  return 'border-yellow-500/25 bg-yellow-500/10 text-yellow-300';
}

function telemetrySourceDetail(source: string | null | undefined, lastSeenSeconds: number | null | undefined) {
  const age = typeof lastSeenSeconds === 'number' ? `${formatDuration(lastSeenSeconds)} ago` : 'pending';
  if (source === 'cache') return `Live heartbeat cache, last seen ${age}.`;
  if (source === 'sample') return `Durable sample fallback, last seen ${age}. Treat counters as audit-grade until fresh heartbeat returns.`;
  return 'Heartbeat telemetry is missing; verify backend ingestion before changing commercial placement.';
}

function policyImpactLabel(status: string | null | undefined) {
  if (status === 'active') return 'active impact';
  if (status === 'historical') return 'historical';
  if (status === 'clear') return 'clear';
  return 'pending';
}

function policyImpactClass(status: string | null | undefined) {
  if (status === 'active') return 'border-yellow-500/25 bg-yellow-500/10 text-yellow-300';
  if (status === 'historical') return 'border-sky-500/25 bg-sky-500/10 text-sky-300';
  if (status === 'clear') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
  return 'border-gray-500/25 bg-gray-500/10 text-gray-300';
}

function policyImpactDetail(status: string | null | undefined, ageSeconds: number | null | undefined, windowSeconds: number | null | undefined) {
  const windowLabel = formatDuration(windowSeconds ?? 3600);
  if (status === 'active') {
    return `Latest policy block is within ${windowLabel}; treat capacity or placement impact as current.`;
  }
  if (status === 'historical') {
    const age = typeof ageSeconds === 'number' ? `${formatDuration(ageSeconds)} ago` : 'outside the recent window';
    return `Last block was ${age}; counters remain for audit but are not current placement impact.`;
  }
  if (status === 'clear') return 'No Rust node_policy block has been reported for this node.';
  return 'Waiting for backend policy impact classification.';
}

function placementAdmissionLabel(readiness: VpnNodeHealth['system']['placement_readiness']) {
  if (!readiness?.reported) return 'rollout pending';
  if (readiness.accepting_new_sessions) return 'accepting';
  if (readiness.status === 'watch') return 'watch';
  return 'blocked';
}

function placementAdmissionBadgeClass(readiness: VpnNodeHealth['system']['placement_readiness']) {
  if (!readiness?.reported) return 'border-gray-500/25 bg-gray-500/10 text-gray-300';
  if (readiness.accepting_new_sessions) return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
  if (readiness.status === 'watch') return 'border-yellow-500/25 bg-yellow-500/10 text-yellow-300';
  return 'border-red-500/25 bg-red-500/10 text-red-300';
}

function placementAdmissionPanelClass(readiness: VpnNodeHealth['system']['placement_readiness']) {
  if (!readiness?.reported) return 'border-gray-500/20 bg-gray-500/[0.04]';
  if (readiness.accepting_new_sessions) return 'border-emerald-500/15 bg-emerald-500/[0.04]';
  if (readiness.status === 'watch') return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  return 'border-red-500/25 bg-red-500/[0.06]';
}

function placementAdmissionDetail(readiness: VpnNodeHealth['system']['placement_readiness']) {
  if (!readiness?.reported) {
    return 'Rust placement_readiness has not reached the backend yet; keep this node in rollout tracking.';
  }
  return readiness.detail || readiness.reason?.replace(/_/g, ' ') || 'Rust runtime admission snapshot is available.';
}

type PlacementCutoverGuard = NonNullable<
  NonNullable<
    NonNullable<VpnNodeHealth['system']['restart_readiness']>['drain_eta']
  >['cutover_guard']
>;

function placementCutoverClass(guard: PlacementCutoverGuard | null | undefined) {
  if (!guard) return 'border-white/10 bg-white/[0.03] text-gray-300';
  if (guard.safe_to_cutover) return 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-100';
  if (guard.risk === 'critical') return 'border-red-500/25 bg-red-500/[0.07] text-red-100';
  return 'border-yellow-500/25 bg-yellow-500/[0.06] text-yellow-100';
}

function placementCutoverLabel(guard: PlacementCutoverGuard | null | undefined) {
  if (!guard) return 'cutover pending';
  if (guard.safe_to_cutover) return 'safe to upgrade';
  return guard.label || guard.status.replace(/_/g, ' ');
}

function formatPercentOrPending(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'pending';
  return `${Math.min(999, Math.max(0, value)).toFixed(value >= 99.95 ? 2 : 1)}%`;
}

function formatUnixSecondsRelative(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return 'pending';
  return formatRelativeTime(new Date(seconds * 1000).toISOString());
}

/**
 * Commercial client-placement decision view.
 *
 * Backend contracts:
 *   GET /api/privacy_network/vpn/overview/
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *   GET /api/privacy_network/vpn/servers/
 *     /root/aeronyx/privacy_network/api/vpn_servers.py
 * Rust producers:
 *   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 */
function CommercialReadinessPanel({
  health,
  server,
  metrics,
  isPlacementLoading,
  isMetricsLoading,
}: {
  health: VpnNodeHealth;
  server: VpnServerCandidate | null;
  metrics: VpnNodeMetrics | null;
  isPlacementLoading: boolean;
  isMetricsLoading: boolean;
}) {
  if (isPlacementLoading) {
    return (
      <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-44 rounded bg-white/10" />
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-16 rounded-lg bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const enforcement = health.system.policy_enforcement;
  const policySync = health.system.policy_sync;
  const peakBps = metrics?.summary.peak_total_bps ?? null;
  const drops = policyCount(enforcement?.bandwidth_drops);
  const droppedBytes = policyCount(enforcement?.bandwidth_drop_bytes);
  const maxSessionRejects = policyCount(enforcement?.max_sessions_rejections);
  const policyImpactStatus = enforcement?.impact_status || 'clear';
  const activePolicyImpact = policyImpactStatus === 'active';
  const remaining = server?.capacity_remaining ?? (
    health.max_sessions > 0 ? Math.max(0, health.max_sessions - health.active_sessions) : null
  );
  const syncStatus = policySync?.status || 'unknown';
  const runtimeMismatch = (policySync?.mismatched_fields?.length ?? 0) > 0;
  const placementBlocked = !server || !server.available;
  const placementReadiness = health.system.placement_readiness ?? null;
  const placementRolloutPending = !placementReadiness?.reported;
  const placementCutoverGuard = health.system.restart_readiness?.drain_eta?.cutover_guard ?? null;
  const rustAdmissionAttention = Boolean(
    placementReadiness?.reported
    && (!placementReadiness.accepting_new_sessions || placementReadiness.status === 'watch')
  );
  const needsAttention = runtimeMismatch || activePolicyImpact || rustAdmissionAttention;
  const status = placementBlocked ? 'blocked' : needsAttention ? 'attention' : 'ready';
  const statusLabel = status === 'ready' ? 'ready for clients' : status === 'attention' ? 'watch policy' : 'not advertised';
  const placementReason = server?.unavailable_reason ?? (!server ? 'not_in_candidate_list' : null);
  const nextAction = !server
    ? 'Check visibility, region, VPN mode, and heartbeat before expecting public placement.'
    : placementNextAction(server.unavailable_reason);
  const limitBps = bandwidthLimitBps(health.bandwidth_limit_mbps);
  const nearBandwidthCap = limitBps > 0 && typeof peakBps === 'number' && peakBps >= limitBps * 0.9;
  const telemetrySource = health.system.source || 'missing';

  return (
    <div className={`mt-5 rounded-xl border p-4 ${readinessToneClass(status)}`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white">AeroNyx Client Readiness</h4>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${readinessBadgeClass(status)}`}>
              {statusLabel}
            </span>
            {server?.available ? (
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300">
                failover rank {server.failover_rank ?? '-'}
              </span>
            ) : null}
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${telemetrySourceClass(telemetrySource)}`}>
              {telemetrySourceLabel(telemetrySource)}
            </span>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${policyImpactClass(policyImpactStatus)}`}>
              {policyImpactLabel(policyImpactStatus)}
            </span>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${placementAdmissionBadgeClass(placementReadiness)}`}>
              Rust admission {placementAdmissionLabel(placementReadiness)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {server?.available
              ? `Clients can receive ${server.address || 'hidden'}:${server.port} when policy counters stay clear.`
              : `Hidden from client placement: ${formatPlacementReason(placementReason)}.`}
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            Policy telemetry: {telemetrySourceDetail(telemetrySource, health.last_seen_seconds)}
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            Policy impact: {policyImpactDetail(policyImpactStatus, enforcement?.last_rejection_age_seconds, enforcement?.recent_block_window_seconds)}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-400 lg:max-w-md">
          <p className="font-medium text-gray-300">Next operator action</p>
          <p className="mt-1 leading-5 text-gray-500">{nextAction}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2 min-w-0">
          <p className="text-[11px] uppercase text-gray-600">Placement</p>
          <p className="mt-1 truncate text-base font-semibold text-white">
            {server?.available ? 'Advertised' : 'Hidden'}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-gray-600">
            {server ? formatPlacementReason(server.unavailable_reason) : 'not in candidate list'}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">Session Capacity</p>
          <p className="mt-1 text-base font-semibold text-white">
            {sessionCapacityValue(health.active_sessions, health.max_sessions, remaining)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-600">
            {health.max_sessions > 0 ? `${remaining ?? 0} slots left` : 'unlimited policy'}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2 min-w-0">
          <p className="text-[11px] uppercase text-gray-600">Rust Admission</p>
          <p className={`mt-1 truncate text-base font-semibold ${
            placementReadiness?.reported && !placementReadiness.accepting_new_sessions ? 'text-yellow-200' : 'text-white'
          }`}>
            {placementAdmissionLabel(placementReadiness)}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-gray-600">
            {placementReadiness?.reported ? placementReadiness.reason.replace(/_/g, ' ') : 'missing runtime field'}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">Bandwidth Policy</p>
          <p className={`mt-1 text-base font-semibold ${activePolicyImpact || nearBandwidthCap ? 'text-yellow-200' : 'text-white'}`}>
            {formatBandwidthLimit(health.bandwidth_limit_mbps)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-600">
            {isMetricsLoading ? 'loading peak' : `${formatBitsPerSecond(peakBps)} peak`}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2 min-w-0">
          <p className="text-[11px] uppercase text-gray-600">Policy Sync</p>
          <p className={`mt-1 truncate text-base font-semibold ${runtimeMismatch ? 'text-yellow-200' : 'text-white'}`}>
            {syncStatus}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-gray-600">
            {runtimeMismatch ? policySync?.mismatched_fields?.map((field) => field.replace(/_/g, ' ')).join(', ') : 'nodeboard vs Rust'}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">Runtime Blocks</p>
          <p className={`mt-1 text-base font-semibold ${activePolicyImpact ? 'text-yellow-200' : drops + maxSessionRejects > 0 ? 'text-sky-200' : 'text-white'}`}>
            {drops + maxSessionRejects}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-600">
            {maxSessionRejects} session · {drops} packet · {formatBytes(droppedBytes)}
          </p>
        </div>
      </div>

      <div className={`mt-3 rounded-lg border px-3 py-2 ${placementAdmissionPanelClass(placementReadiness)}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Rust Runtime Admission</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {placementAdmissionLabel(placementReadiness)}
              {placementReadiness?.reported ? ` · ${placementReadiness.status}` : ''}
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {placementAdmissionDetail(placementReadiness)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs lg:min-w-[420px]">
            <div className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5">
              <p className="text-gray-600">Session use</p>
              <p className="mt-0.5 font-medium text-gray-300">
                {formatPercentOrPending(placementReadiness?.session_capacity_used_percent)}
              </p>
            </div>
            <div className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5">
              <p className="text-gray-600">Slots left</p>
              <p className="mt-0.5 font-medium text-gray-300">
                {typeof placementReadiness?.session_capacity_remaining === 'number'
                  ? placementReadiness.session_capacity_remaining.toLocaleString()
                  : 'pending'}
              </p>
            </div>
            <div className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5">
              <p className="text-gray-600">Traffic status</p>
              <p className="mt-0.5 truncate font-medium text-gray-300">
                {placementReadiness?.traffic_capacity_status?.replace(/_/g, ' ') || 'pending'}
              </p>
            </div>
            <div className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5">
              <p className="text-gray-600">Window use</p>
              <p className="mt-0.5 font-medium text-gray-300">
                {formatPercentOrPending(placementReadiness?.bandwidth_window_used_percent)}
              </p>
            </div>
          </div>
        </div>
        {placementRolloutPending && (
          <div className={`mt-3 rounded-lg border px-3 py-2 ${placementCutoverClass(placementCutoverGuard)}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide opacity-60">Rollout Cutover Safety</p>
                <p className="mt-1 text-sm font-semibold">
                  {placementCutoverLabel(placementCutoverGuard)}
                </p>
                <p className="mt-1 text-xs leading-5 opacity-75">
                  {placementCutoverGuard?.detail || 'Backend cutover guard is still collecting restart safety metadata.'}
                </p>
                <p className="mt-1 text-xs leading-5 opacity-70">
                  {placementCutoverGuard?.next_step || 'Wait for restart_readiness.drain_eta.cutover_guard before upgrading this Rust placement target.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-[280px]">
                <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                  <p className="opacity-55">Safe now</p>
                  <p className="mt-0.5 font-medium">
                    {placementCutoverGuard ? (placementCutoverGuard.safe_to_cutover ? 'yes' : 'no') : 'pending'}
                  </p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                  <p className="opacity-55">Risk</p>
                  <p className="mt-0.5 truncate font-medium">
                    {placementCutoverGuard?.risk || 'pending'}
                  </p>
                </div>
              </div>
            </div>
            {placementCutoverGuard?.user_impact_if_forced && (
              <p className="mt-2 text-[11px] leading-5 opacity-65">
                Forced impact: {placementCutoverGuard.user_impact_if_forced}
              </p>
            )}
            <p className="mt-2 break-words text-[10px] leading-4 opacity-45">
              Source: GET /api/privacy_network/vpn/overview/ -&gt; data.nodes[].system.restart_readiness.drain_eta.cutover_guard
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-gray-600">
        Backend: GET /api/privacy_network/vpn/overview/ from /root/aeronyx/privacy_network/api/vpn_observability.py
        maps data.nodes[].system.placement_readiness from Rust
        /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs and
        /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs. GET
        /api/privacy_network/vpn/servers/ from /root/aeronyx/privacy_network/api/vpn_servers.py
        provides backend placement eligibility. Missing rollout safety uses
        data.nodes[].system.restart_readiness.drain_eta.cutover_guard from the same
        backend overview file.
      </p>
    </div>
  );
}

function formatBitsPerSecond(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'pending';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Gbps`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} Mbps`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} Kbps`;
  return `${Math.round(value)} bps`;
}

function formatBandwidthLimit(limitMbps: number | null | undefined) {
  if (typeof limitMbps !== 'number' || !Number.isFinite(limitMbps) || limitMbps <= 0) return 'Unlimited';
  return `${limitMbps.toLocaleString()} Mbps`;
}

function bandwidthLimitBps(limitMbps: number | null | undefined) {
  if (typeof limitMbps !== 'number' || !Number.isFinite(limitMbps) || limitMbps <= 0) return 0;
  return limitMbps * 1_000_000;
}

function formatLimitUsage(peakBps: number | null | undefined, limitMbps: number | null | undefined) {
  const limitBps = bandwidthLimitBps(limitMbps);
  if (!limitBps) return 'no cap';
  if (typeof peakBps !== 'number' || !Number.isFinite(peakBps)) return 'pending';
  return `${Math.min(999, (peakBps / limitBps) * 100).toFixed(1)}%`;
}

function bandwidthPressureClass(peakBps: number | null | undefined, limitMbps: number | null | undefined, drops: number) {
  const limitBps = bandwidthLimitBps(limitMbps);
  if (!limitBps) return 'border-emerald-500/15 bg-emerald-500/[0.04]';
  if (drops > 0) return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  if (typeof peakBps !== 'number' || !Number.isFinite(peakBps)) return 'border-white/5 bg-white/[0.02]';
  if (peakBps >= limitBps * 0.9) return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  return 'border-emerald-500/15 bg-emerald-500/[0.04]';
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

function commandActorLabel(command: NodeCommand) {
  if (!command.issued_by) return 'system';
  const wallet = command.issued_by.wallet_short || command.issued_by.wallet_address;
  const walletType = command.issued_by.wallet_type ? `${command.issued_by.wallet_type} ` : '';
  return `${walletType}${wallet || command.issued_by.id}`;
}

function commandSourceLabel(command: NodeCommand) {
  const source = command.source || (typeof command.params?.source === 'string' ? command.params.source : '');
  if (!source) return 'unknown source';
  if (source === 'nodeboard_vpn_operations') return 'nodeboard operations';
  if (source === 'nodeboard_vpn_health') return 'nodeboard diagnostics';
  if (source === 'nodeboard_settings') return 'nodeboard settings';
  return source.replace(/_/g, ' ');
}

function parseCommandResult(command: NodeCommand) {
  const text = commandMessage(command);
  const lines = text.split('\n');
  const firstLine = lines[0]?.trim() || '';
  const logMatch = firstLine.match(/^recent_logs\(([^)]+)\):$/);

  if (logMatch) {
    const logBodyLines = lines.slice(1);
    const serviceManagerIndex = logBodyLines.findIndex((line) => line.startsWith('service_manager:'));
    const serviceManager = serviceManagerIndex >= 0
      ? logBodyLines[serviceManagerIndex].replace(/^service_manager:\s*/, '').trim()
      : '';
    const body = logBodyLines
      .filter((_, index) => index !== serviceManagerIndex)
      .join('\n')
      .trim();

    return {
      kind: 'logs' as const,
      title: `Recent logs (${logMatch[1]})`,
      summary: serviceManager || (command.status === 'completed' ? 'Log tail collected from the VPN service.' : firstLine),
      pairs: [] as Array<{ key: string; value: string }>,
      body,
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
    apply_policy: 'Policy acknowledgement',
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

function BandwidthLimitPanel({
  health,
  metrics,
  isLoading,
}: {
  health: VpnNodeHealth;
  metrics: VpnNodeMetrics | null;
  isLoading: boolean;
}) {
  const enforcement = health.system.policy_enforcement;
  const policySync = health.system.policy_sync;
  const configuredLimit = health.bandwidth_limit_mbps;
  const runtimeLimit = policySync?.runtime?.bandwidth_limit_mbps ?? null;
  const peakBps = metrics?.summary.peak_total_bps ?? null;
  const drops = policyCount(enforcement?.bandwidth_drops);
  const pressureClass = bandwidthPressureClass(peakBps, configuredLimit, drops);
  const syncStatus = policySync?.status || 'unknown';
  const runtimeMismatch = bandwidthLimitBps(configuredLimit) !== bandwidthLimitBps(runtimeLimit);

  if (isLoading) {
    return (
      <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="animate-pulse grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-16 rounded-lg bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-5 rounded-xl border p-4 ${pressureClass}`}>
      <div className="mb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-white">Bandwidth Limit</h4>
          <p className="text-xs text-gray-500 mt-1">
            Node-wide cap from Settings, enforced by the Rust packet path when non-zero.
          </p>
        </div>
        <div className={drops > 0 || runtimeMismatch ? 'text-sm font-semibold text-yellow-300' : 'text-sm font-semibold text-emerald-300'}>
          {drops > 0 ? `${drops} drops` : runtimeMismatch ? 'sync pending' : 'clear'}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">Configured Cap</p>
          <p className="text-base font-semibold text-white mt-1">{formatBandwidthLimit(configuredLimit)}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">nodeboard policy</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">Rust Runtime</p>
          <p className={`text-base font-semibold mt-1 ${runtimeMismatch ? 'text-yellow-200' : 'text-white'}`}>
            {runtimeLimit === null ? 'pending' : formatBandwidthLimit(runtimeLimit)}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">policy {syncStatus}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">24h Peak</p>
          <p className="text-base font-semibold text-white mt-1">{formatBitsPerSecond(peakBps)}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">{metrics?.sample_count ?? 0} samples</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">Peak / Cap</p>
          <p className={`text-base font-semibold mt-1 ${
            drops > 0 || (bandwidthLimitBps(configuredLimit) > 0 && typeof peakBps === 'number' && peakBps >= bandwidthLimitBps(configuredLimit) * 0.9)
              ? 'text-yellow-200'
              : 'text-white'
          }`}>
            {formatLimitUsage(peakBps, configuredLimit)}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">{drops} packet drops</p>
        </div>
      </div>

      {runtimeMismatch ? (
        <p className="mt-3 text-xs text-yellow-300">
          Runtime bandwidth cap has not matched nodeboard policy yet. Wait for the next heartbeat or queue Refresh Config.
        </p>
      ) : null}
    </div>
  );
}

function PolicyEnforcementPanel({ health }: { health: VpnNodeHealth }) {
  const enforcement = health.system.policy_enforcement;
  const policySync = health.system.policy_sync;
  const maintenance = policyCount(enforcement?.maintenance_rejections);
  const maxSessions = policyCount(enforcement?.max_sessions_rejections);
  const bandwidth = policyCount(enforcement?.bandwidth_drops);
  const bandwidthDropBytes = policyCount(enforcement?.bandwidth_drop_bytes);
  const bandwidthLimitBpsSnapshot = policyCount(enforcement?.bandwidth_limit_bytes_per_second);
  const bandwidthWindowBytes = policyCount(enforcement?.bandwidth_window_bytes);
  const total = maintenance + maxSessions + bandwidth;
  const lastAt = enforcement?.last_rejection_at
    ? new Date(enforcement.last_rejection_at * 1000).toISOString()
    : null;
  const syncStatus = policySync?.status || 'unknown';
  const syncClass = syncStatus === 'synced'
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
    : syncStatus === 'pending'
      ? 'border-yellow-500/25 bg-yellow-500/10 text-yellow-300'
      : 'border-gray-500/25 bg-gray-500/10 text-gray-300';
  const mismatched = policySync?.mismatched_fields?.map((field) => field.replace(/_/g, ' ')).join(', ') || '';
  const telemetrySource = health.system.source || 'missing';
  const impactStatus = enforcement?.impact_status || (total > 0 ? 'historical' : 'clear');
  const activeImpact = impactStatus === 'active';

  return (
    <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-white">Policy Enforcement</h4>
          <p className="text-xs text-gray-500 mt-1">
            Node-local policy counters from signed heartbeat health.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${telemetrySourceClass(telemetrySource)}`}>
            {telemetrySourceLabel(telemetrySource)}
          </span>
          <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${policyImpactClass(impactStatus)}`}>
            {policyImpactLabel(impactStatus)}
          </span>
          <span className={activeImpact ? 'text-sm font-semibold text-yellow-300' : total > 0 ? 'text-sm font-semibold text-sky-300' : 'text-sm font-semibold text-emerald-300'}>
            {total} blocked
          </span>
        </div>
      </div>

      <div className={`mb-3 rounded-lg border px-3 py-2 ${syncClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <p className="text-xs font-semibold uppercase">Policy Sync: {syncStatus}</p>
            <p className="mt-1 text-xs opacity-80">
              {policySync?.message || 'Waiting for Rust node policy snapshot in heartbeat.'}
            </p>
          </div>
          <div className="text-xs opacity-80">
            heartbeat {policySync?.heartbeat_age_seconds ?? health.last_seen_seconds ?? 'pending'}s
          </div>
        </div>
        {mismatched ? (
          <p className="mt-1 text-xs opacity-80">Pending fields: {mismatched}</p>
        ) : null}
      </div>

      <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${telemetrySourceClass(telemetrySource)}`}>
        <p className="font-semibold uppercase">Telemetry Source: {telemetrySourceLabel(telemetrySource)}</p>
        <p className="mt-1 opacity-80">{telemetrySourceDetail(telemetrySource, health.last_seen_seconds)}</p>
      </div>

      <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${policyImpactClass(impactStatus)}`}>
        <p className="font-semibold uppercase">Policy Impact: {policyImpactLabel(impactStatus)}</p>
        <p className="mt-1 opacity-80">
          {policyImpactDetail(impactStatus, enforcement?.last_rejection_age_seconds, enforcement?.recent_block_window_seconds)}
        </p>
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
          <p className={`text-base font-semibold mt-1 ${activeImpact && bandwidth > 0 ? 'text-yellow-200' : bandwidth > 0 ? 'text-sky-200' : 'text-white'}`}>{bandwidth}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">{formatBytes(bandwidthDropBytes)} rejected</p>
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

      <div className="mt-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
        <div className="grid gap-2 sm:grid-cols-5 text-xs">
          <div>
            <p className="text-gray-600">Limiter Snapshot</p>
            <p className="mt-0.5 text-gray-300">
              {bandwidthLimitBpsSnapshot > 0 ? formatBitsPerSecond(bandwidthLimitBpsSnapshot * 8) : 'unlimited'}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Current Window</p>
            <p className="mt-0.5 text-gray-300">{formatBytes(bandwidthWindowBytes)}</p>
          </div>
          <div>
            <p className="text-gray-600">Telemetry</p>
            <p className="mt-0.5 text-gray-300">{telemetrySourceLabel(telemetrySource)}</p>
          </div>
          <div>
            <p className="text-gray-600">Counter Scope</p>
            <p className="mt-0.5 text-gray-300">{formatUnixSecondsRelative(enforcement?.counters_started_at)}</p>
          </div>
          <div>
            <p className="text-gray-600">Rust Source</p>
            <p className="mt-0.5 text-gray-500 truncate">/root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function runtimeRecoveryClass(status: string) {
  if (status === 'sessions_interrupted') return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  if (status === 'restarted_recently') return 'border-sky-500/20 bg-sky-500/[0.05]';
  if (status === 'stable') return 'border-emerald-500/15 bg-emerald-500/[0.04]';
  return 'border-white/5 bg-white/[0.02]';
}

function runtimeRecoveryLabel(status: string) {
  const labels: Record<string, string> = {
    stable: 'stable',
    restarted_recently: 'restarted',
    sessions_interrupted: 'recovered',
    unknown: 'pending',
  };
  return labels[status] || status.replace(/_/g, ' ');
}

function RuntimeRecoveryPanel({ health }: { health: VpnNodeHealth }) {
  const recovery = health.system.runtime_recovery;
  const status = recovery?.status || 'unknown';
  const runtimeId = recovery?.runtime_id || health.system.runtime_id || '';
  const runtimeStartedAt = recovery?.runtime_started_at || health.system.runtime_started_at || null;
  const uptimeSeconds = recovery?.runtime_uptime_seconds ?? null;
  const interrupted = recovery?.interrupted_sessions_24h ?? 0;
  const panelClass = runtimeRecoveryClass(status);

  return (
    <div className={`mt-5 rounded-xl border p-4 ${panelClass}`}>
      <div className="mb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-white">Runtime Recovery</h4>
          <p className="text-xs text-gray-500 mt-1">
            Rust process lifetime and stale-session cleanup from signed heartbeats.
          </p>
        </div>
        <span className={`inline-flex self-start rounded-full border px-2.5 py-1 text-xs ${
          status === 'sessions_interrupted'
            ? 'border-yellow-500/25 bg-yellow-500/15 text-yellow-300'
            : status === 'stable'
              ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300'
              : 'border-sky-500/25 bg-sky-500/15 text-sky-300'
        }`}>
          {runtimeRecoveryLabel(status)}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2 min-w-0">
          <p className="text-[11px] uppercase text-gray-600">Runtime ID</p>
          <div className="mt-1 flex items-center gap-1 min-w-0">
            <p className="text-xs font-mono text-gray-300 truncate">
              {runtimeId ? `${runtimeId.slice(0, 12)}...` : 'pending'}
            </p>
            {runtimeId ? <CopyButton text={runtimeId} /> : null}
          </div>
          <p className="text-[11px] text-gray-600 mt-0.5">process identity</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">Process Uptime</p>
          <p className="text-base font-semibold text-white mt-1">
            {uptimeSeconds === null ? 'pending' : formatDuration(uptimeSeconds)}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {runtimeStartedAt ? `started ${formatRelativeTime(runtimeStartedAt)}` : 'waiting for heartbeat'}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">24h Restart</p>
          <p className={`text-base font-semibold mt-1 ${recovery?.restarted_within_24h ? 'text-sky-200' : 'text-white'}`}>
            {recovery?.restarted_within_24h ? 'yes' : status === 'unknown' ? 'pending' : 'no'}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">runtime start window</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">Interrupted Sessions</p>
          <p className={`text-base font-semibold mt-1 ${interrupted > 0 ? 'text-yellow-200' : 'text-white'}`}>
            {interrupted}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {recovery?.last_interrupted_at ? `last ${formatRelativeTime(recovery.last_interrupted_at)}` : 'last 24h'}
          </p>
        </div>
      </div>

      <p className={`mt-3 text-xs ${status === 'sessions_interrupted' ? 'text-yellow-200' : 'text-gray-500'}`}>
        {recovery?.message || 'Waiting for Rust runtime recovery telemetry.'}
      </p>
    </div>
  );
}

function drainStepClass(isReady: boolean, isAttention = false) {
  if (isAttention) return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  if (isReady) return 'border-emerald-500/20 bg-emerald-500/[0.05]';
  return 'border-white/5 bg-white/[0.03]';
}

function drainStepStatus(isReady: boolean, attentionLabel: string, readyLabel = 'ready') {
  return isReady ? readyLabel : attentionLabel;
}

function restartReadinessBlockers({
  health,
  maintenanceMode,
  restartSupported,
  restartCommandActive,
}: {
  health: VpnNodeHealth;
  maintenanceMode: boolean;
  restartSupported: boolean;
  restartCommandActive: boolean;
}) {
  const backendReadiness = health.system.restart_readiness ?? null;
  const blockers: string[] = backendReadiness
    ? backendReadiness.blockers.map((blocker) => blocker.message)
    : [];
  const policySyncStatus = health.system.policy_sync?.status || 'unknown';

  if (!restartSupported) {
    blockers.push(health.system.service_manager?.detail || 'The Rust node did not report restart support.');
  }
  if (!backendReadiness && !maintenanceMode) {
    blockers.push('Start maintenance mode first so new VPN handshakes stop before restart.');
  }
  if (policySyncStatus !== 'synced') {
    blockers.push(`Wait for Rust policy sync before restart. Current policy status: ${policySyncStatus}.`);
  }
  if (!backendReadiness && health.active_sessions > 0) {
    blockers.push(`${health.active_sessions} active tunnel${health.active_sessions === 1 ? '' : 's'} must drain to 0.`);
  }
  if (backendReadiness && !backendReadiness.can_restart && backendReadiness.blockers.length === 0) {
    blockers.push(backendReadiness.next_step || 'Backend restart gate has not opened yet.');
  }
  if (restartCommandActive) {
    blockers.push('A restart_service command is already queued or executing.');
  }

  return blockers;
}

function restartReadinessSourceLabel(readiness: VpnRestartReadiness | null | undefined) {
  if (!readiness) return 'nodeboard fallback gate';
  if (readiness.source === 'backend_vpn_observability_restart_gate') {
    return 'backend restart gate';
  }
  return readiness.source || 'backend restart gate';
}

function restartDrainEtaLabel(eta: VpnRestartDrainEta | null | undefined) {
  if (!eta) return 'ETA pending';
  if (eta.status === 'no_active_sessions') return 'Drained';
  if (eta.status === 'cleanup_policy_pending') return 'Policy pending';
  if (eta.status === 'activity_pending') return 'Activity pending';
  if (eta.status === 'cleanup_due') return 'Cleanup due';
  if (eta.status === 'waiting_for_idle_cleanup') return 'Waiting for idle cleanup';
  return eta.status.replace(/_/g, ' ');
}

function restartDrainEtaClass(eta: VpnRestartDrainEta | null | undefined) {
  if (!eta) return 'border-white/10 bg-white/[0.03] text-gray-300';
  if (eta.status === 'no_active_sessions') return 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200';
  if (eta.status === 'cleanup_due') return 'border-sky-500/25 bg-sky-500/[0.06] text-sky-200';
  return 'border-yellow-500/25 bg-yellow-500/[0.06] text-yellow-200';
}

function restartDrainEtaTiming(eta: VpnRestartDrainEta | null | undefined) {
  if (!eta) return 'waiting for backend aggregate';
  if (eta.status === 'no_active_sessions') return 'no active tunnels';
  if (eta.estimated_seconds_remaining !== null && eta.estimated_seconds_remaining <= 0) {
    return 'cleanup window reached';
  }
  if (eta.estimated_seconds_remaining !== null) {
    return `about ${formatDuration(eta.estimated_seconds_remaining)} remaining`;
  }
  if (eta.estimated_cleanup_at) {
    return `cleanup ${formatRelativeTime(eta.estimated_cleanup_at)}`;
  }
  return 'estimate unavailable';
}

function restartCommandStageIndex(command: VpnRestartCommandState | null | undefined) {
  if (!command) return -1;
  if (command.status === 'pending') return 0;
  if (command.status === 'sent') return 1;
  if (command.status === 'executing') return 2;
  if (command.is_terminal) return 2;
  return 0;
}

function restartCommandStageLabels(command: VpnRestartCommandState | null | undefined) {
  if (command?.is_terminal) return ['Queued', 'Sent', 'Closed'];
  return ['Queued', 'Sent', 'Executing'];
}

function restartCommandToneClass(command: VpnRestartCommandState | null | undefined) {
  if (!command) return 'border-white/10 bg-white/[0.03] text-gray-400';
  if (command.is_stale || command.status === 'failed' || command.status === 'timeout') {
    return 'border-red-400/25 bg-red-400/[0.08] text-red-100';
  }
  if (command.status === 'cancelled') return 'border-yellow-400/25 bg-yellow-400/[0.08] text-yellow-100';
  if (command.status === 'completed') return 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100';
  if (command.status === 'executing') return 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100';
  if (command.status === 'sent') return 'border-sky-400/25 bg-sky-400/[0.08] text-sky-100';
  return 'border-yellow-400/25 bg-yellow-400/[0.08] text-yellow-100';
}

function restartCommandSummary(command: VpnRestartCommandState | null | undefined) {
  if (!command) return null;
  const timestamp = command.completed_at ?? command.acked_at ?? command.sent_at ?? command.created_at;
  const timestampLabel = timestamp ? ` · ${formatRelativeTime(timestamp)}` : '';
  const staleLabel = command.is_stale ? ' · stale' : '';
  return `${command.is_terminal ? 'Last restart command' : 'Restart command'} ${command.status}${timestampLabel}${staleLabel}`;
}

function restartCommandSlaDetail(command: VpnRestartCommandState | null | undefined) {
  if (!command?.age_seconds || !command.stale_after_seconds) return null;
  return `${formatDuration(command.age_seconds)} elapsed / ${formatDuration(command.stale_after_seconds)} SLA`;
}

function restartCommandCanCancel(command: VpnRestartCommandState | null | undefined) {
  if (!command) return false;
  if (typeof command.can_cancel === 'boolean') return command.can_cancel;
  return command.status === 'pending' || command.status === 'sent';
}

function restartCommandCancelReason(command: VpnRestartCommandState | null | undefined) {
  if (!command) return '';
  return command.cancel_reason || 'Backend cancel policy allows cancellation only while a command is pending or sent.';
}

function cleanupRolloutPendingCopy(eta: VpnRestartDrainEta | null | undefined) {
  if (eta?.status !== 'cleanup_policy_pending') return null;
  return {
    title: 'Rust cleanup rollout pending',
    detail: (
      'This Rust process has not reported system_stats.vpn_health.session_cleanup, '
      + 'so nodeboard cannot trust stale-session drain ETA yet.'
    ),
    nextStep: 'Keep maintenance on, confirm the staged Rust binary reports cleanup policy, then re-check this gate.',
    source: 'GET /api/privacy_network/vpn/overview/ -> data.nodes[].system.restart_readiness.drain_eta',
  };
}

function legacyRuntimeDrainCopy(health: VpnNodeHealth | null | undefined) {
  const readiness = health?.system.restart_readiness;
  const eta = readiness?.drain_eta;
  const actionPlan = readiness?.operator_action_plan;
  if (!health || (!eta && !actionPlan)) return null;

  const activityHealth = eta?.activity_health;
  const cutoverGuard = eta?.cutover_guard;
  const title = cutoverGuard?.label || activityHealth?.label || actionPlan?.label || 'Runtime rollout pending';
  const detail = cutoverGuard?.detail || activityHealth?.detail || actionPlan?.summary || 'Waiting for upgraded Rust heartbeat telemetry.';
  const nextStep = cutoverGuard?.next_step || (eta?.status === 'cleanup_policy_pending'
    ? 'Keep maintenance on until the staged Rust runtime reports session_cleanup, then re-check drain readiness.'
    : actionPlan?.primary_action || eta?.next_step || 'Inspect active sessions before restart.');

  return {
    title,
    detail,
    nextStep,
    cutoverStatus: cutoverGuard?.status ?? null,
    safeToCutover: cutoverGuard?.safe_to_cutover ?? null,
    forcedImpact: cutoverGuard?.user_impact_if_forced ?? null,
    recentClientRx: eta?.recent_client_rx_sessions ?? eta?.recent_activity_sessions ?? null,
    staleClientRx: eta?.stale_client_rx_sessions ?? eta?.idle_activity_sessions ?? null,
    neverClientRx: eta?.never_client_rx_sessions ?? null,
    keepaliveIssue: Math.max(eta?.keepalive_missed_sessions ?? 0, eta?.keepalive_pending_sessions ?? 0),
    oldestStartedAt: eta?.oldest_started_at ?? null,
    latestActivityAt: eta?.latest_activity_at ?? null,
    latestClientRxAt: eta?.latest_client_rx_at ?? null,
    source: 'GET /api/privacy_network/vpn/overview/ -> data.nodes[].system.restart_readiness',
  };
}

function drainActivityBucketRows(eta: VpnRestartDrainEta | null | undefined) {
  if (!eta) return [];
  const hasActivityBuckets = [
    eta.recent_client_rx_sessions,
    eta.stale_client_rx_sessions,
    eta.never_client_rx_sessions,
    eta.recent_activity_sessions,
    eta.idle_activity_sessions,
    eta.activity_pending_sessions,
    eta.keepalive_missed_total,
    eta.keepalive_pending_total,
  ].some((value) => typeof value === 'number');

  if (!hasActivityBuckets) return [];

  return [
    {
      label: `Client RX recent ${formatDuration(eta.activity_window_seconds || 180)}`,
      value: eta.recent_client_rx_sessions ?? eta.recent_activity_sessions ?? 0,
      tone: 'text-emerald-200',
    },
    {
      label: 'Client RX stale',
      value: Math.max(
        0,
        (eta.stale_client_rx_sessions ?? eta.idle_activity_sessions ?? 0) - (eta.never_client_rx_sessions ?? 0),
      ),
      tone: 'text-yellow-100',
    },
    {
      label: 'Never client RX',
      value: eta.never_client_rx_sessions ?? 0,
      tone: 'text-red-100',
    },
    {
      label: `Runtime activity ${formatDuration(eta.activity_window_seconds || 180)}`,
      value: eta.recent_activity_sessions ?? 0,
      tone: 'text-sky-100',
    },
    {
      label: 'Idle or stale',
      value: eta.idle_activity_sessions ?? 0,
      tone: 'text-yellow-100',
    },
    {
      label: 'No activity stamp',
      value: eta.activity_pending_sessions ?? 0,
      tone: 'text-gray-300',
    },
    {
      label: `Missed keepalive sessions (${(eta.keepalive_missed_total ?? 0).toLocaleString()} total)`,
      value: eta.keepalive_missed_sessions ?? 0,
      tone: 'text-yellow-100',
    },
    {
      label: `Pending keepalive sessions (${(eta.keepalive_pending_total ?? 0).toLocaleString()} total)`,
      value: eta.keepalive_pending_sessions ?? 0,
      tone: 'text-sky-100',
    },
    {
      label: 'Missed keepalive total',
      value: eta.keepalive_missed_total ?? 0,
      tone: 'text-yellow-100',
    },
    {
      label: 'Pending keepalive total',
      value: eta.keepalive_pending_total ?? 0,
      tone: 'text-sky-100',
    },
  ];
}

function drainActivityHealthClass(risk: string | undefined) {
  if (risk === 'critical') return 'border-red-400/25 bg-red-400/[0.08] text-red-100';
  if (risk === 'warning') return 'border-yellow-300/25 bg-yellow-300/[0.08] text-yellow-100';
  if (risk === 'healthy') return 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100';
  return 'border-sky-300/25 bg-sky-300/[0.08] text-sky-100';
}

function nodeCommandDelivery(health: VpnNodeHealth, readiness: VpnRestartReadiness | null | undefined) {
  if (readiness?.command_delivery) {
    return {
      label: readiness.command_delivery.label,
      status: readiness.command_delivery.status,
      risk: readiness.command_delivery.risk,
      detail: readiness.command_delivery.detail,
      nextStep: readiness.command_delivery.next_step,
      source: 'data.nodes[].system.restart_readiness.command_delivery',
      privacyBoundary: readiness.command_delivery.privacy_boundary,
    };
  }

  const age = health.last_seen_seconds;
  const operatorReporting = Boolean(readiness?.operator_reporting);

  if (typeof age !== 'number') {
    return {
      label: 'Heartbeat missing',
      status: 'blocked',
      risk: 'critical',
      detail: 'Rust heartbeat has not reached the backend.',
      nextStep: 'Confirm the node is running and can reach the backend heartbeat API.',
      source: 'data.nodes[].last_seen_seconds + data.nodes[].system.restart_readiness.operator_reporting',
      privacyBoundary: '',
    };
  }
  if (age > COMMAND_DELIVERY_DEGRADED_SECONDS) {
    return {
      label: 'Heartbeat offline',
      status: 'blocked',
      risk: 'critical',
      detail: `Last heartbeat ${formatDuration(age)} ago.`,
      nextStep: 'Check the Rust node process and backend heartbeat path before queueing commands.',
      source: 'data.nodes[].last_seen_seconds + data.nodes[].system.restart_readiness.operator_reporting',
      privacyBoundary: '',
    };
  }
  if (age > COMMAND_DELIVERY_FRESH_SECONDS) {
    return {
      label: 'Heartbeat delayed',
      status: 'degraded',
      risk: 'warning',
      detail: `Last heartbeat ${formatDuration(age)} ago.`,
      nextStep: 'Wait for a fresh heartbeat or inspect Rust heartbeat latency before restart work.',
      source: 'data.nodes[].last_seen_seconds + data.nodes[].system.restart_readiness.operator_reporting',
      privacyBoundary: '',
    };
  }
  if (!operatorReporting) {
    return {
      label: 'Operator reporting pending',
      status: 'degraded',
      risk: 'warning',
      detail: 'Heartbeat is fresh, but operator_status is not reported.',
      nextStep: 'Confirm Rust reports system_stats.operator_status before relying on command delivery.',
      source: 'data.nodes[].last_seen_seconds + data.nodes[].system.restart_readiness.operator_reporting',
      privacyBoundary: '',
    };
  }

  return {
    label: 'Command-ready',
    status: 'ready',
    risk: 'healthy',
    detail: `Fresh heartbeat ${formatDuration(age)} ago with operator reporting.`,
    nextStep: 'Restart commands can be delivered through the current heartbeat path.',
    source: 'data.nodes[].last_seen_seconds + data.nodes[].system.restart_readiness.operator_reporting',
    privacyBoundary: '',
  };
}

function operatorActionPlanToneClass(risk: string | undefined) {
  if (risk === 'critical') return 'border-red-400/25 bg-red-400/[0.08]';
  if (risk === 'warning') return 'border-yellow-300/25 bg-yellow-300/[0.08]';
  if (risk === 'healthy') return 'border-emerald-400/20 bg-emerald-400/[0.06]';
  return 'border-sky-300/20 bg-sky-300/[0.05]';
}

function operatorActionPlanBadgeClass(risk: string | undefined) {
  if (risk === 'critical') return 'border-red-400/25 bg-red-400/15 text-red-100';
  if (risk === 'warning') return 'border-yellow-300/25 bg-yellow-300/15 text-yellow-100';
  if (risk === 'healthy') return 'border-emerald-400/25 bg-emerald-400/15 text-emerald-100';
  return 'border-sky-300/25 bg-sky-300/15 text-sky-100';
}

function operatorChecklistClass(status: string) {
  if (status === 'ready' || status === 'current') return 'border-emerald-500/15 bg-emerald-500/[0.04] text-emerald-200';
  if (status === 'blocked' || status === 'failed' || status === 'timeout') return 'border-red-400/20 bg-red-400/[0.06] text-red-100';
  if (status === 'attention' || status === 'degraded' || status === 'pending') return 'border-yellow-300/20 bg-yellow-300/[0.06] text-yellow-100';
  return 'border-white/10 bg-white/[0.03] text-gray-300';
}

function restartReadinessLabel(blockers: string[], restartCommandActive: boolean) {
  if (restartCommandActive) return 'Restart queued';
  if (blockers.length === 0) return 'Ready to restart';
  return 'Restart blocked';
}

function restartReadinessClass(blockers: string[], restartCommandActive: boolean) {
  if (restartCommandActive) return 'border-sky-500/25 bg-sky-500/15 text-sky-300';
  if (blockers.length === 0) return 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300';
  return 'border-yellow-500/25 bg-yellow-500/15 text-yellow-300';
}

function sessionActivityAt(session: Session) {
  return session.updated_at || session.last_tx_at || session.last_rx_at || session.started_at;
}

function newestSessionActivity(sessions: Session[]) {
  return sessions.reduce<string | null>((latest, session) => {
    const activityAt = sessionActivityAt(session);
    if (!activityAt) return latest;
    if (!latest) return activityAt;
    return new Date(activityAt).getTime() > new Date(latest).getTime() ? activityAt : latest;
  }, null);
}

function oldestSessionStartedAt(sessions: Session[]) {
  return sessions.reduce<string | null>((oldest, session) => {
    if (!session.started_at) return oldest;
    if (!oldest) return session.started_at;
    return new Date(session.started_at).getTime() < new Date(oldest).getTime()
      ? session.started_at
      : oldest;
  }, null);
}

function sumSessionBytes(sessions: Session[]) {
  return sessions.reduce((total, session) => (
    total + (session.total_bytes ?? session.bytes_in + session.bytes_out)
  ), 0);
}

function MaintenanceDrainPanel({
  nodeId,
  health,
  maintenanceMode,
  restartSupported,
  restartCommandActive,
  isPolicySaving,
  isCommandPending,
  cancellingCommandId,
  onToggleMaintenance,
  onRunDiagnostic,
  onRestartService,
  onCancelRestartCommand,
}: {
  nodeId: string;
  health: VpnNodeHealth;
  maintenanceMode: boolean;
  restartSupported: boolean;
  restartCommandActive: boolean;
  isPolicySaving: boolean;
  isCommandPending: boolean;
  cancellingCommandId: string | null;
  onToggleMaintenance: () => Promise<void>;
  onRunDiagnostic: (action: 'system_info' | 'collect_logs') => Promise<void>;
  onRestartService: () => Promise<void>;
  onCancelRestartCommand: (command: VpnRestartCommandState) => Promise<void>;
}) {
  const { sessions: activeSessions, isLoading: activeSessionsLoading } = useNodeSessions(nodeId, {
    status: 'active',
    limit: 100,
    refetchIntervalMs: maintenanceMode ? 30000 : 60000,
    refetchOnMount: true,
  });
  const activeTunnels = health.active_sessions;
  const listedActiveTunnels = activeSessions.length;
  const listedTrafficBytes = sumSessionBytes(activeSessions);
  const oldestStartedAt = oldestSessionStartedAt(activeSessions);
  const newestActivityAt = newestSessionActivity(activeSessions);
  const missedKeepalives = activeSessions.reduce((total, session) => total + (session.keepalive_missed ?? 0), 0);
  const cleanupTimeoutSeconds = health.system.session_cleanup?.client_liveness_timeout_seconds ?? null;
  const restartReadiness = health.system.restart_readiness ?? null;
  const commandDelivery = nodeCommandDelivery(health, restartReadiness);
  const operatorActionPlan = restartReadiness?.operator_action_plan ?? null;
  const backendDrainEta = restartReadiness?.drain_eta ?? null;
  const policySyncStatus = health.system.policy_sync?.status || 'unknown';
  const recoveryStatus = health.system.runtime_recovery?.status || 'unknown';
  const maintenanceReady = maintenanceMode && policySyncStatus === 'synced';
  const drainReady = backendDrainEta?.status === 'no_active_sessions' || activeTunnels === 0;
  const drainDisplaySessions = backendDrainEta?.active_sessions ?? activeTunnels;
  const cleanupRolloutPending = cleanupRolloutPendingCopy(backendDrainEta);
  const drainActivityBuckets = drainActivityBucketRows(backendDrainEta);
  const drainActivityHealth = backendDrainEta?.activity_health ?? null;
  const activeRestartCommand = restartReadiness?.active_restart_command ?? null;
  const latestRestartCommand = restartReadiness?.latest_restart_command ?? null;
  const visibleRestartCommand = activeRestartCommand ?? latestRestartCommand;
  const cancellableRestartCommand = restartCommandCanCancel(activeRestartCommand) ? activeRestartCommand : null;
  const isCancellingRestartCommand = cancellableRestartCommand?.id === cancellingCommandId;
  const cancelUnavailableReason = activeRestartCommand && !cancellableRestartCommand
    ? restartCommandCancelReason(activeRestartCommand)
    : '';
  const restartCommandStage = restartCommandStageIndex(visibleRestartCommand);
  const restartCommandStages = restartCommandStageLabels(visibleRestartCommand);
  const restartCommandSla = restartCommandSlaDetail(visibleRestartCommand);
  const restartBlockers = restartReadinessBlockers({
    health,
    maintenanceMode,
    restartSupported,
    restartCommandActive,
  });
  const restartReady = restartBlockers.length === 0;
  const verificationReady = recoveryStatus === 'stable' && policySyncStatus === 'synced';
  const sessionsHref = `/dashboard/sessions?node=${encodeURIComponent(nodeId)}&status=active&quality=all`;
  const commandHistoryHref = '#vpn-commands';
  const fallbackPlanActions: OperatorPlanAction[] = [
    {
      key: maintenanceMode ? 'end_maintenance' : 'start_maintenance',
      label: maintenanceMode ? 'End Maintenance' : 'Start Maintenance',
      intent: 'node_policy',
      priority: 1,
      enabled: true,
      detail: 'Fallback maintenance control while backend action hints load.',
    },
    {
      key: 'open_active_sessions',
      label: 'Active Sessions',
      intent: 'sessions',
      priority: 2,
      enabled: true,
      detail: 'Open active session list.',
    },
    {
      key: 'system_info',
      label: 'System Info',
      intent: 'node_commands',
      priority: 5,
      enabled: true,
      detail: 'Collect system diagnostics.',
    },
    {
      key: 'collect_logs',
      label: 'Collect Logs',
      intent: 'node_commands',
      priority: 6,
      enabled: true,
      detail: 'Collect recent service logs.',
    },
    {
      key: 'restart_service',
      label: 'Restart VPN',
      intent: 'node_commands',
      priority: 7,
      enabled: restartReady,
      detail: 'Queue restart_service after gate checks pass.',
    },
  ];
  const planActions = operatorActionPlan?.recommended_actions?.length
    ? operatorActionPlan.recommended_actions
    : fallbackPlanActions;

  const renderPlanAction = (action: OperatorPlanAction) => {
    const disabled = !action.enabled;
    if (action.key === 'start_maintenance' || action.key === 'end_maintenance') {
      return (
        <Button
          key={action.key}
          variant={maintenanceMode ? 'secondary' : 'danger'}
          size="sm"
          title={action.detail}
          disabled={disabled || isPolicySaving}
          isLoading={isPolicySaving}
          onClick={onToggleMaintenance}
        >
          {action.label}
        </Button>
      );
    }
    if (action.key === 'open_active_sessions') {
      return (
        <a
          key={action.key}
          href={sessionsHref}
          title={action.detail}
          aria-disabled={disabled}
          className={`inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            disabled
              ? 'border-white/10 bg-white/[0.03] text-gray-600 pointer-events-none'
              : 'border-sky-400/20 bg-sky-400/[0.08] text-sky-200 hover:bg-sky-400/[0.12]'
          }`}
        >
          {action.label}
        </a>
      );
    }
    if (action.key === 'open_commands') {
      return (
        <a
          key={action.key}
          href={commandHistoryHref}
          title={action.detail}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/[0.08] transition-colors"
        >
          {action.label}
        </a>
      );
    }
    if (action.key === 'system_info' || action.key === 'collect_logs') {
      const diagnosticAction = action.key === 'system_info' ? 'system_info' : 'collect_logs';
      return (
        <Button
          key={action.key}
          variant="secondary"
          size="sm"
          title={action.detail}
          disabled={disabled || isCommandPending}
          onClick={() => onRunDiagnostic(diagnosticAction)}
        >
          {action.label}
        </Button>
      );
    }
    if (action.key === 'restart_service') {
      return (
        <Button
          key={action.key}
          variant="danger"
          size="sm"
          title={action.detail}
          disabled={disabled || isCommandPending || !restartReady}
          onClick={onRestartService}
        >
          {action.label}
        </Button>
      );
    }
    if (action.key === 'cancel_restart' && cancellableRestartCommand) {
      return (
        <Button
          key={action.key}
          variant="secondary"
          size="sm"
          title={action.detail}
          disabled={disabled || isCancellingRestartCommand}
          isLoading={isCancellingRestartCommand}
          onClick={() => onCancelRestartCommand(cancellableRestartCommand)}
        >
          {action.label}
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-white">Maintenance Drain</h4>
          <p className="text-xs text-gray-500 mt-1">
            Controlled restart path for commercial AeroNyx Privacy Protocol traffic.
            {' '}Gate source: {restartReadinessSourceLabel(restartReadiness)}.
          </p>
        </div>
        <span className={`inline-flex self-start rounded-full border px-2.5 py-1 text-xs ${restartReadinessClass(restartBlockers, restartCommandActive)}`}>
          {restartReadinessLabel(restartBlockers, restartCommandActive)}
        </span>
      </div>

      {operatorActionPlan && (
        <div className={`mb-4 rounded-lg border px-3 py-3 ${operatorActionPlanToneClass(operatorActionPlan.risk)}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-white">Operator Action Plan</p>
                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] ${operatorActionPlanBadgeClass(operatorActionPlan.risk)}`}>
                  {operatorActionPlan.label}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-300">{operatorActionPlan.summary}</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">{operatorActionPlan.primary_action}</p>
              {operatorActionPlan.secondary_action && (
                <p className="mt-1 text-[11px] leading-5 text-gray-600">{operatorActionPlan.secondary_action}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 lg:w-[420px]">
              {operatorActionPlan.checklist.map((item) => (
                <div key={item.key} className={`rounded-md border px-2 py-1.5 ${operatorChecklistClass(item.status)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold">{item.label}</p>
                    <span className="text-[10px] uppercase opacity-70">{item.status}</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 opacity-70">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
          {operatorActionPlan.reasons.length > 0 && (
            <div className="mt-3 grid gap-1 text-[11px] leading-5 text-gray-500">
              {operatorActionPlan.reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {planActions.map(renderPlanAction)}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-gray-600">
            Source: GET /api/privacy_network/vpn/overview/ -&gt; data.nodes[].system.restart_readiness.operator_action_plan
          </p>
          <p className="mt-1 text-[10px] leading-4 text-gray-600">{operatorActionPlan.privacy_boundary}</p>
        </div>
      )}

      <div className={`mb-4 rounded-lg border px-3 py-2.5 ${drainActivityHealthClass(commandDelivery.risk)}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold">Command Delivery</p>
            <p className="mt-1 text-[11px] leading-5 opacity-75">{commandDelivery.detail}</p>
          </div>
          <span className="inline-flex self-start rounded-md border border-white/10 px-2 py-0.5 text-[11px]">
            {commandDelivery.label}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-5 opacity-75">{commandDelivery.nextStep}</p>
        <p className="mt-1 text-[10px] leading-4 opacity-45">
          Source: GET /api/privacy_network/vpn/overview/ -&gt; {commandDelivery.source}
        </p>
        {commandDelivery.privacyBoundary && (
          <p className="mt-1 text-[10px] leading-4 opacity-45">{commandDelivery.privacyBoundary}</p>
        )}
      </div>

      {restartBlockers.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.05] px-3 py-2.5">
          <p className="text-xs font-medium text-yellow-200">Restart blockers</p>
          <div className="mt-2 grid gap-1 text-xs text-gray-400">
            {restartBlockers.map((blocker) => (
              <p key={blocker}>{blocker}</p>
            ))}
          </div>
          {restartReadiness?.privacy_boundary && (
            <p className="mt-2 text-[11px] leading-5 text-yellow-100/50">
              {restartReadiness.privacy_boundary}
            </p>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-3">
        <div className={`rounded-lg border px-3 py-3 ${drainStepClass(maintenanceReady, !maintenanceMode)}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase text-gray-600">1. Maintenance</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {maintenanceMode ? 'New handshakes blocked' : 'Accepting new handshakes'}
              </p>
            </div>
            <span className={`text-xs ${maintenanceReady ? 'text-emerald-300' : 'text-yellow-300'}`}>
              {drainStepStatus(maintenanceReady, policySyncStatus)}
            </span>
          </div>
          <Button
            variant={maintenanceMode ? 'secondary' : 'danger'}
            size="sm"
            className="mt-3"
            disabled={isPolicySaving}
            isLoading={isPolicySaving}
            onClick={onToggleMaintenance}
          >
            {maintenanceMode ? 'End Maintenance' : 'Start Maintenance'}
          </Button>
        </div>

        <div className={`rounded-lg border px-3 py-3 ${drainStepClass(drainReady, activeTunnels > 0)}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase text-gray-600">2. Drain</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {drainDisplaySessions} active tunnel{drainDisplaySessions === 1 ? '' : 's'}
              </p>
            </div>
            <span className={`text-xs ${drainReady ? 'text-emerald-300' : 'text-yellow-300'}`}>
              {drainStepStatus(drainReady, 'wait')}
            </span>
          </div>
          <div className={`mt-3 rounded-lg border px-3 py-2 ${restartDrainEtaClass(backendDrainEta)}`}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-xs font-semibold">{restartDrainEtaLabel(backendDrainEta)}</p>
              <p className="text-[11px] opacity-75">{restartDrainEtaTiming(backendDrainEta)}</p>
            </div>
            <p className="mt-1 text-[11px] leading-5 opacity-75">
              {backendDrainEta?.next_step || restartReadiness?.next_step || 'Waiting for backend restart drain status.'}
            </p>
            {backendDrainEta?.privacy_boundary && (
              <p className="mt-1 text-[10px] leading-4 opacity-50">{backendDrainEta.privacy_boundary}</p>
            )}
          </div>
          {drainActivityBuckets.length > 0 && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-[11px] font-medium text-gray-300">Aggregate drain activity</p>
                {drainActivityHealth && (
                  <span className={`inline-flex self-start rounded-md border px-2 py-0.5 text-[11px] font-medium ${drainActivityHealthClass(drainActivityHealth.risk)}`}>
                    {drainActivityHealth.label}
                  </span>
                )}
              </div>
              {drainActivityHealth?.detail && (
                <p className="mt-1 text-[11px] leading-5 text-gray-500">{drainActivityHealth.detail}</p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {drainActivityBuckets.map((bucket) => (
                  <div key={bucket.label} className="rounded-md bg-white/[0.03] px-2 py-1.5">
                    <p className={`text-sm font-semibold ${bucket.tone}`}>{bucket.value.toLocaleString()}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-gray-500">{bucket.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {cleanupRolloutPending && (
            <div className="mt-3 rounded-lg border border-yellow-400/20 bg-yellow-400/[0.06] px-3 py-2">
              <p className="text-xs font-semibold text-yellow-100">{cleanupRolloutPending.title}</p>
              <p className="mt-1 text-[11px] leading-5 text-yellow-100/70">
                {cleanupRolloutPending.detail}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-yellow-100/55">
                {cleanupRolloutPending.nextStep}
              </p>
              <p className="mt-1 break-words text-[10px] leading-4 text-yellow-100/35">
                {cleanupRolloutPending.source}
              </p>
            </div>
          )}
          <a
            href={sessionsHref}
            className="mt-3 inline-flex text-xs font-medium text-sky-300 hover:text-sky-200"
          >
            Open active sessions
          </a>
          <div className="mt-3 space-y-1 text-[11px] text-gray-500">
            <p>
              Session poll: {activeSessionsLoading ? 'loading' : `${listedActiveTunnels} listed`}
              {listedActiveTunnels !== activeTunnels ? ` / ${activeTunnels} reported` : ''}
            </p>
            <p>
              Oldest active: {backendDrainEta?.oldest_started_at
                ? formatRelativeTime(backendDrainEta.oldest_started_at)
                : oldestStartedAt ? formatRelativeTime(oldestStartedAt) : 'none'}
            </p>
            <p>
              Latest client RX: {backendDrainEta?.latest_client_rx_at
                ? formatRelativeTime(backendDrainEta.latest_client_rx_at)
                : newestActivityAt ? formatRelativeTime(newestActivityAt) : 'none'}
            </p>
            {backendDrainEta?.latest_server_tx_at && (
              <p>Latest server TX: {formatRelativeTime(backendDrainEta.latest_server_tx_at)}</p>
            )}
            <p>Listed traffic: {formatBytes(listedTrafficBytes, 1)}</p>
            <p>
              Stale client cleanup: {backendDrainEta?.cleanup_timeout_seconds || cleanupTimeoutSeconds
                ? formatDuration(backendDrainEta?.cleanup_timeout_seconds || cleanupTimeoutSeconds || 0)
                : 'pending Rust rollout'}
            </p>
            {missedKeepalives > 0 && <p>Missed keepalives: {missedKeepalives}</p>}
          </div>
        </div>

        <div className={`rounded-lg border px-3 py-3 ${drainStepClass(restartReady, restartCommandActive || !restartSupported)}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase text-gray-600">3. Restart</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {restartSupported ? 'VPN service command' : 'Restart unavailable'}
              </p>
            </div>
            <span className={`text-xs ${restartReady ? 'text-emerald-300' : 'text-yellow-300'}`}>
              {restartCommandActive ? 'queued' : drainStepStatus(restartReady, restartSupported ? 'blocked' : 'unsupported')}
            </span>
          </div>
          <Button
            variant="danger"
            size="sm"
            className="mt-3"
            disabled={isCommandPending || !restartReady}
            isLoading={isCommandPending}
            onClick={onRestartService}
          >
            Restart VPN
          </Button>
          {!restartReady && (
            <p className="mt-2 text-[11px] text-yellow-200">
              {restartReadiness?.next_step || 'Restart unlocks after active tunnels reach 0.'}
            </p>
          )}
          {visibleRestartCommand && (
            <div className={`mt-3 rounded-lg border px-3 py-2 ${restartCommandToneClass(visibleRestartCommand)}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">
                  {restartCommandSummary(visibleRestartCommand)}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href="#vpn-commands"
                    className="text-xs font-medium text-sky-200 hover:text-sky-100"
                  >
                    Open
                  </a>
                  {cancellableRestartCommand && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={Boolean(cancellingCommandId)}
                      isLoading={isCancellingRestartCommand}
                      onClick={() => onCancelRestartCommand(cancellableRestartCommand)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {restartCommandStages.map((stage, index) => (
                  <div
                    key={stage}
                    className={`rounded-md px-2 py-1 text-center text-[11px] ${
                      index <= restartCommandStage
                        ? 'bg-white/15 text-white'
                        : 'bg-black/20 opacity-50'
                    }`}
                  >
                    {stage}
                  </div>
                ))}
              </div>
              {restartCommandSla && (
                <p className="mt-2 text-[11px] opacity-75">
                  {restartCommandSla}
                  {visibleRestartCommand.stale_reason ? ` · ${visibleRestartCommand.stale_reason}` : ''}
                </p>
              )}
              {cancelUnavailableReason && (
                <p className="mt-2 text-[11px] leading-5 opacity-70">
                  Cancel unavailable: {cancelUnavailableReason}
                </p>
              )}
              <p className="mt-1 text-[10px] leading-4 opacity-45">
                Source: data.nodes[].system.restart_readiness.{activeRestartCommand ? 'active_restart_command' : 'latest_restart_command'}
              </p>
            </div>
          )}
        </div>

        <div className={`rounded-lg border px-3 py-3 ${drainStepClass(verificationReady, recoveryStatus === 'sessions_interrupted')}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase text-gray-600">4. Verify</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {runtimeRecoveryLabel(recoveryStatus)}
              </p>
            </div>
            <span className={`text-xs ${verificationReady ? 'text-emerald-300' : 'text-yellow-300'}`}>
              {policySyncStatus}
            </span>
          </div>
          <a
            href="#vpn-commands"
            className="mt-3 inline-flex text-xs font-medium text-purple-300 hover:text-purple-200"
          >
            Open command history
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Service Readiness Panel
// ============================================

const OPERATOR_STATUS_CLASS: Record<string, string> = {
  ok: 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300',
  ready: 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300',
  healthy: 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300',
  attention: 'border-yellow-500/25 bg-yellow-500/15 text-yellow-300',
  warning: 'border-yellow-500/25 bg-yellow-500/15 text-yellow-300',
  degraded: 'border-yellow-500/25 bg-yellow-500/15 text-yellow-300',
  planned: 'border-sky-500/25 bg-sky-500/15 text-sky-300',
  info: 'border-sky-500/25 bg-sky-500/15 text-sky-300',
  disabled: 'border-white/10 bg-white/5 text-gray-400',
  pending: 'border-white/10 bg-white/5 text-gray-300',
  failed: 'border-red-500/25 bg-red-500/15 text-red-300',
  critical: 'border-red-500/25 bg-red-500/15 text-red-300',
};

function operatorStatusClass(status: string | null | undefined) {
  return OPERATOR_STATUS_CLASS[status || 'pending'] || OPERATOR_STATUS_CLASS.pending;
}

function OperatorStatusBadge({ status }: { status: string | null | undefined }) {
  const value = status || 'pending';
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${operatorStatusClass(value)}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function operatorMetricValue(metrics: Record<string, unknown>, key: string): string | null {
  const value = metrics[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string' && value.trim()) return value.length > 32 ? `${value.slice(0, 29)}...` : value;
  return null;
}

function operatorMetricChips(service: OperatorServiceStatus): string[] {
  const keys = [
    'active_sessions',
    'active_wallet_devices',
    'configured_mtu',
    'running_mtu',
    'mode',
    'api_listen_addr',
    'remote_enabled',
    'supernode_enabled',
    'failed_checks',
  ];

  return keys
    .map((key) => {
      const value = operatorMetricValue(service.metrics, key);
      return value ? `${key.replace(/_/g, ' ')}: ${value}` : null;
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 5);
}

function operatorStatusTotals(status: NodeOperatorStatus) {
  return {
    enabled: status.services.filter((service) => service.enabled).length,
    total: status.services.length,
    attention: status.services.filter((service) => (
      ['attention', 'warning', 'degraded', 'failed', 'critical'].includes(service.status)
    )).length,
  };
}

function ServiceRiskCard({ risk }: { risk: OperatorRisk }) {
  return (
    <div className="rounded-lg border border-yellow-500/15 bg-yellow-500/[0.05] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-yellow-100">{risk.message}</p>
          <p className="mt-1 text-xs text-yellow-100/70">{risk.remediation}</p>
        </div>
        <OperatorStatusBadge status={risk.severity} />
      </div>
    </div>
  );
}

function ServiceReadinessPanel({ nodeId, isVpnNode }: { nodeId: string; isVpnNode: boolean }) {
  const { overview, isLoading, isError, refetch } = useVpnOverview();
  const health = overview?.nodes.find((item) => item.id === nodeId) ?? null;
  const operatorStatus = health?.system.operator_status ?? null;
  const runtimeRollout = operatorStatus?.runtime_rollout ?? null;
  const totals = operatorStatus ? operatorStatusTotals(operatorStatus) : null;

  if (!isVpnNode) {
    return (
      <Card variant="outline" padding="md" className="mb-6">
        <h3 className="font-semibold text-white">AeroNyx Service Readiness</h3>
        <p className="mt-2 text-sm text-gray-500">
          Privacy Protocol mode is disabled for this node. Enable it in Node Settings before service readiness is reported.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card variant="default" padding="md" className="mb-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-48 rounded bg-white/10" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-28 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (isError || !health || !operatorStatus) {
    const hasHeartbeatWithoutOperatorStatus = Boolean(health && !operatorStatus);
    const legacyDrain = legacyRuntimeDrainCopy(health);

    return (
      <Card variant="outline" padding="md" className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-white">AeroNyx Service Readiness</h3>
            <p className="mt-1 text-sm text-yellow-300">
              {hasHeartbeatWithoutOperatorStatus
                ? 'Signed heartbeat is live, but this Rust process is not reporting system_stats.operator_status yet.'
                : 'Waiting for system_stats.operator_status from the signed Rust heartbeat.'}
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Backend contract: GET /api/privacy_network/vpn/overview/ reads
              /root/aeronyx/privacy_network/api/vpn_observability.py, which exposes
              Node.hardware_info["operator_status"] written by heartbeat_service.py.
            </p>
            {health && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase text-gray-600">Privacy Health</p>
                  <p className="mt-1 text-xs text-gray-300">{health.health_status}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase text-gray-600">Active Sessions</p>
                  <p className="mt-1 text-xs text-gray-300">{health.active_sessions.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase text-gray-600">Upgrade Path</p>
                  <p className="mt-1 text-xs text-gray-300">
                    {health.active_sessions > 0 ? 'drain before restart' : 'restart Rust node'}
                  </p>
                </div>
              </div>
            )}
            {legacyDrain && (
              <div className="mt-3 rounded-lg border border-yellow-500/15 bg-yellow-500/[0.05] p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-yellow-100">{legacyDrain.title}</p>
                    <p className="mt-1 text-xs leading-5 text-yellow-100/70">{legacyDrain.detail}</p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-yellow-500/25 bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-200">
                    legacy runtime
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">Client RX Recent</p>
                    <p className="mt-1 text-xs text-yellow-100">{legacyDrain.recentClientRx ?? 'pending'}</p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">Client RX Stale</p>
                    <p className="mt-1 text-xs text-yellow-100">{legacyDrain.staleClientRx ?? 'pending'}</p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">Never RX</p>
                    <p className="mt-1 text-xs text-yellow-100">{legacyDrain.neverClientRx ?? 'pending'}</p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">Keepalive Issue</p>
                    <p className="mt-1 text-xs text-yellow-100">{legacyDrain.keepaliveIssue.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">Cutover Status</p>
                    <p className="mt-1 text-xs text-yellow-100">
                      {legacyDrain.cutoverStatus ? legacyDrain.cutoverStatus.replaceAll('_', ' ') : 'pending'}
                    </p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">Safe Cutover</p>
                    <p className="mt-1 text-xs text-yellow-100">
                      {legacyDrain.safeToCutover === null ? 'pending' : legacyDrain.safeToCutover ? 'yes' : 'no'}
                    </p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">Latest Client RX</p>
                    <p className="mt-1 text-xs text-yellow-100">
                      {legacyDrain.latestClientRxAt ? formatRelativeTime(legacyDrain.latestClientRxAt) : 'pending'}
                    </p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">Runtime Activity</p>
                    <p className="mt-1 text-xs text-yellow-100">
                      {legacyDrain.latestActivityAt ? formatRelativeTime(legacyDrain.latestActivityAt) : 'pending'}
                    </p>
                  </div>
                </div>
                {legacyDrain.forcedImpact && (
                  <p className="mt-2 text-xs leading-5 text-yellow-100/50">
                    Forced restart impact: {legacyDrain.forcedImpact.replaceAll('_', ' ')}.
                  </p>
                )}
                <p className="mt-3 text-xs leading-5 text-yellow-100/60">{legacyDrain.nextStep}</p>
                {legacyDrain.oldestStartedAt && (
                  <p className="mt-1 text-[11px] text-yellow-100/40">
                    Oldest active session started {formatRelativeTime(legacyDrain.oldestStartedAt)}.
                  </p>
                )}
                <p className="mt-2 text-[10px] leading-4 text-yellow-100/35">Source: {legacyDrain.source}</p>
              </div>
            )}
            <p className="mt-3 text-xs leading-5 text-gray-600">
              Rust producer files: /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
              and /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="default" padding="md" className="mb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-semibold text-white">AeroNyx Service Readiness</h3>
            <OperatorStatusBadge status={operatorStatus.status} />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Node-level service/config telemetry from signed Rust heartbeat operator_status.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs text-gray-500">
          <div>
            <p className="text-gray-600">Enabled</p>
            <p className="mt-1 text-gray-200">{totals?.enabled ?? 0}/{totals?.total ?? 0}</p>
          </div>
          <div>
            <p className="text-gray-600">Attention</p>
            <p className="mt-1 text-gray-200">{totals?.attention ?? 0}</p>
          </div>
          <div>
            <p className="text-gray-600">Reported</p>
            <p className="mt-1 text-gray-200">
              {operatorStatus.last_reported_at ? formatRelativeTime(operatorStatus.last_reported_at) : 'pending'}
            </p>
          </div>
        </div>
      </div>

      {runtimeRollout && (
        <div className={`mt-5 rounded-xl border p-4 ${
          runtimeRollout.restart_required
            ? 'border-yellow-500/25 bg-yellow-500/[0.06]'
            : 'border-emerald-500/15 bg-emerald-500/[0.04]'
        }`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-white">Runtime Rollout</h4>
              <p className="mt-1 text-xs text-gray-500">
                Binary replacement signal from /proc/self/exe, reported by the Rust operator-status heartbeat.
              </p>
            </div>
            <OperatorStatusBadge status={runtimeRollout.restart_required ? 'warning' : 'ok'} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <p className="text-[11px] uppercase text-gray-600">Restart Required</p>
              <p className={`mt-1 text-sm font-semibold ${runtimeRollout.restart_required ? 'text-yellow-200' : 'text-white'}`}>
                {runtimeRollout.restart_required ? 'yes' : 'no'}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <p className="text-[11px] uppercase text-gray-600">Executable</p>
              <p className="mt-1 truncate text-xs font-mono text-gray-300">
                {runtimeRollout.executable_path || 'pending'}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <p className="text-[11px] uppercase text-gray-600">Active Sessions</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {(health?.active_sessions ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <p className="text-[11px] uppercase text-gray-600">Next Step</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {runtimeRollout.restart_required
                  ? (health && health.active_sessions > 0 ? 'drain first' : 'restart node')
                  : 'no rollout action'}
              </p>
            </div>
          </div>

          <p className={`mt-3 text-xs leading-5 ${runtimeRollout.restart_required ? 'text-yellow-100/70' : 'text-gray-500'}`}>
            {runtimeRollout.detail}
          </p>
          <p className="mt-2 text-xs leading-5 text-gray-600">
            Rust file: /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs ·
            Backend file: /root/aeronyx/privacy_network/services/heartbeat_service.py.
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {operatorStatus.services.map((service) => (
          <div key={service.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{service.label}</p>
                <p className="mt-1 text-xs text-gray-600">{service.enabled ? 'enabled' : 'not enabled'}</p>
              </div>
              <OperatorStatusBadge status={service.status} />
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-400">{service.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {operatorMetricChips(service).map((chip) => (
                <span key={chip} className="max-w-full truncate rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-500">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {operatorStatus.risks.length > 0 && (
        <div className="mt-5 border-t border-white/5 pt-4">
          <h4 className="text-sm font-semibold text-white">Service Risks</h4>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {operatorStatus.risks.map((risk, index) => (
              <ServiceRiskCard key={`${risk.code}-${index}`} risk={risk} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-3">
        <p className="text-xs text-gray-500">
          Source: {operatorStatus.source || 'rust heartbeat'} · Backend:
          /root/aeronyx/privacy_network/api/vpn_observability.py · Rust:
          crates/aeronyx-server/src/api/vpn_health.rs
        </p>
        <p className="mt-2 text-xs leading-5 text-gray-600">{operatorStatus.privacy_boundary}</p>
      </div>
    </Card>
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
  const { servers, isLoading: placementLoading } = useVpnServers();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const commandStatusFilter = initialCommandStatusFilter(searchParams.get('command_status'));
  const commandActionFilter = initialCommandActionFilter(searchParams.get('command_action'));
  const commandFilterActive = commandStatusFilter !== 'all' || commandActionFilter !== 'all';
  const commandFilterSummary = [
    commandStatusFilter !== 'all' ? `Status: ${commandStatusFilter}` : '',
    commandActionFilter !== 'all' ? `Action: ${commandLabel({ action: commandActionFilter } as NodeCommand)}` : '',
  ].filter(Boolean).join(' · ');
  const applyCommandFilters = useCallback((nextStatus: string, nextAction: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextStatus === 'all') {
      params.delete('command_status');
    } else {
      params.set('command_status', nextStatus);
    }
    if (nextAction === 'all') {
      params.delete('command_action');
    } else {
      params.set('command_action', nextAction);
    }

    const query = params.toString();
    const current = searchParams.toString();
    if (query === current) return;

    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    router.replace(`${pathname}${query ? `?${query}` : ''}${hash}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const {
    commands,
    stats: commandStats,
    isLoading: commandsLoading,
  } = useNodeCommands(nodeId, {
    limit: 50,
    status: commandStatusFilter === 'all' ? undefined : commandStatusFilter,
    action: commandActionFilter === 'all' ? undefined : commandActionFilter,
  });
  const { metrics, isLoading: metricsLoading } = useVpnNodeMetrics(nodeId, { hours: 24 });
  const runCommand = useRunNodeCommand();
  const cancelCommand = useCancelNodeCommand();
  const [cancellingCommandId, setCancellingCommandId] = useState<string | null>(null);
  const health = overview?.nodes.find((item) => item.id === nodeId) ?? null;
  const vpnCommands = commands.filter((command) => NODE_DETAIL_VPN_COMMAND_ACTIONS.has(command.action));
  const activeCommandCount = (
    (commandStats?.pending ?? 0) +
    (commandStats?.sent ?? 0) +
    (commandStats?.executing ?? 0)
  );
  const failedCommandCount = (commandStats?.failed ?? 0) + (commandStats?.timeout ?? 0);

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
    if (!health) {
      onToast('Live VPN health is not available yet. Refresh before restarting.', 'error');
      return;
    }

    const commandActive = vpnCommands.some((command) => (
      command.action === 'restart_service'
      && ['pending', 'sent', 'executing'].includes(command.status)
    ));
    const blockers = restartReadinessBlockers({
      health,
      maintenanceMode,
      restartSupported: health.system.service_manager?.restart_supported !== false,
      restartCommandActive: commandActive,
    });

    if (blockers.length > 0) {
      onToast(blockers[0], 'error');
      return;
    }

    if (!window.confirm('Restart the VPN service on this node now? Maintenance mode is active and active tunnels are drained.')) {
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

  const handleCancelRestartCommand = async (command: VpnRestartCommandState) => {
    if (!restartCommandCanCancel(command)) return;
    if (!window.confirm('Cancel the active restart_service command? Commands already executing on the node cannot be interrupted.')) return;

    setCancellingCommandId(command.id);
    try {
      await cancelCommand.mutateAsync({ nodeId, commandId: command.id });
      onToast('Restart command cancellation requested');
      await refetch();
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Failed to cancel restart command', 'error');
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
  const serviceManager = health.system.service_manager;
  const restartSupported = serviceManager?.restart_supported !== false;
  const placement = servers.find((server) => server.id === nodeId) ?? null;
  const restartCommandActive = vpnCommands.some((command) => (
    command.action === 'restart_service'
    && ['pending', 'sent', 'executing'].includes(command.status)
  ));
  const restartBlockers = restartReadinessBlockers({
    health,
    maintenanceMode,
    restartSupported,
    restartCommandActive,
  });
  const restartReady = restartBlockers.length === 0;

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
            disabled={runCommand.isPending || !restartReady}
            onClick={handleRestartService}
          >
            Restart VPN
          </Button>
          {restartBlockers.length > 0 && (
            <div className="basis-full text-xs text-yellow-300">
              Restart blocked: {restartBlockers[0]}
            </div>
          )}
        </div>
      </div>

      <CommercialReadinessPanel
        health={health}
        server={placement}
        metrics={metrics}
        isPlacementLoading={placementLoading}
        isMetricsLoading={metricsLoading}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 mt-5">
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
          <p className="text-xs text-gray-500">Tunnel MTU</p>
          <p className="text-lg font-semibold text-white mt-1">{formatTunnelMtu(health)}</p>
          <p className="text-xs text-gray-600">{tunnelMtuDetail(health)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">Service Manager</p>
          <p className="text-lg font-semibold text-white mt-1 truncate">{formatServiceManagerName(health)}</p>
          <p className="text-xs text-gray-600 truncate">{serviceManagerRuntimeDetail(health)}</p>
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
      <BandwidthLimitPanel health={health} metrics={metrics} isLoading={metricsLoading} />
      <PolicyEnforcementPanel health={health} />
      <RuntimeRecoveryPanel health={health} />
      <MaintenanceDrainPanel
        nodeId={nodeId}
        health={health}
        maintenanceMode={maintenanceMode}
        restartSupported={restartSupported}
        restartCommandActive={restartCommandActive}
        isPolicySaving={isPolicySaving}
        isCommandPending={runCommand.isPending}
        cancellingCommandId={cancellingCommandId}
        onToggleMaintenance={handleMaintenanceToggle}
        onRunDiagnostic={handleRunCommand}
        onRestartService={handleRestartService}
        onCancelRestartCommand={handleCancelRestartCommand}
      />

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
            {!check.ok && (
              <div className="mt-2 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.05] px-2 py-1.5">
                <p className="text-[11px] uppercase tracking-wide text-yellow-300">Runbook</p>
                <p className="text-xs text-gray-400 mt-1">{healthCheckRunbook(check.name)}</p>
              </div>
            )}
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

      <div id="vpn-commands" className="mt-5 border-t border-white/5 pt-4 scroll-mt-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-3">
          <div>
            <h4 className="text-sm font-semibold text-white">Recent VPN Commands</h4>
            <p className="text-xs text-gray-500 mt-1">
              Diagnostics, policy acknowledgements, restarts, session kicks, and wallet policy commands for this node.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
              <p className="text-gray-600">Total</p>
              <p className="mt-0.5 font-semibold text-white">{commandStats?.total ?? 0}</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
              <p className="text-gray-600">Active</p>
              <p className="mt-0.5 font-semibold text-yellow-300">{activeCommandCount}</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
              <p className="text-gray-600">Failed</p>
              <p className="mt-0.5 font-semibold text-red-300">{failedCommandCount}</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
              <p className="text-gray-600">Shown</p>
              <p className="mt-0.5 font-semibold text-gray-200">{vpnCommands.length}</p>
            </div>
          </div>
        </div>

        <div className="mb-3 grid sm:grid-cols-[180px_220px_1fr] gap-2">
          <label className="block">
            <span className="text-[11px] uppercase text-gray-600">Status</span>
            <select
              value={commandStatusFilter}
              onChange={(event) => applyCommandFilters(event.target.value, commandActionFilter)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500/50"
            >
              {COMMAND_STATUS_FILTERS.map((status) => (
                <option key={status} value={status} className="bg-[#111118]">
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase text-gray-600">Action</span>
            <select
              value={commandActionFilter}
              onChange={(event) => applyCommandFilters(commandStatusFilter, event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500/50"
            >
              {COMMAND_ACTION_FILTERS.map((action) => (
                <option key={action} value={action} className="bg-[#111118]">
                  {action === 'all' ? 'all' : commandLabel({ action } as NodeCommand)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end text-xs text-gray-600">
            {commandsLoading ? 'loading command history' : 'filtered by CMS command history'}
          </div>
        </div>

        {commandFilterActive && (
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-purple-500/20 bg-purple-500/[0.06] px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-purple-200">Command history filter active</p>
              <p className="mt-0.5 text-xs text-gray-500">{commandFilterSummary}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyCommandFilters('all', 'all')}
            >
              Clear filters
            </Button>
          </div>
        )}

        {vpnCommands.length === 0 ? (
          <p className="text-sm text-gray-500">No VPN operation commands have been queued yet.</p>
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
                    <p className="text-xs text-gray-600 mt-0.5">
                      Issued by {commandActorLabel(command)} · {commandSourceLabel(command)}
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

function eventCommandLabel(action?: string | null) {
  const labels: Record<string, string> = {
    system_info: 'System diagnostics',
    collect_logs: 'Recent service logs',
    refresh_config: 'Config refresh',
    apply_policy: 'Policy acknowledgement',
    restart_service: 'Service restart',
    kick_session: 'Session kick',
    ban_wallet: 'Wallet ban',
    unban_wallet: 'Wallet unban',
  };
  return action ? labels[action] || action.replace(/_/g, ' ') : 'Command';
}

function eventCommandAudit(details: Record<string, unknown>) {
  const wallet = typeof details.operator_wallet_short === 'string' ? details.operator_wallet_short : '';
  const walletType = typeof details.operator_wallet_type === 'string' ? details.operator_wallet_type : '';
  const source = typeof details.command_source === 'string' ? details.command_source.replace(/_/g, ' ') : '';
  if (!wallet && !source) return '';
  const actor = wallet ? `${walletType ? `${walletType} ` : ''}${wallet}` : 'system';
  return source ? `${actor} · ${source}` : actor;
}

function nodeEventCheckName(event: VpnEvent) {
  const check = event.details?.check;
  if (typeof check === 'string') return check;
  if (check && typeof check === 'object' && !Array.isArray(check)) {
    const checkRecord = check as Record<string, unknown>;
    return typeof checkRecord.name === 'string' ? checkRecord.name : '';
  }
  return '';
}

function eventReason(event: VpnEvent) {
  const details = event.details || {};
  const checkName = nodeEventCheckName(event);

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
  if (event.type === 'node_policy_sync_pending') {
    const fields = Array.isArray(details.mismatched_fields)
      ? details.mismatched_fields.slice(0, 3).join(', ')
      : '';
    const status = typeof details.policy_sync_status === 'string' ? details.policy_sync_status : 'pending';
    return fields ? `${status} · ${fields}` : status;
  }
  if (event.type === 'client_placement_unavailable') {
    return `hidden from clients · ${formatPlacementReason(
      typeof details.unavailable_reason === 'string' ? details.unavailable_reason : null
    )}`;
  }
  if (event.type === 'session_keepalive_timeout') {
    const missed = eventDetailNumber(details, 'keepalive_missed');
    const pending = eventDetailNumber(details, 'keepalive_pending');
    return `keepalive missed ${missed} · pending ${pending}`;
  }
  if (event.source === 'node_command') {
    const audit = eventCommandAudit(details);
    if (audit) return audit;
  }
  if (typeof details.degraded_reason === 'string') return details.degraded_reason;
  if (typeof details.error_message === 'string') return details.error_message;
  if (typeof details.quality_status === 'string') return `session ${details.quality_status}`;
  if (event.type === 'health_check_failed' && checkName) return checkName.replace(/_/g, ' ');
  if (typeof details.health_status === 'string') return `node ${details.health_status}`;
  if (typeof details.observed_mbps === 'number' && typeof details.bandwidth_limit_mbps === 'number') {
    return `${details.observed_mbps.toFixed(1)} / ${details.bandwidth_limit_mbps.toFixed(1)} Mbps`;
  }
  if (typeof details.rtt_ms === 'number') return `${details.rtt_ms.toFixed(1)} ms RTT`;
  if (Array.isArray(details.changed_fields) && details.changed_fields.length > 0) {
    return details.changed_fields.slice(0, 3).join(', ');
  }
  if (event.session_id) return `session ${event.session_id}`;
  if (event.command_id) return `${eventCommandLabel(event.action)} · command ${event.command_id.slice(0, 8)}`;
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
  if (event.type === 'node_policy_sync_pending') {
    const age = eventDetailNumber(details, 'heartbeat_age_seconds');
    return age > 0 ? `heartbeat ${age}s old` : 'waiting for heartbeat';
  }
  if (event.type === 'client_placement_unavailable') {
    const availability = typeof details.availability_24h_percent === 'number'
      ? `24h ${formatAvailability(details.availability_24h_percent)}`
      : '';
    const capacity = eventDetailNumber(details, 'capacity_remaining');
    if (capacity > 0) return availability ? `${availability} · ${capacity} slots` : `${capacity} slots`;
    if (typeof details.load === 'number') return `load ${details.load}%${availability ? ` · ${availability}` : ''}`;
    return availability || 'not advertised';
  }
  if (event.type === 'health_check_failed') {
    const runningMtu = eventDetailNumber(details, 'running_mtu');
    const configuredMtu = eventDetailNumber(details, 'configured_mtu');
    if (nodeEventCheckName(event) === 'mtu_config' && (runningMtu || configuredMtu)) {
      return runningMtu && configuredMtu ? `MTU ${runningMtu} / ${configuredMtu}` : 'MTU metadata pending';
    }
  }
  if (event.source === 'node_command' && event.action === 'apply_policy') {
    return 'policy runtime acknowledgement';
  }
  if (event.source === 'node_command') {
    const source = typeof details.command_source === 'string' ? details.command_source.replace(/_/g, ' ') : '';
    if (source) return source;
  }
  if (typeof details.virtual_ip === 'string' && details.virtual_ip) {
    return `VIP ${details.virtual_ip}`;
  }
  if (typeof details.client_wallet === 'string' && details.client_wallet) {
    return `wallet ${details.client_wallet.slice(0, 10)}...${details.client_wallet.slice(-6)}`;
  }
  const keepaliveMissed = eventDetailNumber(details, 'keepalive_missed');
  if (keepaliveMissed > 0) {
    return `${keepaliveMissed} missed ACKs`;
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

      {/* 3. AeroNyx Service Readiness */}
      <ServiceReadinessPanel
        nodeId={nodeId}
        isVpnNode={node.is_vpn_node}
      />

      {/* 4. VPN Health Panel */}
      <VpnHealthPanel
        nodeId={nodeId}
        isVpnNode={node.is_vpn_node}
        maintenanceMode={node.maintenance_mode}
        isPolicySaving={updateNodeMutation.isPending}
        onToggleMaintenance={handleToggleMaintenance}
        onToast={showToast}
      />

      {/* 5. Recent VPN Events */}
      <NodeVpnEventsPanel nodeId={nodeId} isVpnNode={node.is_vpn_node} />

      {/* 6. Wallet Ban Policies */}
      <WalletBanPolicyPanel nodeId={nodeId} isVpnNode={node.is_vpn_node} onToast={showToast} />

      {/* 7. Stats Grid */}
      <StatsGrid nodeId={nodeId} />

      {/* 8. Hardware Info + Node Details */}
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
