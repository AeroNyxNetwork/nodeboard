/**
 * ============================================
 * AeroNyx Node Detail Page
 * ============================================
 * File Path: app/dashboard/nodes/[id]/page.tsx
 *
 * Creation Reason: Individual node detail view
 * Modification Reason:
 *   v1.6.54 - Added Rust PeerStore recent_peer_events rendering to the
 *     Discovery panel. The UI shows privacy-safe peer lifecycle motion
 *     (inserted, upgraded, refreshed, rejected, expired) using only short
 *     node prefixes, source buckets, sequence numbers, and reason buckets.
 *     It must never expose full node IDs, endpoints, route IDs, encrypted
 *     payloads, client IPs, DNS contents, Memory Chain plaintext, social
 *     graph edges, private keys, voucher secrets, or wallet-level traffic.
 *   v1.6.53 - Added Rust PeerStore network_story rendering to the Discovery
 *     panel. The card translates aggregate protocol discovery readiness into
 *     operator/product language: verified peer view, routeable encrypted relay
 *     candidates, future onion-shaped path readiness, and restart recovery.
 *     The UI consumes only Rust aggregate counts and booleans; it must never
 *     expose full node IDs, endpoint URLs, route IDs, encrypted payloads,
 *     receiver identities, client IPs, DNS contents, Memory Chain plaintext,
 *     social graph edges, or wallet-level traffic.
 *   v1.6.52 - Added Rust local ChatRelay capability self-check to the
 *     Discovery panel. The card consumes discovery_status.local_capabilities
 *     from Rust /api/discovery/status so operators can see whether ChatRelay
 *     config, blind relay endpoint readiness, and advertised capability are
 *     consistent before enabling node-to-node encrypted relay. The UI shows
 *     booleans and Rust-authored status/detail only; it never exposes relay
 *     routes, endpoints, message IDs, encrypted blobs, client IPs, Memory
 *     Chain plaintext, or social graph edges.
 *   v1.6.51 - Added peer-cache startup recovery evidence to the Discovery
 *     panel. The UI distinguishes cache save status from restart load status
 *     and displays only Rust-provided source/status buckets, never cache
 *     paths, peer endpoints, public keys, route IDs, payloads, client IPs, or
 *     social graph edges.
 *   v1.6.50 - Aligned Security / Relay Protection peer health rendering with
 *     Rust PeerStorePeerHealth field names (`route_failure_count`,
 *     `relay_rejection_count`, `relay_quarantine_count`) while preserving
 *     legacy aliases for already-deployed snapshots. The UI still displays
 *     aggregate node-level protection buckets only.
 *   v1.6.49 - Added Security / Relay Protection inside the Discovery panel.
 *     The panel consumes Rust peer_store.runtime.blind_relay and
 *     peer_health_summary aggregates so operators can see loop detection,
 *     replay drops, relay rate limits, quarantine state, and per-peer health
 *     buckets without exposing route IDs, endpoints, encrypted blobs, client
 *     IPs, destinations, payloads, Memory Chain plaintext, or social graph
 *     edges.
 *   v1.6.48 - Discovery Bootstrap Source now prefers Rust
 *     bootstrap.recovery_status when available, so an expired static
 *     bootstrap file does not mask a successful seed-gossip recovery path.
 *     Raw last_source_* evidence is preserved in detail text and heartbeat
 *     data for diagnostics.
 *   v1.6.47 - Added PeerStore restart recovery readiness to the Discovery
 *     Relay foundation card. Rust now reports whether discovery has a restart
 *     recovery path through seed endpoints or peer-cache persistence, so
 *     operators do not mistake a fresh in-memory peer view for a resilient
 *     commercial relay foundation.
 *   v1.6.46 - Added Rust-authored PeerStore stability summary to the
 *     Discovery panel so operators can see whether node discovery is ready
 *     as a relay/multihop foundation without exposing peer URLs, full peer
 *     public keys, client traffic, chat plaintext/ciphertext, Memory Chain
 *     plaintext, or wallet-level traffic.
 *   v1.6.45 - Added a blind-operation boundary callout to the Discovery
 *     panel. Peer discovery health is allowed to show signed peer counts,
 *     gossip freshness, and aggregate descriptor counters, but nodeboard must
 *     not become a user traffic, Memory Chain plaintext, social graph, DNS,
 *     destination, or wallet-level traffic viewer.
 *   v1.6.44 - Added packet_runtime telemetry to the Capacity panel so node
 *     operators can see stale-session packet drops after Rust restarts from
 *     data.nodes[].system.packet_runtime. The card consumes only aggregate
 *     counters from Rust PacketHandler and never exposes session IDs, client
 *     public IPs, packet payloads, chat plaintext, ciphertext, or per-user
 *     traffic.
 *   v1.6.43 - Added a node-scoped Encrypted Chat Relay panel that consumes
 *     data.nodes[].system.chat_relay_status from the backend overview API.
 *     Rust reports privacy-safe node-to-node relay counters from
 *     crates/aeronyx-server/src/services/chat_relay.rs and
 *     crates/aeronyx-server/src/server.rs so operators can see relay
 *     stability without exposing message IDs, wallet IDs, chat plaintext,
 *     ciphertext, client public IPs, or per-user traffic.
 *   v1.6.40 - Added a node-scoped Discovery panel that consumes
 *     data.nodes[].system.discovery_status from the backend overview API.
 *     Rust reports this aggregate peer-store snapshot from
 *     crates/aeronyx-server/src/management/reporter.rs and
 *     crates/aeronyx-server/src/services/peer_store.rs so operators can see
 *     peer count, valid peers, gossip freshness, stale/rejected imports, and
 *     bootstrap readiness without exposing client traffic or chat plaintext.
 *   v1.6.39 - Prioritized `aeronyx-node.sh status` in Operator Runbook and
 *     AI maintenance prompts because status now includes service state,
 *     local endpoints, upgrade state, and operator_next_step from the
 *     privacy-safe healthcheck recommendation.
 *   v1.6.38 - Added Service Configuration shortcuts into the Services
 *     Workbench `section` deep links for fleet capacity, transport, and DNS
 *     review. Node Detail remains the per-node evidence view, while Services
 *     stays the fleet-level decision surface.
 *   v1.6.37 - Added a node-scoped Service Configuration panel so operators
 *     can inspect systemd/service name, config path, repository branch,
 *     runtime executable, TUN/IP/MTU, DNS ownership, and transport carriers
 *     from existing Rust heartbeat metadata without expanding the first-level
 *     Services page.
 *   v1.6.36 - Added Rust-authored operator_action recommendation to the
 *     node detail Operator Actions hub. The card consumes
 *     data.nodes[].system.operator_action and links operators to the detailed
 *     health, capacity, upgrade, runtime, or runbook evidence without adding
 *     more first-level Services modules.
 *   v1.6.35 - Added CPU and memory resource load to the node Capacity panel
 *     and folded high resource pressure into the commercial capacity risk
 *     summary. This keeps Services lean while making node detail explain
 *     whether connection quality is constrained by host resources.
 *   v1.6.34 - Added a node detail section navigator that groups the long
 *     operator page into Overview, Capacity, Runtime, Install & Upgrade,
 *     Events, and Commands. This keeps all existing diagnostic panels intact
 *     while making the page usable as a commercial operator console.
 *   v1.6.33 - Fixed CapacityPanel bandwidth cap unit handling. Rust reports
 *     capacity.bandwidth_limit_bytes_per_second in bytes/sec, while
 *     throughput UI displays bits/sec. The panel now converts Mbps fallback
 *     values to bytes/sec before formatting, preventing an 8x inflated cap
 *     when older telemetry lacks the Rust byte counter.
 *   v1.6.32 - Added node-level install workflow status from
 *     NodeDetail.install_status so operators can see the registration-code
 *     installer timeline after a node is bound, without returning the code
 *     value or any user traffic data.
 *   v1.6.31 - Added privacy-safe Rust upgrade workflow status from
 *     system.upgrade_status with an Operator Actions shortcut and a dedicated
 *     node detail panel, keeping Services as a high-level readiness view.
 *   v1.6.30 - Added an Operator Actions panel that summarizes node settings,
 *     capacity bottlenecks, health checks, recent events, runtime rollout, and
 *     maintenance readiness into action cards with anchors to the detailed
 *     panels instead of forcing operators to scan the whole page.
 *   v1.6.29 - Added recent Rust operational error events from sanitized
 *     system_stats.vpn_health.recent_errors so operators can triage service
 *     failures without collecting client traffic data.
 *   v1.6.28 - Added an operator runbook panel that derives the Rust repo path
 *     from runtime rollout metadata and generates one-command health, status,
 *     logs, no-restart upgrade, and AI maintenance prompts through
 *     deploy/node/aeronyx-node.sh.
 *   v1.6.27 - Prefer Rust-authored capacity.risks from /api/vpn/health so
 *     node detail shows the same commercial placement blockers and
 *     remediation text as the CLI healthcheck and backend automation.
 *   v1.6.26 - Added commercial capacity risk summary for IP-pool/session
 *     mismatches so operators can see paid-placement blockers directly in
 *     nodeboard before scaling traffic.
 *   v1.6.25 - Added config-driven Network Rules cards to the capacity panel
 *     so operators can see virtual IP range, TUN device, forwarding, NAT, and
 *     egress checks from the same Rust /api/vpn/health contract.
 *   v1.6.24 - Added node commercial status, config drift checks, and
 *     diagnostics checklist so operators can see whether a node is safe to
 *     serve clients before inspecting low-level telemetry.
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
 *   4. AeroNyx health panel from /vpn/overview/ for live heartbeat diagnostics
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
 *     Exposes data.nodes[].system.discovery_status for aggregate Rust node
 *     discovery/gossip health, including peer_store.stability as the
 *     Rust-authored relay foundation gate. Backend path:
 *     /root/aeronyx/privacy_network/api/vpn_observability.py. Rust producers:
 *     /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *     and /root/open/AeroNyx/crates/aeronyx-server/src/services/peer_store.rs.
 *     Exposes data.nodes[].system.chat_relay_status for aggregate encrypted
 *     chat peer relay health. Backend path:
 *     /root/aeronyx/privacy_network/api/vpn_observability.py. Rust producers:
 *     /root/open/AeroNyx/crates/aeronyx-server/src/services/chat_relay.rs
 *     and /root/open/AeroNyx/crates/aeronyx-server/src/server.rs.
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
 *     The same cutover guard panel links to
 *     /dashboard/sessions?node={id}&status=active&quality=all and the local
 *     #maintenance-drain section so operators can follow backend next_step
 *     guidance without hunting through the page.
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
 * Last Modified: v1.6.54 - Show PeerStore lifecycle events
 * Previous: v1.6.53 - Show PeerStore network story readiness
 * Previous: v1.6.52 - Show local ChatRelay capability self-check
 * Previous: v1.6.51 - Show peer-cache startup recovery evidence
 * Previous: v1.6.50 - Align peer health counter names with Rust
 * Previous: v1.6.49 - Show blind relay protection counters
 * Previous: v1.6.48 - Added discovery bootstrap recovery status preference
 * Previous: v1.6.47 - Show PeerStore restart recovery readiness
 * Previous: v1.6.46 - Show PeerStore relay foundation stability
 * Previous: v1.6.45 - Show blind operation boundary in Discovery
 * Previous: v1.6.44 - Show packet runtime health
 * Previous: v1.6.43 - Show encrypted chat peer relay health
 * Previous: v1.6.42 - Show discovery outbound gossip health
 * Previous: v1.6.41 - Show discovery seed recovery status
 * Previous: v1.6.40 - Show Rust discovery and gossip status
 * Previous: v1.6.39 - Prioritize status in operator runbook
 * Previous: v1.6.38 - Link service configuration to Services sections
 * Previous: v1.6.37 - Show node service configuration panel
 * Previous: v1.6.36 - Show Rust operator action recommendation
 * Previous: v1.6.35 - Add resource load capacity signals
 * Previous: v1.6.34 - Add node detail section navigator
 * Previous: v1.6.33 - Fix capacity bandwidth cap units
 * Previous: v1.6.32 - Show node install workflow status
 * Previous: v1.6.31 - Show Rust upgrade workflow status
 * Previous: v1.6.30 - Add node operator action hub
 * Previous: v1.6.29 - Show sanitized recent Rust operational errors
 * Previous: v1.6.28 - Add node operator runbook commands
 * Previous: v1.6.27 - Prefer Rust-authored capacity risks
 * Previous: v1.6.26 - Show commercial capacity risk summary
 * Previous: v1.6.25 - Show config-driven Network Rules diagnostics
 * Previous: v1.6.24 - Add commercial status and diagnostics summary
 * Previous: v1.6.23 - Add placement rollout action links
 * Previous: v1.6.22 - Show placement rollout cutover safety
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
  ChatRelayStatus,
  NodeCommand,
  DiscoveryBootstrapStatus,
  DiscoveryLocalCapabilityStatus,
  DiscoveryStatus,
  NodeInstallProgressSummary,
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
  VpnPolicySnapshot,
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
import { useI18n } from '@/lib/i18n/I18nProvider';

// ============================================
// VPN Health Config
// ============================================

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

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

function formatHealthCheckName(name: string, t: TranslateFn): string {
  const label = t(`nodeDetail.healthCheck.${name}`);
  if (label !== `nodeDetail.healthCheck.${name}`) return label;
  return HEALTH_CHECK_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function healthCheckRunbook(name: string, t: TranslateFn): string {
  const hints: Record<string, string> = {
    heartbeat: t('nodeDetail.healthRunbook.heartbeat'),
    resource_load: t('nodeDetail.healthRunbook.resourceLoad'),
    traffic_counters: t('nodeDetail.healthRunbook.trafficCounters'),
    udp_listener: t('nodeDetail.healthRunbook.udpListener'),
    tun_device: t('nodeDetail.healthRunbook.tunDevice'),
    mtu_config: t('nodeDetail.healthRunbook.mtuConfig'),
    ip_forward: t('nodeDetail.healthRunbook.ipForward'),
    nat_masquerade: t('nodeDetail.healthRunbook.natMasquerade'),
    dns_stub: t('nodeDetail.healthRunbook.dnsStub'),
    dns_query: t('nodeDetail.healthRunbook.dnsQuery'),
    internet_egress: t('nodeDetail.healthRunbook.internetEgress'),
  };
  return hints[name] || t('nodeDetail.healthRunbook.default');
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
  const { t } = useI18n();
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span className="text-sm">{t('nodeDetail.backToNodes')}</span>
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
  const { t } = useI18n();
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
      title={t('nodeDetail.editNameTitle')}
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
  const { t, formatRelativeTime: formatLocalizedRelativeTime } = useI18n();
  const statusConfig = NODE_STATUS_CONFIG[node.status] ?? {
    label: 'Unknown',
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/50',
  };
  const statusKey = `common.status.${node.status || 'unknown'}`;
  const translatedStatus = t(statusKey);
  const statusLabel = translatedStatus === statusKey ? statusConfig.label : translatedStatus;

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
                <span className="text-xs font-medium">{statusLabel}</span>
              </div>
              {node.is_verified && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('nodes.card.verified')}
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
                <span>{t('nodeDetail.lastSeen', { time: formatLocalizedRelativeTime(node.last_heartbeat) })}</span>
              </div>
              <span className="text-gray-600">v{node.version}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="danger" onClick={onDelete}>{t('nodeDetail.deleteNode')}</Button>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Stats Grid
// ============================================

function StatsGrid({ nodeId }: { nodeId: string }) {
  const { t, formatNumber } = useI18n();
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
        label={t('nodeDetail.stats.uptime')}
        value={`${formatNumber(stats.uptime_percentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
        subValue={t('nodeDetail.stats.hours', {
          count: formatNumber(stats.total_uptime_hours, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        })}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      />
      <StatCard
        label={t('nodeDetail.stats.activeSessions')}
        value={formatNumber(stats.active_sessions)}
        subValue={t('nodeDetail.stats.total', { count: formatNumber(stats.total_sessions) })}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
      />
      <StatCard
        label={t('nodeDetail.stats.totalTraffic')}
        value={`${formatNumber(stats.total_traffic_gb, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`}
        subValue={t('nodeDetail.stats.mbPerSession', {
          count: formatNumber(stats.avg_session_traffic_mb, { maximumFractionDigits: 0 }),
        })}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>}
      />
      <StatCard
        label={t('nodeDetail.stats.avgSession')}
        value={t('nodeDetail.stats.minutes', {
          count: formatNumber(stats.avg_session_duration_minutes, { maximumFractionDigits: 0 }),
        })}
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

function tunnelMtuDetail(health: VpnNodeHealth, t: TranslateFn) {
  const configured = health.system.configured_mtu;
  const running = health.system.running_mtu;
  if (typeof running === 'number' && typeof configured === 'number') {
    return running === configured ? t('nodeDetail.health.mtuMatchesConfig') : t('nodeDetail.health.mtuConfigValue', { value: configured });
  }
  if (typeof configured === 'number') return t('nodeDetail.health.mtuConfiguredOnly');
  if (typeof running === 'number') return t('nodeDetail.health.mtuRuntimeOnly');
  return t('nodeDetail.health.reportedByHealthCheck');
}

function formatServiceManagerName(health: VpnNodeHealth) {
  const manager = health.system.service_manager;
  if (!manager) return 'pending';
  return manager.manager || 'service';
}

function serviceManagerRuntimeDetail(health: VpnNodeHealth, t: TranslateFn) {
  const manager = health.system.service_manager;
  if (!manager) return t('nodeDetail.health.waitingRustHealth');
  const states = [manager.active_state, manager.load_state, manager.unit_file_state]
    .filter((state): state is string => Boolean(state));
  if (states.length > 0) return states.join(' · ');
  return manager.restart_supported ? t('nodeDetail.health.restartSupported') : manager.detail;
}

function serviceConfigValue(value: string | number | boolean | null | undefined, pending: string) {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}`;
  if (typeof value === 'boolean') return value ? 'enabled' : 'disabled';
  if (typeof value === 'string' && value.trim()) return value;
  return pending;
}

function formatTransportKey(value: string | null | undefined, t: TranslateFn) {
  if (!value) return t('common.status.pending');
  const key = `nodeDetail.serviceConfig.transport.${value}`;
  const translated = t(key);
  return translated === key ? value.replace(/_/g, ' ') : translated;
}

function formatTransportList(values: string[] | null | undefined, t: TranslateFn) {
  if (!Array.isArray(values) || values.length === 0) return t('common.status.pending');
  return values.map((value) => formatTransportKey(value, t)).join(', ');
}

function dnsOwnerLabel(value: string | null | undefined, t: TranslateFn) {
  if (!value) return t('common.status.pending');
  const key = `nodeDetail.serviceConfig.dnsOwner.${value}`;
  const translated = t(key);
  return translated === key ? value.replace(/_/g, ' ') : translated;
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

function formatPlacementReason(reason: string | null | undefined, t: TranslateFn) {
  if (!reason) return t('nodeDetail.placementReason.candidate');
  const labels: Record<string, string> = {
    heartbeat_stale: t('nodeDetail.placementReason.heartbeatStale'),
    maintenance_mode: t('nodeDetail.placementReason.maintenanceMode'),
    max_sessions_reached: t('nodeDetail.placementReason.maxSessionsReached'),
    vpn_health_failed: t('nodeDetail.placementReason.vpnHealthFailed'),
    overloaded: t('nodeDetail.placementReason.overloaded'),
    low_24h_availability: t('nodeDetail.placementReason.lowAvailability'),
    vpn_health_degraded: t('nodeDetail.placementReason.vpnHealthDegraded'),
  };
  return labels[reason] || reason.replace(/_/g, ' ');
}

function placementNextAction(reason: string | null | undefined, t: TranslateFn) {
  const actions: Record<string, string> = {
    heartbeat_stale: t('nodeDetail.placementAction.heartbeatStale'),
    maintenance_mode: t('nodeDetail.placementAction.maintenanceMode'),
    max_sessions_reached: t('nodeDetail.placementAction.maxSessionsReached'),
    vpn_health_failed: t('nodeDetail.placementAction.vpnHealthFailed'),
    vpn_health_degraded: t('nodeDetail.placementAction.vpnHealthDegraded'),
    overloaded: t('nodeDetail.placementAction.overloaded'),
    low_24h_availability: t('nodeDetail.placementAction.lowAvailability'),
  };
  return reason ? actions[reason] || t('nodeDetail.placementAction.default') : t('nodeDetail.placementAction.monitor');
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

function telemetrySourceLabel(source: string | null | undefined, t: TranslateFn) {
  if (source === 'cache') return t('nodeDetail.telemetry.cache');
  if (source === 'sample') return t('nodeDetail.telemetry.sample');
  if (!source || source === 'missing') return t('nodeDetail.telemetry.missing');
  return source.replace(/_/g, ' ');
}

function telemetrySourceClass(source: string | null | undefined) {
  if (source === 'cache') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
  if (source === 'sample') return 'border-sky-500/25 bg-sky-500/10 text-sky-300';
  return 'border-yellow-500/25 bg-yellow-500/10 text-yellow-300';
}

function telemetrySourceDetail(source: string | null | undefined, lastSeenSeconds: number | null | undefined, t: TranslateFn) {
  const age = typeof lastSeenSeconds === 'number' ? t('nodeDetail.telemetry.ageAgo', { age: formatDuration(lastSeenSeconds) }) : t('common.status.pending');
  if (source === 'cache') return t('nodeDetail.telemetry.cacheDetail', { age });
  if (source === 'sample') return t('nodeDetail.telemetry.sampleDetail', { age });
  return t('nodeDetail.telemetry.missingDetail');
}

function policyImpactLabel(status: string | null | undefined, t: TranslateFn) {
  if (status === 'active') return t('nodeDetail.policyImpact.active');
  if (status === 'historical') return t('nodeDetail.policyImpact.historical');
  if (status === 'clear') return t('nodeDetail.policyImpact.clear');
  return t('common.status.pending');
}

function policyImpactClass(status: string | null | undefined) {
  if (status === 'active') return 'border-yellow-500/25 bg-yellow-500/10 text-yellow-300';
  if (status === 'historical') return 'border-sky-500/25 bg-sky-500/10 text-sky-300';
  if (status === 'clear') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
  return 'border-gray-500/25 bg-gray-500/10 text-gray-300';
}

function policyImpactDetail(status: string | null | undefined, ageSeconds: number | null | undefined, windowSeconds: number | null | undefined, t: TranslateFn) {
  const windowLabel = formatDuration(windowSeconds ?? 3600);
  if (status === 'active') {
    return t('nodeDetail.policyImpact.activeDetail', { window: windowLabel });
  }
  if (status === 'historical') {
    const age = typeof ageSeconds === 'number' ? t('nodeDetail.telemetry.ageAgo', { age: formatDuration(ageSeconds) }) : t('nodeDetail.policyImpact.outsideWindow');
    return t('nodeDetail.policyImpact.historicalDetail', { age });
  }
  if (status === 'clear') return t('nodeDetail.policyImpact.clearDetail');
  return t('nodeDetail.policyImpact.pendingDetail');
}

function placementAdmissionLabel(readiness: VpnNodeHealth['system']['placement_readiness'], t: TranslateFn) {
  if (!readiness?.reported) return t('nodeDetail.admission.rolloutPending');
  if (readiness.accepting_new_sessions) return t('nodeDetail.admission.accepting');
  if (readiness.status === 'watch') return t('nodeDetail.admission.watch');
  return t('common.status.blocked');
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

function placementAdmissionDetail(readiness: VpnNodeHealth['system']['placement_readiness'], t: TranslateFn) {
  if (!readiness?.reported) {
    return t('nodeDetail.admission.rolloutPendingDetail');
  }
  return readiness.detail || readiness.reason?.replace(/_/g, ' ') || t('nodeDetail.admission.snapshotAvailable');
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

type CommercialStatusKey = 'ready' | 'degraded' | 'blocked' | 'maintenance' | 'upgrade';
type OperatorCheckStatus = 'pass' | 'warn' | 'fail' | 'pending';

interface OperatorCheckItem {
  label: string;
  status: OperatorCheckStatus;
  detail: string;
  action: string;
}

interface CommercialStatusSummary {
  key: CommercialStatusKey;
  label: string;
  detail: string;
  action: string;
}

function operatorCheckClass(status: OperatorCheckStatus) {
  if (status === 'pass') return 'border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-200';
  if (status === 'fail') return 'border-red-500/25 bg-red-500/[0.06] text-red-200';
  if (status === 'warn') return 'border-yellow-500/25 bg-yellow-500/[0.06] text-yellow-200';
  return 'border-white/10 bg-white/[0.03] text-gray-300';
}

function operatorCheckBadge(status: OperatorCheckStatus, t: TranslateFn) {
  if (status === 'pass') return t('nodeDetail.operatorBadge.ok');
  if (status === 'fail') return t('nodeDetail.operatorBadge.fix');
  if (status === 'warn') return t('nodeDetail.operatorBadge.watch');
  return t('common.status.pending');
}

function commercialStatusClass(status: CommercialStatusKey) {
  if (status === 'ready') return 'border-emerald-500/25 bg-emerald-500/[0.07]';
  if (status === 'maintenance') return 'border-sky-500/25 bg-sky-500/[0.06]';
  if (status === 'upgrade') return 'border-violet-500/25 bg-violet-500/[0.06]';
  if (status === 'blocked') return 'border-red-500/25 bg-red-500/[0.06]';
  return 'border-yellow-500/25 bg-yellow-500/[0.06]';
}

function commercialStatusBadgeClass(status: CommercialStatusKey) {
  if (status === 'ready') return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200';
  if (status === 'maintenance') return 'border-sky-500/30 bg-sky-500/15 text-sky-200';
  if (status === 'upgrade') return 'border-violet-500/30 bg-violet-500/15 text-violet-200';
  if (status === 'blocked') return 'border-red-500/30 bg-red-500/15 text-red-200';
  return 'border-yellow-500/30 bg-yellow-500/15 text-yellow-200';
}

function findHealthCheck(health: VpnNodeHealth, name: string) {
  return health.checks.find((check) => check.name === name) ?? null;
}

function aggregateHealthChecks(health: VpnNodeHealth, names: string[]): OperatorCheckStatus {
  const checks = names.map((name) => findHealthCheck(health, name)).filter(Boolean) as VpnNodeHealth['checks'];
  if (checks.length === 0) return 'pending';
  return checks.every((check) => check.ok) ? 'pass' : 'fail';
}

function checkSummary(health: VpnNodeHealth, names: string[], t: TranslateFn) {
  const checks = names.map((name) => findHealthCheck(health, name)).filter(Boolean) as VpnNodeHealth['checks'];
  if (checks.length === 0) return t('nodeDetail.health.waitingRustChecks');
  const failed = checks.filter((check) => !check.ok);
  if (failed.length === 0) return checks.map((check) => formatHealthCheckName(check.name, t)).join(', ');
  return failed.map((check) => `${formatHealthCheckName(check.name, t)}: ${check.detail}`).join(' · ');
}

function checkStatusValue(check: VpnNodeHealth['checks'][number] | null, t: TranslateFn) {
  if (!check) return t('common.status.pending');
  return check.ok ? t('common.status.ok') : t('common.status.error');
}

function checkStatusTone(check: VpnNodeHealth['checks'][number] | null) {
  if (!check) return 'border-yellow-500/20 bg-yellow-500/[0.05]';
  return check.ok ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-red-500/20 bg-red-500/[0.06]';
}

function checkDetailValue(check: VpnNodeHealth['checks'][number] | null, pending: string) {
  return check?.detail || pending;
}

function policySnapshotValue(snapshot: VpnPolicySnapshot | null | undefined, field: keyof VpnPolicySnapshot) {
  if (!snapshot) return 'pending';
  const value = snapshot[field];
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string' && value.length > 0) return value;
  return 'pending';
}

function commercialStatusSummary({
  health,
  server,
  placementReadiness,
  placementBlocked,
  runtimeMismatch,
  activePolicyImpact,
  failedChecks,
  t,
}: {
  health: VpnNodeHealth;
  server: VpnServerCandidate | null;
  placementReadiness: VpnNodeHealth['system']['placement_readiness'] | null;
  placementBlocked: boolean;
  runtimeMismatch: boolean;
  activePolicyImpact: boolean;
  failedChecks: VpnNodeHealth['checks'];
  t: (key: string, values?: Record<string, string | number>) => string;
}): CommercialStatusSummary {
  if (health.maintenance_mode) {
    return {
      key: 'maintenance',
      label: t('settings.policyEditor.maintenanceMode'),
      detail: t('nodeDetail.commercial.summaryMaintenanceDetail'),
      action: health.active_sessions > 0
        ? t('nodeDetail.commercial.summaryMaintenanceDrainAction')
        : t('nodeDetail.commercial.summaryMaintenanceEndAction'),
    };
  }
  if (health.health_status === 'offline' || (typeof health.last_seen_seconds === 'number' && health.last_seen_seconds > COMMAND_DELIVERY_DEGRADED_SECONDS)) {
    return {
      key: 'blocked',
      label: t('common.status.blocked'),
      detail: t('nodeDetail.commercial.summaryStaleDetail'),
      action: t('nodeDetail.commercial.summaryStaleAction'),
    };
  }
  if (!placementReadiness?.reported) {
    return {
      key: 'upgrade',
      label: t('services.commercial.needsRustUpgrade'),
      detail: t('nodeDetail.commercial.summaryUpgradeDetail'),
      action: t('nodeDetail.commercial.summaryUpgradeAction'),
    };
  }
  if (placementBlocked || !server?.available || placementReadiness.accepting_new_sessions === false) {
    return {
      key: 'blocked',
      label: t('common.status.blocked'),
      detail: t('nodeDetail.commercial.summaryPlacementBlockedDetail', {
        reason: formatPlacementReason(server?.unavailable_reason ?? placementReadiness.reason, t),
      }),
      action: placementNextAction(server?.unavailable_reason ?? placementReadiness.reason, t),
    };
  }
  if (runtimeMismatch || activePolicyImpact || failedChecks.length > 0 || placementReadiness.status === 'watch') {
    return {
      key: 'degraded',
      label: t('nodeDetail.commercial.summaryDegradedLabel'),
      detail: t('nodeDetail.commercial.summaryDegradedDetail'),
      action: runtimeMismatch
        ? t('nodeDetail.commercial.summaryRuntimeMismatchAction')
        : activePolicyImpact
          ? t('nodeDetail.commercial.summaryPolicyImpactAction')
          : t('nodeDetail.commercial.summaryDiagnosticsAction'),
    };
  }
  return {
    key: 'ready',
    label: t('nodeDetail.commercial.summaryReadyLabel'),
    detail: t('nodeDetail.commercial.summaryReadyDetail'),
    action: t('nodeDetail.commercial.summaryReadyAction'),
  };
}

function configDriftItems(
  health: VpnNodeHealth,
  server: VpnServerCandidate | null,
  policySync: VpnNodeHealth['system']['policy_sync'],
  t: TranslateFn
): OperatorCheckItem[] {
  const mismatches = new Set(policySync?.mismatched_fields ?? []);
  const runtime = policySync?.runtime ?? null;
  const desired = policySync?.desired ?? null;
  const endpoint = `${health.public_ip || t('common.status.pending')}:${health.port || t('common.status.pending')}`;
  const placementEndpoint = server ? `${server.address || t('nodeDetail.commercial.hiddenAddress')}:${server.port}` : t('nodeDetail.commercial.notAdvertised');
  const mtuKnown = typeof health.system.configured_mtu === 'number' || typeof health.system.running_mtu === 'number';
  const mtuMismatch = (
    typeof health.system.configured_mtu === 'number'
    && typeof health.system.running_mtu === 'number'
    && health.system.configured_mtu !== health.system.running_mtu
  );

  return [
    {
      label: t('nodeDetail.drift.maxSessions'),
      status: mismatches.has('max_sessions') ? 'fail' : policySync ? 'pass' : 'pending',
      detail: `nodeboard ${policySnapshotValue(desired, 'max_sessions')} · Rust ${policySnapshotValue(runtime, 'max_sessions')}`,
      action: mismatches.has('max_sessions') ? t('nodeDetail.drift.maxSessionsAction') : t('nodeDetail.drift.capacityAligned'),
    },
    {
      label: t('nodeDetail.drift.bandwidthLimit'),
      status: mismatches.has('bandwidth_limit_mbps') ? 'fail' : policySync ? 'pass' : 'pending',
      detail: `nodeboard ${policySnapshotValue(desired, 'bandwidth_limit_mbps')} Mbps · Rust ${policySnapshotValue(runtime, 'bandwidth_limit_mbps')} Mbps`,
      action: mismatches.has('bandwidth_limit_mbps') ? t('nodeDetail.drift.bandwidthAction') : t('nodeDetail.drift.bandwidthAligned'),
    },
    {
      label: t('settings.policyEditor.maintenanceMode'),
      status: mismatches.has('maintenance_mode') ? 'fail' : policySync ? 'pass' : 'pending',
      detail: `nodeboard ${policySnapshotValue(desired, 'maintenance_mode')} · Rust ${policySnapshotValue(runtime, 'maintenance_mode')}`,
      action: mismatches.has('maintenance_mode') ? t('nodeDetail.drift.maintenanceAction') : t('nodeDetail.drift.maintenanceAligned'),
    },
    {
      label: t('nodeDetail.drift.placementEndpoint'),
      status: !server ? 'warn' : endpoint === placementEndpoint ? 'pass' : 'warn',
      detail: `overview ${endpoint} · placement ${placementEndpoint}`,
      action: !server
        ? t('nodeDetail.drift.placementHiddenAction')
        : endpoint === placementEndpoint
          ? t('nodeDetail.drift.placementAligned')
          : t('nodeDetail.drift.placementMismatchAction'),
    },
    {
      label: t('nodeDetail.health.tunnelMtu'),
      status: !mtuKnown ? 'pending' : mtuMismatch ? 'warn' : 'pass',
      detail: `${formatTunnelMtu(health)} · ${tunnelMtuDetail(health, t)}`,
      action: mtuMismatch ? t('nodeDetail.drift.mtuMismatchAction') : t('nodeDetail.drift.mtuAligned'),
    },
  ];
}

function diagnosticItems({
  health,
  server,
  policySync,
  placementReadiness,
  t,
}: {
  health: VpnNodeHealth;
  server: VpnServerCandidate | null;
  policySync: VpnNodeHealth['system']['policy_sync'];
  placementReadiness: VpnNodeHealth['system']['placement_readiness'] | null;
  t: TranslateFn;
}): OperatorCheckItem[] {
  const heartbeatFresh = typeof health.last_seen_seconds !== 'number'
    ? 'pending'
    : health.last_seen_seconds <= COMMAND_DELIVERY_FRESH_SECONDS
      ? 'pass'
      : health.last_seen_seconds <= COMMAND_DELIVERY_DEGRADED_SECONDS
        ? 'warn'
        : 'fail';
  const routingStatus = aggregateHealthChecks(health, ['tun_device', 'ip_forward', 'nat_masquerade', 'internet_egress']);
  const udpStatus = aggregateHealthChecks(health, ['udp_listener']);
  const serviceManager = health.system.service_manager;
  const serviceStatus: OperatorCheckStatus = !serviceManager
    ? 'pending'
    : serviceManager.active_state === 'active' || serviceManager.restart_supported
      ? 'pass'
      : 'warn';
  const policyStatus: OperatorCheckStatus = !policySync
    ? 'pending'
    : policySync.status === 'synced' && policySync.mismatched_fields.length === 0
      ? 'pass'
      : 'fail';
  const placementStatus: OperatorCheckStatus = !placementReadiness?.reported
    ? 'pending'
    : server?.available && placementReadiness.accepting_new_sessions
      ? 'pass'
      : 'warn';

  return [
    {
      label: t('nodeDetail.diagnostics.heartbeat'),
      status: heartbeatFresh,
      detail: typeof health.last_seen_seconds === 'number'
        ? t('nodeDetail.diagnostics.heartbeatAge', { age: formatDuration(health.last_seen_seconds) })
        : t('nodeDetail.diagnostics.waitingSignedHeartbeat'),
      action: heartbeatFresh === 'pass' ? t('nodeDetail.diagnostics.heartbeatHealthy') : t('nodeDetail.diagnostics.heartbeatAction'),
    },
    {
      label: t('nodeDetail.diagnostics.udpListener'),
      status: udpStatus,
      detail: checkSummary(health, ['udp_listener'], t),
      action: udpStatus === 'pass' ? t('nodeDetail.diagnostics.udpHealthy') : t('nodeDetail.diagnostics.udpAction'),
    },
    {
      label: t('nodeDetail.diagnostics.tunnelRouting'),
      status: routingStatus,
      detail: checkSummary(health, ['tun_device', 'ip_forward', 'nat_masquerade', 'internet_egress'], t),
      action: routingStatus === 'pass' ? t('nodeDetail.diagnostics.routingHealthy') : t('nodeDetail.diagnostics.routingAction'),
    },
    {
      label: t('nodeDetail.diagnostics.serviceManager'),
      status: serviceStatus,
      detail: serviceManagerRuntimeDetail(health, t),
      action: serviceStatus === 'pass' ? t('nodeDetail.diagnostics.serviceHealthy') : t('nodeDetail.diagnostics.serviceAction'),
    },
    {
      label: t('nodeDetail.diagnostics.policySync'),
      status: policyStatus,
      detail: policySync?.message || t('nodeDetail.diagnostics.waitingPolicySnapshot'),
      action: policyStatus === 'pass' ? t('nodeDetail.diagnostics.policyHealthy') : t('nodeDetail.diagnostics.policyAction'),
    },
    {
      label: t('nodeDetail.diagnostics.clientPlacement'),
      status: placementStatus,
      detail: server?.available
        ? t('nodeDetail.diagnostics.advertisedRank', { rank: server.failover_rank ?? '-' })
        : t('nodeDetail.diagnostics.notAdvertisedReason', { reason: formatPlacementReason(server?.unavailable_reason ?? placementReadiness?.reason, t) }),
      action: placementStatus === 'pass' ? t('nodeDetail.diagnostics.placementHealthy') : placementNextAction(server?.unavailable_reason ?? placementReadiness?.reason, t),
    },
  ];
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
  const { t, formatNumber } = useI18n();
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
  const placementSessionsHref = `/dashboard/sessions?node=${encodeURIComponent(health.id)}&status=active&quality=all`;
  const rustAdmissionAttention = Boolean(
    placementReadiness?.reported
    && (!placementReadiness.accepting_new_sessions || placementReadiness.status === 'watch')
  );
  const needsAttention = runtimeMismatch || activePolicyImpact || rustAdmissionAttention;
  const status = placementBlocked ? 'blocked' : needsAttention ? 'attention' : 'ready';
  const statusLabel = status === 'ready'
    ? t('nodeDetail.commercial.status.ready')
    : status === 'attention'
      ? t('nodeDetail.commercial.status.attention')
      : t('nodeDetail.commercial.status.blocked');
  const placementReason = server?.unavailable_reason ?? (!server ? 'not_in_candidate_list' : null);
  const nextAction = !server
    ? t('nodeDetail.commercial.nextActionNoServer')
    : placementNextAction(server.unavailable_reason, t);
  const limitBps = bandwidthLimitBps(health.bandwidth_limit_mbps);
  const nearBandwidthCap = limitBps > 0 && typeof peakBps === 'number' && peakBps >= limitBps * 0.9;
  const telemetrySource = health.system.source || 'missing';
  const failedChecks = health.checks.filter((check) => !check.ok);
  const commercialSummary = commercialStatusSummary({
    health,
    server,
    placementReadiness,
    placementBlocked,
    runtimeMismatch,
    activePolicyImpact,
    failedChecks,
    t,
  });
  const driftItems = configDriftItems(health, server, policySync, t);
  const diagnostics = diagnosticItems({
    health,
    server,
    policySync,
    placementReadiness,
    t,
  });

  return (
    <div className={`mt-5 rounded-xl border p-4 ${readinessToneClass(status)}`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white">{t('nodeDetail.commercial.title')}</h4>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${readinessBadgeClass(status)}`}>
              {statusLabel}
            </span>
            {server?.available ? (
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300">
                {t('nodeDetail.commercial.failoverRank', { value: server.failover_rank ?? '-' })}
              </span>
            ) : null}
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${telemetrySourceClass(telemetrySource)}`}>
              {telemetrySourceLabel(telemetrySource, t)}
            </span>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${policyImpactClass(policyImpactStatus)}`}>
              {policyImpactLabel(policyImpactStatus, t)}
            </span>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${placementAdmissionBadgeClass(placementReadiness)}`}>
              {t('nodeDetail.commercial.rustAdmission', { status: placementAdmissionLabel(placementReadiness, t) })}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {server?.available
              ? t('nodeDetail.commercial.availableCopy', { address: server.address || t('nodeDetail.commercial.hiddenAddress'), port: server.port })
              : t('nodeDetail.commercial.hiddenCopy', { reason: formatPlacementReason(placementReason, t) })}
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            {t('nodeDetail.commercial.policyTelemetry', { detail: telemetrySourceDetail(telemetrySource, health.last_seen_seconds, t) })}
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            {t('nodeDetail.commercial.policyImpact', { detail: policyImpactDetail(policyImpactStatus, enforcement?.last_rejection_age_seconds, enforcement?.recent_block_window_seconds, t) })}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-400 lg:max-w-md">
          <p className="font-medium text-gray-300">{t('nodeDetail.commercial.nextOperatorAction')}</p>
          <p className="mt-1 leading-5 text-gray-500">{nextAction}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.05fr_1.35fr_1.25fr]">
        <div className={`rounded-xl border p-3 ${commercialStatusClass(commercialSummary.key)}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{t('nodeDetail.commercial.commercialStatus')}</p>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${commercialStatusBadgeClass(commercialSummary.key)}`}>
              {commercialSummary.label}
            </span>
          </div>
          <p className="mt-3 text-sm leading-5 text-gray-300">{commercialSummary.detail}</p>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-600">{t('nodeDetail.commercial.nextStep')}</p>
            <p className="mt-1 text-xs leading-5 text-gray-400">{commercialSummary.action}</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{t('nodeDetail.commercial.configDrift')}</p>
            <span className="text-xs text-gray-600">
              {t('nodeDetail.commercial.attentionCount', { count: formatNumber(driftItems.filter((item) => item.status === 'fail' || item.status === 'warn').length) })}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {driftItems.map((item) => (
              <div key={item.label} className={`rounded-lg border px-3 py-2 ${operatorCheckClass(item.status)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="mt-0.5 break-words text-[11px] leading-4 opacity-70">{item.detail}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-current/20 px-2 py-0.5 text-[10px]">
                    {operatorCheckBadge(item.status, t)}
                  </span>
                </div>
                {(item.status === 'fail' || item.status === 'warn') && (
                  <p className="mt-1 text-[11px] leading-4 opacity-75">{item.action}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{t('nodeDetail.commercial.diagnostics')}</p>
            <span className="text-xs text-gray-600">
              {t('nodeDetail.commercial.actionItems', { count: formatNumber(diagnostics.filter((item) => item.status === 'fail' || item.status === 'warn').length) })}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {diagnostics.map((item) => (
              <div key={item.label} className={`rounded-lg border px-3 py-2 ${operatorCheckClass(item.status)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="mt-0.5 break-words text-[11px] leading-4 opacity-70">{item.detail}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-current/20 px-2 py-0.5 text-[10px]">
                    {operatorCheckBadge(item.status, t)}
                  </span>
                </div>
                {(item.status === 'fail' || item.status === 'warn' || item.status === 'pending') && (
                  <p className="mt-1 text-[11px] leading-4 opacity-75">{item.action}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2 min-w-0">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.commercial.placement')}</p>
          <p className="mt-1 truncate text-base font-semibold text-white">
            {server?.available ? t('nodeDetail.commercial.advertised') : t('nodeDetail.commercial.hidden')}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-gray-600">
            {server ? formatPlacementReason(server.unavailable_reason, t) : t('nodeDetail.commercial.notInCandidateList')}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.commercial.sessionCapacity')}</p>
          <p className="mt-1 text-base font-semibold text-white">
            {sessionCapacityValue(health.active_sessions, health.max_sessions, remaining)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-600">
            {health.max_sessions > 0
              ? t('nodeDetail.commercial.slotsLeft', { count: formatNumber(remaining ?? 0) })
              : t('nodeDetail.commercial.unlimitedPolicy')}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2 min-w-0">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.commercial.rustAdmissionLabel')}</p>
          <p className={`mt-1 truncate text-base font-semibold ${
            placementReadiness?.reported && !placementReadiness.accepting_new_sessions ? 'text-yellow-200' : 'text-white'
          }`}>
            {placementAdmissionLabel(placementReadiness, t)}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-gray-600">
            {placementReadiness?.reported ? placementReadiness.reason.replace(/_/g, ' ') : t('nodeDetail.commercial.missingRuntimeField')}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.commercial.bandwidthPolicy')}</p>
          <p className={`mt-1 text-base font-semibold ${activePolicyImpact || nearBandwidthCap ? 'text-yellow-200' : 'text-white'}`}>
            {formatBandwidthLimit(health.bandwidth_limit_mbps)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-600">
            {isMetricsLoading ? t('nodeDetail.commercial.loadingPeak') : t('nodeDetail.commercial.peakValue', { value: formatBitsPerSecond(peakBps) })}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2 min-w-0">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.commercial.policySync')}</p>
          <p className={`mt-1 truncate text-base font-semibold ${runtimeMismatch ? 'text-yellow-200' : 'text-white'}`}>
            {syncStatus}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-gray-600">
            {runtimeMismatch ? policySync?.mismatched_fields?.map((field) => field.replace(/_/g, ' ')).join(', ') : t('nodeDetail.commercial.nodeboardVsRust')}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.commercial.runtimeBlocks')}</p>
          <p className={`mt-1 text-base font-semibold ${activePolicyImpact ? 'text-yellow-200' : drops + maxSessionRejects > 0 ? 'text-sky-200' : 'text-white'}`}>
            {formatNumber(drops + maxSessionRejects)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-600">
            {t('nodeDetail.commercial.runtimeBlockBreakdown', {
              sessions: formatNumber(maxSessionRejects),
              packets: formatNumber(drops),
              bytes: formatBytes(droppedBytes),
            })}
          </p>
        </div>
      </div>

      <div className={`mt-3 rounded-lg border px-3 py-2 ${placementAdmissionPanelClass(placementReadiness)}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{t('nodeDetail.commercial.runtimeAdmission')}</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {placementAdmissionLabel(placementReadiness, t)}
              {placementReadiness?.reported ? ` · ${placementReadiness.status}` : ''}
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {placementAdmissionDetail(placementReadiness, t)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs lg:min-w-[420px]">
            <div className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5">
              <p className="text-gray-600">{t('nodeDetail.commercial.sessionUse')}</p>
              <p className="mt-0.5 font-medium text-gray-300">
                {formatPercentOrPending(placementReadiness?.session_capacity_used_percent)}
              </p>
            </div>
            <div className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5">
              <p className="text-gray-600">{t('nodeDetail.commercial.slotsLeftLabel')}</p>
              <p className="mt-0.5 font-medium text-gray-300">
                {typeof placementReadiness?.session_capacity_remaining === 'number'
                  ? formatNumber(placementReadiness.session_capacity_remaining)
                  : t('common.status.pending')}
              </p>
            </div>
            <div className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5">
              <p className="text-gray-600">{t('nodeDetail.commercial.trafficStatus')}</p>
              <p className="mt-0.5 truncate font-medium text-gray-300">
                {placementReadiness?.traffic_capacity_status?.replace(/_/g, ' ') || t('common.status.pending')}
              </p>
            </div>
            <div className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5">
              <p className="text-gray-600">{t('nodeDetail.commercial.windowUse')}</p>
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
                <p className="text-[11px] uppercase tracking-wide opacity-60">{t('nodeDetail.commercial.cutoverSafety')}</p>
                <p className="mt-1 text-sm font-semibold">
                  {placementCutoverLabel(placementCutoverGuard)}
                </p>
                <p className="mt-1 text-xs leading-5 opacity-75">
                  {placementCutoverGuard?.detail || t('nodeDetail.commercial.cutoverCollecting')}
                </p>
                <p className="mt-1 text-xs leading-5 opacity-70">
                  {placementCutoverGuard?.next_step || t('nodeDetail.commercial.cutoverWait')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-[280px]">
                <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                  <p className="opacity-55">{t('nodeDetail.commercial.safeNow')}</p>
                  <p className="mt-0.5 font-medium">
                    {placementCutoverGuard ? (placementCutoverGuard.safe_to_cutover ? t('settings.policyEditor.yes') : t('settings.policyEditor.no')) : t('common.status.pending')}
                  </p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                  <p className="opacity-55">{t('nodeDetail.commercial.risk')}</p>
                  <p className="mt-0.5 truncate font-medium">
                    {placementCutoverGuard?.risk || t('common.status.pending')}
                  </p>
                </div>
              </div>
            </div>
            {placementCutoverGuard?.user_impact_if_forced && (
              <p className="mt-2 text-[11px] leading-5 opacity-65">
                {t('nodeDetail.commercial.forcedImpact', { impact: placementCutoverGuard.user_impact_if_forced })}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={placementSessionsHref}
                className="inline-flex items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/[0.08] px-3 py-1.5 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-400/[0.12]"
              >
                {t('nodeDetail.maintenance.openActiveSessions')}
              </a>
              <a
                href="#maintenance-drain"
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/[0.08]"
              >
                Maintenance drain
              </a>
            </div>
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

function bandwidthLimitBytesPerSecond(limitMbps: number | null | undefined) {
  return bandwidthLimitBps(limitMbps) / 8;
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

function commandMessage(command: NodeCommand, t: TranslateFn) {
  const message = command.result?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (command.error_message) return command.error_message;
  return t('nodeDetail.commands.waitingHeartbeatPickup');
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

function parseCommandResult(command: NodeCommand, t: TranslateFn) {
  const text = commandMessage(command, t);
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
      title: t('nodeDetail.commands.recentLogsTitle', { service: logMatch[1] }),
      summary: serviceManager || (command.status === 'completed' ? t('nodeDetail.commands.logTailCollected') : firstLine),
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
        value: match[2].trim() || t('common.status.empty'),
      });
    } else if (line.trim()) {
      bodyLines.push(line);
    }
  }

  return {
    kind: pairs.length > 0 ? 'diagnostics' as const : 'message' as const,
    title: pairs.length > 0 ? t('nodeDetail.commands.diagnosticResult') : t('nodeDetail.commands.commandResult'),
    summary: firstLine,
    pairs,
    body: bodyLines.join('\n').trim(),
  };
}

type CapacityFormatNumber = (value: number, options?: Intl.NumberFormatOptions) => string;

function capacityPercent(used: number | null | undefined, total: number | null | undefined) {
  if (typeof used !== 'number' || typeof total !== 'number' || total <= 0) return null;
  return Math.max(0, Math.min(100, (used / total) * 100));
}

function formatCapacityNumber(
  value: number | null | undefined,
  formatNumber: CapacityFormatNumber,
  fallback: string,
) {
  return typeof value === 'number' && Number.isFinite(value) ? formatNumber(value) : fallback;
}

function formatCapacityPair(
  used: number | null | undefined,
  total: number | null | undefined,
  formatNumber: CapacityFormatNumber,
  fallback: string,
) {
  if (typeof used !== 'number' || !Number.isFinite(used)) return fallback;
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) return formatNumber(used);
  return `${formatNumber(used)} / ${formatNumber(total)}`;
}

function formatCapacityBytes(value: number | null | undefined, fallback: string, decimals = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return formatBytes(value, decimals);
}

function capacityTone(percent: number | null) {
  if (percent === null) return 'border-white/5 bg-white/[0.02]';
  if (percent >= 90) return 'border-red-500/25 bg-red-500/[0.06]';
  if (percent >= 75) return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  return 'border-emerald-500/15 bg-emerald-500/[0.04]';
}

const RESOURCE_CPU_OVERLOADED_PERCENT = 85;
const RESOURCE_MEMORY_OVERLOADED_PERCENT = 90;
const RESOURCE_MEMORY_OVERLOADED_MB = 14 * 1024;

type CapacityRiskItem = {
  tone: 'critical' | 'warning';
  label: string;
  detail: string;
  action: string;
  recommendedValue?: string;
  recommendedCommand?: string;
  code?: string;
};

function capacityRiskItems(
  capacity: VpnNodeHealth['system']['capacity'] | null | undefined,
  t: TranslateFn,
  formatNumber: CapacityFormatNumber,
): CapacityRiskItem[] {
  if (!capacity?.reported) return [];

  if (Array.isArray(capacity.risks)) {
    return capacity.risks.map((risk) => {
      const code = typeof risk?.code === 'string' ? risk.code : '';
      const message = typeof risk?.message === 'string' ? risk.message.trim() : '';
      const remediation = typeof risk?.remediation === 'string' ? risk.remediation.trim() : '';
      const recommendedValue = typeof risk?.recommended_value === 'string' ? risk.recommended_value.trim() : '';
      const recommendedCommand = typeof risk?.recommended_command === 'string' ? risk.recommended_command.trim() : '';
      const severity = typeof risk?.severity === 'string' ? risk.severity : 'warning';
      const tone: CapacityRiskItem['tone'] = severity === 'critical' ? 'critical' : 'warning';
      return {
        tone,
        label: capacityRiskLabelFromCode(code, t),
        detail: message || code || t('nodeDetail.capacity.risk.description'),
        action: remediation || t('nodeDetail.capacity.risk.description'),
        recommendedValue: recommendedValue || undefined,
        recommendedCommand: recommendedCommand || undefined,
        code,
      };
    }).filter((risk) => risk.detail || risk.action);
  }

  const risks: CapacityRiskItem[] = [];
  const ipPoolCapacity = capacity.ip_pool_capacity;
  const ipPoolFree = capacity.ip_pool_free;
  const maxConnections = capacity.max_connections;
  const policyMaxSessions = capacity.policy_max_sessions;
  const conntrackPercent = capacity.conntrack?.used_percent ?? capacityPercent(capacity.conntrack?.used, capacity.conntrack?.max);
  const fdPercent = capacity.file_descriptors?.used_percent
    ?? capacityPercent(capacity.file_descriptors?.used, capacity.file_descriptors?.soft_limit);
  const packetDrops = capacity.packet_drops_total ?? capacity.interface?.packet_drops ?? null;

  if (typeof ipPoolCapacity === 'number' && typeof maxConnections === 'number' && maxConnections > ipPoolCapacity) {
    risks.push({
      tone: 'warning',
      label: t('nodeDetail.capacity.risk.ipPoolMismatch'),
      detail: t('nodeDetail.capacity.risk.ipPoolMismatchDetail', {
        max: formatNumber(maxConnections),
        pool: formatNumber(ipPoolCapacity),
      }),
      action: t('nodeDetail.capacity.risk.ipPoolMismatchAction'),
      recommendedValue: t('nodeDetail.capacity.risk.ipPoolMismatchRecommended', {
        pool: formatNumber(ipPoolCapacity),
      }),
    });
  }

  if (
    typeof ipPoolCapacity === 'number'
    && typeof policyMaxSessions === 'number'
    && policyMaxSessions > 0
    && policyMaxSessions > ipPoolCapacity
  ) {
    risks.push({
      tone: 'critical',
      label: t('nodeDetail.capacity.risk.policyMismatch'),
      detail: t('nodeDetail.capacity.risk.policyMismatchDetail', {
        policy: formatNumber(policyMaxSessions),
        pool: formatNumber(ipPoolCapacity),
      }),
      action: t('nodeDetail.capacity.risk.policyMismatchAction'),
      recommendedValue: t('nodeDetail.capacity.risk.policyMismatchRecommended', {
        pool: formatNumber(ipPoolCapacity),
      }),
    });
  }

  if (typeof ipPoolFree === 'number' && ipPoolFree <= 0) {
    risks.push({
      tone: 'critical',
      label: t('nodeDetail.capacity.risk.ipPoolExhausted'),
      detail: t('nodeDetail.capacity.risk.ipPoolExhaustedDetail'),
      action: t('nodeDetail.capacity.risk.ipPoolExhaustedAction'),
      recommendedValue: t('nodeDetail.capacity.risk.ipPoolExhaustedRecommended'),
    });
  }

  if (typeof conntrackPercent === 'number' && conntrackPercent >= 80) {
    risks.push({
      tone: conntrackPercent >= 90 ? 'critical' : 'warning',
      label: t('nodeDetail.capacity.risk.conntrack'),
      detail: t('nodeDetail.capacity.risk.conntrackDetail', {
        value: formatNumber(conntrackPercent, { maximumFractionDigits: 1 }),
      }),
      action: t('nodeDetail.capacity.risk.conntrackAction'),
      recommendedValue: t('nodeDetail.capacity.risk.conntrackRecommended'),
    });
  }

  if (typeof fdPercent === 'number' && fdPercent >= 80) {
    risks.push({
      tone: fdPercent >= 90 ? 'critical' : 'warning',
      label: t('nodeDetail.capacity.risk.fileDescriptors'),
      detail: t('nodeDetail.capacity.risk.fileDescriptorsDetail', {
        value: formatNumber(fdPercent, { maximumFractionDigits: 1 }),
      }),
      action: t('nodeDetail.capacity.risk.fileDescriptorsAction'),
      recommendedValue: t('nodeDetail.capacity.risk.fileDescriptorsRecommended'),
    });
  }

  if (typeof packetDrops === 'number' && packetDrops > 0) {
    risks.push({
      tone: 'warning',
      label: t('nodeDetail.capacity.risk.packetDrops'),
      detail: t('nodeDetail.capacity.risk.packetDropsDetail', {
        count: formatNumber(packetDrops),
      }),
      action: t('nodeDetail.capacity.risk.packetDropsAction'),
      recommendedValue: t('nodeDetail.capacity.risk.packetDropsRecommended'),
    });
  }

  return risks;
}

function resourceLoadRiskItems(
  health: VpnNodeHealth,
  t: TranslateFn,
  formatNumber: CapacityFormatNumber,
): CapacityRiskItem[] {
  const risks: CapacityRiskItem[] = [];
  const cpuUsage = typeof health.system.cpu_usage === 'number' && Number.isFinite(health.system.cpu_usage)
    ? health.system.cpu_usage
    : null;
  const memoryMb = typeof health.system.memory_mb === 'number' && Number.isFinite(health.system.memory_mb)
    ? health.system.memory_mb
    : null;
  const memoryTotalMb = typeof health.system.memory_total_mb === 'number' && Number.isFinite(health.system.memory_total_mb)
    ? health.system.memory_total_mb
    : null;
  const memoryPercent = memoryTotalMb && memoryTotalMb > 0
    ? capacityPercent(memoryMb, memoryTotalMb)
    : null;

  if (cpuUsage !== null && cpuUsage >= RESOURCE_CPU_OVERLOADED_PERCENT) {
    risks.push({
      tone: 'warning',
      label: t('nodeDetail.capacity.risk.cpuLoad'),
      detail: t('nodeDetail.capacity.risk.cpuLoadDetail', {
        value: formatNumber(cpuUsage, { maximumFractionDigits: 1 }),
      }),
      action: t('nodeDetail.capacity.risk.cpuLoadAction'),
      code: 'cpu_load_pressure',
    });
  }

  if (
    (typeof memoryPercent === 'number' && memoryPercent >= RESOURCE_MEMORY_OVERLOADED_PERCENT)
    || (memoryPercent === null && memoryMb !== null && memoryMb >= RESOURCE_MEMORY_OVERLOADED_MB)
  ) {
    risks.push({
      tone: typeof memoryPercent === 'number' && memoryPercent >= 95 ? 'critical' : 'warning',
      label: t('nodeDetail.capacity.risk.memoryLoad'),
      detail: typeof memoryPercent === 'number'
        ? t('nodeDetail.capacity.risk.memoryLoadDetailPercent', {
            value: formatNumber(memoryPercent, { maximumFractionDigits: 1 }),
            used: formatCapacityNumber(memoryMb, formatNumber, '0'),
            total: formatCapacityNumber(memoryTotalMb, formatNumber, '0'),
          })
        : t('nodeDetail.capacity.risk.memoryLoadDetailMb', {
            used: formatCapacityNumber(memoryMb, formatNumber, '0'),
          }),
      action: t('nodeDetail.capacity.risk.memoryLoadAction'),
      code: 'memory_load_pressure',
    });
  }

  return risks;
}

function capacityRiskLabelFromCode(code: string, t: TranslateFn) {
  switch (code) {
    case 'vpn_ip_pool_below_max_connections':
      return t('nodeDetail.capacity.risk.ipPoolMismatch');
    case 'vpn_ip_pool_below_policy_max_sessions':
      return t('nodeDetail.capacity.risk.policyMismatch');
    case 'vpn_ip_pool_exhausted':
      return t('nodeDetail.capacity.risk.ipPoolExhausted');
    case 'conntrack_pressure':
      return t('nodeDetail.capacity.risk.conntrack');
    case 'file_descriptor_pressure':
      return t('nodeDetail.capacity.risk.fileDescriptors');
    case 'disk_pressure':
      return t('nodeDetail.capacity.risk.diskPressure');
    case 'bandwidth_limit_pressure':
      return t('nodeDetail.capacity.risk.bandwidthLimit');
    case 'packet_drops_detected':
      return t('nodeDetail.capacity.risk.packetDrops');
    case 'cpu_load_pressure':
      return t('nodeDetail.capacity.risk.cpuLoad');
    case 'memory_load_pressure':
      return t('nodeDetail.capacity.risk.memoryLoad');
    default:
      return code ? code.replaceAll('_', ' ') : t('nodeDetail.capacity.risk.title');
  }
}

function CapacityMetric({
  label,
  value,
  detail,
  percent,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  percent?: number | null;
  tone?: string;
}) {
  const safePercent = typeof percent === 'number' && Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : null;
  return (
    <div className={`rounded-xl border p-3 min-w-0 ${tone || capacityTone(safePercent)}`}>
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-tight text-white break-words [overflow-wrap:anywhere]">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-gray-500 break-words [overflow-wrap:anywhere]">{detail}</p>
      {safePercent !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${safePercent >= 90 ? 'bg-red-300' : safePercent >= 75 ? 'bg-yellow-300' : 'bg-emerald-300'}`}
            style={{ width: `${safePercent}%` }}
          />
        </div>
      )}
    </div>
  );
}

type CapacityDecisionStatus = 'ready' | 'watch' | 'blocked' | 'unknown';

type CapacityDecision = {
  status: CapacityDecisionStatus;
  acceptLabel: string;
  remainingLabel: string;
  primaryBottleneck: string;
  primaryAction: string;
  detail: string;
  bottlenecks: Array<{
    label: string;
    detail: string;
    action: string;
    tone: CapacityRiskItem['tone'] | 'pending';
  }>;
};

function capacityDecisionClass(status: CapacityDecisionStatus) {
  if (status === 'ready') return 'border-emerald-500/20 bg-emerald-500/[0.055]';
  if (status === 'watch') return 'border-yellow-500/25 bg-yellow-500/[0.065]';
  if (status === 'blocked') return 'border-red-500/25 bg-red-500/[0.07]';
  return 'border-gray-500/20 bg-gray-500/[0.045]';
}

function capacityDecisionBadgeClass(status: CapacityDecisionStatus) {
  if (status === 'ready') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
  if (status === 'watch') return 'border-yellow-300/30 bg-yellow-300/10 text-yellow-100';
  if (status === 'blocked') return 'border-red-300/30 bg-red-300/10 text-red-100';
  return 'border-gray-400/25 bg-gray-400/10 text-gray-200';
}

function finiteCapacityValue(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function minimumKnownCapacity(values: Array<number | null | undefined>) {
  const known = values
    .map(finiteCapacityValue)
    .filter((value): value is number => value !== null)
    .map((value) => Math.max(0, value));
  return known.length > 0 ? Math.min(...known) : null;
}

function capacityDecisionSummary({
  health,
  capacity,
  riskItems,
  sessionTotal,
  t,
  formatNumber,
}: {
  health: VpnNodeHealth;
  capacity: VpnNodeHealth['system']['capacity'] | null | undefined;
  riskItems: CapacityRiskItem[];
  sessionTotal: number | null | undefined;
  t: TranslateFn;
  formatNumber: CapacityFormatNumber;
}): CapacityDecision {
  const capacityReported = Boolean(capacity?.reported);
  const placementReadiness = health.system.placement_readiness ?? null;
  const serviceManager = health.system.service_manager ?? null;
  const serviceState = serviceManager?.active_state ?? null;
  const activeSessions = finiteCapacityValue(capacity?.active_sessions) ?? health.active_sessions;
  const sessionRemaining = typeof sessionTotal === 'number' && Number.isFinite(sessionTotal) && sessionTotal > 0
    ? Math.max(0, sessionTotal - activeSessions)
    : null;
  const remaining = minimumKnownCapacity([
    capacity?.session_capacity_remaining,
    capacity?.ip_pool_free,
    placementReadiness?.session_capacity_remaining,
    sessionRemaining,
  ]);
  const criticalRisk = riskItems.find((item) => item.tone === 'critical');
  const firstRisk = criticalRisk ?? riskItems[0] ?? null;
  const bottlenecks: CapacityDecision['bottlenecks'] = riskItems.map((item) => ({
    label: item.label,
    detail: item.detail,
    action: item.action,
    tone: item.tone,
  }));

  if (!capacityReported) {
    bottlenecks.unshift({
      label: t('nodeDetail.capacity.decision.telemetryMissing'),
      detail: t('nodeDetail.capacity.decision.telemetryMissingDetail'),
      action: t('nodeDetail.capacity.decision.telemetryMissingAction'),
      tone: 'pending',
    });
  }

  if (placementReadiness?.reported && !placementReadiness.accepting_new_sessions) {
    bottlenecks.unshift({
      label: t('nodeDetail.capacity.decision.rustAdmissionBlocked'),
      detail: placementAdmissionDetail(placementReadiness, t),
      action: t('nodeDetail.capacity.decision.rustAdmissionAction'),
      tone: 'critical',
    });
  }

  if (!placementReadiness?.reported) {
    bottlenecks.push({
      label: t('nodeDetail.commercial.missingRuntimeField'),
      detail: t('nodeDetail.commercial.summaryUpgradeDetail'),
      action: t('nodeDetail.commercial.summaryUpgradeAction'),
      tone: 'pending',
    });
  }

  if (serviceState && serviceState !== 'active') {
    bottlenecks.unshift({
      label: t('nodeDetail.capacity.decision.serviceInactive'),
      detail: t('nodeDetail.capacity.decision.serviceInactiveDetail', { state: serviceState }),
      action: t('nodeDetail.capacity.decision.serviceInactiveAction'),
      tone: 'critical',
    });
  }

  const hasCriticalBottleneck = bottlenecks.some((item) => item.tone === 'critical');
  const hasWarningBottleneck = bottlenecks.some((item) => item.tone === 'warning');
  const status: CapacityDecisionStatus = !capacityReported
    ? 'unknown'
    : hasCriticalBottleneck
      ? 'blocked'
      : hasWarningBottleneck || serviceState !== 'active' || !placementReadiness?.reported
        ? 'watch'
        : 'ready';
  const primary = bottlenecks[0] ?? null;

  return {
    status,
    acceptLabel: status === 'ready'
      ? t('nodeDetail.capacity.decision.acceptYes')
      : status === 'watch'
        ? t('nodeDetail.capacity.decision.acceptWatch')
        : status === 'blocked'
          ? t('nodeDetail.capacity.decision.acceptNo')
          : t('common.status.pending'),
    remainingLabel: remaining === null ? t('common.status.pending') : formatNumber(remaining),
    primaryBottleneck: primary?.label ?? t('nodeDetail.capacity.decision.noBottleneck'),
    primaryAction: primary?.action ?? t('nodeDetail.capacity.decision.actionReady'),
    detail: status === 'ready'
      ? t('nodeDetail.capacity.decision.readyDetail')
      : status === 'unknown'
        ? t('nodeDetail.capacity.decision.unknownDetail')
        : primary?.detail ?? firstRisk?.detail ?? t('nodeDetail.capacity.risk.description'),
    bottlenecks,
  };
}

function CapacityPanel({ health }: { health: VpnNodeHealth }) {
  const { t, formatNumber } = useI18n();
  const capacity = health.system.capacity;
  const packetRuntime = health.system.packet_runtime;
  const pending = t('common.status.pending');
  const capacityReported = Boolean(capacity?.reported);
  const packetRuntimeReported = Boolean(packetRuntime?.reported);
  const packetRuntimeStatus = packetRuntime?.unknown_session_status || 'unknown';
  const packetRuntimeStatusLabel = packetRuntimeStatus === 'clear'
    ? t('nodeDetail.capacity.packetRuntimeStatus.clear')
    : packetRuntimeStatus === 'stale_after_restart'
      ? t('nodeDetail.capacity.packetRuntimeStatus.staleAfterRestart')
      : packetRuntimeStatus === 'watch'
        ? t('nodeDetail.capacity.packetRuntimeStatus.watch')
        : t('nodeDetail.capacity.packetRuntimeStatus.unknown');
  const packetRuntimeTone = packetRuntimeStatus === 'clear'
    ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
    : packetRuntimeStatus === 'stale_after_restart' || packetRuntimeStatus === 'watch'
      ? 'border-yellow-500/25 bg-yellow-500/[0.06]'
      : packetRuntimeReported
        ? 'border-white/10 bg-white/[0.03]'
        : 'border-yellow-500/20 bg-yellow-500/[0.05]';
  const ipPercent = capacityPercent(capacity?.ip_pool_used, capacity?.ip_pool_capacity);
  const sessionTotal = capacity?.policy_max_sessions && capacity.policy_max_sessions > 0
    ? capacity.policy_max_sessions
    : capacity?.max_connections;
  const sessionPercent = capacityPercent(capacity?.active_sessions ?? health.active_sessions, sessionTotal);
  const conntrackPercent = capacity?.conntrack?.used_percent ?? capacityPercent(capacity?.conntrack?.used, capacity?.conntrack?.max);
  const fdPercent = capacity?.file_descriptors?.used_percent
    ?? capacityPercent(capacity?.file_descriptors?.used, capacity?.file_descriptors?.soft_limit);
  const packetDrops = capacity?.packet_drops_total ?? capacity?.interface?.packet_drops ?? null;
  const pps = capacity?.interface?.total_pps;
  const bps = capacity?.interface?.total_bps;
  const capacityLimitBytesPerSecond = capacity?.bandwidth_limit_bytes_per_second
    ?? bandwidthLimitBytesPerSecond(capacity?.bandwidth_limit_mbps ?? health.bandwidth_limit_mbps);
  const cpuUsage = typeof health.system.cpu_usage === 'number' && Number.isFinite(health.system.cpu_usage)
    ? health.system.cpu_usage
    : null;
  const cpuCount = typeof health.system.cpu_count === 'number' && Number.isFinite(health.system.cpu_count)
    ? health.system.cpu_count
    : null;
  const memoryMb = typeof health.system.memory_mb === 'number' && Number.isFinite(health.system.memory_mb)
    ? health.system.memory_mb
    : null;
  const memoryTotalMb = typeof health.system.memory_total_mb === 'number' && Number.isFinite(health.system.memory_total_mb)
    ? health.system.memory_total_mb
    : null;
  const memoryPercent = memoryTotalMb && memoryTotalMb > 0
    ? capacityPercent(memoryMb, memoryTotalMb)
    : null;
  const diskPath = capacity?.disk?.state?.reported
    ? capacity.disk.state
    : capacity?.disk?.root?.reported
      ? capacity.disk.root
      : capacity?.disk?.state ?? capacity?.disk?.root ?? null;
  const diskPercent = diskPath?.used_percent
    ?? capacityPercent(diskPath?.used_bytes, diskPath?.total_bytes);
  const tunCheck = findHealthCheck(health, 'tun_device');
  const forwardingCheck = findHealthCheck(health, 'ip_forward');
  const natCheck = findHealthCheck(health, 'nat_masquerade');
  const egressCheck = findHealthCheck(health, 'internet_egress');
  const mtuCheck = findHealthCheck(health, 'mtu_config');
  const configuredMtu = typeof health.system.configured_mtu === 'number' ? formatNumber(health.system.configured_mtu) : pending;
  const runningMtu = typeof health.system.running_mtu === 'number' ? formatNumber(health.system.running_mtu) : pending;
  const forwardingOk = forwardingCheck?.ok === true;
  const natOk = natCheck?.ok === true;
  const egressOk = egressCheck?.ok === true;
  const routingTone = forwardingOk && natOk && egressOk
    ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
    : 'border-yellow-500/20 bg-yellow-500/[0.05]';
  const riskItems = [
    ...capacityRiskItems(capacity, t, formatNumber),
    ...resourceLoadRiskItems(health, t, formatNumber),
  ];
  const decision = capacityDecisionSummary({
    health,
    capacity,
    riskItems,
    sessionTotal,
    t,
    formatNumber,
  });
  const riskTone = riskItems.some((item) => item.tone === 'critical')
    ? 'border-red-500/25 bg-red-500/[0.07]'
    : 'border-yellow-500/25 bg-yellow-500/[0.06]';

  return (
    <div id="capacity-panel" className={`mt-5 scroll-mt-6 rounded-xl border p-4 ${capacityReported ? 'border-white/5 bg-white/[0.02]' : 'border-yellow-500/20 bg-yellow-500/[0.05]'}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white">{t('nodeDetail.capacity.title')}</h4>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${
              capacityReported ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200'
            }`}>
              {capacityReported ? t('nodeDetail.capacity.reported') : t('nodeDetail.capacity.waiting')}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {t('nodeDetail.capacity.description')}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500 lg:max-w-md">
          <p className="font-medium text-gray-300">{t('nodeDetail.capacity.source')}</p>
          <p className="mt-1 break-words [overflow-wrap:anywhere]">{capacity?.source || 'system_stats.vpn_health.capacity'}</p>
        </div>
      </div>

      <div className={`mt-4 rounded-xl border p-3 ${capacityDecisionClass(decision.status)}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-200">
                {t('nodeDetail.capacity.decision.title')}
              </p>
              <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${capacityDecisionBadgeClass(decision.status)}`}>
                {t(`nodeDetail.capacity.decision.status.${decision.status}`)}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-400">{decision.detail}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-400 lg:max-w-md">
            <p className="font-medium text-gray-200">{t('nodeDetail.capacity.decision.recommendedAction')}</p>
            <p className="mt-1 leading-5 text-gray-500">{decision.primaryAction}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CapacityMetric
            label={t('nodeDetail.capacity.decision.acceptNew')}
            value={decision.acceptLabel}
            detail={t('nodeDetail.capacity.decision.acceptDetail')}
            tone={capacityDecisionClass(decision.status)}
          />
          <CapacityMetric
            label={t('nodeDetail.capacity.decision.remainingUsers')}
            value={decision.remainingLabel}
            detail={t('nodeDetail.capacity.decision.remainingDetail')}
            tone="border-sky-500/15 bg-sky-500/[0.04]"
          />
          <CapacityMetric
            label={t('nodeDetail.capacity.decision.primaryBottleneck')}
            value={decision.primaryBottleneck}
            detail={decision.bottlenecks.length > 0
              ? t('nodeDetail.capacity.decision.bottleneckCount', { count: formatNumber(decision.bottlenecks.length) })
              : t('nodeDetail.capacity.decision.noBottleneckDetail')}
            tone={decision.status === 'blocked'
              ? 'border-red-500/25 bg-red-500/[0.07]'
              : decision.status === 'watch'
                ? 'border-yellow-500/25 bg-yellow-500/[0.06]'
                : 'border-emerald-500/15 bg-emerald-500/[0.04]'}
          />
          <CapacityMetric
            label={t('nodeDetail.capacity.decision.serviceState')}
            value={health.system.service_manager?.active_state || pending}
            detail={t('nodeDetail.capacity.decision.serviceDetail')}
            tone={health.system.service_manager?.active_state === 'active'
              ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
              : 'border-yellow-500/25 bg-yellow-500/[0.06]'}
          />
        </div>

        {decision.bottlenecks.length > 0 && (
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {decision.bottlenecks.slice(0, 4).map((item) => (
              <div
                key={`${item.label}:${item.detail}`}
                className={`rounded-lg border px-3 py-2 ${
                  item.tone === 'critical'
                    ? 'border-red-300/20 bg-red-950/20'
                    : item.tone === 'warning'
                      ? 'border-yellow-300/20 bg-yellow-950/20'
                      : 'border-gray-300/15 bg-gray-950/20'
                }`}
              >
                <p className="text-xs font-medium text-white">{item.label}</p>
                <p className="mt-1 text-[11px] leading-4 text-gray-400">{item.detail}</p>
                <p className="mt-1 text-[11px] leading-4 text-gray-300">{item.action}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {riskItems.length > 0 && (
        <div className={`mt-4 rounded-xl border p-3 ${riskTone}`}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-100">
                {t('nodeDetail.capacity.risk.title')}
              </p>
              <p className="mt-1 text-xs leading-5 text-yellow-100/80">
                {t('nodeDetail.capacity.risk.description')}
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full border border-yellow-300/25 bg-yellow-300/10 px-2 py-1 text-xs text-yellow-100">
              {t('nodeDetail.capacity.risk.count', { count: riskItems.length })}
            </span>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {riskItems.map((item) => (
              <div
                key={`${item.code || item.label}:${item.detail}`}
                className={`rounded-lg border p-3 ${
                  item.tone === 'critical'
                    ? 'border-red-300/20 bg-red-950/20'
                    : 'border-yellow-300/20 bg-yellow-950/20'
                }`}
              >
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-gray-300">{item.detail}</p>
                <p className="mt-2 text-xs leading-5 text-gray-400">{item.action}</p>
                {(item.recommendedValue || item.recommendedCommand) && (
                  <div className="mt-3 space-y-2 rounded-md border border-white/10 bg-black/20 p-2">
                    {item.recommendedValue && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          {t('nodeDetail.capacity.risk.recommendedValue')}
                        </p>
                        <p className="mt-1 break-words text-xs leading-5 text-gray-200 [overflow-wrap:anywhere]">
                          {item.recommendedValue}
                        </p>
                      </div>
                    )}
                    {item.recommendedCommand && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          {t('nodeDetail.capacity.risk.recommendedCommand')}
                        </p>
                        <code className="mt-1 block break-words rounded bg-black/30 px-2 py-1 font-mono text-[11px] leading-5 text-purple-100 [overflow-wrap:anywhere]">
                          {item.recommendedCommand}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CapacityMetric
          label={t('nodeDetail.capacity.ipPool')}
          value={formatCapacityPair(capacity?.ip_pool_used, capacity?.ip_pool_capacity, formatNumber, pending)}
          detail={t('nodeDetail.capacity.ipPoolDetail', {
            free: formatCapacityNumber(capacity?.ip_pool_free, formatNumber, pending),
            range: capacity?.virtual_ip_range || pending,
          })}
          percent={ipPercent}
        />
        <CapacityMetric
          label={t('nodeDetail.capacity.sessions')}
          value={formatCapacityPair(capacity?.active_sessions ?? health.active_sessions, sessionTotal, formatNumber, pending)}
          detail={t('nodeDetail.capacity.sessionsDetail', {
            max: formatCapacityNumber(capacity?.max_connections, formatNumber, pending),
            policy: capacity?.policy_max_sessions === 0
              ? t('nodes.policy.unlimited')
              : formatCapacityNumber(capacity?.policy_max_sessions, formatNumber, pending),
          })}
          percent={sessionPercent}
        />
        <CapacityMetric
          label={t('nodeDetail.capacity.conntrack')}
          value={formatCapacityPair(capacity?.conntrack?.used, capacity?.conntrack?.max, formatNumber, pending)}
          detail={conntrackPercent === null || conntrackPercent === undefined
            ? t('nodeDetail.capacity.kernelPending')
            : t('nodeDetail.capacity.usedPercent', { value: formatNumber(conntrackPercent, { maximumFractionDigits: 1 }) })}
          percent={conntrackPercent}
        />
        <CapacityMetric
          label={t('nodeDetail.capacity.fileDescriptors')}
          value={formatCapacityPair(capacity?.file_descriptors?.used, capacity?.file_descriptors?.soft_limit, formatNumber, pending)}
          detail={t('nodeDetail.capacity.fdDetail', {
            hard: formatCapacityNumber(capacity?.file_descriptors?.hard_limit, formatNumber, pending),
          })}
          percent={fdPercent}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CapacityMetric
          label={t('nodeDetail.capacity.cpuLoad')}
          value={cpuUsage !== null ? t('nodeDetail.capacity.cpuValue', { value: formatNumber(cpuUsage, { maximumFractionDigits: 1 }) }) : pending}
          detail={cpuCount !== null
            ? t('nodeDetail.capacity.cpuDetail', { count: formatNumber(cpuCount) })
            : t('nodeDetail.capacity.resourceHeartbeatDetail')}
          percent={cpuUsage}
        />
        <CapacityMetric
          label={t('nodeDetail.capacity.memoryUse')}
          value={memoryMb !== null && memoryTotalMb !== null
            ? t('nodeDetail.capacity.memoryValueTotal', {
                used: formatCapacityNumber(memoryMb, formatNumber, pending),
                total: formatCapacityNumber(memoryTotalMb, formatNumber, pending),
              })
            : memoryMb !== null
              ? t('nodeDetail.capacity.memoryValue', { used: formatCapacityNumber(memoryMb, formatNumber, pending) })
              : pending}
          detail={memoryPercent !== null
            ? t('nodeDetail.capacity.memoryDetailPercent', { value: formatNumber(memoryPercent, { maximumFractionDigits: 1 }) })
            : t('nodeDetail.capacity.resourceHeartbeatDetail')}
          percent={memoryPercent}
        />
        <CapacityMetric
          label={t('nodeDetail.capacity.throughput')}
          value={formatBitsPerSecond(bps)}
          detail={capacityLimitBytesPerSecond > 0
            ? t('nodeDetail.capacity.throughputDetailWithCap', {
                rx: formatBitsPerSecond(capacity?.interface?.rx_bps),
                tx: formatBitsPerSecond(capacity?.interface?.tx_bps),
                cap: formatBitsPerSecond(capacityLimitBytesPerSecond * 8),
                status: capacity?.traffic_capacity_status?.replace(/_/g, ' ') || pending,
              })
            : t('nodeDetail.capacity.throughputDetail', {
                rx: formatBitsPerSecond(capacity?.interface?.rx_bps),
                tx: formatBitsPerSecond(capacity?.interface?.tx_bps),
              })}
          tone="border-sky-500/15 bg-sky-500/[0.04]"
        />
        <CapacityMetric
          label={t('nodeDetail.capacity.packetRate')}
          value={typeof pps === 'number' ? t('nodeDetail.capacity.ppsValue', { value: formatNumber(pps, { maximumFractionDigits: 1 }) }) : pending}
          detail={t('nodeDetail.capacity.packetRateDetail', {
            rx: typeof capacity?.interface?.rx_pps === 'number' ? formatNumber(capacity.interface.rx_pps, { maximumFractionDigits: 1 }) : pending,
            tx: typeof capacity?.interface?.tx_pps === 'number' ? formatNumber(capacity.interface.tx_pps, { maximumFractionDigits: 1 }) : pending,
          })}
          tone="border-sky-500/15 bg-sky-500/[0.04]"
        />
        <CapacityMetric
          label={t('nodeDetail.capacity.packetDrops')}
          value={formatCapacityNumber(packetDrops, formatNumber, pending)}
          detail={t('nodeDetail.capacity.packetDropsDetail', {
            iface: formatCapacityNumber(capacity?.interface?.packet_drops, formatNumber, pending),
          })}
          tone={packetDrops && packetDrops > 0 ? 'border-yellow-500/25 bg-yellow-500/[0.06]' : 'border-emerald-500/15 bg-emerald-500/[0.04]'}
        />
        <CapacityMetric
          label={t('nodeDetail.capacity.packetRuntime')}
          value={formatCapacityNumber(packetRuntime?.unknown_session_packets, formatNumber, pending)}
          detail={t('nodeDetail.capacity.packetRuntimeDetail', {
            status: packetRuntimeStatusLabel,
            encrypted: formatCapacityNumber(packetRuntime?.encrypted_vpn_packets, formatNumber, pending),
            active: formatCapacityNumber(packetRuntime?.active_sessions, formatNumber, pending),
          })}
          tone={packetRuntimeTone}
        />
        <CapacityMetric
          label={t('nodeDetail.capacity.storage')}
          value={typeof diskPath?.used_bytes === 'number' && typeof diskPath?.total_bytes === 'number'
            ? `${formatCapacityBytes(diskPath.used_bytes, pending)} / ${formatCapacityBytes(diskPath.total_bytes, pending)}`
            : pending}
          detail={t('nodeDetail.capacity.storageDetail', {
            free: formatCapacityBytes(diskPath?.available_bytes, pending),
            path: diskPath?.path || pending,
          })}
          percent={diskPercent}
        />
      </div>

      <div className="mt-5 border-t border-white/5 pt-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('nodeDetail.networkRules.title')}</h5>
            <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.networkRules.description')}</p>
          </div>
          <p className="text-[11px] text-gray-600">GET /api/privacy_network/vpn/overview/ - checks[]</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CapacityMetric
            label={t('nodeDetail.networkRules.ipRange')}
            value={capacity?.virtual_ip_range || pending}
            detail={t('nodeDetail.networkRules.ipRangeDetail', {
              used: formatCapacityNumber(capacity?.ip_pool_used, formatNumber, pending),
              free: formatCapacityNumber(capacity?.ip_pool_free, formatNumber, pending),
            })}
            tone="border-white/5 bg-black/20"
          />
          <CapacityMetric
            label={t('nodeDetail.networkRules.tun')}
            value={capacity?.interface?.interface || pending}
            detail={t('nodeDetail.networkRules.tunDetail', {
              status: checkStatusValue(tunCheck, t),
              configured: configuredMtu,
              running: runningMtu,
              mtu: checkStatusValue(mtuCheck, t),
            })}
            tone={checkStatusTone(tunCheck)}
          />
          <CapacityMetric
            label={t('nodeDetail.networkRules.forwarding')}
            value={checkStatusValue(forwardingCheck, t)}
            detail={checkDetailValue(forwardingCheck, pending)}
            tone={checkStatusTone(forwardingCheck)}
          />
          <CapacityMetric
            label={t('nodeDetail.networkRules.natEgress')}
            value={natOk && egressOk ? t('common.status.ok') : natCheck || egressCheck ? t('common.status.attention') : pending}
            detail={t('nodeDetail.networkRules.natEgressDetail', {
              nat: checkDetailValue(natCheck, pending),
              egress: checkDetailValue(egressCheck, pending),
            })}
            tone={routingTone}
          />
        </div>
      </div>
    </div>
  );
}

function shortRuntimeValue(value: string | null | undefined, maxLength = 18) {
  if (!value) return 'pending';
  return value.length > maxLength ? `${value.slice(0, maxLength)}` : value;
}

function recentErrorTone(severity: string | null | undefined) {
  switch (severity) {
    case 'critical':
      return 'border-red-500/25 bg-red-500/[0.07] text-red-100';
    case 'warning':
      return 'border-yellow-500/25 bg-yellow-500/[0.06] text-yellow-100';
    default:
      return 'border-sky-500/20 bg-sky-500/[0.05] text-sky-100';
  }
}

function RecentOperationalEventsPanel({ health }: { health: VpnNodeHealth }) {
  const { t } = useI18n();
  const recentErrors = health.system.recent_errors;
  const events = Array.isArray(recentErrors?.events) ? recentErrors.events : [];
  const reported = Boolean(recentErrors?.reported);

  return (
    <div id="recent-operational-events" className={`mt-5 scroll-mt-6 rounded-xl border p-4 ${
      events.length > 0
        ? 'border-yellow-500/20 bg-yellow-500/[0.04]'
        : reported
          ? 'border-emerald-500/15 bg-emerald-500/[0.03]'
          : 'border-white/5 bg-white/[0.02]'
    }`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white">{t('nodeDetail.recentErrors.title')}</h4>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${
              events.length > 0
                ? 'border-yellow-500/25 bg-yellow-500/10 text-yellow-100'
                : reported
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 bg-white/[0.03] text-gray-400'
            }`}>
              {events.length > 0
                ? t('nodeDetail.recentErrors.count', { count: events.length })
                : reported
                  ? t('nodeDetail.recentErrors.clear')
                  : t('nodeDetail.recentErrors.waiting')}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.recentErrors.description')}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500 lg:max-w-md">
          <p className="font-medium text-gray-300">{t('nodeDetail.recentErrors.source')}</p>
          <p className="mt-1 break-words [overflow-wrap:anywhere]">{recentErrors?.source || 'system_stats.vpn_health.recent_errors'}</p>
        </div>
      </div>

      {events.length > 0 ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {events.slice(0, 6).map((event, index) => (
            <div
              key={`${event.timestamp || index}:${event.message}`}
              className={`rounded-lg border p-3 ${recentErrorTone(event.severity)}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] uppercase">
                  {event.severity || 'warning'}
                </span>
                <span className="text-[11px] text-gray-400">
                  {event.timestamp ? formatRelativeTime(event.timestamp) : t('common.status.pending')}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-200 break-words [overflow-wrap:anywhere]">
                {event.message}
              </p>
              {event.source ? (
                <p className="mt-2 text-[11px] text-gray-500 break-words [overflow-wrap:anywhere]">{event.source}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs leading-5 text-gray-500">
          {reported ? t('nodeDetail.recentErrors.empty') : t('nodeDetail.recentErrors.notReported')}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-5 text-gray-600">
        {recentErrors?.privacy_boundary || t('nodeDetail.recentErrors.privacy')}
      </p>
    </div>
  );
}

type OperatorActionTone = 'ok' | 'warning' | 'critical' | 'info' | 'pending';

function operatorActionToneClass(tone: OperatorActionTone) {
  switch (tone) {
    case 'critical':
      return 'border-red-500/25 bg-red-500/[0.07]';
    case 'warning':
      return 'border-yellow-500/25 bg-yellow-500/[0.06]';
    case 'ok':
      return 'border-emerald-500/20 bg-emerald-500/[0.04]';
    case 'pending':
      return 'border-gray-500/20 bg-gray-500/[0.04]';
    default:
      return 'border-sky-500/20 bg-sky-500/[0.04]';
  }
}

function operatorActionBadgeClass(tone: OperatorActionTone) {
  switch (tone) {
    case 'critical':
      return 'border-red-400/25 bg-red-400/10 text-red-100';
    case 'warning':
      return 'border-yellow-400/25 bg-yellow-400/10 text-yellow-100';
    case 'ok':
      return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100';
    case 'pending':
      return 'border-gray-400/20 bg-gray-400/10 text-gray-300';
    default:
      return 'border-sky-400/25 bg-sky-400/10 text-sky-100';
  }
}

function rustOperatorActionTone(status: string | undefined | null): OperatorActionTone {
  switch (status) {
    case 'critical':
      return 'critical';
    case 'warning':
      return 'warning';
    case 'ok':
      return 'ok';
    case 'info':
      return 'info';
    default:
      return 'pending';
  }
}

function rustOperatorActionHref(source: string | undefined | null, priority: string | undefined | null) {
  const value = `${source || ''} ${priority || ''}`.toLowerCase();
  if (value.includes('capacity')) return '#capacity-panel';
  if (value.includes('upgrade')) return '#upgrade-workflow';
  if (value.includes('service_manager') || value.includes('service_not_active')) return '#operator-runbook';
  if (value.includes('runtime') || value.includes('restart')) return '#runtime-panel';
  if (value.includes('recent')) return '#recent-operational-events';
  if (value.includes('check') || value.includes('health')) return '#health-checks';
  return '#operator-runbook';
}

function rustOperatorActionMeta(status: string | undefined | null, priority: string | undefined | null, t: TranslateFn) {
  if (!status && !priority) return t('nodeDetail.operatorActions.meta.waiting');
  return String(status || priority || '').replace(/_/g, ' ');
}

function OperatorActionCard({
  tone,
  title,
  detail,
  meta,
  href,
  cta,
}: {
  tone: OperatorActionTone;
  title: string;
  detail: string;
  meta: string;
  href: string;
  cta: string;
}) {
  return (
    <a
      href={href}
      className={`block min-h-[168px] rounded-xl border p-4 transition hover:border-white/25 hover:bg-white/[0.06] ${operatorActionToneClass(tone)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs leading-5 text-gray-400">{detail}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${operatorActionBadgeClass(tone)}`}>
          {meta}
        </span>
      </div>
      <p className="mt-4 text-xs font-medium text-purple-200">{cta}</p>
    </a>
  );
}

function NodeInstallStatusPanel({
  installStatus,
}: {
  installStatus?: NodeInstallProgressSummary | null;
}) {
  const { t, formatRelativeTime: i18nRelativeTime } = useI18n();
  const status = installStatus?.status || 'not_started';
  const step = installStatus?.step || '';
  const message = installStatus?.message || t('codes.installProgress.noMessage');
  const reported = Boolean(installStatus?.last_reported_at || installStatus?.used_at || status !== 'not_started');
  const tone = installWorkflowTone(status, reported);
  const recommendation = installRecommendation(status, step, t);

  return (
    <div id="install-workflow" className={`mb-6 scroll-mt-6 rounded-xl border p-4 ${operatorActionToneClass(tone)}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{t('nodeDetail.installWorkflow.title')}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.installWorkflow.description')}</p>
        </div>
        <span className={`w-fit rounded-full border px-2 py-1 text-xs uppercase tracking-wide ${operatorActionBadgeClass(tone)}`}>
          {installWorkflowMeta(status, reported, t)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-600">{t('nodeDetail.installWorkflow.step')}</p>
          <p className="mt-1 text-sm font-medium text-white">{installStepLabel(step, t)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-600">{t('nodeDetail.installWorkflow.codeStatus')}</p>
          <p className="mt-1 text-sm font-medium text-white">
            {installStatus?.code_status ? t(`codes.status.${installStatus.code_status}`) : t('common.status.pending')}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-600">{t('nodeDetail.installWorkflow.lastReported')}</p>
          <p className="mt-1 text-sm font-medium text-white">
            {installStatus?.last_reported_at ? i18nRelativeTime(installStatus.last_reported_at) : t('common.status.pending')}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-600">{t('nodeDetail.installWorkflow.source')}</p>
          <p className="mt-1 truncate text-sm font-medium text-white">
            {installStatus?.source || 'registration_code_install_progress'}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-xs leading-5 text-gray-300">{message}</p>
        <p className="mt-2 text-xs leading-5 text-purple-100/70">{installNextAction(status, step, t)}</p>
        {recommendation ? (
          <p className="mt-2 text-xs leading-5 text-yellow-100/80">{recommendation}</p>
        ) : null}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-gray-600">
        {installStatus?.privacy_boundary || t('nodeDetail.installWorkflow.privacyBoundary')}
      </p>
    </div>
  );
}

function OperatorActionsPanel({
  health,
  installStatus,
  failedChecksCount,
  activeCommandCount,
  failedCommandCount,
  maintenanceMode,
  restartReady,
}: {
  health: VpnNodeHealth;
  installStatus?: NodeInstallProgressSummary | null;
  failedChecksCount: number;
  activeCommandCount: number;
  failedCommandCount: number;
  maintenanceMode: boolean;
  restartReady: boolean;
}) {
  const { t, formatNumber } = useI18n();
  const capacityRisks = capacityRiskItems(health.system.capacity, t, formatNumber);
  const recentErrors = health.system.recent_errors;
  const eventCount = Array.isArray(recentErrors?.events) ? recentErrors.events.length : 0;
  const eventsReported = Boolean(recentErrors?.reported);
  const rollout = runtimeRolloutForNode(health);
  const restartRequired = Boolean(rollout?.restart_required);
  const upgradeStatus = health.system.upgrade_status ?? null;
  const rustAction = health.system.operator_action ?? null;
  const upgradeReported = Boolean(upgradeStatus?.reported);
  const upgradeStatusValue = upgradeStatus?.status ?? null;
  const installStatusValue = installStatus?.status ?? null;
  const installStep = installStatus?.step ?? '';
  const installReported = Boolean(
    installStatus?.last_reported_at
    || installStatus?.used_at
    || (installStatusValue && installStatusValue !== 'not_started')
  );
  const runtimeReported = Boolean(
    health.system.runtime
    || health.system.runtime_version
    || health.system.runtime_started_at
    || health.system.operator_status?.runtime_rollout
  );
  const hasCriticalCapacity = capacityRisks.some((risk) => risk.tone === 'critical');
  const capacityTone: OperatorActionTone = capacityRisks.length > 0
    ? (hasCriticalCapacity ? 'critical' : 'warning')
    : health.system.capacity?.reported ? 'ok' : 'pending';
  const healthTone: OperatorActionTone = failedChecksCount > 0
    ? (health.health_status === 'offline' || health.health_status === 'overloaded' ? 'critical' : 'warning')
    : 'ok';
  const runtimeTone: OperatorActionTone = restartRequired ? 'warning' : runtimeReported ? 'ok' : 'pending';
  const installTone = installWorkflowTone(installStatusValue, installReported);
  const upgradeTone = upgradeWorkflowTone(upgradeStatusValue, upgradeReported);
  const eventsTone: OperatorActionTone = eventCount > 0 ? 'warning' : eventsReported ? 'ok' : 'pending';
  const commandTone: OperatorActionTone = failedCommandCount > 0 ? 'warning' : activeCommandCount > 0 ? 'info' : 'ok';
  const restartTone: OperatorActionTone = restartRequired
    ? (restartReady ? 'warning' : 'critical')
    : maintenanceMode ? 'info' : 'ok';
  const rustActionTone = rustOperatorActionTone(rustAction?.status);

  const actions = [
    {
      key: 'rust-operator-action',
      tone: rustActionTone,
      title: rustAction?.title || t('nodeDetail.operatorActions.rust.title'),
      detail: rustAction?.next_step || rustAction?.detail || t('nodeDetail.operatorActions.rust.waitingDetail'),
      meta: rustOperatorActionMeta(rustAction?.status, rustAction?.priority, t),
      href: rustOperatorActionHref(rustAction?.source, rustAction?.priority),
      cta: rustAction?.source
        ? t('nodeDetail.operatorActions.rust.cta', { source: rustAction.source })
        : t('nodeDetail.operatorActions.rust.waitingCta'),
    },
    {
      key: 'settings',
      tone: 'info' as OperatorActionTone,
      title: t('nodeDetail.operatorActions.settings.title'),
      detail: t('nodeDetail.operatorActions.settings.detail'),
      meta: t('nodeDetail.operatorActions.settings.meta'),
      href: '#node-settings',
      cta: t('nodeDetail.operatorActions.settings.cta'),
    },
    {
      key: 'install',
      tone: installTone,
      title: t('nodeDetail.operatorActions.install.title'),
      detail: installReported
        ? t('nodeDetail.operatorActions.install.reportedDetail', {
          status: installWorkflowMeta(installStatusValue, installReported, t),
          step: installStepLabel(installStep, t),
        })
        : t('nodeDetail.operatorActions.install.waitingDetail'),
      meta: installWorkflowMeta(installStatusValue, installReported, t),
      href: '#install-workflow',
      cta: t('nodeDetail.operatorActions.install.cta'),
    },
    {
      key: 'capacity',
      tone: capacityTone,
      title: t('nodeDetail.operatorActions.capacity.title'),
      detail: capacityRisks.length > 0
        ? t('nodeDetail.operatorActions.capacity.riskDetail', { count: formatNumber(capacityRisks.length) })
        : health.system.capacity?.reported
          ? t('nodeDetail.operatorActions.capacity.clearDetail')
          : t('nodeDetail.operatorActions.capacity.waitingDetail'),
      meta: capacityRisks.length > 0
        ? t('nodeDetail.operatorActions.capacity.riskMeta', { count: formatNumber(capacityRisks.length) })
        : health.system.capacity?.reported
          ? t('nodeDetail.operatorActions.meta.clear')
          : t('nodeDetail.operatorActions.meta.waiting'),
      href: '#capacity-panel',
      cta: t('nodeDetail.operatorActions.capacity.cta'),
    },
    {
      key: 'health',
      tone: healthTone,
      title: t('nodeDetail.operatorActions.health.title'),
      detail: failedChecksCount > 0
        ? t('nodeDetail.operatorActions.health.failedDetail', { count: formatNumber(failedChecksCount) })
        : t('nodeDetail.operatorActions.health.clearDetail'),
      meta: failedChecksCount > 0
        ? t('nodeDetail.operatorActions.health.failedMeta', { count: formatNumber(failedChecksCount) })
        : t('nodeDetail.operatorActions.meta.clear'),
      href: '#health-checks',
      cta: t('nodeDetail.operatorActions.health.cta'),
    },
    {
      key: 'events',
      tone: eventsTone,
      title: t('nodeDetail.operatorActions.events.title'),
      detail: eventCount > 0
        ? t('nodeDetail.operatorActions.events.hasEventsDetail', { count: formatNumber(eventCount) })
        : eventsReported
          ? t('nodeDetail.operatorActions.events.clearDetail')
          : t('nodeDetail.operatorActions.events.waitingDetail'),
      meta: eventCount > 0
        ? t('nodeDetail.operatorActions.events.eventMeta', { count: formatNumber(eventCount) })
        : eventsReported
          ? t('nodeDetail.operatorActions.meta.clear')
          : t('nodeDetail.operatorActions.meta.waiting'),
      href: '#recent-operational-events',
      cta: t('nodeDetail.operatorActions.events.cta'),
    },
    {
      key: 'runtime',
      tone: runtimeTone,
      title: t('nodeDetail.operatorActions.runtime.title'),
      detail: restartRequired
        ? t('nodeDetail.operatorActions.runtime.restartDetail')
        : runtimeReported
          ? t('nodeDetail.operatorActions.runtime.clearDetail')
          : t('nodeDetail.operatorActions.runtime.waitingDetail'),
      meta: restartRequired
        ? t('nodeDetail.operatorActions.runtime.restartMeta')
        : runtimeReported
          ? t('nodeDetail.operatorActions.meta.clear')
          : t('nodeDetail.operatorActions.meta.waiting'),
      href: '#runtime-panel',
      cta: t('nodeDetail.operatorActions.runtime.cta'),
    },
    {
      key: 'upgrade',
      tone: upgradeTone,
      title: t('nodeDetail.operatorActions.upgrade.title'),
      detail: upgradeReported
        ? t('nodeDetail.operatorActions.upgrade.reportedDetail', {
          status: upgradeWorkflowMeta(upgradeStatusValue, upgradeReported, t),
          step: upgradeStatus?.step || t('common.status.pending'),
        })
        : t('nodeDetail.operatorActions.upgrade.waitingDetail'),
      meta: upgradeWorkflowMeta(upgradeStatusValue, upgradeReported, t),
      href: '#upgrade-workflow',
      cta: t('nodeDetail.operatorActions.upgrade.cta'),
    },
    {
      key: 'commands',
      tone: commandTone,
      title: t('nodeDetail.operatorActions.commands.title'),
      detail: failedCommandCount > 0
        ? t('nodeDetail.operatorActions.commands.failedDetail', { count: formatNumber(failedCommandCount) })
        : activeCommandCount > 0
          ? t('nodeDetail.operatorActions.commands.activeDetail', { count: formatNumber(activeCommandCount) })
          : t('nodeDetail.operatorActions.commands.clearDetail'),
      meta: failedCommandCount > 0
        ? t('nodeDetail.operatorActions.commands.failedMeta', { count: formatNumber(failedCommandCount) })
        : activeCommandCount > 0
          ? t('nodeDetail.operatorActions.commands.activeMeta', { count: formatNumber(activeCommandCount) })
          : t('nodeDetail.operatorActions.meta.clear'),
      href: '#vpn-commands',
      cta: t('nodeDetail.operatorActions.commands.cta'),
    },
    {
      key: 'restart',
      tone: restartTone,
      title: t('nodeDetail.operatorActions.restart.title'),
      detail: restartRequired
        ? restartReady
          ? t('nodeDetail.operatorActions.restart.readyDetail')
          : t('nodeDetail.operatorActions.restart.blockedDetail')
        : maintenanceMode
          ? t('nodeDetail.operatorActions.restart.maintenanceDetail')
          : t('nodeDetail.operatorActions.restart.clearDetail'),
      meta: restartRequired
        ? restartReady
          ? t('nodeDetail.operatorActions.restart.readyMeta')
          : t('nodeDetail.operatorActions.restart.blockedMeta')
        : maintenanceMode
          ? t('nodeDetail.operatorActions.restart.maintenanceMeta')
          : t('nodeDetail.operatorActions.meta.clear'),
      href: '#maintenance-drain',
      cta: t('nodeDetail.operatorActions.restart.cta'),
    },
    {
      key: 'runbook',
      tone: 'info' as OperatorActionTone,
      title: t('nodeDetail.operatorActions.runbook.title'),
      detail: t('nodeDetail.operatorActions.runbook.detail'),
      meta: t('nodeDetail.operatorActions.runbook.meta'),
      href: '#operator-runbook',
      cta: t('nodeDetail.operatorActions.runbook.cta'),
    },
  ];

  return (
    <div id="operator-actions" className="mt-5 scroll-mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white">{t('nodeDetail.operatorActions.title')}</h4>
          <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.operatorActions.description')}</p>
        </div>
        <span className="w-fit rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-400">
          {t('nodeDetail.operatorActions.scope')}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {actions.map(({ key, ...action }) => (
          <OperatorActionCard key={key} {...action} />
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-gray-600">{t('nodeDetail.operatorActions.privacyBoundary')}</p>
    </div>
  );
}

function runtimeStartedLabel(startedAt: number | string | null | undefined) {
  if (typeof startedAt === 'number' && Number.isFinite(startedAt) && startedAt > 0) {
    return formatUnixSecondsRelative(startedAt);
  }
  if (typeof startedAt === 'string' && startedAt.trim()) {
    return formatRelativeTime(startedAt);
  }
  return 'pending';
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function runtimeRolloutForNode(health: VpnNodeHealth) {
  return health.system.runtime?.rollout ?? health.system.operator_status?.runtime_rollout ?? null;
}

function upgradeWorkflowTone(status?: string | null, reported?: boolean): OperatorActionTone {
  switch ((status || '').toLowerCase()) {
    case 'failed':
    case 'unreadable':
      return 'warning';
    case 'running':
      return 'info';
    case 'completed':
      return 'ok';
    default:
      return reported ? 'info' : 'pending';
  }
}

function upgradeWorkflowMeta(status: string | null | undefined, reported: boolean, t: TranslateFn) {
  switch ((status || '').toLowerCase()) {
    case 'failed':
      return t('nodeDetail.upgradeWorkflow.meta.failed');
    case 'running':
      return t('nodeDetail.upgradeWorkflow.meta.running');
    case 'completed':
      return t('nodeDetail.upgradeWorkflow.meta.completed');
    case 'unreadable':
      return t('nodeDetail.upgradeWorkflow.meta.unreadable');
    default:
      return reported ? t('nodeDetail.upgradeWorkflow.meta.reported') : t('nodeDetail.operatorActions.meta.waiting');
  }
}

function upgradeWorkflowAction(status: string | null | undefined, reported: boolean, t: TranslateFn) {
  switch ((status || '').toLowerCase()) {
    case 'failed':
      return t('nodeDetail.upgradeWorkflow.action.failed');
    case 'running':
      return t('nodeDetail.upgradeWorkflow.action.running');
    case 'completed':
      return t('nodeDetail.upgradeWorkflow.action.completed');
    case 'unreadable':
      return t('nodeDetail.upgradeWorkflow.action.unreadable');
    default:
      return reported
        ? t('nodeDetail.upgradeWorkflow.action.reported')
        : t('nodeDetail.upgradeWorkflow.action.waiting');
  }
}

function installWorkflowTone(status?: string | null, reported?: boolean): OperatorActionTone {
  switch ((status || '').toLowerCase()) {
    case 'failed':
      return 'warning';
    case 'running':
    case 'planning':
      return 'info';
    case 'completed':
      return 'ok';
    default:
      return reported ? 'info' : 'pending';
  }
}

function installWorkflowMeta(status: string | null | undefined, reported: boolean, t: TranslateFn) {
  const normalized = (status || 'not_started').toLowerCase();
  const key = `codes.installProgress.status.${normalized}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return reported ? normalized.replace(/_/g, ' ') : t('nodeDetail.installWorkflow.meta.waiting');
}

function installStepLabel(step: string | null | undefined, t: TranslateFn) {
  const normalized = (step || '').trim();
  if (!normalized) return t('codes.installProgress.waiting');
  const key = `codes.installProgress.stage.${normalized}`;
  const translated = t(key);
  return translated === key ? normalized.replace(/_/g, ' ') : translated;
}

function installNextAction(status: string | null | undefined, step: string | null | undefined, t: TranslateFn) {
  const normalizedStatus = (status || 'not_started').toLowerCase();
  const normalizedStep = (step || '').trim();
  const keys = [
    normalizedStatus === 'failed' ? 'codes.installProgress.next.failed' : '',
    normalizedStep ? `codes.installProgress.next.${normalizedStep}` : '',
    `codes.installProgress.next.${normalizedStatus}`,
    'codes.installProgress.next.running',
  ].filter(Boolean);

  for (const key of keys) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return t('codes.installProgress.next.running');
}

function installRecommendation(status: string | null | undefined, step: string | null | undefined, t: TranslateFn) {
  if ((status || '').toLowerCase() !== 'failed') return '';
  const normalizedStep = (step || '').trim();
  const stepKey = normalizedStep ? `codes.installProgress.recommendation.${normalizedStep}` : '';
  if (stepKey) {
    const translated = t(stepKey);
    if (translated !== stepKey) return translated;
  }
  return t('codes.installProgress.recommendation.default');
}

function inferRustRepoDir(health: VpnNodeHealth) {
  const executablePath = runtimeRolloutForNode(health)?.executable_path?.replace(/\s+\(deleted\)$/, '').trim();
  const suffix = '/target/release/aeronyx-server';
  if (executablePath?.endsWith(suffix)) {
    return executablePath.slice(0, -suffix.length);
  }
  return '/root/open/AeroNyx';
}

function OperatorCommandCard({
  title,
  detail,
  command,
}: {
  title: string;
  detail: string;
  command: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-300">{title}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
        </div>
        <CopyButton text={command} />
      </div>
      <code className="block max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 px-3 py-2 font-mono text-xs leading-5 text-gray-400">
        {command}
      </code>
    </div>
  );
}

function OperatorRunbookPanel({ health }: { health: VpnNodeHealth }) {
  const { t } = useI18n();
  const repoDir = inferRustRepoDir(health);
  const repoParentDir = repoDir.split('/').slice(0, -1).join('/') || '/root/open';
  const quotedRepoDir = shellQuote(repoDir);
  const quotedRepoParentDir = shellQuote(repoParentDir);
  const cdRepo = `cd ${quotedRepoDir}`;
  const healthCommand = `${cdRepo} && ./deploy/node/aeronyx-node.sh health --repo-dir ${quotedRepoDir} --json`;
  const statusCommand = `${cdRepo} && ./deploy/node/aeronyx-node.sh status --repo-dir ${quotedRepoDir}`;
  const logsCommand = `${cdRepo} && ./deploy/node/aeronyx-node.sh logs --repo-dir ${quotedRepoDir} --lines 200`;
  const upgradeCommand = `${cdRepo} && sudo ./deploy/node/aeronyx-node.sh upgrade --repo-dir ${quotedRepoDir} --branch main --no-restart`;
  const aiPrompt = [
    'You are helping me maintain an AeroNyx privacy protocol node.',
    '',
    'The operator script comes from the AeroNyx GitHub repository:',
    'https://github.com/AeroNyxNetwork/AeroNyx',
    'After cloning or updating the repository, the script path is:',
    'AeroNyx/deploy/node/aeronyx-node.sh',
    '',
    'Rules:',
    '1. Use deploy/node/aeronyx-node.sh as the only operator entrypoint.',
    '2. Start with read-only status. Summarize operator_status, operator_title, operator_detail, and operator_next_step before running deeper health JSON diagnostics.',
    '3. Do not print private keys, API secrets, registration codes, wallet-level data, DNS contents, destinations, packet payloads, chat plaintext, or client public IPs.',
    '4. Use upgrade --no-restart for staged builds unless I approve a maintenance-window restart.',
    '5. Do not use --force unless I explicitly approve disruption to active sessions.',
    '',
    `REPO_DIR=${repoDir}`,
    'BRANCH=main',
    '',
    'Start with:',
    `mkdir -p ${quotedRepoParentDir}`,
    `cd ${quotedRepoParentDir}`,
    `if [ -d ${quotedRepoDir}/.git ]; then cd ${quotedRepoDir} && git fetch origin main && git checkout main && git pull --ff-only origin main; else git clone https://github.com/AeroNyxNetwork/AeroNyx.git ${quotedRepoDir} && cd ${quotedRepoDir}; fi`,
    `cd ${quotedRepoDir}`,
    './deploy/node/aeronyx-node.sh status --repo-dir "$REPO_DIR"',
    './deploy/node/aeronyx-node.sh health --repo-dir "$REPO_DIR" --json',
  ].join('\n');

  return (
    <div id="operator-runbook" className="mt-5 scroll-mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-white">{t('nodeDetail.operatorRunbook.title')}</h4>
          <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.operatorRunbook.description')}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500 lg:max-w-md">
          <p className="font-medium text-gray-300">{t('nodeDetail.operatorRunbook.repoPath')}</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-gray-400">{repoDir}</code>
            <CopyButton text={repoDir} />
          </div>
          <p className="mt-1 leading-5">{t('nodeDetail.operatorRunbook.repoDetail')}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <OperatorCommandCard
          title={t('nodeDetail.operatorRunbook.statusTitle')}
          detail={t('nodeDetail.operatorRunbook.statusDetail')}
          command={statusCommand}
        />
        <OperatorCommandCard
          title={t('nodeDetail.operatorRunbook.healthTitle')}
          detail={t('nodeDetail.operatorRunbook.healthDetail')}
          command={healthCommand}
        />
        <OperatorCommandCard
          title={t('nodeDetail.operatorRunbook.logsTitle')}
          detail={t('nodeDetail.operatorRunbook.logsDetail')}
          command={logsCommand}
        />
        <OperatorCommandCard
          title={t('nodeDetail.operatorRunbook.upgradeTitle')}
          detail={t('nodeDetail.operatorRunbook.upgradeDetail')}
          command={upgradeCommand}
        />
      </div>

      <div className="mt-3 rounded-lg border border-purple-500/15 bg-purple-500/[0.05] p-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-100">{t('nodeDetail.operatorRunbook.aiPromptTitle')}</p>
            <p className="mt-1 text-xs leading-5 text-purple-100/60">{t('nodeDetail.operatorRunbook.aiPromptDetail')}</p>
          </div>
          <CopyButton text={aiPrompt} />
        </div>
        <code className="block max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 px-3 py-2 font-mono text-xs leading-5 text-gray-400">
          {aiPrompt}
        </code>
      </div>

      <p className="mt-3 text-xs leading-5 text-gray-600">{t('nodeDetail.operatorRunbook.privacyBoundary')}</p>
    </div>
  );
}

function RuntimeVersionPanel({ health }: { health: VpnNodeHealth }) {
  const { t, formatNumber } = useI18n();
  const runtime = health.system.runtime;
  const rollout = runtimeRolloutForNode(health);
  const version = runtime?.version ?? health.system.runtime_version ?? health.version;
  const gitCommit = runtime?.git_commit ?? health.system.runtime_git_commit ?? null;
  const buildProfile = runtime?.build_profile ?? health.system.runtime_build_profile ?? null;
  const buildTarget = runtime?.build_target ?? health.system.runtime_build_target ?? null;
  const processId = runtime?.process_id ?? health.system.runtime_process_id ?? null;
  const startedAt = runtime?.started_at ?? health.system.runtime_started_at ?? null;
  const uptimeSeconds = runtime?.uptime_seconds ?? health.system.runtime_uptime_seconds ?? null;
  const restartRequired = Boolean(rollout?.restart_required);
  const runtimeReported = Boolean(runtime || health.system.runtime_version || health.system.runtime_started_at || health.system.operator_status?.runtime_rollout);

  return (
    <div id="runtime-panel" className={`mt-5 scroll-mt-6 rounded-xl border p-4 ${restartRequired ? 'border-yellow-500/25 bg-yellow-500/[0.06]' : runtimeReported ? 'border-white/5 bg-white/[0.02]' : 'border-gray-500/20 bg-gray-500/[0.04]'}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white">{t('nodeDetail.runtime.title')}</h4>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${
              restartRequired
                ? 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200'
                : runtimeReported
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                  : 'border-gray-500/25 bg-gray-500/10 text-gray-300'
            }`}>
              {restartRequired
                ? t('nodeDetail.runtime.restartRequired')
                : runtimeReported
                  ? t('nodeDetail.runtime.reported')
                  : t('common.status.pending')}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.runtime.description')}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500 lg:max-w-md">
          <p className="font-medium text-gray-300">{t('nodeDetail.runtime.operatorAction')}</p>
          <p className="mt-1 leading-5">
            {restartRequired
              ? (rollout?.detail || t('nodeDetail.runtime.restartAction'))
              : t('nodeDetail.runtime.monitorAction')}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CapacityMetric
          label={t('nodeDetail.runtime.version')}
          value={version || t('common.status.pending')}
          detail={t('nodeDetail.runtime.gitCommit', { commit: shortRuntimeValue(gitCommit, 12) })}
          tone="border-white/5 bg-black/20"
        />
        <CapacityMetric
          label={t('nodeDetail.runtime.build')}
          value={buildProfile || t('common.status.pending')}
          detail={buildTarget || t('common.status.pending')}
          tone="border-white/5 bg-black/20"
        />
        <CapacityMetric
          label={t('nodeDetail.runtime.uptime')}
          value={typeof uptimeSeconds === 'number' ? formatDuration(uptimeSeconds) : t('common.status.pending')}
          detail={t('nodeDetail.runtime.started', { time: runtimeStartedLabel(startedAt) })}
          tone="border-white/5 bg-black/20"
        />
        <CapacityMetric
          label={t('nodeDetail.runtime.process')}
          value={typeof processId === 'number' ? formatNumber(processId) : t('common.status.pending')}
          detail={rollout?.executable_replaced ? t('nodeDetail.runtime.executableReplaced') : (rollout?.source || runtime?.source || 'runtime metadata')}
          tone={restartRequired ? 'border-yellow-500/25 bg-yellow-500/[0.06]' : 'border-emerald-500/15 bg-emerald-500/[0.04]'}
        />
      </div>
    </div>
  );
}

function privacyProtocolTone(status: string | null | undefined) {
  if (status === 'ok') return 'border-emerald-500/15 bg-emerald-500/[0.04]';
  if (status === 'degraded') return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  if (status === 'failed') return 'border-red-500/25 bg-red-500/[0.06]';
  return 'border-gray-500/20 bg-gray-500/[0.04]';
}

function privacyProtocolStatusLabel(status: string | null | undefined, pending: string, t: TranslateFn) {
  if (!status) return pending;
  const key = `nodeDetail.privacyProtocol.status.${status}`;
  const translated = t(key);
  return translated === key ? status.replaceAll('_', ' ') : translated;
}

function discoveryWarningCount(discovery: DiscoveryStatus | null | undefined) {
  const runtime = discovery?.peer_store?.runtime;
  const bootstrap = discovery?.peer_store?.bootstrap;
  const stability = discovery?.peer_store?.stability;
  const localCapabilities = discovery?.local_capabilities;
  if (!runtime) return 0;
  const recoveredAndReady = bootstrap?.recovery_status === 'success' && stability?.relay_foundation_ready;
  const descriptorRejectedWarnings = recoveredAndReady ? 0 : (runtime.rejected || 0);
  const gossipStatus = bootstrap?.last_gossip_status;
  const gossipWarning = gossipStatus === 'failed' || gossipStatus === 'degraded'
    || (bootstrap?.consecutive_gossip_failures ?? 0) > 0
    ? 1
    : 0;
  const stabilityWarning = stability
    && !stability.relay_foundation_ready
    && stability.health !== 'pending'
    && stability.health !== 'disabled'
    ? 1
    : 0;
  const relayProtectionWarning = relayProtectionWarningCount(discovery) > 0 ? 1 : 0;
  const localCapabilityWarning = localCapabilities
    && (localCapabilities.status === 'misconfigured' || !localCapabilities.capability_config_consistent)
    ? 1
    : 0;
  return (
    descriptorRejectedWarnings
    + (runtime.capacity_rejected || 0)
    + (runtime.policy_rejected || 0)
    + (runtime.rate_limited || 0)
    + gossipWarning
    + stabilityWarning
    + relayProtectionWarning
    + localCapabilityWarning
  );
}

function discoveryPanelTone(discovery: DiscoveryStatus | null | undefined) {
  if (!discovery?.peer_store) return 'border-gray-500/20 bg-gray-500/[0.04]';
  if (discoveryWarningCount(discovery) > 0) return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  if (discovery.peer_store.snapshot.valid_peers > 0) return 'border-emerald-500/15 bg-emerald-500/[0.04]';
  return 'border-sky-500/15 bg-sky-500/[0.04]';
}

function discoveryStatusLabel(discovery: DiscoveryStatus | null | undefined, t: TranslateFn) {
  if (!discovery?.peer_store) return t('nodeDetail.discovery.status.pending');
  if (discoveryWarningCount(discovery) > 0) return t('nodeDetail.discovery.status.attention');
  if (discovery.peer_store.snapshot.valid_peers > 0) return t('nodeDetail.discovery.status.ready');
  return t('nodeDetail.discovery.status.pending');
}

function discoveryTimestampLabel(
  value: number | null | undefined,
  pending: string,
  relativeTime: (value: string) => string,
) {
  return typeof value === 'number' && value > 0
    ? relativeTime(new Date(value * 1000).toISOString())
    : pending;
}

function discoveryGossipStatusLabel(status: string | null | undefined, t: TranslateFn) {
  switch (status) {
    case 'healthy':
      return t('nodeDetail.discovery.gossipStatus.healthy');
    case 'degraded':
      return t('nodeDetail.discovery.gossipStatus.degraded');
    case 'failed':
      return t('nodeDetail.discovery.gossipStatus.failed');
    case 'idle':
      return t('nodeDetail.discovery.gossipStatus.idle');
    default:
      return t('nodeDetail.discovery.gossipStatus.waiting');
  }
}

function discoveryGossipTone(bootstrap: DiscoveryBootstrapStatus) {
  if (!bootstrap.gossip_enabled) return 'border-white/5 bg-black/20';
  if (bootstrap.last_gossip_status === 'failed' || (bootstrap.consecutive_gossip_failures ?? 0) > 1) {
    return 'border-red-500/25 bg-red-500/[0.06]';
  }
  if (bootstrap.last_gossip_status === 'degraded' || (bootstrap.last_gossip_failed ?? 0) > 0) {
    return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  }
  if (bootstrap.last_gossip_status === 'healthy') {
    return 'border-emerald-500/15 bg-emerald-500/[0.04]';
  }
  return 'border-sky-500/15 bg-sky-500/[0.04]';
}

type DiscoveryStabilityStatus = NonNullable<DiscoveryStatus['peer_store']['stability']>;
type DiscoveryBlindRelayStats = NonNullable<DiscoveryStatus['peer_store']['runtime']['blind_relay']>;
type DiscoveryPeerHealthSummary = NonNullable<DiscoveryStatus['peer_store']['peer_health_summary']>;
type DiscoveryPeerHealthRow = DiscoveryPeerHealthSummary['peers'][number];
type DiscoveryNetworkStoryStatus = NonNullable<DiscoveryStatus['peer_store']['network_story']>;

function localCapabilityTone(capability: DiscoveryLocalCapabilityStatus | null | undefined) {
  if (!capability) return 'border-white/5 bg-black/20';
  if (capability.status === 'misconfigured' || !capability.capability_config_consistent) {
    return 'border-red-500/25 bg-red-500/[0.06]';
  }
  if (capability.status === 'ready') return 'border-emerald-500/15 bg-emerald-500/[0.04]';
  if (capability.status === 'disabled') return 'border-sky-500/15 bg-sky-500/[0.04]';
  return 'border-yellow-500/25 bg-yellow-500/[0.06]';
}

function localCapabilityStatusLabel(
  capability: DiscoveryLocalCapabilityStatus | null | undefined,
  t: TranslateFn,
) {
  if (!capability) return t('nodeDetail.discovery.localCapability.status.pending');
  const key = `nodeDetail.discovery.localCapability.status.${capability.status}`;
  const translated = t(key);
  return translated === key ? capability.status.replaceAll('_', ' ') : translated;
}

function localCapabilityBooleanLabel(value: boolean, t: TranslateFn) {
  return value ? t('nodeDetail.discovery.enabled') : t('nodeDetail.discovery.disabled');
}

function localCapabilityBlockerLabel(blocker: string) {
  return blocker.replaceAll('_', ' ');
}

function localCapabilitySafeToAdvertise(capability: DiscoveryLocalCapabilityStatus) {
  return Boolean(
    capability.safe_to_advertise_chat_relay
    ?? (
      capability.chat_relay_configured
      && capability.blind_relay_endpoint_ready
      && capability.chat_relay_runtime_ready
      && capability.advertised_chat_relay_capability
      && capability.capability_config_consistent
    ),
  );
}

function networkStoryTone(story: DiscoveryNetworkStoryStatus | null | undefined) {
  if (!story) return 'border-white/5 bg-black/20';
  if (story.status === 'attention') return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  if (story.status === 'onion_ready') return 'border-emerald-500/20 bg-emerald-500/[0.06]';
  if (story.status === 'relay_ready' || story.status === 'peer_view_ready') {
    return 'border-emerald-500/15 bg-emerald-500/[0.04]';
  }
  if (story.status === 'disabled') return 'border-gray-500/20 bg-gray-500/[0.04]';
  return 'border-sky-500/15 bg-sky-500/[0.04]';
}

function networkStoryStatusLabel(
  story: DiscoveryNetworkStoryStatus | null | undefined,
  t: TranslateFn,
) {
  if (!story) return t('nodeDetail.discovery.networkStory.status.pending');
  const key = `nodeDetail.discovery.networkStory.status.${story.status}`;
  const translated = t(key);
  return translated === key ? story.status.replaceAll('_', ' ') : translated;
}

function networkStoryBooleanLabel(value: boolean, t: TranslateFn) {
  return value ? t('nodeDetail.discovery.networkStory.ready') : t('nodeDetail.discovery.networkStory.notReady');
}

function NetworkStoryPanel({
  story,
}: {
  story: DiscoveryNetworkStoryStatus | null | undefined;
}) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();

  if (!story) return null;

  const tone = networkStoryTone(story);
  const fields = [
    {
      label: t('nodeDetail.discovery.networkStory.validNodes'),
      value: formatNumber(story.valid_nodes ?? 0),
      detail: t('nodeDetail.discovery.networkStory.discoveredNodes', {
        count: formatNumber(story.discovered_nodes ?? 0),
      }),
      ready: (story.valid_nodes ?? 0) > 0,
    },
    {
      label: t('nodeDetail.discovery.networkStory.chatRelays'),
      value: formatNumber(story.routeable_chat_relays ?? 0),
      detail: t('nodeDetail.discovery.networkStory.chatRelayDescriptors', {
        count: formatNumber(story.chat_relay_nodes ?? 0),
      }),
      ready: (story.routeable_chat_relays ?? 0) > 0,
    },
    {
      label: t('nodeDetail.discovery.networkStory.onionHops'),
      value: formatNumber(story.routeable_onion_middle_hops ?? 0),
      detail: t('nodeDetail.discovery.networkStory.onionDescriptors', {
        count: formatNumber(story.onion_middle_nodes ?? 0),
      }),
      ready: (story.routeable_onion_middle_hops ?? 0) > 0,
    },
    {
      label: t('nodeDetail.discovery.networkStory.twoHopPath'),
      value: networkStoryBooleanLabel(Boolean(story.chat_two_hop_onion_ready), t),
      detail: t('nodeDetail.discovery.networkStory.singleHopDetail', {
        status: networkStoryBooleanLabel(Boolean(story.chat_single_hop_ready), t),
      }),
      ready: Boolean(story.chat_two_hop_onion_ready),
    },
  ];

  return (
    <div className={`mt-4 rounded-xl border p-3 ${tone}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">
              {t('nodeDetail.discovery.networkStory.title')}
            </p>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${tone}`}>
              {networkStoryStatusLabel(story, t)}
            </span>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${story.relay_foundation_ready ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200'}`}>
              {story.relay_foundation_ready
                ? t('nodeDetail.discovery.networkStory.foundationReady')
                : t('nodeDetail.discovery.networkStory.foundationBlocked')}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-400">
            {t('nodeDetail.discovery.networkStory.description')}
          </p>
          <p className="mt-2 break-words text-[11px] leading-4 text-gray-500 [overflow-wrap:anywhere]">
            {story.headline || t('nodeDetail.discovery.networkStory.noHeadline')}
          </p>
          {story.detail && (
            <p className="mt-1 break-words text-[11px] leading-4 text-gray-600 [overflow-wrap:anywhere]">
              {story.detail}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px] leading-4 text-gray-500 lg:max-w-md">
          <p className="font-medium text-gray-300">
            {t('nodeDetail.discovery.networkStory.generatedAt')}
          </p>
          <p className="mt-1">
            {discoveryTimestampLabel(story.generated_at, t('nodeDetail.discovery.pendingTime'), i18nRelativeTime)}
          </p>
          <p className="mt-2">
            {story.restart_recovery_configured
              ? t('nodeDetail.discovery.networkStory.restartReady')
              : t('nodeDetail.discovery.networkStory.restartMissing')}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {fields.map((field) => (
          <div key={field.label} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-600">{field.label}</p>
            <p className={`mt-1 text-sm font-semibold ${field.ready ? 'text-emerald-200' : 'text-gray-300'}`}>
              {field.value}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-gray-600">{field.detail}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-gray-600">
        {story.privacy_boundary || t('nodeDetail.discovery.networkStory.privacy')}
      </p>
    </div>
  );
}

function relayProtectionWarningCountFromParts(
  relay: DiscoveryBlindRelayStats | null | undefined,
  peerHealth: DiscoveryPeerHealthSummary | null | undefined,
) {
  const relayCounters = [
    relay?.loop_detected ?? 0,
    relay?.replay_dropped ?? 0,
    relay?.rate_limited ?? 0,
    relay?.quarantined ?? 0,
    relay?.quarantine_started ?? 0,
  ].reduce<number>((sum, value) => sum + value, 0);
  const unhealthyPeers = (peerHealth?.degraded_peers ?? 0)
    + (peerHealth?.failing_peers ?? 0)
    + (peerHealth?.quarantined_peers ?? 0);
  return relayCounters + unhealthyPeers;
}

function relayProtectionWarningCount(discovery: DiscoveryStatus | null | undefined) {
  return relayProtectionWarningCountFromParts(
    discovery?.peer_store?.runtime?.blind_relay,
    discovery?.peer_store?.peer_health_summary,
  );
}

function relayProtectionTone(
  relay: DiscoveryBlindRelayStats | null | undefined,
  peerHealth: DiscoveryPeerHealthSummary | null | undefined,
) {
  if (!relay && !peerHealth) return 'border-white/5 bg-black/20';
  if (relayProtectionWarningCountFromParts(relay, peerHealth) > 0) {
    return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  }
  return 'border-emerald-500/15 bg-emerald-500/[0.04]';
}

function relayProtectionStatusLabel(
  relay: DiscoveryBlindRelayStats | null | undefined,
  peerHealth: DiscoveryPeerHealthSummary | null | undefined,
  t: TranslateFn,
) {
  if (!relay && !peerHealth) return t('nodeDetail.discovery.securityStatus.pending');
  if (relayProtectionWarningCountFromParts(relay, peerHealth) > 0) {
    return t('nodeDetail.discovery.securityStatus.attention');
  }
  return t('nodeDetail.discovery.securityStatus.ready');
}

function relayPeerRouteFailureCount(peer: DiscoveryPeerHealthRow) {
  return peer.route_failure_count ?? peer.route_failures ?? 0;
}

function relayPeerRejectionCount(peer: DiscoveryPeerHealthRow) {
  return peer.relay_rejection_count ?? peer.relay_rejections ?? 0;
}

function relayPeerQuarantineCount(peer: DiscoveryPeerHealthRow) {
  return peer.relay_quarantine_count ?? peer.relay_quarantine_started ?? 0;
}

function relayPeerHealthTone(peer: DiscoveryPeerHealthRow) {
  if (peer.health === 'quarantined' || peer.health === 'failing') {
    return 'border-red-500/25 bg-red-500/[0.06]';
  }
  if (peer.health === 'degraded' || relayPeerRouteFailureCount(peer) > 0 || relayPeerRejectionCount(peer) > 0) {
    return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  }
  return 'border-white/5 bg-black/20';
}

function discoveryStabilityTone(stability: DiscoveryStabilityStatus | null | undefined) {
  if (!stability) return 'border-white/5 bg-black/20';
  if (stability.health === 'failed') return 'border-red-500/25 bg-red-500/[0.06]';
  if (stability.health === 'degraded' || stability.health === 'stale') return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  if (stability.health === 'healthy' && stability.relay_foundation_ready) return 'border-emerald-500/15 bg-emerald-500/[0.04]';
  return 'border-sky-500/15 bg-sky-500/[0.04]';
}

function discoveryStabilityHealthLabel(health: string | null | undefined, t: TranslateFn) {
  if (!health) return t('nodeDetail.discovery.status.pending');
  const key = `nodeDetail.discovery.stability.health.${health}`;
  const translated = t(key);
  return translated === key ? health.replaceAll('_', ' ') : translated;
}

function discoveryRestartRecoverySourcesLabel(
  sources: string[] | null | undefined,
  t: TranslateFn,
) {
  if (!sources || sources.length === 0) {
    return t('common.status.pending');
  }

  return sources
    .map((source) => {
      if (source === 'seed_endpoints') return t('nodeDetail.discovery.recoverySourceSeed');
      if (source === 'peer_cache') return t('nodeDetail.discovery.recoverySourceCache');
      return source.replace(/_/g, ' ');
    })
    .join(' · ');
}

function discoveryStabilityAgeLabel(
  seconds: number | null | undefined,
  pending: string,
  formatNumber: (value: number) => string,
  t: TranslateFn,
) {
  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? t('nodeDetail.discovery.stabilityAgeSeconds', { seconds: formatNumber(Math.max(0, Math.floor(seconds))) })
    : pending;
}

function discoveryFailureReasonLabel(reason: string | null | undefined, t: TranslateFn) {
  if (!reason) return t('nodeDetail.discovery.gossipFailureNone');
  return reason.replaceAll('_', ' ');
}

function LocalCapabilityPanel({
  capability,
}: {
  capability: DiscoveryLocalCapabilityStatus | null | undefined;
}) {
  const { t } = useI18n();

  if (!capability) return null;

  const tone = localCapabilityTone(capability);
  const safeToAdvertise = localCapabilitySafeToAdvertise(capability);
  const blockers = Array.isArray(capability.advertisement_blockers)
    ? capability.advertisement_blockers.filter(Boolean)
    : [];
  const fields = [
    {
      label: t('nodeDetail.discovery.localCapability.chatRelayConfigured'),
      value: localCapabilityBooleanLabel(capability.chat_relay_configured, t),
      ready: capability.chat_relay_configured,
    },
    {
      label: t('nodeDetail.discovery.localCapability.endpointReady'),
      value: localCapabilityBooleanLabel(capability.blind_relay_endpoint_ready, t),
      ready: capability.blind_relay_endpoint_ready,
    },
    {
      label: t('nodeDetail.discovery.localCapability.runtimeReady'),
      value: localCapabilityBooleanLabel(Boolean(capability.chat_relay_runtime_ready), t),
      ready: Boolean(capability.chat_relay_runtime_ready),
    },
    {
      label: t('nodeDetail.discovery.localCapability.advertised'),
      value: localCapabilityBooleanLabel(capability.advertised_chat_relay_capability, t),
      ready: capability.advertised_chat_relay_capability,
    },
    {
      label: t('nodeDetail.discovery.localCapability.safeToAdvertiseLabel'),
      value: localCapabilityBooleanLabel(safeToAdvertise, t),
      ready: safeToAdvertise,
    },
    {
      label: t('nodeDetail.discovery.localCapability.consistent'),
      value: capability.capability_config_consistent
        ? t('nodeDetail.discovery.localCapability.consistentYes')
        : t('nodeDetail.discovery.localCapability.consistentNo'),
      ready: capability.capability_config_consistent,
    },
  ];

  return (
    <div className={`mt-4 rounded-xl border p-3 ${tone}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">
              {t('nodeDetail.discovery.localCapability.title')}
            </p>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${tone}`}>
              {localCapabilityStatusLabel(capability, t)}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-400">
            {t('nodeDetail.discovery.localCapability.description')}
          </p>
          <p className="mt-2 break-words text-[11px] leading-4 text-gray-500 [overflow-wrap:anywhere]">
            {capability.detail || t('nodeDetail.discovery.localCapability.noDetail')}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px] leading-4 text-gray-500 lg:max-w-md">
          <p className="font-medium text-gray-300">
            {safeToAdvertise
              ? t('nodeDetail.discovery.localCapability.safeToAdvertise')
              : t('nodeDetail.discovery.localCapability.fixBeforeAdvertise')}
          </p>
          <p className="mt-1">
            {blockers.length > 0
              ? blockers.map(localCapabilityBlockerLabel).join(' · ')
              : t('nodeDetail.discovery.localCapability.privacy')}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {fields.map((field) => (
          <div key={field.label} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-600">{field.label}</p>
            <p className={`mt-1 text-sm font-semibold ${field.ready ? 'text-emerald-200' : 'text-gray-300'}`}>
              {field.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelayProtectionPanel({
  relay,
  peerHealth,
}: {
  relay: DiscoveryBlindRelayStats | null | undefined;
  peerHealth: DiscoveryPeerHealthSummary | null | undefined;
}) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  const pending = t('nodeDetail.discovery.pendingTime');
  const peerRows = peerHealth?.peers ?? [];
  const securityTone = relayProtectionTone(relay, peerHealth);
  const statusLabel = relayProtectionStatusLabel(relay, peerHealth, t);
  const relayReported = Boolean(relay);
  const peerHealthDetail = peerHealth
    ? t('nodeDetail.discovery.peerHealthDetail', {
        healthy: formatNumber(peerHealth.healthy_peers),
        degraded: formatNumber(peerHealth.degraded_peers),
        failing: formatNumber(peerHealth.failing_peers),
        quarantined: formatNumber(peerHealth.quarantined_peers),
      })
    : t('nodeDetail.discovery.securityWaiting');

  return (
    <div id="relay-protection-panel" className={`mt-4 rounded-xl border p-3 ${securityTone}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">
              {t('nodeDetail.discovery.securityTitle')}
            </p>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${securityTone}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-400">
            {t('nodeDetail.discovery.securityDescription')}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px] leading-4 text-gray-500 xl:max-w-md">
          <p className="font-medium text-gray-300">
            {relayReported
              ? t('nodeDetail.discovery.securityReported')
              : t('nodeDetail.discovery.securityWaiting')}
          </p>
          <p className="mt-1">
            {t('nodeDetail.discovery.relaySummary', {
              received: formatNumber(relay?.received ?? 0),
              forwarded: formatNumber(relay?.forwarded ?? 0),
              rejected: formatNumber(relay?.rejected ?? 0),
            })}
          </p>
          <p className="mt-1">
            {t('nodeDetail.discovery.lastRelayEvent')}: {discoveryTimestampLabel(relay?.last_event_at, pending, i18nRelativeTime)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [t('nodeDetail.discovery.loopDetected'), relay?.loop_detected ?? 0],
          [t('nodeDetail.discovery.replayDropped'), relay?.replay_dropped ?? 0],
          [t('nodeDetail.discovery.relayRateLimited'), relay?.rate_limited ?? 0],
          [t('nodeDetail.discovery.relayQuarantined'), relay?.quarantined ?? 0],
          [t('nodeDetail.discovery.quarantineStarted'), relay?.quarantine_started ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-600">{label}</p>
            <p className={`mt-1 text-sm font-semibold ${Number(value) > 0 ? 'text-yellow-200' : 'text-gray-200'}`}>
              {formatNumber(Number(value))}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-white/5 bg-black/20 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium text-gray-300">{t('nodeDetail.discovery.peerHealth')}</p>
            <p className="mt-1 text-[11px] leading-4 text-gray-500">{peerHealthDetail}</p>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase text-gray-400">
            {t('nodeDetail.discovery.peerHealthRows', { count: formatNumber(peerRows.length) })}
          </span>
        </div>

        {peerRows.length > 0 ? (
          <div className="mt-3 grid gap-2 xl:grid-cols-2">
            {peerRows.slice(0, 6).map((peer) => {
              const reason = peer.last_relay_rejection_reason
                || peer.last_route_failure_reason
                || peer.last_relay_quarantine_reason;
              return (
                <div
                  key={`${peer.node_id_prefix}-${peer.source}`}
                  className={`rounded-lg border px-3 py-2 ${relayPeerHealthTone(peer)}`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-xs font-semibold text-white [overflow-wrap:anywhere]">
                        {peer.node_id_prefix}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-gray-500">
                        {t('nodeDetail.discovery.peerRowDetail', {
                          source: peer.source || pending,
                          route: peer.route_health || pending,
                          gossip: discoveryStabilityAgeLabel(peer.last_successful_gossip_age_seconds, pending, formatNumber, t),
                        })}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase text-gray-300">
                      {peer.health}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] leading-4 text-gray-500">
                    <span>{t('nodeDetail.discovery.peerRouteFailures', { count: formatNumber(relayPeerRouteFailureCount(peer)) })}</span>
                    <span>{t('nodeDetail.discovery.peerRelayRejections', { count: formatNumber(relayPeerRejectionCount(peer)) })}</span>
                    {relayPeerQuarantineCount(peer) > 0 && (
                      <span>{t('nodeDetail.discovery.peerRelayQuarantines', { count: formatNumber(relayPeerQuarantineCount(peer)) })}</span>
                    )}
                    {typeof peer.relay_quarantine_remaining_seconds === 'number' && peer.relay_quarantine_remaining_seconds > 0 && (
                      <span className="text-yellow-200">
                        {t('nodeDetail.discovery.peerQuarantineRemaining', {
                          seconds: formatNumber(Math.floor(peer.relay_quarantine_remaining_seconds)),
                        })}
                      </span>
                    )}
                    {reason && (
                      <span className="break-words [overflow-wrap:anywhere]">
                        {t('nodeDetail.discovery.peerReason', { reason: discoveryFailureReasonLabel(reason, t) })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-[11px] leading-4 text-gray-600">
            {t('nodeDetail.discovery.securityNoPeerRows')}
          </p>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-gray-600">
        {t('nodeDetail.discovery.securityPrivacy')}
      </p>
    </div>
  );
}

function DiscoveryStatusPanel({ discovery }: { discovery: DiscoveryStatus | null | undefined }) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  const pending = t('nodeDetail.discovery.pendingTime');
  const peerStore = discovery?.peer_store ?? null;

  if (!peerStore) {
    return (
      <div id="discovery-panel" className={`mt-5 scroll-mt-6 rounded-xl border p-4 ${discoveryPanelTone(discovery)}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-white">{t('nodeDetail.discovery.title')}</h4>
              <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${discoveryPanelTone(discovery)}`}>
                {t('nodeDetail.discovery.status.pending')}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.discovery.description')}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500 lg:max-w-md">
            <p className="font-medium text-gray-300">{t('nodeDetail.discovery.pendingTitle')}</p>
            <p className="mt-1 leading-5">{t('nodeDetail.discovery.pendingDescription')}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-gray-600">{t('nodeDetail.discovery.backendPath')}</p>
      </div>
    );
  }

  const snapshot = peerStore.snapshot;
  const runtime = peerStore.runtime;
  const warnings = discoveryWarningCount(discovery);
  const maxPeers = typeof peerStore.max_peers === 'number' ? formatNumber(peerStore.max_peers) : pending;
  const totalPeers = formatNumber(snapshot.total_peers);
  const validPeers = formatNumber(snapshot.valid_peers);
  const publicPeers = formatNumber(snapshot.public_peers);
  const auditEvents = peerStore.recent_audit_events ?? [];
  const peerEvents = peerStore.recent_peer_events ?? [];
  const bootstrap = peerStore.bootstrap ?? null;
  const stability = peerStore.stability ?? null;
  const networkStory = peerStore.network_story ?? null;
  const localCapabilities = discovery?.local_capabilities ?? null;
  const blindRelay = runtime.blind_relay ?? null;
  const peerHealthSummary = peerStore.peer_health_summary ?? null;
  const bootstrapRecoveryStatus = bootstrap?.recovery_status || bootstrap?.last_source_status || null;
  const bootstrapRecoveryKind = bootstrap?.recovery_status
    ? [bootstrap.last_source_kind, 'recovery'].filter(Boolean).join(' / ')
    : bootstrap?.last_source_kind;
  const bootstrapRecoveryAt = bootstrap?.recovery_at ?? bootstrap?.last_source_at ?? null;
  const restartRecoverySources = discoveryRestartRecoverySourcesLabel(stability?.restart_recovery_sources, t);
  const cacheLoadStatus = bootstrap?.last_cache_load_status || null;
  const telemetrySource = discovery?.source || 'system_stats.discovery_status';
  const privacyBoundary = discovery?.privacy_boundary || t('nodeDetail.discovery.privacyBoundary');

  return (
    <div id="discovery-panel" className={`mt-5 scroll-mt-6 rounded-xl border p-4 ${discoveryPanelTone(discovery)}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white">{t('nodeDetail.discovery.title')}</h4>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${discoveryPanelTone(discovery)}`}>
              {discoveryStatusLabel(discovery, t)}
            </span>
            {warnings > 0 && (
              <span className="inline-flex rounded-full border border-yellow-500/25 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-200">
                {t('nodeDetail.discovery.navWarnings', { count: formatNumber(warnings) })}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.discovery.description')}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500 lg:max-w-md">
          <p className="font-medium text-gray-300">{t('nodeDetail.discovery.source')}</p>
          <p className="mt-1 break-words [overflow-wrap:anywhere]">{telemetrySource}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.035] p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
              {t('nodeDetail.discovery.blindTitle')}
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-100/75">
              {t('nodeDetail.discovery.blindDescription')}
            </p>
          </div>
          <div className="grid gap-2 text-[11px] leading-4 text-gray-400 sm:grid-cols-2 lg:max-w-2xl">
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <p className="font-medium text-gray-200">{t('nodeDetail.discovery.blindAllowedTitle')}</p>
              <p className="mt-1">{t('nodeDetail.discovery.blindAllowedDetail')}</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <p className="font-medium text-gray-200">{t('nodeDetail.discovery.blindForbiddenTitle')}</p>
              <p className="mt-1">{t('nodeDetail.discovery.blindForbiddenDetail')}</p>
            </div>
          </div>
        </div>
      </div>

      <NetworkStoryPanel story={networkStory} />

      <LocalCapabilityPanel capability={localCapabilities} />

      {stability && (
        <div className={`mt-4 rounded-xl border p-3 ${discoveryStabilityTone(stability)}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                  {t('nodeDetail.discovery.stabilityTitle')}
                </p>
                <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${discoveryStabilityTone(stability)}`}>
                  {discoveryStabilityHealthLabel(stability.health, t)}
                </span>
                <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${stability.relay_foundation_ready ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200'}`}>
                  {stability.relay_foundation_ready
                    ? t('nodeDetail.discovery.stabilityReady')
                    : t('nodeDetail.discovery.stabilityBlocked')}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-400">
                {stability.detail || t('nodeDetail.discovery.stabilityDescription')}
              </p>
              {stability.next_action && (
                <p className="mt-2 text-[11px] leading-4 text-gray-500">
                  {t('nodeDetail.discovery.stabilityNextAction')}: {stability.next_action}
                </p>
              )}
            </div>
            <div className="grid gap-2 text-[11px] leading-4 text-gray-400 sm:grid-cols-2 xl:grid-cols-3 lg:min-w-[360px]">
              <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                <p className="font-medium text-gray-200">{t('nodeDetail.discovery.stabilityLastSuccessAge')}</p>
                <p className="mt-1">{discoveryStabilityAgeLabel(stability.last_gossip_success_age_seconds, pending, formatNumber, t)}</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                <p className="font-medium text-gray-200">{t('nodeDetail.discovery.stabilityLastRoundAge')}</p>
                <p className="mt-1">{discoveryStabilityAgeLabel(stability.last_gossip_round_age_seconds, pending, formatNumber, t)}</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                <p className="font-medium text-gray-200">{t('nodeDetail.discovery.stabilitySeedRecovery')}</p>
                <p className="mt-1">{stability.seed_recovery_configured ? t('nodeDetail.discovery.enabled') : t('nodeDetail.discovery.disabled')}</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                <p className="font-medium text-gray-200">{t('nodeDetail.discovery.stabilityRestartRecovery')}</p>
                <p className="mt-1">
                  {stability.restart_recovery_configured
                    ? t('nodeDetail.discovery.stabilityRestartRecoveryReady')
                    : t('nodeDetail.discovery.stabilityRestartRecoveryMissing')}
                </p>
                <p className="mt-1 text-gray-600">
                  {stability.restart_recovery_sources?.length
                    ? t('nodeDetail.discovery.stabilityRestartRecoverySources', {
                        sources: restartRecoverySources,
                      })
                    : t('nodeDetail.discovery.stabilityRestartRecoveryDetail', {
                        seed: stability.seed_recovery_configured ? t('nodeDetail.discovery.enabled') : t('nodeDetail.discovery.disabled'),
                        cache: bootstrap?.peer_cache_configured ? t('nodeDetail.discovery.enabled') : t('nodeDetail.discovery.disabled'),
                      })}
                </p>
              </div>
              <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                <p className="font-medium text-gray-200">{t('nodeDetail.discovery.stabilityStaleAfter')}</p>
                <p className="mt-1">{discoveryStabilityAgeLabel(stability.stale_after_seconds, pending, formatNumber, t)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <RelayProtectionPanel relay={blindRelay} peerHealth={peerHealthSummary} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CapacityMetric
          label={t('nodeDetail.discovery.totalPeers')}
          value={totalPeers}
          detail={t('nodeDetail.discovery.maxPeersDetail', { max: maxPeers })}
          tone="border-sky-500/15 bg-sky-500/[0.04]"
        />
        <CapacityMetric
          label={t('nodeDetail.discovery.validPeers')}
          value={validPeers}
          detail={t('nodeDetail.discovery.publicPeersDetail', {
            public: publicPeers,
            exit: formatNumber(snapshot.public_exit_peers),
          })}
          tone={snapshot.valid_peers > 0 ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-gray-500/20 bg-gray-500/[0.04]'}
        />
        <CapacityMetric
          label={t('nodeDetail.discovery.lastGossip')}
          value={discoveryTimestampLabel(runtime.last_gossip_at, pending, i18nRelativeTime)}
          detail={t('nodeDetail.discovery.lastImportDetail', {
            time: discoveryTimestampLabel(runtime.last_import_at, pending, i18nRelativeTime),
          })}
          tone={runtime.last_gossip_at ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-white/5 bg-black/20'}
        />
        <CapacityMetric
          label={t('nodeDetail.discovery.lastSnapshot')}
          value={discoveryTimestampLabel(runtime.last_snapshot_at, pending, i18nRelativeTime)}
          detail={t('nodeDetail.discovery.importedDetail', {
            total: formatNumber(runtime.total_imported),
          })}
          tone="border-white/5 bg-black/20"
        />
      </div>

      {bootstrap && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <CapacityMetric
            label={t('nodeDetail.discovery.bootstrapSource')}
            value={bootstrapRecoveryStatus || (bootstrap.enabled ? pending : t('nodeDetail.discovery.disabled'))}
            detail={t('nodeDetail.discovery.bootstrapSourceDetail', {
              kind: bootstrapRecoveryKind || t('common.status.pending'),
              time: discoveryTimestampLabel(bootstrapRecoveryAt, pending, i18nRelativeTime),
            })}
            tone={bootstrapRecoveryStatus === 'failed'
              ? 'border-yellow-500/25 bg-yellow-500/[0.06]'
              : bootstrapRecoveryStatus === 'success' || bootstrapRecoveryStatus === 'warning'
                ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
                : 'border-white/5 bg-black/20'}
          />
          <CapacityMetric
            label={t('nodeDetail.discovery.selfDescriptor')}
            value={bootstrap.self_descriptor_status || pending}
            detail={bootstrap.self_descriptor_at
              ? discoveryTimestampLabel(bootstrap.self_descriptor_at, pending, i18nRelativeTime)
              : t('nodeDetail.discovery.selfDescriptorDetail')}
            tone={bootstrap.self_descriptor_status === 'failed'
              ? 'border-yellow-500/25 bg-yellow-500/[0.06]'
              : bootstrap.self_descriptor_status === 'success'
                ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
                : 'border-white/5 bg-black/20'}
          />
          <CapacityMetric
            label={t('nodeDetail.discovery.peerCache')}
            value={bootstrap.peer_cache_configured ? (bootstrap.last_cache_save_status || pending) : t('nodeDetail.discovery.disabled')}
            detail={bootstrap.last_cache_save_detail || t('nodeDetail.discovery.peerCacheDetail')}
            tone={bootstrap.last_cache_save_status === 'failed'
              ? 'border-yellow-500/25 bg-yellow-500/[0.06]'
              : bootstrap.last_cache_save_status === 'success'
                ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
                : 'border-white/5 bg-black/20'}
          />
          <CapacityMetric
            label={t('nodeDetail.discovery.peerCacheStartup')}
            value={bootstrap.peer_cache_configured ? (cacheLoadStatus || pending) : t('nodeDetail.discovery.disabled')}
            detail={bootstrap.last_cache_load_source || bootstrap.last_cache_load_at
              ? t('nodeDetail.discovery.peerCacheStartupSourceDetail', {
                  source: bootstrap.last_cache_load_source || t('common.status.pending'),
                  time: discoveryTimestampLabel(bootstrap.last_cache_load_at, pending, i18nRelativeTime),
                })
              : t('nodeDetail.discovery.peerCacheStartupDetail')}
            tone={cacheLoadStatus === 'failed'
              ? 'border-yellow-500/25 bg-yellow-500/[0.06]'
              : cacheLoadStatus === 'success' || cacheLoadStatus === 'warning'
                ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
                : 'border-white/5 bg-black/20'}
          />
          <CapacityMetric
            label={t('nodeDetail.discovery.outboundGossip')}
            value={bootstrap.gossip_enabled
              ? discoveryGossipStatusLabel(bootstrap.last_gossip_status, t)
              : t('nodeDetail.discovery.disabled')}
            detail={bootstrap.last_gossip_round_at
              ? t('nodeDetail.discovery.outboundGossipHealthDetail', {
                  attempted: formatNumber(bootstrap.last_gossip_attempted),
                  succeeded: formatNumber(bootstrap.last_gossip_succeeded),
                  failed: formatNumber(bootstrap.last_gossip_failed ?? 0),
                  consecutive: formatNumber(bootstrap.consecutive_gossip_failures ?? 0),
                  time: discoveryTimestampLabel(bootstrap.last_gossip_round_at, pending, i18nRelativeTime),
                })
              : t('nodeDetail.discovery.outboundGossipWaiting')}
            tone={discoveryGossipTone(bootstrap)}
          />
          {(bootstrap.last_gossip_failure_reason || bootstrap.last_gossip_success_at) && (
            <CapacityMetric
              label={t('nodeDetail.discovery.gossipEvidence')}
              value={discoveryTimestampLabel(bootstrap.last_gossip_success_at, pending, i18nRelativeTime)}
              detail={t('nodeDetail.discovery.gossipEvidenceDetail', {
                reason: discoveryFailureReasonLabel(bootstrap.last_gossip_failure_reason, t),
              })}
              tone={bootstrap.last_gossip_failure_reason
                ? 'border-yellow-500/25 bg-yellow-500/[0.06]'
                : 'border-emerald-500/15 bg-emerald-500/[0.04]'}
            />
          )}
          <CapacityMetric
            label={t('nodeDetail.discovery.seedRecovery')}
            value={formatNumber(bootstrap.seed_endpoints_configured ?? 0)}
            detail={t('nodeDetail.discovery.seedRecoveryDetail', {
              attempted: formatNumber(bootstrap.last_gossip_seed_attempted ?? 0),
              configured: formatNumber(bootstrap.seed_endpoints_configured ?? 0),
            })}
            tone={(bootstrap.seed_endpoints_configured ?? 0) > 0
              ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
              : 'border-white/5 bg-black/20'}
          />
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [t('nodeDetail.discovery.inserted'), runtime.inserted, 'text-emerald-200'],
          [t('nodeDetail.discovery.unchanged'), runtime.unchanged, 'text-gray-200'],
          [t('nodeDetail.discovery.stale'), runtime.stale, runtime.stale > 0 ? 'text-yellow-200' : 'text-gray-200'],
          [t('nodeDetail.discovery.rejected'), runtime.rejected, runtime.rejected > 0 ? 'text-yellow-200' : 'text-gray-200'],
          [t('nodeDetail.discovery.rateLimited'), runtime.rate_limited, runtime.rate_limited > 0 ? 'text-yellow-200' : 'text-gray-200'],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-600">{label}</p>
            <p className={`mt-1 text-sm font-semibold ${tone}`}>{formatNumber(Number(value))}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500">
          <p className="font-medium text-gray-300">{t('nodeDetail.discovery.policyRejected')}</p>
          <p className="mt-1">{formatNumber(runtime.policy_rejected)}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500">
          <p className="font-medium text-gray-300">{t('nodeDetail.discovery.capacityRejected')}</p>
          <p className="mt-1">{formatNumber(runtime.capacity_rejected)}</p>
        </div>
      </div>

      {peerEvents.length > 0 && (
        <div className="mt-3 rounded-lg border border-cyan-500/10 bg-cyan-500/[0.035] p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium text-cyan-100">{t('nodeDetail.discovery.peerEventsTitle')}</p>
              <p className="mt-1 text-[11px] leading-4 text-cyan-100/60">{t('nodeDetail.discovery.peerEventsDescription')}</p>
            </div>
            <span className="w-fit rounded-full border border-cyan-500/15 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase text-cyan-100">
              {t('nodeDetail.discovery.peerEventsCount', { count: formatNumber(peerEvents.length) })}
            </span>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {peerEvents.slice(-6).map((event, index) => {
              const rejected = event.outcome === 'rejected' || event.outcome === 'expired';
              return (
                <div
                  key={`${event.at}-${event.event}-${event.node_id_prefix}-${index}`}
                  className="rounded-lg border border-white/5 bg-black/20 px-3 py-2"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">
                        {event.event.replaceAll('_', ' ')}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-gray-500">
                        {t('nodeDetail.discovery.peerEventsDetail', {
                          prefix: event.node_id_prefix || pending,
                          source: event.source || pending,
                          sequence: event.sequence == null ? pending : formatNumber(event.sequence),
                        })}
                      </p>
                      {event.reason && (
                        <p className="mt-1 break-words text-[11px] leading-4 text-gray-600 [overflow-wrap:anywhere]">
                          {t('nodeDetail.discovery.peerEventsReason', {
                            reason: discoveryFailureReasonLabel(event.reason, t),
                          })}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase ${
                      rejected
                        ? 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200'
                        : event.outcome === 'ignored'
                          ? 'border-white/10 bg-white/[0.04] text-gray-300'
                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                    }`}>
                      {event.outcome}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-600">
                    {discoveryTimestampLabel(event.at, pending, i18nRelativeTime)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {auditEvents.length > 0 && (
        <div className="mt-3 rounded-lg border border-white/5 bg-black/20 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium text-gray-300">{t('nodeDetail.discovery.auditTitle')}</p>
              <p className="mt-1 text-[11px] leading-4 text-gray-600">{t('nodeDetail.discovery.auditDescription')}</p>
            </div>
            <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase text-gray-400">
              {t('nodeDetail.discovery.auditCount', { count: formatNumber(auditEvents.length) })}
            </span>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {auditEvents.slice(-6).map((event, index) => (
              <div
                key={`${event.at}-${event.action}-${index}`}
                className="rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">
                      {event.action.replaceAll('_', ' ')}
                    </p>
                    <p className="mt-1 break-words text-[11px] leading-4 text-gray-500 [overflow-wrap:anywhere]">
                      {event.detail}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase ${
                    event.outcome === 'rejected' || event.outcome === 'limited' || event.outcome === 'warning'
                      ? 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200'
                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                  }`}>
                    {event.outcome}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-gray-600">
                  {discoveryTimestampLabel(event.at, pending, i18nRelativeTime)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-5 text-gray-600">
        {privacyBoundary}
      </p>
    </div>
  );
}

function chatRelayPeer(relay: ChatRelayStatus | null | undefined) {
  return relay?.peer_relay ?? null;
}

function chatRelayWarningCount(relay: ChatRelayStatus | null | undefined) {
  const peer = chatRelayPeer(relay);
  if (!peer || !peer.enabled) return 0;
  const outboundWarning = peer.last_outbound_status === 'failed' || peer.last_outbound_status === 'degraded'
    || (peer.consecutive_outbound_failures ?? 0) > 0
    ? 1
    : 0;
  const inboundWarning = (peer.inbound_rejected_total ?? 0) > 0 ? 1 : 0;
  return outboundWarning + inboundWarning;
}

function chatRelayPanelTone(relay: ChatRelayStatus | null | undefined) {
  const peer = chatRelayPeer(relay);
  if (!peer) return 'border-gray-500/20 bg-gray-500/[0.04]';
  if (!peer.enabled) return 'border-white/5 bg-black/20';
  if (peer.last_outbound_status === 'failed' || (peer.consecutive_outbound_failures ?? 0) > 1) {
    return 'border-red-500/25 bg-red-500/[0.06]';
  }
  if (chatRelayWarningCount(relay) > 0) return 'border-yellow-500/25 bg-yellow-500/[0.06]';
  if (peer.last_outbound_status === 'healthy' || peer.inbound_accepted_total > 0) {
    return 'border-emerald-500/15 bg-emerald-500/[0.04]';
  }
  return 'border-sky-500/15 bg-sky-500/[0.04]';
}

function chatRelayStatusLabel(relay: ChatRelayStatus | null | undefined, t: TranslateFn) {
  const peer = chatRelayPeer(relay);
  if (!peer) return t('nodeDetail.chatRelay.status.pending');
  if (!peer.enabled) return t('nodeDetail.chatRelay.status.disabled');
  if (chatRelayWarningCount(relay) > 0) return t('nodeDetail.chatRelay.status.attention');
  if (peer.last_outbound_status === 'healthy') return t('nodeDetail.chatRelay.status.ready');
  if (peer.outbound_rounds > 0 || peer.inbound_accepted_total > 0) return t('nodeDetail.chatRelay.status.active');
  return t('nodeDetail.chatRelay.status.idle');
}

function chatRelayBucketLabel(value: string | null | undefined, t: TranslateFn) {
  if (!value) return t('nodeDetail.chatRelay.bucket.none');
  const key = `nodeDetail.chatRelay.bucket.${value}`;
  const translated = t(key);
  return translated === key ? value.replaceAll('_', ' ') : translated;
}

function chatRelayTimestampLabel(
  value: number | null | undefined,
  pending: string,
  relativeTime: (value: string) => string,
) {
  return typeof value === 'number' && value > 0
    ? relativeTime(new Date(value * 1000).toISOString())
    : pending;
}

function ChatRelayStatusPanel({ relay }: { relay: ChatRelayStatus | null | undefined }) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  const pending = t('common.status.pending');
  const peer = chatRelayPeer(relay);

  if (!peer) {
    return (
      <div id="chat-relay-panel" className={`mt-5 scroll-mt-6 rounded-xl border p-4 ${chatRelayPanelTone(relay)}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-white">{t('nodeDetail.chatRelay.title')}</h4>
              <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${chatRelayPanelTone(relay)}`}>
                {t('nodeDetail.chatRelay.status.pending')}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.chatRelay.description')}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500 lg:max-w-md">
            <p className="font-medium text-gray-300">{t('nodeDetail.chatRelay.pendingTitle')}</p>
            <p className="mt-1 leading-5">{t('nodeDetail.chatRelay.pendingDescription')}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-gray-600">{t('nodeDetail.chatRelay.backendPath')}</p>
      </div>
    );
  }

  const warnings = chatRelayWarningCount(relay);
  const telemetrySource = relay?.source || 'system_stats.chat_relay_status';
  const privacyBoundary = relay?.privacy_boundary || t('nodeDetail.chatRelay.privacyBoundary');
  const lastOutboundStatus = chatRelayBucketLabel(peer.last_outbound_status, t);
  const lastInboundStatus = chatRelayBucketLabel(peer.last_inbound_status, t);
  const lastFailure = peer.last_outbound_failure_reason || peer.last_inbound_failure_reason;

  return (
    <div id="chat-relay-panel" className={`mt-5 scroll-mt-6 rounded-xl border p-4 ${chatRelayPanelTone(relay)}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white">{t('nodeDetail.chatRelay.title')}</h4>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${chatRelayPanelTone(relay)}`}>
              {chatRelayStatusLabel(relay, t)}
            </span>
            {warnings > 0 && (
              <span className="inline-flex rounded-full border border-yellow-500/25 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-200">
                {t('nodeDetail.chatRelay.navWarnings', { count: formatNumber(warnings) })}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.chatRelay.description')}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500 lg:max-w-md">
          <p className="font-medium text-gray-300">{t('nodeDetail.discovery.source')}</p>
          <p className="mt-1 break-words [overflow-wrap:anywhere]">{telemetrySource}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CapacityMetric
          label={t('nodeDetail.chatRelay.mode')}
          value={peer.enabled ? t('nodeDetail.discovery.enabled') : t('nodeDetail.discovery.disabled')}
          detail={t('nodeDetail.chatRelay.roundsDetail', { count: formatNumber(peer.outbound_rounds) })}
          tone={peer.enabled ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-white/5 bg-black/20'}
        />
        <CapacityMetric
          label={t('nodeDetail.chatRelay.outbound')}
          value={`${formatNumber(peer.outbound_accepted_total)}/${formatNumber(peer.outbound_attempted_total)}`}
          detail={t('nodeDetail.chatRelay.lastOutboundDetail', {
            status: lastOutboundStatus,
            failed: formatNumber(peer.last_outbound_failed),
          })}
          tone={peer.last_outbound_status === 'failed'
            ? 'border-red-500/25 bg-red-500/[0.06]'
            : peer.last_outbound_status === 'degraded'
              ? 'border-yellow-500/25 bg-yellow-500/[0.06]'
              : peer.last_outbound_status === 'healthy'
                ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
                : 'border-white/5 bg-black/20'}
        />
        <CapacityMetric
          label={t('nodeDetail.chatRelay.inbound')}
          value={`${formatNumber(peer.inbound_accepted_total)}/${formatNumber(peer.inbound_rejected_total)}`}
          detail={t('nodeDetail.chatRelay.lastInboundDetail', {
            status: lastInboundStatus,
            duplicate: formatNumber(peer.inbound_duplicate_total),
          })}
          tone={peer.inbound_rejected_total > 0
            ? 'border-yellow-500/25 bg-yellow-500/[0.06]'
            : peer.inbound_accepted_total > 0
              ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
              : 'border-white/5 bg-black/20'}
        />
        <CapacityMetric
          label={t('nodeDetail.chatRelay.lastSuccess')}
          value={chatRelayTimestampLabel(peer.last_outbound_success_at, pending, i18nRelativeTime)}
          detail={t('nodeDetail.chatRelay.lastAttemptDetail', {
            time: chatRelayTimestampLabel(peer.last_outbound_at, pending, i18nRelativeTime),
          })}
          tone={peer.last_outbound_success_at ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-white/5 bg-black/20'}
        />
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500">
          <p className="font-medium text-gray-300">{t('nodeDetail.chatRelay.delivery')}</p>
          <p className="mt-1">
            {t('nodeDetail.chatRelay.deliveryDetail', {
              online: formatNumber(peer.inbound_delivered_online_total),
              pending: formatNumber(peer.inbound_stored_pending_total),
            })}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500">
          <p className="font-medium text-gray-300">{t('nodeDetail.chatRelay.consecutiveFailures')}</p>
          <p className="mt-1">{formatNumber(peer.consecutive_outbound_failures)}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500">
          <p className="font-medium text-gray-300">{t('nodeDetail.chatRelay.lastFailure')}</p>
          <p className="mt-1 break-words [overflow-wrap:anywhere]">{lastFailure ? lastFailure.replaceAll('_', ' ') : t('nodeDetail.discovery.gossipFailureNone')}</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-gray-600">
        {privacyBoundary}
      </p>
    </div>
  );
}

function PrivacyProtocolHealthPanel({ health }: { health: VpnNodeHealth }) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  const protocol = health.system.privacy_protocol_health ?? null;
  const pending = t('common.status.pending');
  const status = protocol?.status || health.system.vpn_health_status || null;
  const checkedAt = protocol?.checked_at ?? health.system.vpn_health_checked_at ?? null;
  const runtime = protocol?.protocol_runtime ?? null;
  const failedChecks = typeof protocol?.failed_checks === 'number'
    ? protocol.failed_checks
    : health.checks.filter((check) => !check.ok).length;
  const source = protocol?.source || runtime?.source || 'system_stats.vpn_health';
  const activeSessions = typeof protocol?.active_sessions === 'number'
    ? protocol.active_sessions
    : health.active_sessions;

  return (
    <div id="privacy-protocol-panel" className={`mt-5 scroll-mt-6 rounded-xl border p-4 ${privacyProtocolTone(status)}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white">{t('nodeDetail.privacyProtocol.title')}</h4>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${privacyProtocolTone(status)}`}>
              {privacyProtocolStatusLabel(status, pending, t)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {t('nodeDetail.privacyProtocol.description')}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500 lg:max-w-md">
          <p className="font-medium text-gray-300">{t('nodeDetail.privacyProtocol.source')}</p>
          <p className="mt-1 break-words [overflow-wrap:anywhere]">{source}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CapacityMetric
          label={t('nodeDetail.privacyProtocol.protocol')}
          value={protocol?.label || 'AeroNyx Privacy Protocol'}
          detail={runtime?.detail || t('nodeDetail.privacyProtocol.runtimeDetail')}
          tone={privacyProtocolTone(status)}
        />
        <CapacityMetric
          label={t('nodeDetail.privacyProtocol.dataPlane')}
          value={protocol?.data_plane || 'aeronyx_privacy_protocol'}
          detail={t('nodeDetail.privacyProtocol.dataPlaneDetail', {
            sessions: formatNumber(activeSessions),
            checks: formatNumber(failedChecks),
          })}
          tone={failedChecks > 0 ? 'border-yellow-500/25 bg-yellow-500/[0.06]' : 'border-emerald-500/15 bg-emerald-500/[0.04]'}
        />
        <CapacityMetric
          label={t('nodeDetail.privacyProtocol.transport')}
          value={formatTransportKey(protocol?.effective_transport ?? health.system.transport_health?.effective_transport ?? health.system.preferred_transport, t)}
          detail={t('nodeDetail.privacyProtocol.transportDetail', {
            preferred: formatTransportKey(protocol?.preferred_transport ?? health.system.preferred_transport, t),
          })}
          tone="border-sky-500/15 bg-sky-500/[0.04]"
        />
        <CapacityMetric
          label={t('nodeDetail.privacyProtocol.service')}
          value={protocol?.service_active_state || health.system.service_manager?.active_state || pending}
          detail={checkedAt
            ? t('nodeDetail.privacyProtocol.checkedAt', { time: i18nRelativeTime(new Date(checkedAt * 1000).toISOString()) })
            : t('nodeDetail.privacyProtocol.waiting')}
          tone={health.system.service_manager?.active_state === 'active' ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-white/5 bg-black/20'}
        />
      </div>

      <p className="mt-3 text-[11px] leading-5 text-gray-600">{t('nodeDetail.privacyProtocol.privacyBoundary')}</p>
    </div>
  );
}

function ServiceConfigurationPanel({ health }: { health: VpnNodeHealth }) {
  const { t, formatNumber } = useI18n();
  const pending = t('common.status.pending');
  const manager = health.system.service_manager ?? null;
  const upgrade = health.system.upgrade_status ?? null;
  const runtime = health.system.runtime ?? null;
  const rollout = runtimeRolloutForNode(health);
  const capacity = health.system.capacity ?? null;
  const transport = health.system.transport_health ?? null;
  const configuredMtu = typeof health.system.configured_mtu === 'number'
    ? formatNumber(health.system.configured_mtu)
    : pending;
  const runningMtu = typeof health.system.running_mtu === 'number'
    ? formatNumber(health.system.running_mtu)
    : pending;
  const repoDir = upgrade?.repo_dir || inferRustRepoDir(health);
  const configPath = upgrade?.config || '/etc/aeronyx/server.toml';
  const serviceName = upgrade?.service || manager?.service_name || 'aeronyx-server';
  const executablePath = rollout?.executable_path?.replace(/\s+\(deleted\)$/, '').trim()
    || t('common.status.pending');
  const supportedTransports = transport?.supported_transports ?? health.system.supported_transports ?? [];
  const configuredTransports = transport?.configured_transports ?? [];
  const preferredTransport = transport?.preferred_transport ?? health.system.preferred_transport ?? null;
  const effectiveTransport = transport?.effective_transport ?? null;
  const dnsProxy = health.system.dns_proxy_enabled === true
    ? t('nodeDetail.serviceConfig.enabled')
    : health.system.dns_proxy_enabled === false
      ? t('nodeDetail.serviceConfig.disabled')
      : pending;
  const serviceTone = manager?.active_state === 'active'
    ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
    : manager
      ? 'border-yellow-500/25 bg-yellow-500/[0.06]'
      : 'border-gray-500/20 bg-gray-500/[0.04]';

  return (
    <div id="service-config-panel" className="mt-5 scroll-mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white">{t('nodeDetail.serviceConfig.title')}</h4>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${manager ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-gray-500/25 bg-gray-500/10 text-gray-300'}`}>
              {manager ? t('nodeDetail.serviceConfig.reported') : t('nodeDetail.serviceConfig.waiting')}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {t('nodeDetail.serviceConfig.description')}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500 lg:max-w-md">
          <p className="font-medium text-gray-300">{t('nodeDetail.serviceConfig.source')}</p>
          <p className="mt-1 break-words [overflow-wrap:anywhere]">
            {transport?.source || manager?.detail || upgrade?.source || 'system_stats.vpn_health'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CapacityMetric
          label={t('nodeDetail.serviceConfig.service')}
          value={serviceName}
          detail={manager
            ? t('nodeDetail.serviceConfig.serviceDetail', {
                manager: manager.manager || pending,
                active: manager.active_state || pending,
                load: manager.load_state || pending,
              })
            : t('nodeDetail.serviceConfig.waitingService')}
          tone={serviceTone}
        />
        <CapacityMetric
          label={t('nodeDetail.serviceConfig.configPath')}
          value={configPath}
          detail={t('nodeDetail.serviceConfig.configDetail')}
          tone="border-white/5 bg-black/20"
        />
        <CapacityMetric
          label={t('nodeDetail.serviceConfig.repository')}
          value={repoDir}
          detail={t('nodeDetail.serviceConfig.repositoryDetail', {
            branch: upgrade?.branch || pending,
          })}
          tone="border-white/5 bg-black/20"
        />
        <CapacityMetric
          label={t('nodeDetail.serviceConfig.executable')}
          value={shortRuntimeValue(executablePath, 42)}
          detail={runtime?.source || rollout?.source || t('nodeDetail.serviceConfig.runtimeSource')}
          tone={rollout?.restart_required ? 'border-yellow-500/25 bg-yellow-500/[0.06]' : 'border-white/5 bg-black/20'}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CapacityMetric
          label={t('nodeDetail.serviceConfig.virtualRange')}
          value={capacity?.virtual_ip_range || pending}
          detail={t('nodeDetail.serviceConfig.virtualRangeDetail', {
            used: serviceConfigValue(capacity?.ip_pool_used, pending),
            free: serviceConfigValue(capacity?.ip_pool_free, pending),
          })}
          tone="border-sky-500/15 bg-sky-500/[0.04]"
        />
        <CapacityMetric
          label={t('nodeDetail.serviceConfig.tunMtu')}
          value={capacity?.interface?.interface || pending}
          detail={t('nodeDetail.serviceConfig.tunMtuDetail', {
            configured: configuredMtu,
            running: runningMtu,
          })}
          tone="border-sky-500/15 bg-sky-500/[0.04]"
        />
        <CapacityMetric
          label={t('nodeDetail.serviceConfig.dns')}
          value={dnsOwnerLabel(health.system.dns_owner, t)}
          detail={t('nodeDetail.serviceConfig.dnsDetail', { proxy: dnsProxy })}
          tone={health.system.dns_owner === 'rust_dns_proxy' ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-white/5 bg-black/20'}
        />
        <CapacityMetric
          label={t('nodeDetail.serviceConfig.transports')}
          value={formatTransportList(supportedTransports, t)}
          detail={t('nodeDetail.serviceConfig.transportsDetail', {
            configured: formatTransportList(configuredTransports, t),
            preferred: formatTransportKey(preferredTransport, t),
            effective: formatTransportKey(effectiveTransport, t),
          })}
          tone={transport?.fallback_available ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-white/5 bg-black/20'}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <a href="#capacity-panel" className="rounded-lg border border-white/5 bg-black/20 p-3 text-xs leading-5 text-gray-400 transition hover:border-white/20 hover:bg-white/[0.04]">
          <span className="font-semibold text-gray-200">{t('nodeDetail.serviceConfig.openCapacity')}</span>
          <span className="mt-1 block text-gray-500">{t('nodeDetail.serviceConfig.openCapacityDetail')}</span>
        </a>
        <a href="#runtime-panel" className="rounded-lg border border-white/5 bg-black/20 p-3 text-xs leading-5 text-gray-400 transition hover:border-white/20 hover:bg-white/[0.04]">
          <span className="font-semibold text-gray-200">{t('nodeDetail.serviceConfig.openRuntime')}</span>
          <span className="mt-1 block text-gray-500">{t('nodeDetail.serviceConfig.openRuntimeDetail')}</span>
        </a>
        <a href="#operator-runbook" className="rounded-lg border border-white/5 bg-black/20 p-3 text-xs leading-5 text-gray-400 transition hover:border-white/20 hover:bg-white/[0.04]">
          <span className="font-semibold text-gray-200">{t('nodeDetail.serviceConfig.openRunbook')}</span>
          <span className="mt-1 block text-gray-500">{t('nodeDetail.serviceConfig.openRunbookDetail')}</span>
        </a>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <a href="/dashboard/services?section=capacity" className="rounded-lg border border-sky-500/15 bg-sky-500/[0.04] p-3 text-xs leading-5 text-sky-100/70 transition hover:border-sky-400/30 hover:bg-sky-500/[0.08]">
          <span className="font-semibold text-sky-100">{t('nodeDetail.serviceConfig.openFleetCapacity')}</span>
          <span className="mt-1 block text-sky-100/50">{t('nodeDetail.serviceConfig.openFleetCapacityDetail')}</span>
        </a>
        <a href="/dashboard/services?section=transport" className="rounded-lg border border-sky-500/15 bg-sky-500/[0.04] p-3 text-xs leading-5 text-sky-100/70 transition hover:border-sky-400/30 hover:bg-sky-500/[0.08]">
          <span className="font-semibold text-sky-100">{t('nodeDetail.serviceConfig.openFleetTransport')}</span>
          <span className="mt-1 block text-sky-100/50">{t('nodeDetail.serviceConfig.openFleetTransportDetail')}</span>
        </a>
        <a href="/dashboard/services?section=dns" className="rounded-lg border border-sky-500/15 bg-sky-500/[0.04] p-3 text-xs leading-5 text-sky-100/70 transition hover:border-sky-400/30 hover:bg-sky-500/[0.08]">
          <span className="font-semibold text-sky-100">{t('nodeDetail.serviceConfig.openFleetDns')}</span>
          <span className="mt-1 block text-sky-100/50">{t('nodeDetail.serviceConfig.openFleetDnsDetail')}</span>
        </a>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-gray-600">{t('nodeDetail.serviceConfig.privacyBoundary')}</p>
    </div>
  );
}

function UpgradeWorkflowPanel({ health }: { health: VpnNodeHealth }) {
  const { t } = useI18n();
  const upgrade = health.system.upgrade_status ?? null;
  const reported = Boolean(upgrade?.reported);
  const status = upgrade?.status ?? null;
  const tone = upgradeWorkflowTone(status, reported);
  const meta = upgradeWorkflowMeta(status, reported, t);
  const action = upgradeWorkflowAction(status, reported, t);
  const statusValue = meta;
  const stepValue = upgrade?.step || t('common.status.pending');
  const updatedValue = upgrade?.updated_at ? formatRelativeTime(upgrade.updated_at) : t('common.status.pending');
  const branchValue = upgrade?.branch || t('common.status.pending');
  const repoValue = upgrade?.repo_dir || inferRustRepoDir(health);
  const serviceValue = upgrade?.service || 'aeronyx-server';
  const configValue = upgrade?.config || '/etc/aeronyx/server.toml';
  const noRestartValue = upgrade?.no_restart === true
    ? t('common.yes')
    : upgrade?.no_restart === false
      ? t('common.no')
      : t('common.status.pending');
  const forceValue = upgrade?.force === true
    ? t('common.yes')
    : upgrade?.force === false
      ? t('common.no')
      : t('common.status.pending');

  return (
    <div id="upgrade-workflow" className={`mt-5 scroll-mt-6 rounded-xl border p-4 ${operatorActionToneClass(tone)}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white">{t('nodeDetail.upgradeWorkflow.title')}</h4>
            <span className={`inline-flex rounded-full border px-2 py-1 text-xs uppercase tracking-wide ${operatorActionBadgeClass(tone)}`}>
              {meta}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.upgradeWorkflow.description')}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-500 lg:max-w-md">
          <p className="font-medium text-gray-300">{t('nodeDetail.upgradeWorkflow.operatorAction')}</p>
          <p className="mt-1 leading-5">{action}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CapacityMetric
          label={t('nodeDetail.upgradeWorkflow.status')}
          value={statusValue}
          detail={reported ? t('nodeDetail.upgradeWorkflow.reported') : t('nodeDetail.upgradeWorkflow.waiting')}
          tone="border-white/5 bg-black/20"
        />
        <CapacityMetric
          label={t('nodeDetail.upgradeWorkflow.step')}
          value={stepValue}
          detail={upgrade?.message || t('nodeDetail.upgradeWorkflow.stepDetail')}
          tone={tone === 'warning' ? 'border-yellow-500/25 bg-yellow-500/[0.06]' : 'border-white/5 bg-black/20'}
        />
        <CapacityMetric
          label={t('nodeDetail.upgradeWorkflow.updated')}
          value={updatedValue}
          detail={upgrade?.updated_at || t('common.status.pending')}
          tone="border-white/5 bg-black/20"
        />
        <CapacityMetric
          label={t('nodeDetail.upgradeWorkflow.branch')}
          value={branchValue}
          detail={t('nodeDetail.upgradeWorkflow.flags', { noRestart: noRestartValue, force: forceValue })}
          tone="border-white/5 bg-black/20"
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-white/5 bg-black/20 p-3 lg:col-span-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">{t('nodeDetail.upgradeWorkflow.repoDir')}</p>
          <p className="mt-1 break-words font-mono text-xs leading-5 text-gray-300 [overflow-wrap:anywhere]">{repoValue}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">{t('nodeDetail.upgradeWorkflow.service')}</p>
          <p className="mt-1 break-words font-mono text-xs leading-5 text-gray-300 [overflow-wrap:anywhere]">{serviceValue}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 p-3 lg:col-span-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">{t('nodeDetail.upgradeWorkflow.config')}</p>
          <p className="mt-1 break-words font-mono text-xs leading-5 text-gray-300 [overflow-wrap:anywhere]">{configValue}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">{t('nodeDetail.upgradeWorkflow.source')}</p>
          <p className="mt-1 break-words font-mono text-xs leading-5 text-gray-300 [overflow-wrap:anywhere]">
            {upgrade?.source || 'system_stats.vpn_health.upgrade_status'}
          </p>
        </div>
      </div>

      {upgrade?.message ? (
        <div className="mt-3 rounded-lg border border-white/5 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">{t('nodeDetail.upgradeWorkflow.message')}</p>
          <p className="mt-1 break-words text-xs leading-5 text-gray-300 [overflow-wrap:anywhere]">{upgrade.message}</p>
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-gray-600">
        {upgrade?.privacy_boundary || t('nodeDetail.upgradeWorkflow.privacyBoundary')}
      </p>
    </div>
  );
}

function CommandResultPanel({ command }: { command: NodeCommand }) {
  const { t } = useI18n();
  const parsed = parseCommandResult(command, t);
  const copyText = parsed.kind === 'logs'
    ? (parsed.body || parsed.summary)
    : commandMessage(command, t);

  return (
    <div className="mt-3 rounded-xl border border-white/5 bg-black/20 overflow-hidden">
      <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-gray-300">{parsed.title}</span>
        <div className="flex items-center gap-2">
          {command.result?.timestamp ? (
            <span className="text-[11px] text-gray-600">
              {t('nodeDetail.commands.nodeTime', { time: String(command.result.timestamp) })}
            </span>
          ) : null}
          <CopyButton text={copyText} />
        </div>
      </div>

      {parsed.kind === 'logs' ? (
        <div>
          <p className="px-3 pt-2 text-xs text-gray-500">{parsed.summary}</p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words px-3 pb-3 text-xs text-gray-400 font-mono">
            {parsed.body || t('nodeDetail.commands.noLogLines')}
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

function commandLabel(command: NodeCommand, t: TranslateFn) {
  const labels: Record<string, string> = {
    system_info: t('events.command.systemInfo'),
    collect_logs: t('events.command.collectLogs'),
    refresh_config: t('events.command.refreshConfig'),
    apply_policy: t('events.command.applyPolicy'),
    restart_service: t('events.command.restartService'),
    kick_session: t('events.command.kickSession'),
    ban_wallet: t('events.command.banWallet'),
    unban_wallet: t('events.command.unbanWallet'),
  };
  return labels[command.action] || command.action_display || command.action;
}

function canCancelCommand(command: NodeCommand) {
  return command.status === 'pending' || command.status === 'sent';
}

function CommandLifecycle({ command }: { command: NodeCommand }) {
  const { t, formatRelativeTime: i18nRelativeTime } = useI18n();
  const steps = [
    { label: t('nodeDetail.commands.lifecycleQueued'), value: command.created_at },
    { label: t('nodeDetail.commands.lifecycleSent'), value: command.sent_at },
    { label: t('nodeDetail.commands.lifecycleAcked'), value: command.acked_at },
    { label: t('nodeDetail.commands.lifecycleDone'), value: command.completed_at },
  ];

  return (
    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
      {steps.map((step) => (
        <div key={step.label} className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5">
          <p className="text-[11px] uppercase text-gray-600">{step.label}</p>
          <p className={`text-xs mt-0.5 ${step.value ? 'text-gray-300' : 'text-gray-600'}`}>
            {step.value ? i18nRelativeTime(step.value) : t('common.status.pending')}
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
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();

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
        <h4 className="text-sm font-semibold text-white">{t('nodeDetail.metrics.title')}</h4>
        <p className="text-sm text-gray-500 mt-2">{t('nodeDetail.metrics.empty')}</p>
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
          <h4 className="text-sm font-semibold text-white">{t('nodeDetail.metrics.title')}</h4>
          <p className="text-xs text-gray-500 mt-1">
            {t('nodeDetail.metrics.sampledUpdated', {
              count: formatNumber(metrics.sample_count),
              time: i18nRelativeTime(metrics.generated_at),
            })}
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {t('nodeDetail.metrics.invalidSamples', { count: formatNumber(metrics.summary.invalid_samples) })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">{t('nodeDetail.metrics.avgCpu')}</p>
          <p className="text-lg font-semibold text-white mt-1">
            {metrics.summary.avg_cpu_usage === null ? t('common.status.pending') : `${formatNumber(metrics.summary.avg_cpu_usage)}%`}
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">{t('nodeDetail.metrics.peakBandwidth')}</p>
          <p className="text-lg font-semibold text-white mt-1">
            {formatBitsPerSecond(metrics.summary.peak_total_bps)}
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">{t('nodeDetail.metrics.trafficDelta')}</p>
          <p className="text-lg font-semibold text-white mt-1">{formatBytes(totalTraffic, 1)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">{t('nodeDetail.metrics.maxSessions')}</p>
          <p className="text-lg font-semibold text-white mt-1">{formatNumber(metrics.summary.max_active_sessions)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">{t('nodeDetail.metrics.cpuLoad')}</span>
            <span className="text-xs text-gray-500">{t('nodeDetail.metrics.peakValue', { value: `${formatNumber(metrics.summary.max_cpu_usage ?? 0)}%` })}</span>
          </div>
          <TrendBars
            points={metrics.points}
            getValue={(point) => point.cpu_usage}
            maxValue={cpuMax}
            colorClass="bg-emerald-400/80"
            formatValue={(value) => value === null ? t('common.status.pending') : `${formatNumber(value)}%`}
          />
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">{t('nodeDetail.metrics.bandwidth')}</span>
            <span className="text-xs text-gray-500">{t('nodeDetail.metrics.peakValue', { value: formatBitsPerSecond(metrics.summary.peak_total_bps) })}</span>
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
  const { t, formatNumber } = useI18n();
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
          <h4 className="text-sm font-semibold text-white">{t('nodeDetail.bandwidth.title')}</h4>
          <p className="text-xs text-gray-500 mt-1">
            {t('nodeDetail.bandwidth.description')}
          </p>
        </div>
        <div className={drops > 0 || runtimeMismatch ? 'text-sm font-semibold text-yellow-300' : 'text-sm font-semibold text-emerald-300'}>
          {drops > 0
            ? t('nodeDetail.bandwidth.drops', { count: formatNumber(drops) })
            : runtimeMismatch
              ? t('nodeDetail.bandwidth.syncPending')
              : t('services.placement.clear')}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.bandwidth.configuredCap')}</p>
          <p className="text-base font-semibold text-white mt-1">{formatBandwidthLimit(configuredLimit)}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">{t('nodeDetail.bandwidth.nodeboardPolicy')}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.bandwidth.rustRuntime')}</p>
          <p className={`text-base font-semibold mt-1 ${runtimeMismatch ? 'text-yellow-200' : 'text-white'}`}>
            {runtimeLimit === null ? t('common.status.pending') : formatBandwidthLimit(runtimeLimit)}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">{t('nodeDetail.bandwidth.policyStatus', { status: syncStatus })}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.bandwidth.peak24h')}</p>
          <p className="text-base font-semibold text-white mt-1">{formatBitsPerSecond(peakBps)}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">{t('nodeDetail.bandwidth.samples', { count: formatNumber(metrics?.sample_count ?? 0) })}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.bandwidth.peakCap')}</p>
          <p className={`text-base font-semibold mt-1 ${
            drops > 0 || (bandwidthLimitBps(configuredLimit) > 0 && typeof peakBps === 'number' && peakBps >= bandwidthLimitBps(configuredLimit) * 0.9)
              ? 'text-yellow-200'
              : 'text-white'
          }`}>
            {formatLimitUsage(peakBps, configuredLimit)}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">{t('nodeDetail.bandwidth.packetDrops', { count: formatNumber(drops) })}</p>
        </div>
      </div>

      {runtimeMismatch ? (
        <p className="mt-3 text-xs text-yellow-300">
          {t('nodeDetail.bandwidth.mismatchNotice')}
        </p>
      ) : null}
    </div>
  );
}

function PolicyEnforcementPanel({ health }: { health: VpnNodeHealth }) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
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
          <h4 className="text-sm font-semibold text-white">{t('nodeDetail.policy.title')}</h4>
          <p className="text-xs text-gray-500 mt-1">
            {t('nodeDetail.policy.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${telemetrySourceClass(telemetrySource)}`}>
            {telemetrySourceLabel(telemetrySource, t)}
          </span>
          <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${policyImpactClass(impactStatus)}`}>
            {policyImpactLabel(impactStatus, t)}
          </span>
          <span className={activeImpact ? 'text-sm font-semibold text-yellow-300' : total > 0 ? 'text-sm font-semibold text-sky-300' : 'text-sm font-semibold text-emerald-300'}>
            {t('nodeDetail.policy.blockedCount', { count: formatNumber(total) })}
          </span>
        </div>
      </div>

      <div className={`mb-3 rounded-lg border px-3 py-2 ${syncClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <p className="text-xs font-semibold uppercase">{t('nodeDetail.policy.policySync', { status: syncStatus })}</p>
            <p className="mt-1 text-xs opacity-80">
              {policySync?.message || t('settings.policySync.waiting')}
            </p>
          </div>
          <div className="text-xs opacity-80">
            {t('settings.policySync.heartbeat', { value: policySync?.heartbeat_age_seconds ?? health.last_seen_seconds ?? t('common.status.pending') })}
          </div>
        </div>
        {mismatched ? (
          <p className="mt-1 text-xs opacity-80">{t('nodeDetail.policy.pendingFields', { fields: mismatched })}</p>
        ) : null}
      </div>

      <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${telemetrySourceClass(telemetrySource)}`}>
        <p className="font-semibold uppercase">{t('nodeDetail.policy.telemetrySource', { source: telemetrySourceLabel(telemetrySource, t) })}</p>
        <p className="mt-1 opacity-80">{telemetrySourceDetail(telemetrySource, health.last_seen_seconds, t)}</p>
      </div>

      <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${policyImpactClass(impactStatus)}`}>
        <p className="font-semibold uppercase">{t('nodeDetail.policy.policyImpact', { impact: policyImpactLabel(impactStatus, t) })}</p>
        <p className="mt-1 opacity-80">
          {policyImpactDetail(impactStatus, enforcement?.last_rejection_age_seconds, enforcement?.recent_block_window_seconds, t)}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('settings.policyEditor.maintenanceMode')}</p>
          <p className="text-base font-semibold text-white mt-1">{formatNumber(maintenance)}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('settings.policyEditor.maxSessions')}</p>
          <p className="text-base font-semibold text-white mt-1">{formatNumber(maxSessions)}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.policy.bandwidthDrops')}</p>
          <p className={`text-base font-semibold mt-1 ${activeImpact && bandwidth > 0 ? 'text-yellow-200' : bandwidth > 0 ? 'text-sky-200' : 'text-white'}`}>{formatNumber(bandwidth)}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">{t('nodeDetail.policy.rejectedBytes', { bytes: formatBytes(bandwidthDropBytes) })}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2 min-w-0">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.policy.lastRejection')}</p>
          <p className="text-xs text-gray-300 mt-1 truncate">
            {formatPolicyReason(enforcement?.last_rejection_reason)}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {lastAt ? i18nRelativeTime(lastAt) : t('nodeDetail.policy.noRecentBlock')}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
        <div className="grid gap-2 sm:grid-cols-5 text-xs">
          <div>
            <p className="text-gray-600">{t('nodeDetail.policy.limiterSnapshot')}</p>
            <p className="mt-0.5 text-gray-300">
              {bandwidthLimitBpsSnapshot > 0 ? formatBitsPerSecond(bandwidthLimitBpsSnapshot * 8) : t('nodes.policy.unlimited')}
            </p>
          </div>
          <div>
            <p className="text-gray-600">{t('nodeDetail.policy.currentWindow')}</p>
            <p className="mt-0.5 text-gray-300">{formatBytes(bandwidthWindowBytes)}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('nodeDetail.policy.telemetry')}</p>
            <p className="mt-0.5 text-gray-300">{telemetrySourceLabel(telemetrySource, t)}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('nodeDetail.policy.counterScope')}</p>
            <p className="mt-0.5 text-gray-300">{formatUnixSecondsRelative(enforcement?.counters_started_at)}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('nodeDetail.policy.rustSource')}</p>
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

function runtimeRecoveryLabel(status: string, t: TranslateFn) {
  const labels: Record<string, string> = {
    stable: t('nodeDetail.runtimeRecovery.status.stable'),
    restarted_recently: t('nodeDetail.runtimeRecovery.status.restarted'),
    sessions_interrupted: t('nodeDetail.runtimeRecovery.status.recovered'),
    unknown: t('common.status.pending'),
  };
  return labels[status] || status.replace(/_/g, ' ');
}

function RuntimeRecoveryPanel({ health }: { health: VpnNodeHealth }) {
  const { t, formatRelativeTime: i18nRelativeTime, formatNumber } = useI18n();
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
          <h4 className="text-sm font-semibold text-white">{t('nodeDetail.runtimeRecovery.title')}</h4>
          <p className="text-xs text-gray-500 mt-1">
            {t('nodeDetail.runtimeRecovery.description')}
          </p>
        </div>
        <span className={`inline-flex self-start rounded-full border px-2.5 py-1 text-xs ${
          status === 'sessions_interrupted'
            ? 'border-yellow-500/25 bg-yellow-500/15 text-yellow-300'
            : status === 'stable'
              ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300'
              : 'border-sky-500/25 bg-sky-500/15 text-sky-300'
        }`}>
          {runtimeRecoveryLabel(status, t)}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2 min-w-0">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.runtimeRecovery.runtimeId')}</p>
          <div className="mt-1 flex items-center gap-1 min-w-0">
            <p className="text-xs font-mono text-gray-300 truncate">
              {runtimeId ? `${runtimeId.slice(0, 12)}...` : t('common.status.pending')}
            </p>
            {runtimeId ? <CopyButton text={runtimeId} /> : null}
          </div>
          <p className="text-[11px] text-gray-600 mt-0.5">{t('nodeDetail.runtimeRecovery.processIdentity')}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.runtimeRecovery.processUptime')}</p>
          <p className="text-base font-semibold text-white mt-1">
            {uptimeSeconds === null ? t('common.status.pending') : formatDuration(uptimeSeconds)}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {runtimeStartedAt ? t('nodeDetail.runtimeRecovery.started', { time: i18nRelativeTime(runtimeStartedAt) }) : t('nodeDetail.health.waitingHeartbeat')}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.runtimeRecovery.restart24h')}</p>
          <p className={`text-base font-semibold mt-1 ${recovery?.restarted_within_24h ? 'text-sky-200' : 'text-white'}`}>
            {recovery?.restarted_within_24h ? t('common.yes') : status === 'unknown' ? t('common.status.pending') : t('common.no')}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">{t('nodeDetail.runtimeRecovery.startWindow')}</p>
        </div>
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.runtimeRecovery.interruptedSessions')}</p>
          <p className={`text-base font-semibold mt-1 ${interrupted > 0 ? 'text-yellow-200' : 'text-white'}`}>
            {formatNumber(interrupted)}
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {recovery?.last_interrupted_at ? t('nodeDetail.runtimeRecovery.last', { time: i18nRelativeTime(recovery.last_interrupted_at) }) : t('nodeDetail.runtimeRecovery.last24h')}
          </p>
        </div>
      </div>

      <p className={`mt-3 text-xs ${status === 'sessions_interrupted' ? 'text-yellow-200' : 'text-gray-500'}`}>
        {recovery?.message || t('nodeDetail.runtimeRecovery.waitingTelemetry')}
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
    blockers.push('Start maintenance mode first so new AeroNyx protocol handshakes stop before restart.');
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

function drainActivityBucketRows(eta: VpnRestartDrainEta | null | undefined): Array<{
  labelKey: string;
  values?: Record<string, string | number>;
  value: number;
  tone: string;
}> {
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
      labelKey: 'nodeDetail.drain.clientRxRecent',
      values: { duration: formatDuration(eta.activity_window_seconds || 180) },
      value: eta.recent_client_rx_sessions ?? eta.recent_activity_sessions ?? 0,
      tone: 'text-emerald-200',
    },
    {
      labelKey: 'nodeDetail.drain.clientRxStale',
      value: Math.max(
        0,
        (eta.stale_client_rx_sessions ?? eta.idle_activity_sessions ?? 0) - (eta.never_client_rx_sessions ?? 0),
      ),
      tone: 'text-yellow-100',
    },
    {
      labelKey: 'nodeDetail.drain.neverClientRx',
      value: eta.never_client_rx_sessions ?? 0,
      tone: 'text-red-100',
    },
    {
      labelKey: 'nodeDetail.drain.runtimeActivity',
      values: { duration: formatDuration(eta.activity_window_seconds || 180) },
      value: eta.recent_activity_sessions ?? 0,
      tone: 'text-sky-100',
    },
    {
      labelKey: 'nodeDetail.drain.idleOrStale',
      value: eta.idle_activity_sessions ?? 0,
      tone: 'text-yellow-100',
    },
    {
      labelKey: 'nodeDetail.drain.noActivityStamp',
      value: eta.activity_pending_sessions ?? 0,
      tone: 'text-gray-300',
    },
    {
      labelKey: 'nodeDetail.drain.missedKeepaliveSessions',
      values: { total: (eta.keepalive_missed_total ?? 0).toLocaleString() },
      value: eta.keepalive_missed_sessions ?? 0,
      tone: 'text-yellow-100',
    },
    {
      labelKey: 'nodeDetail.drain.pendingKeepaliveSessions',
      values: { total: (eta.keepalive_pending_total ?? 0).toLocaleString() },
      value: eta.keepalive_pending_sessions ?? 0,
      tone: 'text-sky-100',
    },
    {
      labelKey: 'nodeDetail.drain.missedKeepaliveTotal',
      value: eta.keepalive_missed_total ?? 0,
      tone: 'text-yellow-100',
    },
    {
      labelKey: 'nodeDetail.drain.pendingKeepaliveTotal',
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

function nodeCommandDelivery(health: VpnNodeHealth, readiness: VpnRestartReadiness | null | undefined, t: TranslateFn) {
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
      label: t('nodeDetail.commandDelivery.heartbeatMissing'),
      status: 'blocked',
      risk: 'critical',
      detail: t('nodeDetail.commandDelivery.missingDetail'),
      nextStep: t('nodeDetail.commandDelivery.missingNextStep'),
      source: 'data.nodes[].last_seen_seconds + data.nodes[].system.restart_readiness.operator_reporting',
      privacyBoundary: '',
    };
  }
  if (age > COMMAND_DELIVERY_DEGRADED_SECONDS) {
    return {
      label: t('nodeDetail.commandDelivery.heartbeatOffline'),
      status: 'blocked',
      risk: 'critical',
      detail: t('nodeDetail.commandDelivery.lastHeartbeatAgo', { age: formatDuration(age) }),
      nextStep: t('nodeDetail.commandDelivery.offlineNextStep'),
      source: 'data.nodes[].last_seen_seconds + data.nodes[].system.restart_readiness.operator_reporting',
      privacyBoundary: '',
    };
  }
  if (age > COMMAND_DELIVERY_FRESH_SECONDS) {
    return {
      label: t('nodeDetail.commandDelivery.heartbeatDelayed'),
      status: 'degraded',
      risk: 'warning',
      detail: t('nodeDetail.commandDelivery.lastHeartbeatAgo', { age: formatDuration(age) }),
      nextStep: t('nodeDetail.commandDelivery.delayedNextStep'),
      source: 'data.nodes[].last_seen_seconds + data.nodes[].system.restart_readiness.operator_reporting',
      privacyBoundary: '',
    };
  }
  if (!operatorReporting) {
    return {
      label: t('nodeDetail.commandDelivery.operatorReportingPending'),
      status: 'degraded',
      risk: 'warning',
      detail: t('nodeDetail.commandDelivery.operatorReportingDetail'),
      nextStep: t('nodeDetail.commandDelivery.operatorReportingNextStep'),
      source: 'data.nodes[].last_seen_seconds + data.nodes[].system.restart_readiness.operator_reporting',
      privacyBoundary: '',
    };
  }

  return {
    label: t('nodeDetail.commandDelivery.ready'),
    status: 'ready',
    risk: 'healthy',
    detail: t('nodeDetail.commandDelivery.readyDetail', { age: formatDuration(age) }),
    nextStep: t('nodeDetail.commandDelivery.readyNextStep'),
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
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
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
  const commandDelivery = nodeCommandDelivery(health, restartReadiness, t);
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
      label: maintenanceMode ? t('nodeDetail.maintenance.endMaintenance') : t('nodeDetail.maintenance.startMaintenance'),
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
      label: t('nodeDetail.commands.systemInfo'),
      intent: 'node_commands',
      priority: 5,
      enabled: true,
      detail: t('nodeDetail.commands.systemInfoDetail'),
    },
    {
      key: 'collect_logs',
      label: t('nodeDetail.commands.collectLogs'),
      intent: 'node_commands',
      priority: 6,
      enabled: true,
      detail: t('nodeDetail.commands.collectLogsDetail'),
    },
    {
      key: 'restart_service',
      label: t('nodeDetail.maintenance.restartService'),
      intent: 'node_commands',
      priority: 7,
      enabled: restartReady,
      detail: t('nodeDetail.commands.restartDetail'),
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
    <div id="maintenance-drain" className="mt-5 scroll-mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-white">{t('nodeDetail.maintenance.title')}</h4>
          <p className="text-xs text-gray-500 mt-1">
            {t('nodeDetail.maintenance.description')}{' '}
            {t('nodeDetail.maintenance.gateSource', { source: restartReadinessSourceLabel(restartReadiness) })}
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
                <p className="text-xs font-semibold text-white">{t('nodeDetail.maintenance.operatorActionPlan')}</p>
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
            {t('nodeDetail.maintenance.sourceOperatorPlan')}
          </p>
          <p className="mt-1 text-[10px] leading-4 text-gray-600">{operatorActionPlan.privacy_boundary}</p>
        </div>
      )}

      <div className={`mb-4 rounded-lg border px-3 py-2.5 ${drainActivityHealthClass(commandDelivery.risk)}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold">{t('nodeDetail.maintenance.commandDelivery')}</p>
            <p className="mt-1 text-[11px] leading-5 opacity-75">{commandDelivery.detail}</p>
          </div>
          <span className="inline-flex self-start rounded-md border border-white/10 px-2 py-0.5 text-[11px]">
            {commandDelivery.label}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-5 opacity-75">{commandDelivery.nextStep}</p>
        <p className="mt-1 text-[10px] leading-4 opacity-45">
          {t('nodeDetail.maintenance.sourceValue', { source: commandDelivery.source })}
        </p>
        {commandDelivery.privacyBoundary && (
          <p className="mt-1 text-[10px] leading-4 opacity-45">{commandDelivery.privacyBoundary}</p>
        )}
      </div>

      {restartBlockers.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.05] px-3 py-2.5">
          <p className="text-xs font-medium text-yellow-200">{t('nodeDetail.maintenance.restartBlockers')}</p>
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
              <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.maintenance.stepMaintenance')}</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {maintenanceMode ? t('nodeDetail.maintenance.newHandshakesBlocked') : t('nodeDetail.maintenance.acceptingHandshakes')}
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
            {maintenanceMode ? t('nodeDetail.maintenance.endMaintenance') : t('nodeDetail.maintenance.startMaintenance')}
          </Button>
        </div>

        <div className={`rounded-lg border px-3 py-3 ${drainStepClass(drainReady, activeTunnels > 0)}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.maintenance.stepDrain')}</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {t('nodeDetail.maintenance.activeTunnels', { count: formatNumber(drainDisplaySessions) })}
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
              {backendDrainEta?.next_step || restartReadiness?.next_step || t('nodeDetail.maintenance.waitingDrainStatus')}
            </p>
            {backendDrainEta?.privacy_boundary && (
              <p className="mt-1 text-[10px] leading-4 opacity-50">{backendDrainEta.privacy_boundary}</p>
            )}
          </div>
          {drainActivityBuckets.length > 0 && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-[11px] font-medium text-gray-300">{t('nodeDetail.maintenance.aggregateDrainActivity')}</p>
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
                  <div key={bucket.labelKey} className="rounded-md bg-white/[0.03] px-2 py-1.5">
                    <p className={`text-sm font-semibold ${bucket.tone}`}>{formatNumber(bucket.value)}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-gray-500">{t(bucket.labelKey, bucket.values)}</p>
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
            {t('nodeDetail.maintenance.openActiveSessions')}
          </a>
          <div className="mt-3 space-y-1 text-[11px] text-gray-500">
            <p>
              {t('nodeDetail.maintenance.sessionPoll', {
                listed: activeSessionsLoading
                  ? t('common.refreshing')
                  : t('nodeDetail.maintenance.listedCount', { count: formatNumber(listedActiveTunnels) }),
                reported: listedActiveTunnels !== activeTunnels
                  ? t('nodeDetail.maintenance.reportedCount', { count: formatNumber(activeTunnels) })
                  : '',
              })}
            </p>
            <p>
              {t('nodeDetail.maintenance.oldestActive', {
                value: backendDrainEta?.oldest_started_at
                  ? i18nRelativeTime(backendDrainEta.oldest_started_at)
                  : oldestStartedAt ? i18nRelativeTime(oldestStartedAt) : t('nodeDetail.maintenance.none'),
              })}
            </p>
            <p>
              {t('nodeDetail.maintenance.latestClientRx', {
                value: backendDrainEta?.latest_client_rx_at
                  ? i18nRelativeTime(backendDrainEta.latest_client_rx_at)
                  : newestActivityAt ? i18nRelativeTime(newestActivityAt) : t('nodeDetail.maintenance.none'),
              })}
            </p>
            {backendDrainEta?.latest_server_tx_at && (
              <p>{t('nodeDetail.maintenance.latestServerTx', { value: i18nRelativeTime(backendDrainEta.latest_server_tx_at) })}</p>
            )}
            <p>{t('nodeDetail.maintenance.listedTraffic', { value: formatBytes(listedTrafficBytes, 1) })}</p>
            <p>
              {t('nodeDetail.maintenance.staleClientCleanup', { value: backendDrainEta?.cleanup_timeout_seconds || cleanupTimeoutSeconds
                ? formatDuration(backendDrainEta?.cleanup_timeout_seconds || cleanupTimeoutSeconds || 0)
                : t('nodeDetail.maintenance.pendingRustRollout') })}
            </p>
            {missedKeepalives > 0 && <p>{t('nodeDetail.maintenance.missedKeepalives', { count: formatNumber(missedKeepalives) })}</p>}
          </div>
        </div>

        <div className={`rounded-lg border px-3 py-3 ${drainStepClass(restartReady, restartCommandActive || !restartSupported)}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.maintenance.stepRestart')}</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {restartSupported ? t('nodeDetail.maintenance.serviceCommand') : t('nodeDetail.maintenance.restartUnavailable')}
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
            {t('nodeDetail.maintenance.restartService')}
          </Button>
          {!restartReady && (
            <p className="mt-2 text-[11px] text-yellow-200">
              {restartReadiness?.next_step || t('nodeDetail.maintenance.restartUnlocks')}
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
                {runtimeRecoveryLabel(recoveryStatus, t)}
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

function ServiceReadinessPanel({
  nodeId,
  isVpnNode,
  installStatus,
}: {
  nodeId: string;
  isVpnNode: boolean;
  installStatus?: NodeInstallProgressSummary | null;
}) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  const { overview, isLoading, isError, refetch } = useVpnOverview();
  const health = overview?.nodes.find((item) => item.id === nodeId) ?? null;
  const operatorStatus = health?.system.operator_status ?? null;
  const runtimeRollout = operatorStatus?.runtime_rollout ?? null;
  const totals = operatorStatus ? operatorStatusTotals(operatorStatus) : null;

  if (!isVpnNode) {
    return (
      <Card variant="outline" padding="md" className="mb-6">
        <h3 className="font-semibold text-white">{t('nodeDetail.service.title')}</h3>
        <p className="mt-2 text-sm text-gray-500">
          {t('nodeDetail.service.disabled')}
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
            <h3 className="font-semibold text-white">{t('nodeDetail.service.title')}</h3>
            <p className="mt-1 text-sm text-yellow-300">
              {hasHeartbeatWithoutOperatorStatus
                ? t('nodeDetail.service.operatorMissingLive')
                : t('nodeDetail.service.operatorWaiting')}
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              {t('nodeDetail.service.backendContract')}
            </p>
            {health && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.service.privacyHealth')}</p>
                  <p className="mt-1 text-xs text-gray-300">{health.health_status}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.stats.activeSessions')}</p>
                  <p className="mt-1 text-xs text-gray-300">{formatNumber(health.active_sessions)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.service.upgradePath')}</p>
                  <p className="mt-1 text-xs text-gray-300">
                    {health.active_sessions > 0 ? t('nodeDetail.service.drainBeforeRestart') : t('nodeDetail.service.restartRustNode')}
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
                    {t('nodeDetail.service.legacyRuntime')}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">{t('nodeDetail.service.clientRxRecent')}</p>
                    <p className="mt-1 text-xs text-yellow-100">{legacyDrain.recentClientRx ?? t('common.status.pending')}</p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">{t('nodeDetail.service.clientRxStale')}</p>
                    <p className="mt-1 text-xs text-yellow-100">{legacyDrain.staleClientRx ?? t('common.status.pending')}</p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">{t('nodeDetail.service.neverRx')}</p>
                    <p className="mt-1 text-xs text-yellow-100">{legacyDrain.neverClientRx ?? t('common.status.pending')}</p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">{t('nodeDetail.service.keepaliveIssue')}</p>
                    <p className="mt-1 text-xs text-yellow-100">{formatNumber(legacyDrain.keepaliveIssue)}</p>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">{t('nodeDetail.service.cutoverStatus')}</p>
                    <p className="mt-1 text-xs text-yellow-100">
                      {legacyDrain.cutoverStatus ? legacyDrain.cutoverStatus.replaceAll('_', ' ') : t('common.status.pending')}
                    </p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">{t('nodeDetail.commercial.safeNow')}</p>
                    <p className="mt-1 text-xs text-yellow-100">
                      {legacyDrain.safeToCutover === null ? t('common.status.pending') : legacyDrain.safeToCutover ? t('settings.policyEditor.yes') : t('settings.policyEditor.no')}
                    </p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">{t('nodeDetail.service.latestClientRxLabel')}</p>
                    <p className="mt-1 text-xs text-yellow-100">
                      {legacyDrain.latestClientRxAt ? i18nRelativeTime(legacyDrain.latestClientRxAt) : t('common.status.pending')}
                    </p>
                  </div>
                  <div className="rounded-md border border-yellow-100/10 bg-black/20 px-2 py-1.5">
                    <p className="text-[10px] uppercase text-yellow-100/35">{t('nodeDetail.service.runtimeActivity')}</p>
                    <p className="mt-1 text-xs text-yellow-100">
                      {legacyDrain.latestActivityAt ? i18nRelativeTime(legacyDrain.latestActivityAt) : t('common.status.pending')}
                    </p>
                  </div>
                </div>
                {legacyDrain.forcedImpact && (
                  <p className="mt-2 text-xs leading-5 text-yellow-100/50">
                    {t('nodeDetail.service.forcedRestartImpact', { impact: legacyDrain.forcedImpact.replaceAll('_', ' ') })}
                  </p>
                )}
                <p className="mt-3 text-xs leading-5 text-yellow-100/60">{legacyDrain.nextStep}</p>
                {legacyDrain.oldestStartedAt && (
                  <p className="mt-1 text-[11px] text-yellow-100/40">
                    {t('nodeDetail.service.oldestStarted', { time: i18nRelativeTime(legacyDrain.oldestStartedAt) })}
                  </p>
                )}
                <p className="mt-2 text-[10px] leading-4 text-yellow-100/35">{t('nodeDetail.maintenance.sourceValue', { source: legacyDrain.source })}</p>
              </div>
            )}
            <p className="mt-3 text-xs leading-5 text-gray-600">
              {t('nodeDetail.service.rustProducerFiles')}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            {t('common.retry')}
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
            <h3 className="font-semibold text-white">{t('nodeDetail.service.title')}</h3>
            <OperatorStatusBadge status={operatorStatus.status} />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {t('nodeDetail.service.description')}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs text-gray-500">
          <div>
            <p className="text-gray-600">{t('nodeDetail.service.enabled')}</p>
            <p className="mt-1 text-gray-200">{totals?.enabled ?? 0}/{totals?.total ?? 0}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('nodeDetail.service.attention')}</p>
            <p className="mt-1 text-gray-200">{totals?.attention ?? 0}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('nodeDetail.service.reported')}</p>
            <p className="mt-1 text-gray-200">
              {operatorStatus.last_reported_at ? i18nRelativeTime(operatorStatus.last_reported_at) : t('common.status.pending')}
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
              <h4 className="text-sm font-semibold text-white">{t('nodeDetail.service.runtimeRollout')}</h4>
              <p className="mt-1 text-xs text-gray-500">
                {t('nodeDetail.service.runtimeRolloutDescription')}
              </p>
            </div>
            <OperatorStatusBadge status={runtimeRollout.restart_required ? 'warning' : 'ok'} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.service.restartRequired')}</p>
              <p className={`mt-1 text-sm font-semibold ${runtimeRollout.restart_required ? 'text-yellow-200' : 'text-white'}`}>
                {runtimeRollout.restart_required ? t('settings.policyEditor.yes') : t('settings.policyEditor.no')}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.service.executable')}</p>
              <p className="mt-1 truncate text-xs font-mono text-gray-300">
                {runtimeRollout.executable_path || t('common.status.pending')}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.stats.activeSessions')}</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {formatNumber(health?.active_sessions ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <p className="text-[11px] uppercase text-gray-600">{t('nodeDetail.commercial.nextStep')}</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {runtimeRollout.restart_required
                  ? (health && health.active_sessions > 0 ? t('services.rollout.drainFirst') : t('services.rollout.restartNode'))
                  : t('nodeDetail.service.noRolloutAction')}
              </p>
            </div>
          </div>

          <p className={`mt-3 text-xs leading-5 ${runtimeRollout.restart_required ? 'text-yellow-100/70' : 'text-gray-500'}`}>
            {runtimeRollout.detail}
          </p>
          <p className="mt-2 text-xs leading-5 text-gray-600">
            {t('nodeDetail.service.runtimeRolloutSources')}
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {operatorStatus.services.map((service) => (
          <div key={service.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{service.label}</p>
                <p className="mt-1 text-xs text-gray-600">{service.enabled ? t('nodeDetail.service.enabled') : t('nodeDetail.service.notEnabled')}</p>
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
          <h4 className="text-sm font-semibold text-white">{t('nodeDetail.service.risks')}</h4>
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

type DetailSectionNavTone = 'ok' | 'warning' | 'critical' | 'info' | 'pending' | 'neutral';

type DetailSectionNavItem = {
  href: string;
  label: string;
  detail: string;
  meta: string;
  tone: DetailSectionNavTone;
};

function detailSectionToneClass(tone: DetailSectionNavTone) {
  if (tone === 'ok') return 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-100';
  if (tone === 'warning') return 'border-yellow-500/25 bg-yellow-500/[0.07] text-yellow-100';
  if (tone === 'critical') return 'border-red-400/25 bg-red-400/[0.07] text-red-100';
  if (tone === 'info') return 'border-sky-500/20 bg-sky-500/[0.06] text-sky-100';
  if (tone === 'pending') return 'border-white/10 bg-white/[0.035] text-gray-300';
  return 'border-white/10 bg-white/[0.025] text-gray-300';
}

function DetailSectionNavigator({ items }: { items: DetailSectionNavItem[] }) {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t('nodeDetail.sectionNav.title')}
      className="mt-5 rounded-xl border border-white/5 bg-black/20 p-3"
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white">{t('nodeDetail.sectionNav.title')}</h4>
          <p className="mt-1 text-xs leading-5 text-gray-500">{t('nodeDetail.sectionNav.description')}</p>
        </div>
        <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-gray-400">
          {t('nodeDetail.sectionNav.scope')}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`group rounded-lg border px-3 py-2.5 transition hover:border-white/25 hover:bg-white/[0.06] ${detailSectionToneClass(item.tone)}`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white group-hover:text-purple-100">{item.label}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-75">{item.detail}</p>
              </div>
              <span className="shrink-0 rounded-full border border-current/20 px-2 py-0.5 text-[10px] uppercase opacity-80">
                {item.meta}
              </span>
            </div>
          </a>
        ))}
      </div>
    </nav>
  );
}

function VpnHealthPanel({
  nodeId,
  isVpnNode,
  installStatus,
  maintenanceMode,
  isPolicySaving,
  onToggleMaintenance,
  onToast,
}: {
  nodeId: string;
  isVpnNode: boolean;
  installStatus?: NodeInstallProgressSummary | null;
  maintenanceMode: boolean;
  isPolicySaving: boolean;
  onToggleMaintenance: () => Promise<void>;
  onToast: (message: string, variant?: 'success' | 'error') => void;
}) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
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
    commandActionFilter !== 'all' ? `Action: ${commandLabel({ action: commandActionFilter } as NodeCommand, t)}` : '',
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
        ? t('nodeDetail.commands.systemDiagnosticsQueued')
        : action === 'collect_logs'
          ? t('nodeDetail.commands.logCollectionQueued')
          : t('nodeDetail.commands.configRefreshQueued');

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
      onToast(error instanceof Error ? error.message : t('nodeDetail.commands.queueFailed'), 'error');
    }
  };

  const handleRestartService = async () => {
    if (!health) {
      onToast(t('nodeDetail.commands.healthUnavailableRestart'), 'error');
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

    if (!window.confirm(t('nodeDetail.commands.confirmRestart'))) {
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
      onToast(t('nodeDetail.commands.restartQueued'));
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('nodeDetail.commands.restartQueueFailed'), 'error');
    }
  };

  const handleMaintenanceToggle = async () => {
    const actionLabel = maintenanceMode ? t('nodeDetail.maintenance.endMaintenance') : t('nodeDetail.maintenance.startMaintenance');
    if (!window.confirm(t('nodeDetail.commands.confirmMaintenance', { action: actionLabel }))) {
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
    if (!window.confirm(t('nodeDetail.commands.confirmCancel', { command: commandLabel(command, t) }))) return;

    setCancellingCommandId(command.id);
    try {
      await cancelCommand.mutateAsync({ nodeId, commandId: command.id });
      onToast(t('nodeDetail.commands.commandCancelled'));
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('nodeDetail.commands.cancelFailed'), 'error');
    } finally {
      setCancellingCommandId(null);
    }
  };

  const handleCancelRestartCommand = async (command: VpnRestartCommandState) => {
    if (!restartCommandCanCancel(command)) return;
    if (!window.confirm(t('nodeDetail.commands.confirmCancelRestart'))) return;

    setCancellingCommandId(command.id);
    try {
      await cancelCommand.mutateAsync({ nodeId, commandId: command.id });
      onToast(t('nodeDetail.commands.restartCancelRequested'));
      await refetch();
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('nodeDetail.commands.restartCancelFailed'), 'error');
    } finally {
      setCancellingCommandId(null);
    }
  };

  if (!isVpnNode) {
    return (
      <Card variant="outline" padding="md" className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white">{t('nodeDetail.health.title')}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {t('nodeDetail.health.disabled')}
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
            <h3 className="font-semibold text-white">{t('nodeDetail.health.title')}</h3>
            <p className="text-sm text-yellow-300 mt-1">
              {t('nodeDetail.health.unavailable')}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            {t('common.retry')}
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
  const capacityRisks = capacityRiskItems(health.system.capacity, t, formatNumber);
  const capacityReported = Boolean(health.system.capacity?.reported);
  const upgradeStatus = health.system.upgrade_status ?? null;
  const upgradeReported = Boolean(upgradeStatus?.reported);
  const installStatusValue = installStatus?.status ?? null;
  const installReported = Boolean(
    installStatus?.last_reported_at
    || installStatus?.used_at
    || (installStatusValue && installStatusValue !== 'not_started')
  );
  const upgradeStatusValue = upgradeStatus?.status ?? null;
  const installMeta = installWorkflowMeta(installStatusValue, installReported, t);
  const upgradeMeta = upgradeWorkflowMeta(upgradeStatusValue, upgradeReported, t);
  const runtimeRollout = health.system.operator_status?.runtime_rollout ?? null;
  const runtimeReported = Boolean(health.system.operator_status);
  const restartRequired = Boolean(runtimeRollout?.restart_required);
  const discoveryStatus = health.system.discovery_status ?? null;
  const discoveryWarnings = discoveryWarningCount(discoveryStatus);
  const chatRelayStatus = health.system.chat_relay_status ?? null;
  const chatRelayWarnings = chatRelayWarningCount(chatRelayStatus);
  const chatRelay = chatRelayPeer(chatRelayStatus);
  const recentErrors = health.system.recent_errors;
  const recentOperationalEventCount = Array.isArray(recentErrors?.events) ? recentErrors.events.length : 0;
  const hasRecentOperationalEventTelemetry = Boolean(recentErrors?.reported);
  const installUpgradeNeedsAttention = [installStatusValue, upgradeStatusValue]
    .some((status) => ['failed', 'error', 'timeout'].includes((status || '').toLowerCase()));
  const sectionNavItems: DetailSectionNavItem[] = [
    {
      href: '#overview-panel',
      label: t('nodeDetail.sectionNav.overview'),
      detail: t('nodeDetail.sectionNav.overviewDetail', { checks: formatNumber(failedChecks.length) }),
      meta: `${health.health_score}/100`,
      tone: health.health_status === 'offline'
        ? 'critical'
        : failedChecks.length > 0 || health.health_status === 'degraded' || health.health_status === 'overloaded'
          ? 'warning'
          : 'ok',
    },
    {
      href: '#capacity-panel',
      label: t('nodeDetail.operatorActions.capacity.title'),
      detail: capacityRisks.length > 0
        ? t('nodeDetail.operatorActions.capacity.riskDetail', { count: formatNumber(capacityRisks.length) })
        : capacityReported
          ? t('nodeDetail.operatorActions.capacity.clearDetail')
          : t('nodeDetail.operatorActions.capacity.waitingDetail'),
      meta: capacityRisks.length > 0
        ? t('nodeDetail.operatorActions.capacity.riskMeta', { count: formatNumber(capacityRisks.length) })
        : capacityReported
          ? t('nodeDetail.operatorActions.meta.clear')
          : t('nodeDetail.operatorActions.meta.waiting'),
      tone: capacityRisks.some((risk) => risk.tone === 'critical')
        ? 'critical'
        : capacityRisks.length > 0
          ? 'warning'
          : capacityReported
            ? 'ok'
            : 'pending',
    },
    {
      href: '#runtime-panel',
      label: t('nodeDetail.operatorActions.runtime.title'),
      detail: restartRequired
        ? t('nodeDetail.operatorActions.runtime.restartDetail')
        : runtimeReported
          ? t('nodeDetail.operatorActions.runtime.clearDetail')
          : t('nodeDetail.operatorActions.runtime.waitingDetail'),
      meta: restartRequired
        ? t('nodeDetail.operatorActions.runtime.restartMeta')
        : runtimeReported
          ? t('nodeDetail.operatorActions.meta.clear')
          : t('nodeDetail.operatorActions.meta.waiting'),
      tone: restartRequired ? 'warning' : runtimeReported ? 'ok' : 'pending',
    },
    {
      href: '#discovery-panel',
      label: t('nodeDetail.discovery.navLabel'),
      detail: discoveryStatus
        ? t('nodeDetail.discovery.navDetail', {
            valid: formatNumber(discoveryStatus.peer_store.snapshot.valid_peers),
            total: formatNumber(discoveryStatus.peer_store.snapshot.total_peers),
          })
        : t('nodeDetail.discovery.navPending'),
      meta: discoveryWarnings > 0
        ? t('nodeDetail.discovery.navWarnings', { count: formatNumber(discoveryWarnings) })
        : discoveryStatus
          ? t('nodeDetail.operatorActions.meta.clear')
          : t('nodeDetail.operatorActions.meta.waiting'),
      tone: discoveryWarnings > 0 ? 'warning' : discoveryStatus ? 'ok' : 'pending',
    },
    {
      href: '#chat-relay-panel',
      label: t('nodeDetail.chatRelay.navLabel'),
      detail: chatRelay
        ? t('nodeDetail.chatRelay.navDetail', {
            accepted: formatNumber(chatRelay.outbound_accepted_total),
            attempted: formatNumber(chatRelay.outbound_attempted_total),
          })
        : t('nodeDetail.chatRelay.navPending'),
      meta: chatRelayWarnings > 0
        ? t('nodeDetail.chatRelay.navWarnings', { count: formatNumber(chatRelayWarnings) })
        : chatRelay
          ? chatRelayStatusLabel(chatRelayStatus, t)
          : t('nodeDetail.operatorActions.meta.waiting'),
      tone: chatRelayWarnings > 0 ? 'warning' : chatRelay ? (chatRelay.enabled ? 'ok' : 'info') : 'pending',
    },
    {
      href: '#service-config-panel',
      label: t('nodeDetail.serviceConfig.navLabel'),
      detail: health.system.service_manager
        ? t('nodeDetail.serviceConfig.navDetailReported', {
            service: health.system.service_manager.service_name || 'aeronyx-server',
            active: health.system.service_manager.active_state || t('common.status.pending'),
          })
        : t('nodeDetail.serviceConfig.navDetailWaiting'),
      meta: health.system.service_manager
        ? t('nodeDetail.operatorActions.meta.clear')
        : t('nodeDetail.operatorActions.meta.waiting'),
      tone: health.system.service_manager
        ? health.system.service_manager.active_state === 'active' ? 'ok' : 'warning'
        : 'pending',
    },
    {
      href: '#install-workflow',
      label: t('nodeDetail.sectionNav.installUpgrade'),
      detail: t('nodeDetail.sectionNav.installUpgradeDetail', { install: installMeta, upgrade: upgradeMeta }),
      meta: installUpgradeNeedsAttention
        ? t('nodeDetail.operatorActions.commands.failedMeta', { count: 1 })
        : installReported || upgradeReported
          ? t('nodeDetail.operatorActions.meta.clear')
          : t('nodeDetail.operatorActions.meta.waiting'),
      tone: installUpgradeNeedsAttention ? 'critical' : installReported || upgradeReported ? 'info' : 'pending',
    },
    {
      href: '#recent-operational-events',
      label: t('nodeDetail.operatorActions.events.title'),
      detail: recentOperationalEventCount > 0
        ? t('nodeDetail.operatorActions.events.hasEventsDetail', { count: formatNumber(recentOperationalEventCount) })
        : hasRecentOperationalEventTelemetry
          ? t('nodeDetail.operatorActions.events.clearDetail')
          : t('nodeDetail.operatorActions.events.waitingDetail'),
      meta: recentOperationalEventCount > 0
        ? t('nodeDetail.operatorActions.events.eventMeta', { count: formatNumber(recentOperationalEventCount) })
        : hasRecentOperationalEventTelemetry
          ? t('nodeDetail.operatorActions.meta.clear')
          : t('nodeDetail.operatorActions.meta.waiting'),
      tone: recentOperationalEventCount > 0 ? 'warning' : hasRecentOperationalEventTelemetry ? 'ok' : 'pending',
    },
    {
      href: '#vpn-commands',
      label: t('nodeDetail.operatorActions.commands.title'),
      detail: failedCommandCount > 0
        ? t('nodeDetail.operatorActions.commands.failedDetail', { count: formatNumber(failedCommandCount) })
        : activeCommandCount > 0
          ? t('nodeDetail.operatorActions.commands.activeDetail', { count: formatNumber(activeCommandCount) })
          : t('nodeDetail.operatorActions.commands.clearDetail'),
      meta: failedCommandCount > 0
        ? t('nodeDetail.operatorActions.commands.failedMeta', { count: formatNumber(failedCommandCount) })
        : activeCommandCount > 0
          ? t('nodeDetail.operatorActions.commands.activeMeta', { count: formatNumber(activeCommandCount) })
          : t('nodeDetail.operatorActions.meta.clear'),
      tone: failedCommandCount > 0 ? 'critical' : activeCommandCount > 0 ? 'warning' : 'ok',
    },
  ];

  return (
    <Card variant="default" padding="md" className="mb-6">
      <div id="overview-panel" className="scroll-mt-6 flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h3 className="font-semibold text-white">{t('nodeDetail.health.title')}</h3>
            <VpnHealthBadge status={health.health_status} />
            <span className="text-xs text-gray-500">{t('nodeDetail.health.score', { value: health.health_score })}</span>
          </div>
          <p className="text-sm text-gray-500">
            {t('nodeDetail.health.description', {
              source: health.system.source === 'cache' ? t('nodeDetail.health.heartbeatCache') : t('nodeDetail.health.sampleFallback'),
            })}
            {health.system.vpn_health_checked_at
              ? ` ${t('nodeDetail.health.checksRan', { time: i18nRelativeTime(new Date(health.system.vpn_health_checked_at * 1000).toISOString()) })}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            {t('common.refreshNow')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={runCommand.isPending}
            onClick={() => handleRunCommand('system_info')}
          >
            {t('nodeDetail.commands.systemInfo')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={runCommand.isPending}
            onClick={() => handleRunCommand('collect_logs')}
          >
            {t('nodeDetail.commands.collectLogs')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={runCommand.isPending}
            onClick={() => handleRunCommand('refresh_config')}
          >
            {t('nodeDetail.health.refreshConfig')}
          </Button>
          <Button
            variant={maintenanceMode ? 'secondary' : 'danger'}
            size="sm"
            disabled={isPolicySaving}
            isLoading={isPolicySaving}
            onClick={handleMaintenanceToggle}
          >
            {maintenanceMode ? t('nodeDetail.maintenance.endMaintenance') : t('nodeDetail.maintenance.startMaintenance')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={runCommand.isPending || !restartReady}
            onClick={handleRestartService}
          >
            {t('nodeDetail.maintenance.restartService')}
          </Button>
          {restartBlockers.length > 0 && (
            <div className="basis-full text-xs text-yellow-300">
              {t('nodeDetail.commands.restartBlocked', { blocker: restartBlockers[0] })}
            </div>
          )}
        </div>
      </div>

      <DetailSectionNavigator items={sectionNavItems} />

      <CommercialReadinessPanel
        health={health}
        server={placement}
        metrics={metrics}
        isPlacementLoading={placementLoading}
        isMetricsLoading={metricsLoading}
      />

      <OperatorActionsPanel
        health={health}
        installStatus={installStatus}
        failedChecksCount={failedChecks.length}
        activeCommandCount={activeCommandCount}
        failedCommandCount={failedCommandCount}
        maintenanceMode={maintenanceMode}
        restartReady={restartReady}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 mt-5">
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">{t('nodeDetail.health.activeTunnels')}</p>
          <p className="text-lg font-semibold text-white mt-1">{formatNumber(health.active_sessions)}</p>
          <p className="text-xs text-gray-600">{t('nodeDetail.stats.total', { count: formatNumber(health.total_sessions) })}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">{t('nodeDetail.health.availability24h')}</p>
          <p className="text-lg font-semibold text-white mt-1">
            {formatAvailability(health.availability_24h?.percent)}
          </p>
          <p className="text-xs text-gray-600">
            {t('nodeDetail.bandwidth.samples', { count: formatNumber(health.availability_24h?.sample_count ?? 0) })}
            {health.availability_24h?.last_gap_seconds
              ? ` · ${t('nodeDetail.health.gap', { value: formatDuration(health.availability_24h.last_gap_seconds) })}`
              : ''}
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">CPU</p>
          <p className="text-lg font-semibold text-white mt-1">
            {health.system.cpu_usage === null ? t('common.status.pending') : `${health.system.cpu_usage}%`}
          </p>
          <p className="text-xs text-gray-600">{t('nodeDetail.health.cores', { count: health.system.cpu_count || t('common.status.pending') })}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">{t('nodeDetail.hardware.memory')}</p>
          <p className="text-lg font-semibold text-white mt-1">{formatMemoryUsage(health)}</p>
          <p className="text-xs text-gray-600">{t('nodeDetail.health.reportedByNode')}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">{t('nodeDetail.health.tunnelMtu')}</p>
          <p className="text-lg font-semibold text-white mt-1">{formatTunnelMtu(health)}</p>
          <p className="text-xs text-gray-600">{tunnelMtuDetail(health, t)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">{t('nodeDetail.health.serviceManager')}</p>
          <p className="text-lg font-semibold text-white mt-1 truncate">{formatServiceManagerName(health)}</p>
          <p className="text-xs text-gray-600 truncate">{serviceManagerRuntimeDetail(health, t)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <p className="text-xs text-gray-500">{t('nodeDetail.health.lastHeartbeat')}</p>
          <p className="text-lg font-semibold text-white mt-1">
            {health.last_heartbeat ? i18nRelativeTime(health.last_heartbeat) : t('nodeDetail.health.never')}
          </p>
          <p className="text-xs text-gray-600">{t('nodeDetail.health.ageSeconds', { value: health.last_seen_seconds ?? t('common.status.pending') })}</p>
        </div>
      </div>

      <CapacityPanel health={health} />
      <RecentOperationalEventsPanel health={health} />
      <RuntimeVersionPanel health={health} />
      <PrivacyProtocolHealthPanel health={health} />
      <DiscoveryStatusPanel discovery={health.system.discovery_status} />
      <ChatRelayStatusPanel relay={health.system.chat_relay_status} />
      <ServiceConfigurationPanel health={health} />
      <UpgradeWorkflowPanel health={health} />
      <OperatorRunbookPanel health={health} />
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

      <div id="health-checks" className="mt-5 grid scroll-mt-6 gap-3 md:grid-cols-2">
        {health.checks.map((check) => (
          <div
            key={check.name}
            className={`
              rounded-xl border px-3 py-2.5
              ${check.ok ? 'bg-emerald-500/[0.04] border-emerald-500/15' : 'bg-yellow-500/[0.06] border-yellow-500/20'}
            `}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">{formatHealthCheckName(check.name, t)}</span>
              <span className={check.ok ? 'text-xs text-emerald-300' : 'text-xs text-yellow-300'}>
                {check.ok ? t('common.status.ok') : t('common.status.attention')}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{check.detail}</p>
            {!check.ok && (
              <div className="mt-2 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.05] px-2 py-1.5">
                <p className="text-[11px] uppercase tracking-wide text-yellow-300">{t('nodeDetail.health.runbook')}</p>
                <p className="text-xs text-gray-400 mt-1">{healthCheckRunbook(check.name, t)}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {failedChecks.length > 0 && (
        <div className="mt-4 rounded-xl bg-yellow-500/[0.06] border border-yellow-500/20 px-4 py-3">
          <p className="text-sm text-yellow-200">
            {t('nodeDetail.health.failedChecks', { count: formatNumber(failedChecks.length) })}
          </p>
        </div>
      )}

      <div id="vpn-commands" className="mt-5 border-t border-white/5 pt-4 scroll-mt-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-3">
          <div>
            <h4 className="text-sm font-semibold text-white">{t('nodeDetail.commands.title')}</h4>
            <p className="text-xs text-gray-500 mt-1">
              {t('nodeDetail.commands.description')}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
              <p className="text-gray-600">{t('nodeDetail.commands.total')}</p>
              <p className="mt-0.5 font-semibold text-white">{formatNumber(commandStats?.total ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
              <p className="text-gray-600">{t('common.status.active')}</p>
              <p className="mt-0.5 font-semibold text-yellow-300">{formatNumber(activeCommandCount)}</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
              <p className="text-gray-600">{t('nodeDetail.commands.failed')}</p>
              <p className="mt-0.5 font-semibold text-red-300">{formatNumber(failedCommandCount)}</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
              <p className="text-gray-600">{t('nodeDetail.commands.shown')}</p>
              <p className="mt-0.5 font-semibold text-gray-200">{formatNumber(vpnCommands.length)}</p>
            </div>
          </div>
        </div>

        <div className="mb-3 grid sm:grid-cols-[180px_220px_1fr] gap-2">
          <label className="block">
            <span className="text-[11px] uppercase text-gray-600">{t('events.table.status')}</span>
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
            <span className="text-[11px] uppercase text-gray-600">{t('nodeDetail.commands.action')}</span>
            <select
              value={commandActionFilter}
              onChange={(event) => applyCommandFilters(commandStatusFilter, event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500/50"
            >
              {COMMAND_ACTION_FILTERS.map((action) => (
                <option key={action} value={action} className="bg-[#111118]">
                  {action === 'all' ? t('common.status.all') : commandLabel({ action } as NodeCommand, t)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end text-xs text-gray-600">
            {commandsLoading ? t('nodeDetail.commands.loadingHistory') : t('nodeDetail.commands.filteredByHistory')}
          </div>
        </div>

        {commandFilterActive && (
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-purple-500/20 bg-purple-500/[0.06] px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-purple-200">{t('nodeDetail.commands.filterActive')}</p>
              <p className="mt-0.5 text-xs text-gray-500">{commandFilterSummary}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyCommandFilters('all', 'all')}
            >
              {t('nodes.clearSearch')}
            </Button>
          </div>
        )}

        {vpnCommands.length === 0 ? (
          <p className="text-sm text-gray-500">{t('nodeDetail.commands.empty')}</p>
        ) : (
          <div className="space-y-2">
            {vpnCommands.map((command) => (
              <div key={command.id} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{commandLabel(command, t)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('nodeDetail.commands.queuedAt', { time: i18nRelativeTime(command.created_at) })}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {t('nodeDetail.commands.issuedBy', { actor: commandActorLabel(command), source: commandSourceLabel(command) })}
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

function eventCommandLabel(action: string | null | undefined, t: TranslateFn) {
  const labels: Record<string, string> = {
    system_info: t('events.command.systemInfo'),
    collect_logs: t('events.command.collectLogs'),
    refresh_config: t('events.command.refreshConfig'),
    apply_policy: t('events.command.applyPolicy'),
    restart_service: t('events.command.restartService'),
    kick_session: t('events.command.kickSession'),
    ban_wallet: t('events.command.banWallet'),
    unban_wallet: t('events.command.unbanWallet'),
  };
  return action ? labels[action] || action.replace(/_/g, ' ') : t('events.command.generic');
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

function eventReason(event: VpnEvent, t: TranslateFn) {
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
      : t('nodeDetail.events.policyEnforced');
    return t('events.preview.blocked', { count: blocked, reason });
  }
  if (event.type === 'node_policy_sync_pending') {
    const fields = Array.isArray(details.mismatched_fields)
      ? details.mismatched_fields.slice(0, 3).join(', ')
      : '';
    const status = typeof details.policy_sync_status === 'string' ? details.policy_sync_status : t('common.status.pending');
    return fields ? `${status} · ${fields}` : status;
  }
  if (event.type === 'client_placement_unavailable') {
    return t('nodeDetail.events.hiddenFromClients', {
      reason: formatPlacementReason(typeof details.unavailable_reason === 'string' ? details.unavailable_reason : null, t),
    });
  }
  if (event.type === 'session_keepalive_timeout') {
    const missed = eventDetailNumber(details, 'keepalive_missed');
    const pending = eventDetailNumber(details, 'keepalive_pending');
    return t('nodeDetail.events.keepaliveMissed', { missed, pending });
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
  if (event.command_id) return `${eventCommandLabel(event.action, t)} · ${t('nodeDetail.events.commandShort', { id: event.command_id.slice(0, 8) })}`;
  return event.type.replace(/_/g, ' ');
}

function eventImpact(event: VpnEvent, t: TranslateFn) {
  const details = event.details || {};

  if (event.type === 'node_policy_enforced') {
    const bandwidthDrops = eventDetailNumber(details, 'bandwidth_drops');
    const maxSessionRejects = eventDetailNumber(details, 'max_sessions_rejections');
    const maintenanceRejects = eventDetailNumber(details, 'maintenance_rejections');
    if (bandwidthDrops > 0) return t('nodeDetail.events.bandwidthDrops', { count: bandwidthDrops });
    if (maxSessionRejects > 0) return t('nodeDetail.events.maxSessionRejects', { count: maxSessionRejects });
    if (maintenanceRejects > 0) return t('nodeDetail.events.maintenanceRejects', { count: maintenanceRejects });
  }
  if (event.type === 'node_policy_sync_pending') {
    const age = eventDetailNumber(details, 'heartbeat_age_seconds');
    return age > 0 ? t('nodeDetail.events.heartbeatAge', { age }) : t('nodeDetail.health.waitingHeartbeat');
  }
  if (event.type === 'client_placement_unavailable') {
    const availability = typeof details.availability_24h_percent === 'number'
      ? t('nodeDetail.events.availability24h', { value: formatAvailability(details.availability_24h_percent) })
      : '';
    const capacity = eventDetailNumber(details, 'capacity_remaining');
    if (capacity > 0) return availability ? `${availability} · ${t('nodeDetail.events.slots', { count: capacity })}` : t('nodeDetail.events.slots', { count: capacity });
    if (typeof details.load === 'number') return `${t('nodeDetail.events.load', { value: details.load })}${availability ? ` · ${availability}` : ''}`;
    return availability || t('nodeDetail.commercial.notAdvertised');
  }
  if (event.type === 'health_check_failed') {
    const runningMtu = eventDetailNumber(details, 'running_mtu');
    const configuredMtu = eventDetailNumber(details, 'configured_mtu');
    if (nodeEventCheckName(event) === 'mtu_config' && (runningMtu || configuredMtu)) {
      return runningMtu && configuredMtu ? `MTU ${runningMtu} / ${configuredMtu}` : t('nodeDetail.events.mtuMetadataPending');
    }
  }
  if (event.source === 'node_command' && event.action === 'apply_policy') {
    return t('nodeDetail.events.policyRuntimeAcknowledgement');
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
    return t('nodeDetail.events.missedAcks', { count: keepaliveMissed });
  }
  if (typeof details.total_bytes === 'number') {
    return formatBytes(details.total_bytes, 1);
  }
  if (event.source) return event.source.replace(/_/g, ' ');
  return t('nodeDetail.events.nodeEvent');
}

function VpnEventSeverityBadge({ severity }: { severity: VpnEventSeverity }) {
  const { t } = useI18n();
  const config = VPN_EVENT_SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${config.badgeClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {t(`events.severity.${severity}`)}
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
  const { t, formatNumber } = useI18n();
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
          <h3 className="font-semibold text-white">{t('nodeDetail.events.title')}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('nodeDetail.events.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {summary ? (
            <span className="text-xs text-gray-500">
              {t('nodeDetail.events.summary', {
                open: formatNumber(summary.open),
                critical: formatNumber(summary.critical),
                warning: formatNumber(summary.warning),
              })}
            </span>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            {t('common.refreshNow')}
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
          <p className="text-sm text-yellow-200">{t('nodeDetail.events.unavailable')}</p>
        </div>
      ) : recentEvents.length === 0 ? (
        <p className="text-sm text-emerald-300">{t('nodeDetail.events.empty')}</p>
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
                    <span>{eventReason(event, t)}</span>
                    <span>{eventImpact(event, t)}</span>
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
  const { t, formatRelativeTime: formatLocalizedRelativeTime } = useI18n();

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
        <span className="text-sm text-gray-400">{formatLocalizedRelativeTime(ban.banned_at)}</span>
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
          <span className="text-sm text-gray-600">{t('nodeDetail.wallet.manual')}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          variant="secondary"
          size="sm"
          disabled={isBusy}
          onClick={() => onUnban(ban.wallet_hex)}
        >
          {t('nodeDetail.wallet.unban')}
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
  const { t } = useI18n();
  const { bans, isLoading, isError, refetch } = useNodeWalletBans(nodeId, 'active');
  const runCommand = useRunNodeCommand();

  const handleUnban = async (walletHex: string) => {
    if (!window.confirm(t('nodeDetail.wallet.unbanConfirm', { wallet: `${walletHex.slice(0, 8)}...` }))) {
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
      onToast(t('nodeDetail.wallet.unbanQueued'));
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('nodeDetail.wallet.unbanFailed'), 'error');
    }
  };

  if (!isVpnNode) return null;

  return (
    <Card variant="default" padding="none" className="mb-6">
      <div className="px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{t('nodeDetail.wallet.title')}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {t('nodeDetail.wallet.description')}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          {t('common.refreshNow')}
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
          <p className="text-sm text-yellow-300">{t('nodeDetail.wallet.unavailable')}</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : bans.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">{t('nodeDetail.wallet.empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">{t('nodeDetail.wallet.wallet')}</th>
                <th className="px-4 py-3 font-medium">{t('nodeDetail.wallet.reason')}</th>
                <th className="px-4 py-3 font-medium">{t('nodeDetail.wallet.source')}</th>
                <th className="px-4 py-3 font-medium">{t('nodeDetail.wallet.banned')}</th>
                <th className="px-4 py-3 font-medium">{t('nodeDetail.wallet.command')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('nodeDetail.wallet.action')}</th>
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
  const { t, formatNumber } = useI18n();
  const { sessions, isLoading } = useNodeSessions(nodeId, { limit: 10 });

  const formatSessionStatus = (status: string) => {
    if (status === 'active') return t('common.status.active');
    if (status === 'completed') return t('common.status.completed');
    if (status === 'error') return t('common.status.error');
    return status.replace(/_/g, ' ');
  };

  return (
    <Card variant="default" padding="none">
      <div className="px-6 py-4 border-b border-white/5">
        <h3 className="font-semibold text-white">{t('nodeDetail.sessions.title')}</h3>
      </div>
      {isLoading ? (
        <div className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-gray-500">{t('nodeDetail.sessions.empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">{t('nodeDetail.sessions.sessionId')}</th>
                <th className="px-6 py-3 font-medium">{t('nodeDetail.sessions.client')}</th>
                <th className="px-6 py-3 font-medium">{t('nodeDetail.sessions.traffic')}</th>
                <th className="px-6 py-3 font-medium">{t('nodeDetail.sessions.duration')}</th>
                <th className="px-6 py-3 font-medium">{t('nodeDetail.sessions.status')}</th>
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
                    {formatNumber(session.total_bytes_mb, { maximumFractionDigits: 2 })} MB
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {session.duration_seconds > 0 ? formatDuration(session.duration_seconds) : t('common.status.active')}
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
                      {formatSessionStatus(session.status)}
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
  const {
    t,
    formatDateTime,
    formatRelativeTime: formatLocalizedRelativeTime,
  } = useI18n();

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
      showToast(t('nodeDetail.nameUpdated'));
    } catch (err) {
      showToast(t('nodeDetail.nameUpdateFailed'), 'error');
      throw err;
    }
  }, [nodeId, updateNodeMutation, refetch, showToast, t]);

  const handleToggleMaintenance = useCallback(async () => {
    if (!node) return;
    const nextMaintenance = !node.maintenance_mode;
    try {
      await updateNodeMutation.mutateAsync({
        nodeId,
        data: { maintenance_mode: nextMaintenance },
      });
      refetch();
      showToast(nextMaintenance ? t('nodeDetail.maintenanceEnabled') : t('nodeDetail.maintenanceDisabled'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('nodeDetail.maintenanceUpdateFailed'), 'error');
      throw error;
    }
  }, [node, nodeId, updateNodeMutation, refetch, showToast, t]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteNodeMutation.mutateAsync(nodeId);
      showToast(t('nodeDetail.deleted'));
      setTimeout(() => router.push('/dashboard/nodes'), 1000);
    } catch {
      showToast(t('nodeDetail.deleteFailed'), 'error');
    }
  }, [nodeId, deleteNodeMutation, router, showToast, t]);

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
            <h2 className="text-xl font-semibold text-white mb-2">{t('nodeDetail.notFoundTitle')}</h2>
            <p className="text-gray-400 mb-6">{t('nodeDetail.notFoundDescription')}</p>
            <Button variant="secondary" onClick={() => router.push('/dashboard/nodes')}>
              {t('nodeDetail.backToNodes')}
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
      <div id="node-settings" className="scroll-mt-6">
        <NodeSettings
          node={node}
          onSaved={refetch}
          onToast={showToast}
        />
      </div>

      <NodeInstallStatusPanel installStatus={node.install_status} />

      {/* 3. AeroNyx Service Readiness */}
      <ServiceReadinessPanel
        nodeId={nodeId}
        isVpnNode={node.is_vpn_node}
        installStatus={node.install_status}
      />

      {/* 4. VPN Health Panel */}
      <VpnHealthPanel
        nodeId={nodeId}
        isVpnNode={node.is_vpn_node}
        installStatus={node.install_status}
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
          <h3 className="font-semibold text-white mb-4">{t('nodeDetail.hardware.title')}</h3>
          <div className="space-y-4">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('nodeDetail.hardware.cpu')}</span>
              <p className="text-sm text-white mt-1 break-words">{node.hardware_info?.cpu || t('nodes.unknown')}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('nodeDetail.hardware.memory')}</span>
              <p className="text-sm text-white mt-1">{node.hardware_info?.memory || t('nodes.unknown')}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('nodeDetail.hardware.os')}</span>
              <p className="text-sm text-white mt-1 break-words">{node.hardware_info?.os || t('nodes.unknown')}</p>
            </div>
          </div>
        </Card>

        <Card variant="default" padding="md" className="lg:col-span-2">
          <h3 className="font-semibold text-white mb-4">{t('nodeDetail.details.title')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('nodeDetail.details.nodeId')}</span>
              <div className="flex items-center gap-2 mt-1 min-w-0">
                <span className="text-sm font-mono text-gray-300 truncate">{node.id}</span>
                <CopyButton text={node.id} />
              </div>
            </div>
            <div className="min-w-0">
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('nodeDetail.details.publicKey')}</span>
              <div className="flex items-center gap-2 mt-1 min-w-0">
                <span className="text-sm font-mono text-gray-300 truncate">
                  {node.public_key?.slice(0, 20)}...
                </span>
                <CopyButton text={node.public_key || ''} />
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('nodeDetail.details.created')}</span>
              <p className="text-sm text-gray-300 mt-1">
                {formatDateTime(node.created_at, { dateStyle: 'medium' })}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('nodeDetail.details.lastUpdated')}</span>
              <p className="text-sm text-gray-300 mt-1">{formatLocalizedRelativeTime(node.updated_at)}</p>
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
        title={t('nodeDetail.deleteNode')}
        message={t('nodeDetail.deleteMessage', { name: node.name })}
        confirmText={t('nodeDetail.deleteNode')}
        cancelText={t('nodes.cancel')}
        variant="danger"
        isLoading={deleteNodeMutation.isPending}
      />
    </div>
  );
}
