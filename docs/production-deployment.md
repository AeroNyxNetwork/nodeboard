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
  - `app/api/health/route.ts`
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

Preferred deployment path from `/root/open/nodeboard`:

```bash
./deploy/bin/deploy-nodeboard.sh
```

The script pulls `origin/main`, runs `npm ci`, builds Next.js, writes
`/etc/nodeboard/nodeboard.env`, installs the systemd unit, restarts nodeboard,
and checks `/api/health` plus the main dashboard routes.

The deploy script also runs `npm audit --audit-level=high` before building.
High or critical dependency advisories block deployment. Lower-severity
advisories should be triaged in a planned dependency update instead of using
`npm audit fix --force` on a production branch.

Manual fallback:

```bash
git pull --ff-only origin main
npm ci
npm audit --audit-level=high
npm run build
mkdir -p /etc/nodeboard
cat >/etc/nodeboard/nodeboard.env <<EOF
NODE_ENV=production
PORT=3000
NODEBOARD_GIT_SHA=$(git rev-parse --short HEAD)
NODEBOARD_DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
NODEBOARD_SOURCE_DIR=/root/open/nodeboard
EOF
cp deploy/systemd/nodeboard.service /etc/systemd/system/nodeboard.service
systemctl daemon-reload
systemctl enable nodeboard
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
producer files, `runtime.git_sha`, `runtime.deployed_at`, and the privacy
boundary. It does not query node or user data.

The API call should expose `data.nodes[].system.operator_status` for upgraded
Rust nodes and `runtime_rollout` for nodes running the rollout-status build.

## Dependency Security

Current production baseline:

- `next`: `15.5.19`
- `eslint-config-next`: `15.5.19`
- `postcss`: `8.5.15`
- `overrides.postcss`: `8.5.15`

Reasoning:

- Nodeboard uses the App Router and must stay on a modern Next.js line.
- The earlier `next@14.2.35` lockfile produced high-severity advisories.
- `next@15.5.19` removes the high-severity Next.js advisories while remaining
  compatible with React 18 on the US1 Node.js 22 runtime.
- The PostCSS override keeps nested Next.js PostCSS resolution on the patched
  `8.5.15` line. Keep this override unless a future Next.js release removes the
  nested vulnerable PostCSS dependency.

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
