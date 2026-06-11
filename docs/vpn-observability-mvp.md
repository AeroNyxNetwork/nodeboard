# VPN Observability MVP

This document records the first commercial VPN operations milestone: node
operators can inspect VPN node health and active tunnel impact from nodeboard
without SSH access.

M3 starts a narrow, non-destructive operations path: nodeboard can enqueue VPN
diagnostic commands and read their command history. Destructive actions such as
service restart, session kick, config mutation, tier switching, and rate-limit
changes remain intentionally closed until confirmation, audit, and permission
rules are added.

## Goal

Give operators answers to three production questions:

1. Which VPN node is unhealthy?
2. Why is it unhealthy?
3. Which VPN sessions or users are affected?

The MVP intentionally uses privacy-minimal telemetry. It does not collect
destination domains, destination IPs, browsing history, packet payloads, or DNS
queries.

## Source Map

### nodeboard frontend

- `app/dashboard/page.tsx`
  - Adds a VPN Operations snapshot to the main dashboard entry point.
  - Shows healthy VPN node count, 24h availability, active tunnels, VPN traffic,
    open alert count, and the top nodes needing attention.
  - Links directly to VPN Operations, Events, and Node Detail so operators can
    triage without starting from SSH or a generic node card.

- `app/dashboard/nodes/page.tsx`
  - Adds a dense VPN Node Operations table above the existing node cards.
  - Shows region, IP/port, version, health status, health score, 24h
    availability, active sessions, CPU, memory, and last heartbeat age.
  - Sorts unhealthy VPN nodes first so degraded/offline/overloaded nodes are
    visible before the generic node card grid.

- `app/dashboard/sessions/page.tsx`
  - Replaces the old aggregate-only Sessions page with the VPN Operations view.
  - Shows summary cards, node health table, operational alerts, and VPN session
    table.
  - Shows 24h node availability from backend-derived sampled heartbeat
    history. The table includes sample count and current stale gap so operators
    can judge confidence instead of reading it as packet-level monitoring.
  - Displays stored `last_rx_at`, `last_tx_at`, and packet-loss telemetry from
    the API. Displays Rust-reported `rtt_ms` once the in-tunnel keepalive probe
    receives an ICMP Echo Reply from the session's assigned virtual IP.
  - Shows backend-derived tunnel quality (`healthy`, `degraded`, `stale`,
    `error`, `pending`, or `completed`), quality score, and first degraded
    reason so operators can triage a bad session without reading raw counters.
  - Adds a `Kick` operation for active sessions. The button queues a
    `kick_session` command through the CMS instead of calling the node directly.
  - Adds a guarded `Ban Wallet` operation for active sessions. The backend
    derives the wallet from the selected session, and the Rust node adds it to
    the VPN deny list before disconnecting that wallet's active tunnels.

- `app/dashboard/nodes/[id]/page.tsx`
  - Adds a per-node VPN Health panel to the node detail page.
  - Shows the same live heartbeat source, health score, checks, CPU, memory,
    and tunnel counters without requiring the operator to leave the node page.
  - Shows per-node 24h availability, sample count, and last stale gap to make
    intermittent node instability visible without SSH access.
  - Shows 24h CPU and bandwidth trends from sampled heartbeat history,
    including average CPU, peak bandwidth, traffic delta, max sessions, and
    invalid sample count.
  - Adds safe `System Info` and `Collect Logs` command buttons plus recent VPN
    command history.
  - Adds `Refresh Config`, which queues a bounded `refresh_config` command for
    the node to validate and summarize its management configuration without SSH.
  - Adds a guarded `Restart VPN` operation that requires browser confirmation
    and queues a CMS `restart_service` command.
  - Adds Wallet Ban Policies, an active policy table backed by
    `GET /nodes/<id>/wallet_bans/`, with copy and unban controls.

- `app/dashboard/billing/page.tsx`
  - Adds Traffic & Billing with filters for days, node, and session status.
  - Adds wallet/session search backed by the billing API `q` parameter.
  - Shows traffic, session, monthly quota, voucher time, voucher issue count,
    node rows, identity rows, session rows, and daily rows.
  - Exports the current table as CSV directly from the browser.
  - Keeps the privacy boundary visible in the UI. Voucher attribution is
    represented by a reserved `voucher_id` field until voucher IDs are stored
    separately from blind voucher secrets.

- `app/dashboard/events/page.tsx`
  - Adds Alerts / Events with filters for days, severity, type, and node.
  - Shows open, critical, warning, and info counts plus a live event stream.
  - Displays derived node health events, session errors/resets, command
    failures, stuck commands, service restarts, and operator actions.

- `app/dashboard/settings/page.tsx`
  - Adds Settings as the node operator policy center.
  - Lets operators select a node and edit node tier, maintenance mode, maximum
    sessions, bandwidth cap, and heartbeat interval.
  - Saves through the existing owner-scoped `PATCH /nodes/<id>/` endpoint.

- `components/dashboard/Sidebar.tsx`
  - Adds the `Traffic & Billing` navigation item at `/dashboard/billing`.
  - Adds the `Alerts / Events` navigation item at `/dashboard/events`.
  - Adds the `Settings` navigation item at `/dashboard/settings`.

- `hooks/useNodes.ts`
  - Adds `useVpnOverview()` with 30 second polling.
  - Adds `useVpnSessions()` with 15 second polling.
  - Adds `useVpnBilling()` with 30 second polling for Traffic & Billing.
  - Adds `useVpnEvents()` with 15 second polling for Alerts / Events.
  - Adds `useVpnNodeMetrics()` with 30 second polling for per-node 24h
    heartbeat metrics history on the node detail page.
  - Adds `useNodeWalletBans()` with 15 second polling for active CMS wallet ban
    policies on the node detail page.
  - Adds `useNodeCommands()` and `useRunNodeCommand()` for node-level
    operations history and enqueue mutations.
  - Invalidates VPN overview, session, and wallet-ban queries after node
    commands so policy and session state refresh after the node reports
    completion.
  - Keeps authentication gating consistent with existing owner-only hooks.

