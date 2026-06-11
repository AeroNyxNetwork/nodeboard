# VPN Observability MVP

This document records the first commercial VPN operations milestone: node
operators can inspect VPN node health and active tunnel impact from nodeboard
without SSH access.

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
  - Leaves RTT and packet-loss cells as `pending` until Rust M2 telemetry lands.

- `app/dashboard/nodes/[id]/page.tsx`
  - Adds a per-node VPN Health panel to the node detail page.
  - Shows the same live heartbeat source, health score, checks, CPU, memory,
    and tunnel counters without requiring the operator to leave the node page.

- `hooks/useNodes.ts`
  - Adds `useVpnOverview()` with 30 second polling.
  - Adds `useVpnSessions()` with 15 second polling.
  - Keeps authentication gating consistent with existing owner-only hooks.

- `lib/api.ts`
  - Adds `getVpnOverview()`.
  - Adds `getVpnSessions({ status, nodeId, limit })`.

- `lib/constants.ts`
  - Adds `VPN_OVERVIEW` and `VPN_SESSIONS` API endpoints.
  - Adds polling intervals for VPN overview and session data.

- `types/index.ts`
  - Adds `VpnOverview`, `VpnNodeHealth`, `VpnAlert`, `VpnSession`, and response
    types.

### API backend

- `/root/aeronyx/privacy_network/api/vpn_observability.py`
  - Adds owner-authenticated observability endpoints.
  - Builds the MVP from existing `Node`, `NodeHeartbeat`, and `ClientSession`
    models, so no database migration is required for M1.
  - Prefers the live Redis heartbeat cache written by
    `HeartbeatService._cache_heartbeat()` and uses sampled `NodeHeartbeat`
    rows only as a fallback. This keeps nodeboard aligned with the real
    heartbeat cadence instead of the lower-frequency DB sampling cadence.
  - Derives `health_status` as `healthy`, `degraded`, `offline`, or
    `overloaded`.
  - Emits node health checks for heartbeat freshness, node online state, and
    resource load.
  - Emits operational alerts from derived node health.

- `/root/aeronyx/privacy_network/urls.py`
  - Registers `GET /api/privacy_network/vpn/overview/`.
  - Registers `GET /api/privacy_network/vpn/sessions/`.

### Rust VPN node

- `/root/a/AeroNyx/crates/aeronyx-server/src/management/client.rs`
  - Existing heartbeat sender already reports `system_stats.cpu_usage`,
    `system_stats.memory_mb`, `system_stats.active_sessions`, node version,
    binary hash, `connected_wallets`, and `traffic_delta`.

- `/root/a/AeroNyx/crates/aeronyx-server/src/management/reporter.rs`
  - Existing heartbeat reporter already collects connected wallets and drains
    traffic deltas every heartbeat period.

- `/root/a/AeroNyx/crates/aeronyx-server/src/services/traffic_tracker.rs`
  - Existing traffic tracker aggregates per-wallet byte deltas for billing and
    quota accounting.

- `/root/a/AeroNyx/crates/aeronyx-server/src/services/session.rs`
  - Existing session manager tracks active VPN sessions, wallet/device indexes,
    and session cleanup.

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
      "packet_loss": null,
      "last_error": ""
    }
  ],
  "count": 1
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
  -> signed session report /api/privacy_network/node/sessions/report/
  -> existing ClientSession rows
  -> VPN session API
  -> nodeboard VPN Sessions table
```

## M1 Verification

- API backend:
  - `python manage.py check`
  - `GET /api/privacy_network/vpn/overview/` returns `200`
  - `GET /api/privacy_network/vpn/sessions/?limit=1` returns `200`

- nodeboard:
  - `npm run type-check`
  - `npm run build`

## M2 Backlog

The following fields are intentionally present in the frontend contract but are
`pending` or `null` until the Rust and API schema are extended:

- keepalive ACK
- RTT
- last real RX timestamp
- last real TX timestamp
- packet-loss estimate
- tunnel degraded reason
- automatic reconnect events
- server reset recovery events
- MTU probe results

These should be added as stored telemetry rather than inferred from generic
session `updated_at`.
