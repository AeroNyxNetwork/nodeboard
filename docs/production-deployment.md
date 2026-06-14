# AeroNyx Nodeboard Production Deployment

## Purpose

This document defines the production deployment path for nodeboard, the AeroNyx
node operator console. It exists so code changes pushed to `main` can be traced
from browser UI to Django API files and Rust heartbeat producer files without
guessing which process or reverse proxy is serving the interface.

## Product Requirement

Node operators need a stable commercial control surface for AeroNyx Privacy
Protocol nodes. The deployed nodeboard must let an operator confirm:

- Which nodes are reporting signed Rust heartbeats.
- Which nodes have `system_stats.operator_status` available.
- Which nodes have staged Rust binaries that still require a controlled
  maintenance drain and restart.
- Which backend API and Rust source files produce each status shown in the UI.

## Source Map

Frontend repository:

- GitHub: `AeroNyxNetwork/nodeboard`
- Production source path on US1 test host: `/root/open/nodeboard`
- Main UI files:
  - `app/dashboard/services/page.tsx`
  - `app/dashboard/nodes/[id]/page.tsx`
  - `lib/api.ts`
  - `lib/constants.ts`
  - `hooks/useNodes.ts`
  - `types/index.ts`

Backend API:

- Base URL used by nodeboard:
  `https://api.aeronyx.network/api/privacy_network`
- Django route registry:
  `/root/aeronyx/privacy_network/urls.py`
- Node owner APIs:
  `/root/aeronyx/privacy_network/api/nodes.py`
- VPN overview, node health, metrics, and runtime rollout snapshots:
  `/root/aeronyx/privacy_network/api/vpn_observability.py`
- Heartbeat ingestion and `Node.hardware_info["operator_status"]` storage:
  `/root/aeronyx/privacy_network/services/heartbeat_service.py`
- Node serializers:
  `/root/aeronyx/privacy_network/serializers.py`
- Node commands and restart/drain operations:
  `/root/aeronyx/privacy_network/api/vpn_commands.py`
  `/root/aeronyx/privacy_network/services/command_service.py`

Rust node producer:

- US1 test source path: `/root/open/AeroNyx`
- Operator status endpoint and runtime rollout signal:
  `/root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs`
- Heartbeat report assembly:
  `/root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs`
- Backend management client:
  `/root/open/AeroNyx/crates/aeronyx-server/src/management/client.rs`
- Node policy runtime:
  `/root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs`
- Encrypted packet counters:
  `/root/open/AeroNyx/crates/aeronyx-server/src/handlers/packet.rs`

## Deployment Model

Run nodeboard as a Next.js production server behind nginx:

- Next.js process: `127.0.0.1:3000`
- Public TLS: nginx
- API calls: browser to `https://api.aeronyx.network/api/privacy_network`
- Runtime user: `root` on current US1 test host, or a dedicated `nodeboard`
  user on production hosts.

US1 test host `34.136.167.59` now runs nodeboard through systemd on
`127.0.0.1:3000` for private validation. nginx is still not configured to expose
nodeboard publicly; use `deploy/nginx/nodeboard.conf` when a public nodeboard
domain and TLS certificate are ready.

## Build And Start

From `/root/open/nodeboard`:

```bash
git pull --ff-only origin main
npm ci
npm run build
systemctl restart nodeboard
systemctl status nodeboard --no-pager
```

Health checks:

```bash
systemctl is-active nodeboard
curl -s http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:3000/dashboard/services
curl -I http://127.0.0.1:3000/dashboard/nodes/test-node-id
curl -s https://api.aeronyx.network/api/privacy_network/vpn/overview/ \
  -H "Authorization: Bearer <operator-api-key>"
```

`/api/health` is served by `app/api/health/route.ts` and returns deployment
metadata only: nodeboard version, API base URL, backend source files, Rust
producer files, and the privacy boundary. It does not query node or user data.

The API call should expose `data.nodes[].system.operator_status` for upgraded
Rust nodes and `runtime_rollout` for nodes running the rollout-status build.

## Runtime Rollout Contract

Rust reports:

```json
{
  "system_stats": {
    "operator_status": {
      "runtime_rollout": {
        "executable_path": "/root/open/AeroNyx/target/release/aeronyx-server",
        "executable_replaced": false,
        "restart_required": false,
        "source": "/proc/self/exe"
      }
    }
  }
}
```

Django stores the snapshot under `Node.hardware_info["operator_status"]` and
nodeboard reads it through `GET /api/privacy_network/vpn/overview/`.

If `restart_required` is true, the UI must tell the operator to:

1. Enable maintenance mode.
2. Wait until active sessions reach zero.
3. Restart the Rust node.
4. Confirm `runtime_rollout.restart_required=false` on the next heartbeat.

## Production Safety Notes

- Do not hard restart a Rust VPN node with active sessions unless the operator
  explicitly accepts user interruption.
- Do not expose node public keys, client public IPs, DNS contents, packet
  payloads, domains, URLs, browsing history, voucher secrets, wallet-level
  traffic, or plaintext social graph data in nodeboard.
- Keep comments in frontend files aligned with the backend file paths above.
- Keep backend heartbeat storage comments aligned with the Rust producer files.