- `lib/api.ts`
  - Adds `getVpnOverview()`.
  - Adds `getVpnNodeMetrics(nodeId, { hours })`.
  - Adds `getVpnSessions({ status, nodeId, limit })`.
  - Adds `getVpnBilling({ days, status, nodeId, q })`.
  - Adds `getVpnEvents({ days, severity, type, nodeId, limit })`.
  - Adds `getNodeCommands()` and `runNodeCommand()`.

- `lib/constants.ts`
  - Adds `VPN_OVERVIEW`, `VPN_SESSIONS`, `VPN_BILLING`, and `VPN_EVENTS` API
    endpoints.
  - Adds `VPN_NODE_METRICS` for `GET /vpn/nodes/<id>/metrics/`.
  - Adds `NODE_COMMANDS` and `NODE_COMMAND_RUN` API endpoints.
  - Adds polling intervals for VPN overview, session, and event data.

- `types/index.ts`
  - Adds `VpnOverview`, `VpnNodeHealth`, `VpnAlert`, `VpnSession`, and response
    types.
  - Adds `VpnNodeMetrics` and `VpnNodeMetricPoint` types for sampled CPU,
    memory, sessions, bandwidth, and heartbeat validity history.
  - Adds `VpnEvent`, `VpnEventsOverview`, and `VpnEventsResponse` types.
  - Extends `Node`, `NodeDetail`, and `NodeUpdateRequest` with commercial VPN
    operator policy fields: `node_tier`, `maintenance_mode`, `max_sessions`,
    `bandwidth_limit_mbps`, and `heartbeat_interval_seconds`.
  - Adds `NodeCommand`, `NodeCommandListResponse`, and
    `RunNodeCommandResponse` types.

### API backend

- `/root/aeronyx/privacy_network/api/vpn_observability.py`
  - Adds owner-authenticated observability endpoints.
  - Builds the MVP from `Node`, `NodeHeartbeat`, and `ClientSession` models.
  - Prefers the live Redis heartbeat cache written by
    `HeartbeatService._cache_heartbeat()` and uses sampled `NodeHeartbeat`
    rows only as a fallback. This keeps nodeboard aligned with the real
    heartbeat cadence instead of the lower-frequency DB sampling cadence.
  - Derives `health_status` as `healthy`, `degraded`, `offline`, or
    `overloaded`.
  - Derives `availability_24h` from sampled `NodeHeartbeat` rows and the latest
    heartbeat age. The value reports percent, sample count, valid sample count,
    first/last sample time, and current stale gap. It is an operational uptime
    signal only and does not inspect packet payloads, browsing destinations, or
    DNS contents.
  - Adds `GET /vpn/nodes/<id>/metrics/` for owner-scoped per-node heartbeat
    history. The endpoint returns sampled CPU, memory, active sessions, net
    counter deltas, calculated bandwidth, invalid sample count, and summary
    values for nodeboard charts.
  - Emits node health checks for heartbeat freshness, resource load, traffic
    counters, and Rust-reported VPN checks: UDP listener, TUN device, MTU
    config, IPv4 forwarding, NAT masquerade, DNS stub, DNS query, and Internet
    egress.
  - Marks a fresh node as `degraded` when Rust reports failed local VPN checks,
    so operators can distinguish "heartbeat alive" from "VPN path broken".
  - Emits operational alerts from derived node health.
  - Returns stored session quality fields from M2: `last_rx_at`, `last_tx_at`,
    `rtt_ms`, and `packet_loss`. If `packet_loss` has not been stored, it can
    estimate a percentage from packet/replay rejection counters.
  - Derives per-session `quality_status`, `quality_score`,
    `degraded_reason`, `quality_reasons`, and `last_activity_at` from
    operational counters only: status, last RX/TX timestamps, RTT, packet loss,
    and replay-window rejection totals.

- `/root/aeronyx/privacy_network/models.py`
  - Extends `NodeHeartbeat` with privacy-safe extended metrics:
    `net_rx_bytes`, `net_tx_bytes`, `memory_total_mb`, `cpu_count`, and
    `vpn_health_status`, enabling trend charts without storing destinations,
    DNS contents, or packet payloads.
  - Extends `ClientSession` with stored VPN quality telemetry:
    `last_rx_at`, `last_tx_at`, `rtt_ms`, `packet_loss`,
    `replay_rejections`, `too_old_rejections`, `packets_rx`, and `packets_tx`.
  - Stores `Node.runtime_id` / `Node.runtime_started_at` and
    `ClientSession.last_error` so server resets can be diagnosed without SSH.

- `/root/aeronyx/privacy_network/serializers.py`
  - Allows Rust nodes to submit `session_traffic_snapshot` reports in addition
    to created, updated, and ended events.
  - Accepts optional quality telemetry on session reports.

- `/root/aeronyx/privacy_network/services/session_service.py`
  - Adds cumulative snapshot upsert handling so Rust session snapshots do not
    double-count bytes when a report is retried.
  - Treats `session_ended` as a final cumulative snapshot, then completes the
    session and updates node totals once.
  - Adds node-level session interruption handling for Rust process resets.
    Active sessions that existed only in the previous node runtime are marked
    `error` with a human-readable `last_error` reason.

- `/root/aeronyx/privacy_network/services/heartbeat_service.py`
  - Detects Rust `runtime_id` changes in heartbeat `system_stats`.
  - On runtime change, closes stale active sessions for that node before
    storing the new heartbeat counters.
  - Persists sampled extended heartbeat counters from Rust `system_stats` so
    nodeboard can show historical CPU, memory, sessions, and bandwidth.

