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
 *   - Dashboard service page: app/dashboard/services/page.tsx
 *   - Node detail page: app/dashboard/nodes/[id]/page.tsx
 *
 * Backend API and File Paths:
 *   - GET /api/privacy_network/vpn/overview/
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *   - Heartbeat storage:
 *     /root/aeronyx/privacy_network/services/heartbeat_service.py
 *   - Node command controls:
 *     /root/aeronyx/privacy_network/api/vpn_commands.py
 *     /root/aeronyx/privacy_network/services/command_service.py
 *
 * Rust Producer Paths:
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *
 * Privacy Boundary:
 *   This endpoint returns deployment metadata only. It does not query node data
 *   and never exposes node public keys, client public IPs, DNS contents, packet
 *   payloads, domains, URLs, browsing history, voucher secrets, wallet-level
 *   traffic, or plaintext social graph data.
 *
 * Last Modified: v1.1.1 - Production health route
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
      purpose: 'Local node health, operator_status, runtime_rollout',
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
      generated_at: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

