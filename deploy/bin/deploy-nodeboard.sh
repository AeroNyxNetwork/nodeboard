#!/usr/bin/env bash
#
# AeroNyx Nodeboard production deploy helper
#
# File Path:
#   deploy/bin/deploy-nodeboard.sh
#
# Product Requirement:
#   Node operators need a repeatable, auditable deploy path for the nodeboard
#   console. This script updates the checked-out main branch, builds Next.js,
#   installs the systemd unit, writes runtime version metadata, restarts the
#   service, and verifies the health endpoint.
#
# Frontend paths verified by this script:
#   /root/open/nodeboard/app/api/health/route.ts
#   /root/open/nodeboard/app/dashboard/services/page.tsx
#   /root/open/nodeboard/app/dashboard/nodes/[id]/page.tsx
#
# Backend API contract exposed by /api/health:
#   https://api.aeronyx.network/api/privacy_network
#   /root/aeronyx/privacy_network/api/vpn_observability.py
#   /root/aeronyx/privacy_network/services/heartbeat_service.py
#
# Rust producer paths exposed by /api/health:
#   /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
#   /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
#
# Privacy Boundary:
#   The script writes deployment metadata only: git SHA, deploy time, source
#   path, and service port. It does not read node public keys, client public IPs,
#   DNS contents, packet payloads, domains, URLs, browsing history, voucher
#   secrets, wallet-level traffic, or plaintext social graph data.

set -euo pipefail

SOURCE_DIR="${NODEBOARD_SOURCE_DIR:-/root/open/nodeboard}"
SERVICE_NAME="${NODEBOARD_SERVICE_NAME:-nodeboard}"
ENV_DIR="${NODEBOARD_ENV_DIR:-/etc/nodeboard}"
ENV_FILE="${NODEBOARD_ENV_FILE:-${ENV_DIR}/nodeboard.env}"
PORT="${NODEBOARD_PORT:-3000}"
HOST="${NODEBOARD_HOST:-127.0.0.1}"
HEALTH_URL="http://${HOST}:${PORT}/api/health"
SERVICES_URL="http://${HOST}:${PORT}/dashboard/services"
NODE_DETAIL_URL="http://${HOST}:${PORT}/dashboard/nodes/test-node-id"

log() {
  printf '[nodeboard-deploy] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[nodeboard-deploy] missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_cmd git
require_cmd npm
require_cmd curl
require_cmd systemctl

cd "$SOURCE_DIR"

if [ "${NODEBOARD_ALLOW_DIRTY:-0}" != "1" ] && [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short
  printf '[nodeboard-deploy] refusing to deploy with tracked local changes; set NODEBOARD_ALLOW_DIRTY=1 to override\n' >&2
  exit 1
fi

log "syncing main in ${SOURCE_DIR}"
git fetch origin main
git checkout main
git pull --ff-only origin main

GIT_SHA="$(git rev-parse --short HEAD)"
DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

log "installing dependencies"
npm ci

if [ "${NODEBOARD_SKIP_AUDIT:-0}" != "1" ]; then
  log "checking npm audit threshold high"
  npm audit --audit-level=high
fi

log "building Next.js app"
npm run build

log "writing runtime metadata to ${ENV_FILE}"
mkdir -p "$ENV_DIR"
cat > "$ENV_FILE" <<EOF
# Written by ${SOURCE_DIR}/deploy/bin/deploy-nodeboard.sh
# Frontend API base is compiled from ${SOURCE_DIR}/lib/constants.ts.
NODE_ENV=production
PORT=${PORT}
NODEBOARD_GIT_SHA=${GIT_SHA}
NODEBOARD_DEPLOYED_AT=${DEPLOYED_AT}
NODEBOARD_SOURCE_DIR=${SOURCE_DIR}
EOF
chmod 0644 "$ENV_FILE"

log "installing systemd unit"
cp "${SOURCE_DIR}/deploy/systemd/nodeboard.service" "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

log "waiting for service"
sleep 3
systemctl is-active --quiet "$SERVICE_NAME"

log "checking ${HEALTH_URL}"
curl --fail --silent --show-error "$HEALTH_URL" | grep -q "\"git_sha\":\"${GIT_SHA}\""

log "checking dashboard routes"
curl --fail --silent --show-error --output /dev/null "$SERVICES_URL"
curl --fail --silent --show-error --output /dev/null "$NODE_DETAIL_URL"

log "deployed ${SERVICE_NAME} at ${GIT_SHA}"