- `/root/aeronyx/privacy_network/urls.py`
  - Registers `GET /api/privacy_network/vpn/overview/`.
  - Registers `GET /api/privacy_network/vpn/sessions/`.
  - Registers `GET /api/privacy_network/vpn/nodes/<id>/metrics/`.
  - Registers `POST /api/privacy_network/nodes/<id>/commands/run/`.

- `/root/aeronyx/privacy_network/api/agent.py`
  - Adds `RunNodeCommandView` for owner-authenticated non-destructive
    operations commands.
  - Allows `system_info`, `collect_logs`, and the bounded control action
    `kick_session`, wallet controls `ban_wallet` / `unban_wallet`, plus
    `refresh_config` and guarded `restart_service`.
  - Validates `kick_session` against the target node and requires the session to
    still be active before the command is queued.
  - Validates `ban_wallet` from a target-node active session, normalizes the
    64-character wallet hex, and strips caller-provided wallet values.
  - Validates `unban_wallet` against wallets that have session history on the
    requested node.
  - Rewrites `refresh_config` params to fixed `scope="management"` so callers
    cannot provide arbitrary local paths or shell arguments.
  - Validates `restart_service` with `confirm="restart"` and rewrites params so
    the node can only restart the fixed `aeronyx-server` service.
  - Increases command status message size so short diagnostic summaries can be
    stored in `NodeCommand.result`.
  - Treats `vpn` / `node` command status reports as command-only updates, so
    VPN diagnostics do not create or mutate OpenClaw `AgentInstance` records.

- `/root/aeronyx/privacy_network/models.py`
  - Adds `NodeWalletBan`, the CMS source of truth for operator-managed wallet
    bans per node.
  - `ban_wallet` upserts an active policy row after queuing the Rust command;
    `unban_wallet` marks the policy inactive with `unbanned_at`.
  - Adds node operator policy fields:
    `maintenance_mode`, `max_sessions`, `bandwidth_limit_mbps`, and
    `heartbeat_interval_seconds`.
  - Existing `node_tier` remains the authoritative commercial access tier.

- `/root/aeronyx/privacy_network/serializers.py`
  - Exposes operator policy fields in owner `NodeListSerializer` and
    `NodeDetailSerializer`.
  - Allows owner `NodeUpdateSerializer` to update `node_tier`,
    `maintenance_mode`, `max_sessions`, `bandwidth_limit_mbps`, and
    `heartbeat_interval_seconds` with bounds validation.

- `/root/aeronyx/privacy_network/api/heartbeat.py`
  - Adds `operator_bans` to heartbeat responses as the full active wallet ban
    list for the node. Rust uses this to recover policy after restart or a
    missed command.
  - Adds `node_policy` to heartbeat responses so Rust can read the operator
    Settings policy on each heartbeat.
  - Overrides `next_heartbeat_in` from `Node.heartbeat_interval_seconds`, so the
    Settings page can change heartbeat cadence without SSH.

- `/root/aeronyx/privacy_network/api/nodes.py`
  - Adds owner-scoped `GET /nodes/<id>/wallet_bans/?status=active|inactive|all`
    for nodeboard policy visibility.
  - Returns only operator ban policy metadata: wallet hex, reason, source,
    command id, and timestamps. It does not expose traffic destinations,
    packet payloads, DNS queries, or browsing activity.

- `/root/aeronyx/privacy_network/api/vpn_billing.py`
  - Adds owner-scoped `GET /vpn/billing/`.
  - Aggregates existing `ClientSession`, `UserTrafficQuota`,
    `UserVpnDailyUsage`, and `VoucherIssueLog` rows.
  - Supports `q` search over `client_wallet` and `session_id` only.
  - Returns `sessions` rows with operational counters and a reserved
    `voucher_id` placeholder. It does not expose or derive voucher secrets.
  - Preserves the blind-voucher privacy boundary: no blinded tokens, final
    voucher tokens, signatures, destinations, DNS queries, or packet payloads
    are returned.

- `/root/aeronyx/privacy_network/api/vpn_events.py`
  - Adds owner-scoped `GET /vpn/events/`.
  - Derives operator events from existing `Node`, `ClientSession`, and
    `NodeCommand` state without adding a new table.
  - Reuses the VPN observability health helpers so node health status and event
    status stay consistent.
  - Emits current health events for offline, stale heartbeat, overloaded, and
    failed health checks.
  - Emits historical events for session errors/resets and failed, timed out,
    stuck, restart, or operator action commands.
  - Emits current `session_degraded` and `session_stale` warnings by reusing
    the same session quality classification returned by `/vpn/sessions/`.
    Event details include RTT, packet loss, quality score, degraded reason, and
    last activity age.
  - Keeps the same privacy boundary as the other VPN APIs: no packet payloads,
    DNS contents, destination domains, destination IPs, browsing history, blind
    tokens, or final voucher tokens.

### Rust VPN node

- `/root/a/AeroNyx/crates/aeronyx-server/src/management/client.rs`
  - Existing heartbeat sender already reports `system_stats.cpu_usage`,
    `system_stats.memory_mb`, `system_stats.active_sessions`, node version,
    binary hash, `connected_wallets`, and `traffic_delta`.
  - Adds `system_stats.vpn_health` to the signed heartbeat body. The payload is
    privacy-safe local node diagnostics only.

- `/root/a/AeroNyx/crates/aeronyx-server/src/management/reporter.rs`
  - Existing heartbeat reporter already collects connected wallets and drains
    traffic deltas every heartbeat period.
  - Adds quality fields to session event reports and sends
    `session_traffic_snapshot` as cumulative byte totals.
  - Includes stored RTT samples from session stats in `session_traffic_snapshot`
    and final `session_ended` reports.
  - Synchronizes CMS `operator_bans` into the runtime `DenyList` before the
    legacy membership enforcement gate, so operator controls remain active
    while voucher auth is authoritative.
  - Applies CMS-requested `next_heartbeat_in` by rebuilding the tokio heartbeat
    interval at runtime.
  - Parses and logs `node_policy` from Settings and keeps `node_tier` cache in
    sync with policy.
  - Updates the shared runtime `NodePolicyRuntime` on each heartbeat so
    nodeboard Settings can affect handshake and packet paths without SSH or
    service restart.
  - Runs the injected VPN health probe before each heartbeat and passes the
    result into the signed CMS heartbeat payload.

