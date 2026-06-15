/**
 * ============================================
 * AeroNyx Nodeboard - Health Check Route
 * ============================================
 * File Path: app/api/health/route.ts
 *
 * Creation Reason:
 *   Production nodeboard needs a lightweight runtime health endpoint for
 *   systemd, nginx, and external monitors. Page routes can return 200 while
 *   client-side authentication or dashboard data is still loading; this route
 *   reports the Next.js service itself and the exact backend/Rust contracts the
 *   UI is compiled to use.
 *
 * Frontend API Contract:
 *   - API base: lib/constants.ts -> API_BASE_URL
 *   - Runtime env: /etc/nodeboard/nodeboard.env
 *   - Deployment helper: deploy/bin/deploy-nodeboard.sh
 *     Verifies /dashboard/nodes/{id}?command_action=restart_service when
 *     NODEBOARD_CANARY_NODE_ID is configured for the production environment.
 *   - Dashboard service page: app/dashboard/services/page.tsx
 *   - Dashboard sessions page: app/dashboard/sessions/page.tsx
 *   - Node detail page: app/dashboard/nodes/[id]/page.tsx
 *
 * Backend API and File Paths:
 *   - GET /api/privacy_network/vpn/overview/
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Provides data.nodes[].system.session_cleanup for drain timeout context.
 *     Provides data.nodes[].system.restart_readiness for controlled restart
 *     gate decisions shared by node detail and services fleet views.
 *     Provides data.nodes[].system.source so node detail can label live
 *     heartbeat cache versus durable sample fallback for node-level policy
 *     and health counters.
 *     Provides data.nodes[].system.policy_enforcement.recent_block_active /
 *     impact_status so node detail can distinguish active commercial policy
 *     blocking from historical Rust process counters.
 *     Provides data.nodes[].system.policy_enforcement.counters_started_at
 *     so node detail can show when Rust process-local counters began.
 *     Provides data.summary.restart_readiness for owner-scoped fleet restart
 *     readiness monitoring, including blocked node drain/command status and
 *     backend-authored recommended_action plus drain_activity buckets.
 *     Provides data.summary.restart_readiness.command_delivery_health for
 *     Services Command Delivery health from Rust heartbeat freshness and
 *     backend operator_reporting. problem_nodes is a capped node-level triage
 *     list for command delivery blockers; problem_panel_summary and
 *     problem_nodes[].primary_action are backend-authored operator guidance.
 *     Provides data.summary.restart_readiness.policy_sync_health for Services
 *     Policy Sync health from data.nodes[].system.policy_sync so operators can
 *     verify max_sessions / bandwidth_limit_mbps reached Rust node_policy.
 *     problem_panel_summary and problem_nodes[].primary_action are
 *     backend-authored remediation metadata for sync issues.
 *     Provides data.summary.restart_readiness.policy_enforcement_health for
 *     Services Policy Blocks from data.nodes[].system.policy_enforcement so
 *     operators can see maintenance/max_sessions/bandwidth blocks fleet-wide.
 *     Includes bandwidth_drop_bytes / bandwidth_limit_bytes_per_second /
 *     bandwidth_window_bytes, aggregate Rust node_policy limiter telemetry
 *     produced by /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs.
 *     Includes recent_problem_nodes / historical_problem_nodes so Services
 *     can distinguish current impact from cumulative Rust process counters.
 *     Includes telemetry_source_counts / telemetry_source_summary so Services
 *     can show whether policy counters came from fresh heartbeat cache,
 *     durable sample fallback, or missing heartbeat telemetry.
 *     Includes counter_scope_started_at_min / counter_scope_started_at_max so
 *     Services can show fleet Rust process-local counter scope.
 *     Includes counter_scope_summary so Services can show backend-authored
 *     rollout coverage for Rust counters_started_at.
 *     Includes dominant_block_reason so Services can show whether maintenance,
 *     max_sessions, or bandwidth is the main policy block cause.
 *     problem_panel_summary and problem_nodes[].primary_action are
 *     backend-authored remediation metadata for policy blocks.
 *     Provides data.summary.restart_readiness.commercial_placement_health for
 *     Services Commercial Placement from data.nodes[], policy_sync_health, and
 *     policy_enforcement_health. The backend owns ready/watch/blocked
 *     classification and primary_action so React does not guess paid placement
 *     rules.
 *     Includes Rust runtime data.nodes[].system.placement_readiness from
 *     /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 *     and /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs.
 *     Includes rust_placement_rollout_summary so Services can show backend
 *     coverage guidance for runtime-owned admission rollout.
 *     Includes rust_placement_rollout_summary.missing_node_list so Services
 *     can show which nodes need the placement_readiness Rust rollout.
 *     Provides data.summary.restart_readiness.drain_activity_health_counts
 *     for the Services page top-level Drain Risk card.
 *     drain_activity_health_counts.summary is backend-authored display copy
 *     and next_step.
 *     Provides data.summary.restart_readiness.cutover_guard_counts for the
 *     Services page Cutover Safety card from backend cutover_guard policy.
 *     cutover_guard_counts.actionable_problem_nodes powers Services Cutover
 *     Blockers in the Restart Action Queue; problem_nodes remains full safety
 *     accounting. actionable_reason/blocker_codes are backend-authored
 *     operator diagnostics, not React-derived policy.
 *     Provides data.summary.restart_readiness.runtime_capability_health for
 *     the Services Rust Capability card and Rust Capability Gaps panel. The
 *     backend owns the operator_status/runtime_rollout/session_cleanup
 *     capability decision plus problem_nodes[].upgrade_gate cutover safety
 *     and checklist/checklist_summary/primary_action copy. It also provides
 *     upgrade_blocker_summary, upgrade_blockers, and upgrade_blocker_counts
 *     for fleet-level upgrade blocker card copy, plus
 *     problem_panel_summary for the Rust Capability Gaps panel.
 *     Provides data.summary.restart_readiness.command_lifecycle_counts for
 *     Services page Command SLA card, backend-authored stale/retry copy, and
 *     cancelable_active/non_cancelable_active active command counts.
 *     command_lifecycle_counts.outcome_summary powers Services Restart
 *     Outcome Audit from latest per-node restart_service terminal statuses.
 *     command_lifecycle_counts.history_24h powers Services 24h restart
 *     command reliability and latest_any restart context without exposing
 *     command params/result/errors.
 *     data.summary.restart_readiness.maintenance_exit_candidates powers the
 *     Services capacity recovery card for nodes left in maintenance mode after
 *     restart work is complete. Candidate public_ip / region_code / city /
 *     version fields show which commercial entry point returns to client
 *     placement without exposing client-level traffic.
 *     maintenance_exit_summary provides backend-authored visible/hidden
 *     candidate, public entry, and region counts for the recovery panel.
 *     Candidate selection is sourced from node-level
 *     operator_action_plan.recommended_actions key=end_maintenance.
 *   - GET /api/privacy_network/vpn/sessions/?node_id=&status=&quality_status=
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Supports /dashboard/sessions?node={id}&status=active&quality=all deep links.
 *   - PATCH /api/privacy_network/nodes/{id}/
 *     /root/aeronyx/privacy_network/api/nodes.py
 *     Used by /dashboard/services to enable maintenance_mode from the restart
 *     readiness gate before a controlled Rust restart.
 *     Used by /dashboard/nodes/[id] NodeSettings for commercial capacity
 *     policy fields max_sessions and bandwidth_limit_mbps, validated by
 *     /root/aeronyx/privacy_network/serializers.py and consumed by Rust
 *     /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs.
 *   - data.nodes[].system.restart_readiness.active_restart_command
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Mirrors NodeCommand restart_service pending/sent/executing state.
 *   - data.nodes[].system.restart_readiness.latest_restart_command
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Mirrors latest restart_service lifecycle metadata for completed,
 *     failed, cancelled, or timeout command outcome closure without command
 *     params, result, or error_message payloads. Includes age_seconds,
 *     stale_after_seconds, is_stale, and stale_reason for backend-authored
 *     command SLA inspection.
 *     active_restart_command.can_cancel / cancel_reason and
 *     latest_restart_command.can_cancel / cancel_reason mirror NodeCommand
 *     mark_cancelled eligibility so Services and node detail do not guess
 *     whether an active restart command can be cancelled.
 *     data.nodes[].last_seen_seconds plus
 *     data.nodes[].system.restart_readiness.operator_reporting power node
 *     detail Command Delivery readiness before restart actions.
 *     data.nodes[].system.restart_readiness.command_delivery is preferred
 *     because it is backend-authored and shares policy with Services.
 *     data.nodes[].system.restart_readiness.operator_action_plan powers the
 *     node detail Operator Action Plan preflight summary from restart gate,
 *     command delivery, drain ETA, and restart command lifecycle metadata.
 *     operator_action_plan.recommended_actions is backend-ordered
 *     machine-readable UI action metadata for node detail controls.
 *   - GET /api/privacy_network/vpn/servers/
 *     /root/aeronyx/privacy_network/api/vpn_servers.py
 *     Provides Services Client Placement Capacity from the same owner-scoped
 *     backend placement policy used by VPN clients: available candidates,
 *     unavailable reasons, remaining capped slots, unlimited-capacity nodes,
 *     and region/tier capacity groups.
 *   - data.nodes[].system.restart_readiness.drain_eta
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Aggregates active ClientSession timing for restart drain visibility.
 *     Includes status, next_step, timing fields, activity bucket counts, and
 *     keepalive issue session counts plus aggregate totals used by node detail
 *     and services restart UX.
 *     Includes activity_health backend triage so frontend views share one
 *     operational risk interpretation.
 *     Includes cutover_guard.safe_to_cutover/status/risk/next_step so
 *     Services and node detail can show whether replacing or restarting Rust
 *     is commercially safe without parsing backend English copy.
 *     cleanup_policy_pending is rendered in node detail as Rust cleanup
 *     rollout pending until heartbeat.system_stats.vpn_health.session_cleanup
 *     is reported.
 *   - GET /api/privacy_network/nodes/{id}/sessions/
 *     /root/aeronyx/privacy_network/api/sessions.py
 *     /root/aeronyx/privacy_network/serializers.py
 *   - Heartbeat storage:
 *     /root/aeronyx/privacy_network/services/heartbeat_service.py
 *   - Node command controls:
 *     /root/aeronyx/privacy_network/api/vpn_commands.py
 *     /root/aeronyx/privacy_network/services/command_service.py
 *     GET /api/privacy_network/nodes/{id}/commands/?status=&action=&limit=
 *     feeds node detail command history and command_action deep links.
 *     POST /api/privacy_network/nodes/{id}/commands/run/ queues diagnostics,
 *     restart_service, policy, wallet, and session control commands.
 *     POST /api/privacy_network/nodes/{id}/commands/{cmd_id}/cancel/ cancels
 *     pending command queue entries before Rust acknowledges them.
 *
 * Rust Producer Paths:
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/services/session.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *
 * Privacy Boundary:
 *   This endpoint returns deployment metadata only. It does not query node data
 *   and never exposes node public keys, client public IPs, DNS contents, packet
 *   payloads, domains, URLs, browsing history, voucher secrets, wallet-level
 *   traffic, or plaintext social graph data.
 *
 * Last Modified: v1.1.56 - Documented Rust placement rollout missing nodes
 * Previous: v1.1.55 - Documented Rust placement rollout summary
 * Previous: v1.1.54 - Documented Rust placement readiness
 * Previous: v1.1.53 - Documented commercial placement health
 * Previous: v1.1.52 - Documented dominant policy block reason
 * Previous: v1.1.51 - Documented fleet counter scope coverage
 * Previous: v1.1.50 - Documented fleet policy counter scope
 * Previous: v1.1.49 - Documented Rust policy counter scope
 * Previous: v1.1.48 - Documented node policy block impact fields
 * Previous: v1.1.47 - Documented node heartbeat source quality
 * Previous: v1.1.46 - Documented policy telemetry source quality
 * Previous: v1.1.45 - Documented recent policy block classification
 * Previous: v1.1.44 - Documented fleet bandwidth limiter bytes
 * Previous: v1.1.43 - Documented services placement capacity
 * Previous: v1.1.42 - Documented fleet policy enforcement health
 * Previous: v1.1.41 - Documented fleet policy sync health
 * Previous: v1.1.40 - Documented capacity policy PATCH fields
 * Previous: v1.1.39 - Documented maintenance placement context
 * Previous: v1.1.38 - Documented action-sourced maintenance exits
 * Previous: v1.1.37 - Documented maintenance exit candidates
 * Previous: v1.1.36 - Documented recommended operator actions
 * Previous: v1.1.35 - Documented node operator action plan
 * Previous: v1.1.34 - Documented backend node command delivery policy
 * Previous: v1.1.33 - Documented node detail command delivery readiness
 * Previous: v1.1.32 - Documented command delivery issue nodes
 * Previous: v1.1.31 - Documented command delivery health
 * Previous: v1.1.30 - Documented latest restart command context
 * Previous: v1.1.29 - Documented 24h restart command reliability
 * Previous: v1.1.28 - Documented restart outcome audit summary
 * Previous: v1.1.27 - Documented fleet cancelability counts
 * Previous: v1.1.26 - Documented backend cancel reason flag
 * Previous: v1.1.25 - Documented backend cancel eligibility flag
 * Previous: v1.1.24 - Documented command timeline deep-link contract
 * Previous: v1.1.23 - Documented fleet command lifecycle summary
 * Previous: v1.1.22 - Documented restart command SLA fields
 * Previous: v1.1.21 - Documented latest restart command outcome
 * Previous: v1.1.20 - Documented backend drain risk next step
 * Previous: v1.1.19 - Documented backend-authored drain risk copy
 * Previous: v1.1.18 - Documented fleet drain risk summary
 * Previous: v1.1.17 - Documented backend drain activity health
 * Previous: v1.1.16 - Documented keepalive issue session counts
 * Previous: v1.1.15 - Documented blocked node drain activity contract
 * Previous: v1.1.14 - Documented drain activity bucket contract
 * Previous: v1.1.13 - Documented cleanup rollout pending node detail UX
 * Previous: v1.1.12 - Documented node detail restart drain ETA usage
 * Previous: v1.1.11 - Documented blocked node recommended action
 * Previous: v1.1.10 - Documented blocked node drain status
 * Previous: v1.1.9 - Documented restart drain status
 * Previous: v1.1.8 - Documented restart drain ETA
 * Previous: v1.1.7 - Documented active restart command gate
 * Previous: v1.1.6 - Documented restart gate maintenance action
 * Previous: v1.1.5 - Documented sessions deep-link contract
 * Previous: v1.1.1 - Production health route
 * ============================================
 */

