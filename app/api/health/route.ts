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
 *     Provides data.summary.restart_readiness for owner-scoped fleet restart
 *     readiness monitoring, including blocked node drain/command status and
 *     backend-authored recommended_action.
 *   - GET /api/privacy_network/vpn/sessions/?node_id=&status=&quality_status=
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Supports /dashboard/sessions?node={id}&status=active&quality=all deep links.
 *   - PATCH /api/privacy_network/nodes/{id}/
 *     /root/aeronyx/privacy_network/api/nodes.py
 *     Used by /dashboard/services to enable maintenance_mode from the restart
 *     readiness gate before a controlled Rust restart.
 *   - data.nodes[].system.restart_readiness.active_restart_command
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Mirrors NodeCommand restart_service pending/sent/executing state.
 *   - data.nodes[].system.restart_readiness.drain_eta
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *     Aggregates active ClientSession timing for restart drain visibility.
 *     Includes status, next_step, timing fields, activity bucket counts, and
 *     keepalive aggregate totals used by node detail and services restart UX.
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
 * Last Modified: v1.1.14 - Documented drain activity bucket contract
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
      endpoint: 'data.nodes[].system.restart_readiness.active_restart_command',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Active restart_service command state from NodeCommand to prevent duplicate fleet restarts',
    },
    {
      endpoint: 'data.nodes[].system.restart_readiness.drain_eta',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Node-level active ClientSession timing aggregate, activity bucket counts, keepalive totals, and cleanup rollout pending signal used by node detail and services maintenance drain ETA',
    },
    {
      endpoint: 'data.summary.restart_readiness',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Owner-scoped fleet restart readiness counts, blocked-node drain status, command status, and recommended action',
    },
    {
      endpoint: 'GET /api/privacy_network/vpn/sessions/?node_id=&status=&quality_status=',
      file: '/root/aeronyx/privacy_network/api/vpn_observability.py',
      purpose: 'Global VPN session list used by /dashboard/sessions deep links from blocked restart nodes',
    },
    {
      endpoint: 'PATCH /api/privacy_network/nodes/{id}/',
      file: '/root/aeronyx/privacy_network/api/nodes.py',
      purpose: 'Operator-approved maintenance_mode update from /dashboard/services restart gate',
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
      endpoint: 'POST /api/privacy_network/nodes/{id}/commands/run/',
      file: '/root/aeronyx/privacy_network/api/vpn_commands.py',
      purpose: 'Operator command queue for restart, diagnostics, and policy actions',
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