- `/root/a/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs`
  - Exposes local `GET /api/vpn/health` and the reusable
    `collect_vpn_health_value()` heartbeat collector.
  - Checks UDP listener, TUN device, TUN MTU config, IPv4 forwarding, NAT
    masquerade, DNS listener, DNS query, and TCP Internet egress.
  - Includes `configured_mtu` and a `mtu_config` check that compares the
    running Linux TUN MTU with Rust config and the recommended Internet VPN
    range.
  - Reports only node-local diagnostics and aggregate counters; it never
    includes user destination IPs, destination domains, DNS query contents,
    packet payloads, or browsing history.

- `/root/a/AeroNyx/crates/aeronyx-server/src/management/client.rs`
  - Adds `runtime_id` and `runtime_started_at` to signed heartbeat
    `system_stats`. The id is regenerated each Rust process start and lets the
    CMS identify server resets.
  - Adds `NodePolicy` to the heartbeat response model for Settings-driven node
    policy delivery.

- `/root/a/AeroNyx/crates/aeronyx-server/src/services/traffic_tracker.rs`
  - Existing traffic tracker aggregates per-wallet byte deltas for billing and
    quota accounting.

- `/root/a/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs`
  - Keeps the latest CMS `node_policy` in a thread-safe runtime snapshot.
  - Validates new-session admission for `maintenance_mode` and `max_sessions`.
  - Enforces a node-wide one-second byte window for `bandwidth_limit_mbps` in
    the VPN packet hot path. A value of `0` remains unlimited.

- `/root/a/AeroNyx/crates/aeronyx-server/src/services/handshake.rs`
  - Checks `NodePolicyRuntime::validate_new_session()` before deny-list checks,
    IP allocation, or session creation.
  - Rejects new handshakes during maintenance mode.
  - Rejects new handshakes when active sessions have reached nodeboard
    `max_sessions`.

- `/root/a/AeroNyx/crates/aeronyx-server/src/handlers/packet.rs`
  - Applies `bandwidth_limit_mbps` to both decrypted client-to-VPN packets and
    TUN-to-client packets before byte counters are recorded or packets are
    re-encrypted.
  - Builds encrypted ICMP Echo Request keepalive probes from the gateway IP to
    each session's assigned virtual IP.
  - Consumes matching ICMP Echo Replies after decrypting client packets,
    records RTT on the session, and prevents keepalive ACKs from being written
    back to TUN or counted as billable user traffic.
  - Preserves the privacy boundary: probes target only assigned virtual IPs and
    never include user destination IPs, destination domains, DNS query contents,
    packet payloads, or browsing history.

- `/root/a/AeroNyx/crates/aeronyx-server/src/services/session.rs`
  - Existing session manager tracks active VPN sessions, wallet/device indexes,
    and session cleanup.
  - Records real RX/TX timestamps and packet/replay counters in each session
    stats snapshot.
  - Tracks bounded pending keepalive probes per session and stores completed
    RTT samples as microseconds in the session stats snapshot.
  - Adds `record_control_tx()` so operational keepalive probes refresh transmit
    activity without inflating bytes, packet counters, billing, or quota usage.

- `/root/a/AeroNyx/crates/aeronyx-server/src/services/deny_list.rs`
  - Maintains the in-memory wallet deny list checked by VPN handshake.
  - Adds `OperatorBan`, a permanent operator-controlled reason that is not
    auto-cleared by membership or quota heartbeat updates.
  - Exposes reason-scoped listing so heartbeat sync only reconciles
    `OperatorBan` entries and leaves membership/quota entries alone.

- `/root/a/AeroNyx/crates/aeronyx-server/src/server.rs`
  - Converts session stats snapshots into privacy-minimal quality telemetry for
    periodic traffic snapshots and final session-ended reports.
  - Injects the shared `DenyList` into `CommandHandler` so nodeboard operations
    and handshake enforcement use the same runtime control plane.
  - Injects the shared `NodePolicyRuntime` into `HeartbeatReporter`,
    `HandshakeService`, and `PacketHandler`.
  - Starts a periodic keepalive task that probes established sessions and lets
    `PacketHandler` consume ACKs on the encrypted VPN data path.

- `/root/a/AeroNyx/crates/aeronyx-server/src/management/command_handler.rs`
  - Adds `system_info` and `collect_logs` command handlers.
  - Uses fixed read-only commands with timeout, truncation, and simple
    sensitive-line redaction.
  - Reports VPN diagnostics as `agent_type="vpn"` through the existing signed
    command status endpoint; OpenClaw lifecycle commands still report as
    `agent_type="openclaw"`.
  - Adds `kick_session`, which parses the CMS-provided base64 session id,
    removes that session from `SessionManager`, and emits a final
    `session_ended` report with cumulative traffic/quality counters.
  - Adds `ban_wallet` and `unban_wallet`. `ban_wallet` validates 64-character
    wallet hex, inserts `OperatorBan` into the shared `DenyList`, disconnects
    all active sessions for that wallet, and emits final session reports.
    `unban_wallet` removes the wallet from the runtime deny list.
  - Adds `refresh_config`, which validates the running management config and
    summarizes the fixed node binding file. This creates the nodeboard control
    path for future centralized policy refresh without exposing SSH or arbitrary
    file reads.
  - Adds `restart_service`, which reports the command audit status first and
    then schedules a delayed restart of the fixed `aeronyx-server` systemd
    service. The delayed restart lets the CMS store command completion before
    the process exits.
  - Includes stored RTT in command-triggered final session quality reports.