import { NextResponse } from 'next/server';
import packageJson from '@/package.json';
import { API_BASE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const healthPayload = {
  service: 'aeronyx-nodeboard',
  status: 'ok',
  version: packageJson.version,
  api_base_url: API_BASE_URL,
  frontend_paths: [
    'app/dashboard/services/page.tsx',
    'app/dashboard/sessions/page.tsx',
    'app/dashboard/nodes/[id]/page.tsx',
    'lib/api.ts',
    'lib/constants.ts',
    'hooks/useNodes.ts',
    'types/index.ts',
  ],
  backend_contracts: [
    {
      endpoint: 'GET /api/privacy_network/vpn/overview/',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Node fleet health, operator_status, runtime_rollout, metrics',
    },
    {
      endpoint: 'data.nodes[].system.session_cleanup',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Drain ETA context from Rust client-liveness cleanup policy',
    },
    {
      endpoint: 'data.nodes[].system.restart_readiness',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Backend-authoritative controlled restart gate for node detail and services fleet views',
    },
    {
      endpoint: 'data.nodes[].system.source',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Node-level telemetry source quality for node detail Commercial Readiness and Policy Enforcement, distinguishing fresh Redis heartbeat cache from durable NodeHeartbeat sample fallback',
    },
    {
      endpoint: 'data.nodes[].system.policy_enforcement.recent_block_active|impact_status',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Backend-authored node-level current-impact classification for Policy Enforcement and Commercial Readiness, separating active commercial policy blocking from historical Rust process counters',
    },
    {
      endpoint: 'data.nodes[].system.policy_enforcement.counters_started_at',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Rust node_policy process-local counter scope timestamp produced by /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs and displayed in node detail Policy Enforcement',
    },
    {
      endpoint: 'data.nodes[].last_seen_seconds + data.nodes[].system.restart_readiness.operator_reporting',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Node detail command delivery readiness from Rust heartbeat freshness and backend operator reporting before restart actions',
    },
    {
      endpoint: 'data.nodes[].system.restart_readiness.command_delivery',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Backend-authored node detail command delivery readiness policy shared with Services command_delivery_health',
    },
    {
      endpoint: 'data.nodes[].system.restart_readiness.operator_action_plan',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Backend-authored node detail operator preflight summary from restart gate, command delivery, drain ETA, and restart command lifecycle metadata',
    },
    {
      endpoint: 'data.nodes[].system.restart_readiness.operator_action_plan.recommended_actions',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Backend-ordered machine-readable node detail action list for maintenance, sessions, diagnostics, cancellation, and restart controls',
    },
    {
      endpoint: 'data.nodes[].system.restart_readiness.active_restart_command',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Active restart_service command state from NodeCommand to prevent duplicate fleet restarts',
    },
    {
      endpoint: 'data.nodes[].system.restart_readiness.latest_restart_command',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Latest restart_service lifecycle metadata and explicit age_seconds/stale_after_seconds/is_stale/stale_reason SLA fields for Services Retry Needed, Stale Command, Current, and Manual Check outcome closure',
    },
    {
      endpoint: 'data.nodes[].system.restart_readiness.*_restart_command.can_cancel|cancel_reason',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Backend-authoritative restart command cancellation eligibility and explanation mirrored from NodeCommand.mark_cancelled for Services and node detail controls',
    },
    {
      endpoint: 'data.nodes[].system.restart_readiness.drain_eta',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Node-level active ClientSession timing aggregate, activity buckets, keepalive issue session counts, backend activity_health triage, cutover_guard safe_to_cutover status, and cleanup rollout pending signal used by node detail and services maintenance drain UX',
    },
    {
      endpoint: 'data.summary.restart_readiness',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Owner-scoped fleet restart readiness counts, blocked-node drain status, command status, and recommended action',
    },
    {
      endpoint: 'data.summary.restart_readiness.command_delivery_health',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Fleet-level restart command delivery readiness plus problem_panel_summary and capped problem_nodes[].primary_action triage list from Rust heartbeat freshness and backend operator_reporting for the Services Command Delivery card and issue panel',
    },
    {
      endpoint: 'data.summary.restart_readiness.runtime_capability_health',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Fleet-level Rust commercial runtime capability summary for operator_status.runtime_rollout/session_cleanup reporting, including upgrade_blocker_summary/upgrade_blockers/upgrade_blocker_counts/problem_panel_summary, capped problem_nodes plus upgrade_gate cutover safety/checklist/checklist_summary/primary_action copy for the Services Rust Capability card, Rust Capability Gaps panel, and Restart Action Queue',
    },
    {
      endpoint: 'data.summary.restart_readiness.policy_sync_health',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Fleet-level commercial capacity policy sync summary for max_sessions/bandwidth_limit_mbps desired-vs-runtime state from data.nodes[].system.policy_sync and Rust node_policy, including problem_panel_summary and problem_nodes[].primary_action for Services remediation',
    },
    {
      endpoint: 'data.summary.restart_readiness.policy_enforcement_health',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Fleet-level Rust node_policy enforcement counter summary for maintenance_rejections/max_sessions_rejections/bandwidth_drops plus aggregate bandwidth_drop_bytes/bandwidth_limit_bytes_per_second/bandwidth_window_bytes, recent_problem_nodes/historical_problem_nodes current-impact classification, telemetry_source_counts/telemetry_source_summary freshness quality, counter_scope_started_at_min/counter_scope_started_at_max Rust process counter scope, counter_scope_summary rollout coverage, dominant_block_reason main cause guidance, problem_panel_summary, and capped problem_nodes[].primary_action triage',
    },
    {
      endpoint: 'data.summary.restart_readiness.commercial_placement_health',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Backend-authored ready/watch/blocked commercial placement summary for AeroNyx Privacy Protocol nodes, combining data.nodes[], data.nodes[].system.placement_readiness from Rust /api/vpn/health, policy_sync_health, and policy_enforcement_health so Services can show paid-placement readiness without reimplementing backend policy; includes rust_placement_rollout_summary and missing_node_list for runtime admission rollout coverage and target nodes',
    },
    {
      endpoint: 'data.nodes[].system.placement_readiness',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Mapped Rust runtime admission snapshot from /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs and /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs, including accepting_new_sessions, reason, session capacity, and bandwidth window coverage for commercial placement triage',
    },
    {
      endpoint: 'data.summary.restart_readiness.blocked_nodes[].drain_activity',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Fleet blocked-node node-level activity buckets, keepalive issue session counts, and backend activity_health mirrored from restart_readiness.drain_eta for services triage',
    },
    {
      endpoint: 'data.summary.restart_readiness.drain_activity_health_counts',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Fleet-level blocked-node activity_health risk/status counts plus backend-authored summary copy and next_step used by the Services Drain Risk card',
    },
    {
      endpoint: 'data.summary.restart_readiness.cutover_guard_counts',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Fleet-level Rust cutover safety counts, observed_only_nodes/serving_traffic_nodes, full problem_nodes, and backend-authored actionable_problem_nodes/actionable_reason/blocker_codes derived from data.nodes[].system.restart_readiness.drain_eta.cutover_guard for the Services Cutover Safety card and Cutover Blockers action queue',
    },
    {
      endpoint: 'data.summary.restart_readiness.command_lifecycle_counts',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Fleet-level restart_service active/stale/retry/terminal lifecycle counts, cancelable_active/non_cancelable_active active command counts, outcome_summary terminal audit copy, history_24h reliability aggregate with latest_any_created_at/latest_any_status context, plus backend-authored summary copy for the Services Command SLA and Restart Outcome Audit cards',
    },
    {
      endpoint: 'data.summary.restart_readiness.maintenance_exit_candidates',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Fleet-level current/drained maintenance nodes plus maintenance_exit_summary visible/hidden candidate, public entry, and region counts sourced from operator_action_plan.recommended_actions key=end_maintenance for Services capacity recovery before PATCH maintenance_mode=false',
    },
    {
      endpoint: 'GET /api/privacy_network/vpn/servers/',
      file: '/root/aeronyx/privacy_network/api/vpn_servers.py',
      purpose: 'Owner-scoped client placement capacity summary for Services: available candidates, unavailable reasons, remaining capped slots, unlimited-capacity nodes, and region/tier placement groups',
    },
    {
      endpoint: 'GET /api/privacy_network/vpn/sessions/?node_id=&status=&quality_status=',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Global VPN session list used by /dashboard/sessions deep links from blocked restart nodes',
    },
    {
      endpoint: 'PATCH /api/privacy_network/nodes/{id}/',
      file: '/root/aeronyx/privacy_network/api/nodes.py',
      purpose: 'Operator-approved maintenance_mode updates from /dashboard/services and NodeSettings commercial capacity policy updates for max_sessions/bandwidth_limit_mbps consumed by Rust node_policy',
    },
    {
      endpoint: 'GET /api/privacy_network/nodes/{id}/sessions/',
      file: '/root/aeronyx/privacy_network/api/sessions.py',
      purpose: 'Owner-scoped session list for Maintenance Drain restart guardrails',
    },
    {
      endpoint: 'ClientSessionSerializer',
      file: '/root/aeronyx/privacy_network/serializers.py',
      purpose: 'Session telemetry fields: updated_at, last_rx_at, last_tx_at, keepalive counters',
    },
    {
      endpoint: 'POST /api/privacy_network/heartbeat/',
      file: '/root/aeronyx/privacy_network/services/heartbeat_service.py',
      purpose: 'Signed heartbeat ingestion and Node.hardware_info storage',
    },
    {
      endpoint: 'GET /api/privacy_network/nodes/{id}/commands/?status=&action=&limit=',
      file: '/root/aeronyx/privacy_network/api/vpn_commands.py',
      purpose: 'Node detail command timeline, including command_action=restart_service deep links from Services',
    },
    {
      endpoint: 'POST /api/privacy_network/nodes/{id}/commands/run/',
      file: '/root/aeronyx/privacy_network/api/vpn_commands.py',
      purpose: 'Operator command queue for restart, diagnostics, and policy actions',
    },
    {
      endpoint: 'POST /api/privacy_network/nodes/{id}/commands/{cmd_id}/cancel/',
      file: '/root/aeronyx/privacy_network/api/vpn_commands.py',
      purpose: 'Operator cancellation for pending node commands before Rust acknowledgement',
    },
  ],
  rust_producers: [
    {
      file: '/root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs',
      purpose: 'Local node health, operator_status, runtime_rollout, session_cleanup',
    },
    {
      file: '/root/open/AeroNyx/crates/aeronyx-server/src/services/session.rs',
      purpose: 'Client-liveness timeout used to expire unresponsive VPN sessions during maintenance drain',
    },
    {
      file: '/root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs',
      purpose: 'Heartbeat payload assembly and backend reporting',
    },
  ],
  privacy_boundary: [
    'deployment metadata only',
    'no node public keys',
    'no client public IPs',
    'no DNS contents',
    'no packet payloads',
    'no domains or URLs',
    'no browsing history',
    'no voucher secrets',
    'no wallet-level traffic',
    'no plaintext social graph data',
  ],
};

export async function GET() {
  return NextResponse.json(
    {
      ...healthPayload,
      runtime: {
        git_sha: process.env.NODEBOARD_GIT_SHA || 'unknown',
        deployed_at: process.env.NODEBOARD_DEPLOYED_AT || null,
        source_dir: process.env.NODEBOARD_SOURCE_DIR || '/root/open/nodeboard',
        port: process.env.PORT || '3000',
        env_file: '/etc/nodeboard/nodeboard.env',
      },
      generated_at: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
