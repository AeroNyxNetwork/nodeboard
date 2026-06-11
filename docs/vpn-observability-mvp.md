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

- `app/dashboard/sessions/page.tsx`
  - Replaces the old aggregate-only Sessions page with the VPN Operations view.
  - Shows summary cards, node health table, operational alerts, and VPN session
    table.
  - Displays stored `last_rx_at`, `last_tx_at`, and packet-loss telemetry from
    the API. RTT remains `pending` until keepalive ACK telemetry is added.
  - Adds a `Kick` operation for active sessions. The button queues a
    `kick_session` command through the CMS instead of calling the node directly.
  - Adds a guarded `Ban Wallet` operation for active sessions. The backend
    derives the wallet from the selected session, and the Rust node adds it to
    the VPN deny list before disconnecting that wallet's active tunnels.

- `app/dashboard/nodes/[id]/page.tsx`
  - Adds a per-node VPN Health panel to the node detail page.
  - Shows the same live heartbeat source, health score, checks, CPU, memory,
    and tunnel counters without requiring the operator to leave the node page.
  - Adds safe `System Info` and `Collect Logs` command buttons plus recent VPN
    command history.
  - Adds `Refresh Config`, which queues a bounded `refresh_config` command for
    the node to validate and summarize its management configuration without SSH.
  - Adds a guarded `Restart VPN` operation that requires browser confirmation
    and queues a CMS `restart_service` command.

- `hooks/useNodes.ts`
  - Adds `useVpnOverview()` with 30 second polling.
  - Adds `useVpnSessions()` with 15 second polling.
  - Adds `useNodeCommands()` and `useRunNodeCommand()` for node-level
    operations history and enqueue mutations.
  - Invalidates VPN overview and session queries after node commands so kicked
    sessions disappear from the active view after the node reports completion.
  - Keeps authentication gating consistent with existing owner-only hooks.

- `lib/api.ts`
  - Adds `getVpnOverview()`.
  - Adds `getVpnSessions({ status, nodeId, limit })`.
  - Adds `getNodeCommands()` and `runNodeCommand()`.

- `lib/constants.ts`
  - Adds `VPN_OVERVIEW` and `VPN_SESSIONS` API endpoints.
  - Adds `NODE_COMMANDS` and `NODE_COMMAND_RUN` API endpoints.
  - Adds polling intervals for VPN overview and session data.

- `types/index.ts`
  - Adds `VpnOverview`, `VpnNodeHealth`, `VpnAlert`, `VpnSession`, and response
    types.
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
  - Emits node health checks for heartbeat freshness, node online state, and
    resource load.
  - Emits operational alerts from derived node health.
  - Returns stored session quality fields from M2: `last_rx_at`, `last_tx_at`,
    `rtt_ms`, and `packet_loss`. If `packet_loss` has not been stored, it can
    estimate a percentage from packet/replay rejection counters.

- `/root/aeronyx/privacy_network/models.py`
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

- `/root/aeronyx/privacy_network/urls.py`
  - Registers `GET /api/privacy_network/vpn/overview/`.
  - Registers `GET /api/privacy_network/vpn/sessions/`.
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

- `/root/aeronyx/privacy_network/api/heartbeat.py`
  - Adds `operator_bans` to heartbeat responses as the full active wallet ban
    list for the node. Rust uses this to recover policy after restart or a
    missed command.

### Rust VPN node

- `/root/a/AeroNyx/crates/aeronyx-server/src/management/client.rs`
  - Existing heartbeat sender already reports `system_stats.cpu_usage`,
    `system_stats.memory_mb`, `system_stats.active_sessions`, node version,
    binary hash, `connected_wallets`, and `traffic_delta`.

- `/root/a/AeroNyx/crates/aeronyx-server/src/management/reporter.rs`
  - Existing heartbeat reporter already collects connected wallets and drains
    traffic deltas every heartbeat period.
  - Adds quality fields to session event reports and sends
    `session_traffic_snapshot` as cumulative byte totals.
  - Synchronizes CMS `operator_bans` into the runtime `DenyList` before the
    legacy membership enforcement gate, so operator controls remain active
    while voucher auth is authoritative.

- `/root/a/AeroNyx/crates/aeronyx-server/src/management/client.rs`
  - Adds `runtime_id` and `runtime_started_at` to signed heartbeat
    `system_stats`. The id is regenerated each Rust process start and lets the
    CMS identify server resets.

- `/root/a/AeroNyx/crates/aeronyx-server/src/services/traffic_tracker.rs`
  - Existing traffic tracker aggregates per-wallet byte deltas for billing and
    quota accounting.

- `/root/a/AeroNyx/crates/aeronyx-server/src/services/session.rs`
  - Existing session manager tracks active VPN sessions, wallet/device indexes,
    and session cleanup.
  - Records real RX/TX timestamps and packet/replay counters in each session
    stats snapshot.

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
      "last_error": "node runtime reset; previous in-memory VPN sessions were marked stale by heartbeat recovery"
    }
  ],
  "count": 1
}
```

`last_rx_at`, `last_tx_at`, `packet_loss`, packet counters, replay rejection
counters, and bytes are stored from signed Rust session reports. `rtt_ms` is
reserved for M2 follow-up keepalive ACK telemetry and remains `null` until the
protocol sends round-trip samples.

When a Rust process restart changes `system.runtime_id`, the backend marks
previously active sessions as `error` with `last_error` explaining the reset.
This prevents nodeboard from showing sessions that no longer exist in node
memory as active.

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
  -> Rust heartbeat command dispatch
  -> DenyList.add(wallet, OperatorBan)
  -> SessionManager removes all active sessions for that wallet
  -> handshake rejects reconnects while the runtime deny entry exists
  -> signed session_ended + command status audit
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
  - `python -m py_compile privacy_network/models.py privacy_network/api/agent.py privacy_network/api/heartbeat.py`
  - `python manage.py migrate privacy_network`
  - `python manage.py check`
  - Smoke test: `ban_wallet` refuses missing/inactive/cross-node sessions and
    queues only sanitized wallet params derived from a target-node active
    session. It also creates an active `NodeWalletBan`; `unban_wallet` marks it
    inactive.

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

- Rust VPN node:
  - `cargo check -p aeronyx-server`
  - `cargo build -p aeronyx-server --release`
  - `systemctl restart aeronyx-server`
  - `systemctl is-active aeronyx-server`

- nodeboard:
  - VPN Operations table renders `last_error` below the session status, so reset
    recovery reasons are visible without SSH.

## M2 Backlog

The following fields still need protocol or control-plane work before they can
be considered commercial-grade:

- keepalive ACK
- RTT
- tunnel degraded reason
- automatic reconnect events
- MTU probe results

These should continue to be added as stored telemetry rather than inferred from
generic session `updated_at`.