## API Contract

### `GET /api/privacy_network/vpn/overview/`

Authenticated with the existing nodeboard API key.

Response shape:

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_nodes": 1,
      "healthy_nodes": 1,
      "degraded_nodes": 0,
      "offline_nodes": 0,
      "overloaded_nodes": 0,
      "active_sessions": 3,
      "traffic_in_mb": 128.5,
      "traffic_out_mb": 256.1,
      "open_alerts": 0
    },
    "nodes": [],
    "alerts": [],
    "generated_at": "2026-06-11T11:30:14Z"
  }
}
```

Each `nodes[]` item includes:

- identity: `id`, `name`, `public_ip`, `port`, `version`, `region_code`,
  `city`, `node_tier`, `is_vpn_node`
- health: `health_status`, `health_score`, `last_heartbeat`,
  `last_seen_seconds`, `checks[]`
- load: `system.cpu_usage`, `system.memory_mb`, `system.memory_total_mb`,
  `system.cpu_count`, `system.source`
- VPN health: `system.vpn_health_status`, `system.vpn_health_checked_at`, and
  detailed `checks[]` entries for UDP/TUN/MTU/NAT/DNS/egress
- traffic counters: `system.net_rx_bytes`, `system.net_tx_bytes`,
  `traffic_in_mb`, `traffic_out_mb`
- session counters: `active_sessions`, `total_sessions`,
  `system.reported_active_sessions`
- runtime: `system.runtime_id`, `system.runtime_started_at`

`system.source` is `cache` for live heartbeat cache data and `sample` when the
API had to fall back to the sampled heartbeat table.

### `GET /api/privacy_network/vpn/sessions/`

Query parameters:

- `status`: `all`, `active`, `completed`, or `error`
- `node_id`: optional node UUID
- `limit`: 1 to 1000, default 200

Response shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "session_id": "node-session-id",
      "node_id": "node-uuid",
      "node_name": "US VPN 1",
      "client_wallet": "wallet-or-voucher-transport-id",
      "virtual_ip": "",
      "voucher_id": "",
      "bytes_in": 1024,
      "bytes_out": 2048,
      "total_bytes_mb": 0.01,
      "started_at": "2026-06-11T11:00:00Z",
      "ended_at": null,
      "duration_seconds": 120,
      "status": "active",
      "last_rx_at": "2026-06-11T11:02:00Z",
      "last_tx_at": "2026-06-11T11:02:00Z",
      "rtt_ms": null,
      "packet_loss": 0.5,
      "last_error": "node runtime reset; previous in-memory VPN sessions were marked stale by heartbeat recovery",
      "quality_status": "degraded",
      "quality_score": 75,
      "degraded_reason": "RTT is high at 320.4 ms",
      "quality_reasons": ["RTT is high at 320.4 ms"],
      "last_activity_at": "2026-06-11T11:02:00Z",
      "last_activity_age_seconds": 8
    }
  ],
  "count": 1
}
```

### `GET /api/privacy_network/nodes/{id}/wallet_bans/`

Query parameters:

- `status`: `active`, `inactive`, or `all`; default `active`

Response shape:

```json
{
  "success": true,
  "count": 1,
  "status": "active",
  "data": [
    {
      "id": "uuid",
      "node_id": "node-uuid",
      "wallet_hex": "64-char-lowercase-hex",
      "wallet_short": "abcdef12...123456",
      "reason": "operator_ban",
      "source": "nodeboard_vpn_operations",
      "is_active": true,
      "banned_by_wallet": "operator-wallet",
      "command_id": "command-uuid",
      "banned_at": "2026-06-11T11:00:00Z",
      "unbanned_at": null,
      "updated_at": "2026-06-11T11:00:00Z"
    }
  ]
}
```

### `PATCH /api/privacy_network/nodes/{id}/`

Settings uses the existing owner node update endpoint.

Operator policy fields:

```json
{
  "node_tier": "premium",
  "maintenance_mode": false,
  "max_sessions": 500,
  "bandwidth_limit_mbps": 1000,
  "heartbeat_interval_seconds": 30
}
```

Validation:

- `node_tier`: `public` or `premium`
- `maintenance_mode`: boolean
- `max_sessions`: 0 to 100000; `0` means local default
- `bandwidth_limit_mbps`: 0 to 100000; `0` means unlimited / local default
- `heartbeat_interval_seconds`: 10 to 300

The full node list/detail responses include these fields so nodeboard can show
and edit policy without opening SSH.

### Heartbeat `node_policy`

`POST /api/privacy_network/node/heartbeat/` returns the operator policy on every
successful heartbeat:

```json
{
  "success": true,
  "next_heartbeat_in": 30,
  "node_tier": "premium",
  "node_policy": {
    "node_tier": "premium",
    "maintenance_mode": false,
    "max_sessions": 500,
    "bandwidth_limit_mbps": 1000,
    "heartbeat_interval_seconds": 30,
    "updated_at": "2026-06-12T00:00:00Z"
  }
}
```

Rust immediately applies `next_heartbeat_in` to the heartbeat loop, caches
`node_policy.node_tier`, and updates the shared runtime policy. New handshakes
are rejected when `maintenance_mode=true` or when `max_sessions` is reached.
Packet handling enforces `bandwidth_limit_mbps` as a node-wide per-second byte
window in both traffic directions. Existing sessions are not kicked by
maintenance mode; operators can use `kick_session` or wallet bans for explicit
disconnects.

### `GET /api/privacy_network/vpn/billing/`

Query parameters:

- `days`: 1 to 90, default 30
- `status`: `all`, `active`, `completed`, or `error`
- `node_id`: optional node UUID
- `q`: optional wallet/session search string. Matches `client_wallet` and
  `session_id` only.

Response shape:

```json
{
  "success": true,
  "data": {
    "filters": {
      "days": 30,
      "status": "all",
      "node_id": "",
      "start_at": "2026-05-12T00:00:00Z",
      "end_at": "2026-06-11T00:00:00Z"
    },
    "summary": {
      "total_nodes": 3,
      "filtered_nodes": 2,
      "total_sessions": 128,
      "active_sessions": 9,
      "total_traffic_mb": 10240.5,
      "duration_seconds": 86400
    },
    "quota": {
      "monthly": {
        "tier": "free",
        "quota_bytes": 5368709120,
        "used_bytes": 1073741824,
        "remaining_bytes": 4294967296,
        "usage_percent": 20.0,
        "is_unlimited": false
      },
      "daily_vpn_usage": {
        "quota_seconds": 3600,
        "reserved_seconds": 900,
        "billable_seconds": 900,
        "remaining_seconds": 2700,
        "usage_percent": 25.0
      }
    },
    "voucher_accounting": {
      "epoch": "2026-06",
      "issued_vouchers": 12,
      "issue_events": 12,
      "last_issued_at": "2026-06-11T11:00:00Z",
      "privacy_note": "blind voucher tokens and signatures are not stored"
    },
    "nodes": [],
    "identities": [],
    "daily": [],
    "tiers": [],
    "known_identity_count": 0,
    "generated_at": "2026-06-11T11:30:14Z"
  }
}
```

`nodes[]`, `identities[]`, and `daily[]` are aggregate views over
`ClientSession`. `voucher_accounting` is issuance-side accounting only: the
server stores wallet, epoch, tier, and count, never blinded tokens or final
voucher tokens.

`last_rx_at`, `last_tx_at`, `rtt_ms`, `packet_loss`, packet counters, replay
rejection counters, and bytes are stored from signed Rust session reports.
`rtt_ms` comes from a Rust server-side ICMP Echo keepalive sent inside the VPN
tunnel to the session's assigned virtual IP. It remains `null` until an active
client replies to a probe.

When a Rust process restart changes `system.runtime_id`, the backend marks
previously active sessions as `error` with `last_error` explaining the reset.
This prevents nodeboard from showing sessions that no longer exist in node
memory as active.

### `GET /api/privacy_network/vpn/events/`

Query parameters:

- `days`: 1 to 90, default 7
- `severity`: `all`, `critical`, `warning`, or `info`
- `type`: optional event type filter
- `node_id`: optional node UUID
- `limit`: 1 to 500, default 200

Response shape:

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 4,
      "critical": 1,
      "warning": 2,
      "info": 1,
      "open": 3
    },
    "events": [
      {
        "id": "node-node-uuid-offline",
        "severity": "critical",
        "type": "node_offline",
        "title": "Node offline",
        "message": "US VPN 1 has not sent a fresh heartbeat.",
        "node_id": "node-uuid",
        "node_name": "US VPN 1",
        "source": "node_health",
        "created_at": "2026-06-11T11:30:14Z",
        "status": "open",
        "action": null,
        "session_id": null,
        "command_id": null,
        "details": {
          "last_seen_seconds": 330,
          "health_score": 0
        }
      }
    ],
    "filters": {
      "days": 7,
      "severity": "all",
      "type": "",
      "node_id": "",
      "limit": 200,
      "start_at": "2026-06-04T11:30:14Z",
      "end_at": "2026-06-11T11:30:14Z"
    },
    "generated_at": "2026-06-11T11:30:14Z"
  }
}
```

Event sources:

- `node_health`: current derived node state from the same helper used by
  `/vpn/overview/`.
- `vpn_session`: `ClientSession.status="error"`, non-empty `last_error`, or
  active sessions whose derived tunnel quality is `degraded` or `stale`.
- `node_command`: `NodeCommand` failures, timeouts, stale active commands,
  service restarts, and operator actions.

### `POST /api/privacy_network/nodes/{id}/commands/run/`

Authenticated with the existing nodeboard API key and node ownership check.

Allowed request body:

```json
{
  "action": "system_info",
  "params": {},
  "priority": 5
}
```

Allowed actions:

- `system_info`: collects uptime, kernel, service status, TUN device state,
  UDP listeners, and IPv4 forwarding state.
- `collect_logs`: collects a short redacted `journalctl` tail for the VPN
  service.
- `refresh_config`: validates the Rust node's current management config and
  fixed node binding file, then records a sanitized summary in command history.
  The backend strips caller-provided params and the node does not accept custom
  file paths.
- `kick_session`: removes one active VPN session from the Rust node. The backend
  only queues this command when the session belongs to the requested node and is
  still active.
- `ban_wallet`: operator ban for the wallet attached to an active VPN session.
  The backend derives `wallet_hex` from the selected session, and Rust enforces
  it through the handshake `DenyList`. The backend also persists the active
  policy in `NodeWalletBan` for heartbeat recovery.
- `unban_wallet`: removes a wallet from the Rust node runtime deny list after
  the backend verifies that the wallet has session history on the requested
  node, and marks the CMS policy inactive.
- `restart_service`: restarts the VPN node service. The backend requires
  `confirm="restart"` and strips caller-provided service names; the Rust node
  only restarts `aeronyx-server`.

Response shape:

```json
{
  "success": true,
  "data": {
    "command": {
      "id": "command-uuid",
      "action": "system_info",
      "params": {},
      "priority": 5,
      "issued_at": "2026-06-11T11:30:14Z"
    }
  },
  "message": "System info collection queued for US VPN 1"
}
```

## Data Flow

```text
Rust VPN node
  -> signed heartbeat /api/privacy_network/node/heartbeat/
  -> existing NodeHeartbeat + Node counters
  -> VPN observability API
  -> nodeboard VPN Operations page

Rust VPN node
  -> signed heartbeat with runtime_id/runtime_started_at
  -> HeartbeatService detects Rust process reset
  -> stale active sessions marked error with last_error
  -> nodeboard VPN Sessions table

Rust VPN node
  -> signed session report /api/privacy_network/node/sessions/report/
  -> cumulative ClientSession snapshot upsert
  -> VPN session API
  -> nodeboard VPN Sessions table

nodeboard Node Detail
  -> POST /nodes/{id}/commands/run/
  -> CommandService Redis + DB queue
  -> Rust heartbeat command dispatch
  -> CommandHandler executes diagnostic, refresh_config, or restart_service
  -> signed POST /node/agent/status/
  -> NodeCommand history visible in nodeboard

nodeboard VPN Sessions
  -> POST /nodes/{id}/commands/run/ action=kick_session
  -> CommandService Redis + DB queue
  -> Rust heartbeat command dispatch
  -> SessionManager.remove(session_id)
  -> signed session_ended report
  -> ClientSession leaves active view
  -> signed command status audit

nodeboard VPN Sessions
  -> POST /nodes/{id}/commands/run/ action=ban_wallet
  -> backend derives wallet_hex from the active ClientSession
  -> backend persists active NodeWalletBan policy
  -> Rust heartbeat command dispatch
  -> DenyList.add(wallet, OperatorBan)
  -> SessionManager removes all active sessions for that wallet
  -> handshake rejects reconnects while the runtime deny entry exists
  -> signed session_ended + command status audit

nodeboard Node Detail
  -> GET /nodes/{id}/wallet_bans/?status=active
  -> operator sees active CMS wallet ban policies
  -> POST /nodes/{id}/commands/run/ action=unban_wallet
  -> backend marks NodeWalletBan inactive
  -> next heartbeat removes OperatorBan from Rust runtime DenyList

nodeboard Traffic & Billing
  -> GET /vpn/billing/?days=30&status=all&q=<wallet-or-session>
  -> aggregate ClientSession traffic by node, identity, session, and day
  -> attach owner quota, daily voucher allowance, and voucher issue counts
  -> browser exports current table as CSV

nodeboard Alerts / Events
  -> GET /vpn/events/?days=7&severity=all
  -> backend derives events from current node health, ClientSession errors, and NodeCommand audits
  -> operator sees offline/degraded/overloaded nodes, session resets, command failures, and operator actions

nodeboard Settings
  -> PATCH /nodes/{id}/ operator policy fields
  -> backend stores commercial policy on Node
  -> Rust heartbeat receives node_policy + next_heartbeat_in
  -> heartbeat interval updates without SSH
  -> new handshakes enforce maintenance_mode and max_sessions
  -> packet paths enforce bandwidth_limit_mbps in both directions
```

## M1 Verification

- API backend:
  - `python manage.py check`
  - `GET /api/privacy_network/vpn/overview/` returns `200`
  - `GET /api/privacy_network/vpn/sessions/?limit=1` returns `200`

- nodeboard:
  - `npm run type-check`
  - `npm run build`

## M3 Verification

- API backend:
  - `python -m py_compile privacy_network/api/agent.py privacy_network/urls.py`
  - `python manage.py check`

- Rust VPN node:
  - `cargo check -p aeronyx-server`

- nodeboard:
  - `npm run type-check`
  - `npm run build`

## M3 Kick Session Verification

- API backend:
  - `python -m py_compile privacy_network/models.py privacy_network/api/agent.py`
  - `python manage.py check`
  - Smoke test: `kick_session` refuses missing session ids, refuses inactive or
    cross-node sessions, and queues only active sessions on the requested node.

- Rust VPN node:
  - `cargo check -p aeronyx-server`
  - `cargo build -p aeronyx-server --release`
  - `systemctl restart aeronyx-server`
  - `systemctl is-active aeronyx-server`

- nodeboard:
  - `npm run type-check`
  - `npm run build`

## M4 Wallet Ban Verification

- API backend:
  - `python -m py_compile privacy_network/models.py privacy_network/api/agent.py privacy_network/api/heartbeat.py privacy_network/api/nodes.py privacy_network/urls.py`
  - `python manage.py migrate privacy_network`
  - `python manage.py check`
  - Smoke test: `ban_wallet` refuses missing/inactive/cross-node sessions and
    queues only sanitized wallet params derived from a target-node active
    session. It also creates an active `NodeWalletBan`; `unban_wallet` marks it
    inactive.
  - Smoke test: `GET /nodes/<id>/wallet_bans/` returns active policy rows and
    `unban_wallet` succeeds for an active policy even without session history.

- Rust VPN node:
  - `cargo check -p aeronyx-server`
  - `cargo build -p aeronyx-server --release`
  - `systemctl restart aeronyx-server`
  - `systemctl is-active aeronyx-server`

- nodeboard:
  - `npm run type-check`
  - `npm run build`

Operator ban persistence boundary: CMS `NodeWalletBan` is the source of truth.
Rust keeps an in-memory `DenyList` for fast handshake rejection and reconciles
the `OperatorBan` subset from heartbeat responses. If CMS omits the
`operator_bans` field, Rust keeps its current runtime state for backward
compatibility; if CMS sends an empty list, Rust clears only active
`OperatorBan` entries.

## M4 Traffic & Billing Verification

- API backend:
  - `python -m py_compile privacy_network/api/vpn_billing.py privacy_network/urls.py`
  - `python manage.py check`
  - Smoke test: `GET /api/privacy_network/vpn/billing/?days=30&status=all`
    returns `summary`, `quota`, `voucher_accounting`, `nodes`, `identities`,
    `sessions`, `daily`, and `tiers`.
  - Smoke test: `GET /api/privacy_network/vpn/billing/?q=<session-or-wallet>`
    filters by `client_wallet` or `session_id` and still returns no destination
    IPs, DNS contents, packet payloads, blind voucher tokens, or signatures.

- nodeboard:
  - `npm run type-check`
  - `npm run build`
  - `/dashboard/billing` is included in the build output and the sidebar links
    to it.

## M4 Alerts / Events Verification

- API backend:
  - `python -m py_compile privacy_network/api/vpn_events.py privacy_network/urls.py`
  - `python manage.py check`
  - Smoke test: `GET /api/privacy_network/vpn/events/?days=7&severity=all`
    returns `summary`, `events`, `filters`, and `generated_at`.
  - Smoke test: active degraded/stale VPN sessions appear as
    `session_degraded` or `session_stale` events with operational-only details:
    quality status, score, reason, RTT, packet loss, and last activity age.

- nodeboard:
  - `npm run type-check`
  - `npm run build`
  - `/dashboard/events` is included in the build output and the sidebar links
    to it.

## M4 Settings Verification

- API backend:
  - `python -m py_compile privacy_network/models.py privacy_network/serializers.py privacy_network/api/heartbeat.py privacy_network/migrations/0008_node_operator_policy.py`
  - `python manage.py migrate privacy_network`
  - `python manage.py check`
  - Smoke test: owner `PATCH /nodes/<id>/` accepts `node_tier`,
    `maintenance_mode`, `max_sessions`, `bandwidth_limit_mbps`, and
    `heartbeat_interval_seconds`.
  - Smoke test: heartbeat response includes `node_policy` and
    `next_heartbeat_in` equals `heartbeat_interval_seconds`.

- Rust VPN node:
  - `cargo check -p aeronyx-server`
  - `cargo build -p aeronyx-server --release`
  - `systemctl restart aeronyx-server`
  - `systemctl is-active aeronyx-server` returns `active`.
  - Heartbeat reporter applies CMS `next_heartbeat_in` by rebuilding its tokio
    interval and logs `node_policy`.
  - Local `GET /api/vpn/health` returns `status="ok"` with checks:
    `udp_listener`, `tun_device`, `mtu_config`, `ip_forward`,
    `nat_masquerade`, `dns_stub`, `dns_query`, and `internet_egress`.
  - Backend heartbeat cache includes `vpn_health.status="ok"` and the eight
    Rust health check entries after one heartbeat cycle.
  - Backend `_node_payload()` returns the Rust VPN checks in nodeboard
    `checks[]`.
  - Journal shows `[NODE_POLICY] CMS operator policy updated` after restart.
  - `Korean1` heartbeat cache shows `vpn_health.status="ok"` after restart.
  - With one active VPN session, the backend stored `rtt_ms=80.844` from the
    Rust in-tunnel ICMP keepalive ACK path.
  - Focused unit tests for the new handshake policy are present, but
    `cargo test -p aeronyx-server ...` is currently blocked by existing
    unrelated `lib test` compile errors in supernode/memchain/session test
    modules before the new tests can run.

- nodeboard:
  - `npm run type-check`
  - `npm run build`
  - `/dashboard/settings` is included in the build output and the sidebar links
    to it.

## M3 Refresh Config Verification

- API backend:
  - `python -m py_compile privacy_network/models.py privacy_network/api/agent.py`
  - `python manage.py check`
  - Smoke test: `refresh_config` queues with sanitized
    `{"scope": "management", "source": "nodeboard_vpn_operations"}` params even
    if the caller attempts to pass another path or scope.

- Rust VPN node:
  - `cargo check -p aeronyx-server`
  - `cargo build -p aeronyx-server --release`
  - `systemctl restart aeronyx-server`
  - `systemctl is-active aeronyx-server`

- nodeboard:
  - `npm run type-check`
  - `npm run build`

## M3 Restart Service Verification

- API backend:
  - `python -m py_compile privacy_network/models.py privacy_network/api/agent.py`
  - `python manage.py check`
  - Smoke test: `restart_service` refuses requests without
    `confirm="restart"` and queues sanitized fixed-service params when
    confirmed.

- Rust VPN node:
  - `cargo check -p aeronyx-server`
  - `cargo build -p aeronyx-server --release`
  - `systemctl restart aeronyx-server`
  - `systemctl is-active aeronyx-server`

- nodeboard:
  - `npm run type-check`
  - `npm run build`

## M2 Verification

- API backend:
  - `python -m py_compile privacy_network/models.py privacy_network/serializers.py privacy_network/services/session_service.py privacy_network/api/vpn_observability.py privacy_network/migrations/0005_clientsession_quality_metrics.py`
  - `python manage.py check`
  - `python manage.py migrate privacy_network`
  - Smoke test: duplicate `session_traffic_snapshot` reports keep bytes
    cumulative, while final `session_ended` updates total bytes and stored
    quality fields.
  - Smoke test: heartbeat runtime id change marks stale active sessions as
    `error` and exposes the interruption reason through VPN session API.
  - Smoke test: active sessions expose `quality_status`, `quality_score`,
    `degraded_reason`, `quality_reasons`, and `last_activity_at` from
    `/vpn/sessions/` without exposing destinations, DNS contents, packet
    payloads, or browsing history.

- Rust VPN node:
  - `cargo check -p aeronyx-server`
  - `cargo build -p aeronyx-server --release`
  - `systemctl restart aeronyx-server`
  - `systemctl is-active aeronyx-server`
  - Local `GET /api/vpn/health` returns `status="ok"` after restart.
  - Backend heartbeat cache receives the health payload after the next
    heartbeat.
  - With one active VPN session, backend `ClientSession.rtt_ms` stores a live
    sample (`80.844` ms observed on the deployed `Korean1` node).

- nodeboard:
  - VPN Operations table renders `last_error` below the session status, so reset
    recovery reasons are visible without SSH.
  - VPN Operations table renders tunnel quality badges, score, RTT/loss, and
    first degraded reason in the Quality column.

## M2 Backlog

The following fields still need protocol or control-plane work before they can
be considered commercial-grade:

- tunnel degraded reason
- automatic reconnect events

These should continue to be added as stored telemetry rather than inferred from
generic session `updated_at`.
