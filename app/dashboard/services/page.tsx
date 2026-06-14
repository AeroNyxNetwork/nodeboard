/**
 * ============================================
 * AeroNyx Node Services Page
 * ============================================
 * File Path: app/dashboard/services/page.tsx
 *
 * Creation Reason: Nodeboard is evolving from a VPN-only dashboard into the
 * AeroNyx node operator console. This page gives operators one place to inspect
 * Privacy Protocol, MemChain, ChatRelay, Sovereign Data Layer, and SuperNode
 * readiness.
 *
 * Backend APIs used on this page:
 *   - GET /api/privacy_network/vpn/overview/
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *
 * Rust heartbeat source:
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *
 * The Rust node reports service readiness under system_stats.operator_status.
 * Until the Django backend exposes that field in VPN node health snapshots,
 * non-VPN services intentionally render as pending instead of inferred facts.
 *
 * Last Modified: v1.0.0 - Initial node services overview
 * ============================================
 */

'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useVpnOverview } from '@/hooks/useNodes';
import { formatRelativeTime } from '@/lib/api';
import { NodeOperatorStatus, OperatorRisk, OperatorServiceStatus, VpnNodeHealth } from '@/types';

type ServiceKey =
  | 'privacy_protocol'
  | 'memchain'
  | 'chat_relay'
  | 'sovereign_data_layer'
  | 'supernode';

interface ServiceView {
  key: ServiceKey;
  label: string;
  eyebrow: string;
  status: string;
  summary: string;
  enabledCount: number;
  totalCount: number;
  detail: string;
}

const serviceMeta: Record<ServiceKey, { label: string; eyebrow: string }> = {
  privacy_protocol: {
    label: 'AeroNyx Privacy Protocol',
    eyebrow: 'VPN transport',
  },
  memchain: {
    label: 'MemChain / MPI',
    eyebrow: 'AI memory',
  },
  chat_relay: {
    label: 'Zero-Knowledge Chat Relay',
    eyebrow: 'Encrypted messaging',
  },
  sovereign_data_layer: {
    label: 'Sovereign Data Layer',
    eyebrow: 'Encrypted RPC',
  },
  supernode: {
    label: 'SuperNode Cognitive Worker',
    eyebrow: 'AI worker',
  },
};

const statusStyles: Record<string, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  attention: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  degraded: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  planned: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  pending: 'border-white/10 bg-white/5 text-gray-300',
  disabled: 'border-white/10 bg-white/5 text-gray-400',
  failed: 'border-red-500/30 bg-red-500/10 text-red-300',
  critical: 'border-red-500/30 bg-red-500/10 text-red-300',
};

function statusClass(status: string) {
  return statusStyles[status] ?? statusStyles.pending;
}

function normalizeStatus(status: string | null | undefined) {
  if (!status) return 'pending';
  if (status === 'healthy') return 'ok';
  if (status === 'offline' || status === 'overloaded') return 'failed';
  return status;
}

function collectOperatorStatuses(nodes: VpnNodeHealth[]): NodeOperatorStatus[] {
  return nodes
    .map((node) => node.system?.operator_status)
    .filter((status): status is NodeOperatorStatus => Boolean(status));
}

function collectService(statuses: NodeOperatorStatus[], key: ServiceKey): OperatorServiceStatus[] {
  return statuses
    .map((status) => status.services.find((service) => service.key === key))
    .filter((service): service is OperatorServiceStatus => Boolean(service));
}

function serviceStatus(services: OperatorServiceStatus[]) {
  if (services.length === 0) return 'pending';
  if (services.some((service) => ['failed', 'critical'].includes(service.status))) return 'failed';
  if (services.some((service) => ['degraded', 'attention'].includes(service.status))) return 'attention';
  if (services.some((service) => service.status === 'planned')) return 'planned';
  if (services.every((service) => service.status === 'disabled')) return 'disabled';
  if (services.some((service) => ['ok', 'ready'].includes(service.status))) return 'ok';
  return services[0]?.status ?? 'pending';
}

function buildServiceViews(nodes: VpnNodeHealth[], statuses: NodeOperatorStatus[]): ServiceView[] {
  const privacyNodes = nodes.filter((node) => node.is_vpn_node);
  const healthyPrivacyNodes = privacyNodes.filter((node) => node.health_status === 'healthy');

  const privacyView: ServiceView = {
    key: 'privacy_protocol',
    label: serviceMeta.privacy_protocol.label,
    eyebrow: serviceMeta.privacy_protocol.eyebrow,
    status: privacyNodes.length === 0
      ? 'pending'
      : healthyPrivacyNodes.length === privacyNodes.length
        ? 'ok'
        : healthyPrivacyNodes.length > 0
          ? 'attention'
          : 'failed',
    summary: `${healthyPrivacyNodes.length}/${privacyNodes.length} VPN nodes healthy`,
    enabledCount: privacyNodes.length,
    totalCount: nodes.length,
    detail: 'Transport, tunnel health, policy sync, encrypted packet counters, and placement readiness.',
  };

  const rest = (['memchain', 'chat_relay', 'sovereign_data_layer', 'supernode'] as ServiceKey[]).map((key) => {
    const services = collectService(statuses, key);
    const enabledCount = services.filter((service) => service.enabled).length;
    const latest = services[0];
    const meta = serviceMeta[key];

    return {
      key,
      label: meta.label,
      eyebrow: meta.eyebrow,
      status: serviceStatus(services),
      summary: latest?.summary ?? 'Awaiting operator_status from Rust heartbeat',
      enabledCount,
      totalCount: statuses.length || nodes.length,
      detail: key === 'sovereign_data_layer'
        ? 'Encrypted user-owned records, node RPC, full-network sync readiness, and Ethereum settlement boundary.'
        : 'Reported by Rust node heartbeat when the backend exposes system_stats.operator_status.',
    };
  });

  return [privacyView, ...rest];
}

function collectRisks(statuses: NodeOperatorStatus[]): OperatorRisk[] {
  return statuses.flatMap((status) => status.risks).slice(0, 8);
}

function StatusPill({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(normalized)}`}>
      {normalized.replaceAll('_', ' ')}
    </span>
  );
}

function PageHeader() {
  return (
    <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-300">
          Node Operator Console
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">Node Services</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
          Monitor the service layers each AeroNyx node can provide: privacy protocol transport,
          MemChain memory, encrypted chat relay, sovereign encrypted data RPC, and SuperNode workers.
        </p>
      </div>
      <Link
        href="/dashboard/nodes"
        className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/5"
      >
        Manage nodes
      </Link>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceView }) {
  return (
    <section className="min-h-[210px] rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
            {service.eyebrow}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">{service.label}</h2>
        </div>
        <StatusPill status={service.status} />
      </div>
      <p className="mt-4 text-sm leading-6 text-gray-300">{service.summary}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500">Enabled nodes</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {service.enabledCount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Observed nodes</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {service.totalCount.toLocaleString()}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-500">{service.detail}</p>
    </section>
  );
}

function NodeReadinessRow({ node }: { node: VpnNodeHealth }) {
  const services = node.system?.operator_status?.services ?? [];
  const serviceByKey = (key: ServiceKey) => services.find((service) => service.key === key);

  return (
    <tr className="border-t border-white/5">
      <td className="px-4 py-4">
        <div className="min-w-0">
          <Link href={`/dashboard/nodes`} className="font-medium text-white hover:text-purple-300">
            {node.name}
          </Link>
          <p className="mt-1 truncate text-xs text-gray-500">
            {node.city || node.region_code || 'unknown region'} · {node.public_ip ?? 'no public IP'}
          </p>
        </div>
      </td>
      <td className="px-4 py-4"><StatusPill status={node.health_status} /></td>
      <td className="px-4 py-4"><StatusPill status={serviceByKey('memchain')?.status ?? 'pending'} /></td>
      <td className="px-4 py-4"><StatusPill status={serviceByKey('chat_relay')?.status ?? 'pending'} /></td>
      <td className="px-4 py-4"><StatusPill status={serviceByKey('sovereign_data_layer')?.status ?? 'pending'} /></td>
      <td className="px-4 py-4 text-sm text-gray-400">
        {node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : 'pending'}
      </td>
    </tr>
  );
}

export default function NodeServicesPage() {
  const { overview, isLoading, isError, refetch } = useVpnOverview();

  const nodes = overview?.nodes ?? [];
  const operatorStatuses = useMemo(() => collectOperatorStatuses(nodes), [nodes]);
  const services = useMemo(() => buildServiceViews(nodes, operatorStatuses), [nodes, operatorStatuses]);
  const risks = useMemo(() => collectRisks(operatorStatuses), [operatorStatuses]);

  if (isLoading) {
    return (
      <div>
        <PageHeader />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-[210px] rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageHeader />
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <h2 className="text-lg font-semibold text-red-200">Service data unavailable</h2>
          <p className="mt-2 text-sm text-red-100/70">
            The operator console could not load VPN overview data from the backend.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-lg border border-red-300/20 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-400/10"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <ServiceCard key={service.key} service={service} />
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Operator Signal</h2>
            <p className="mt-1 text-sm text-gray-400">
              {operatorStatuses.length > 0
                ? `${operatorStatuses.length} node(s) reporting operator_status through Rust heartbeat`
                : 'Waiting for backend exposure of system_stats.operator_status from Rust heartbeats'}
            </p>
          </div>
          <StatusPill status={operatorStatuses.length > 0 ? 'ok' : 'pending'} />
        </div>
      </div>

      {risks.length > 0 && (
        <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
          <h2 className="text-lg font-semibold text-yellow-100">Service Risks</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {risks.map((risk, index) => (
              <div key={`${risk.code}-${index}`} className="rounded-xl border border-yellow-300/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-yellow-100">{risk.message}</p>
                  <StatusPill status={risk.severity} />
                </div>
                <p className="mt-2 text-xs leading-5 text-yellow-100/70">{risk.remediation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Node Readiness</h2>
          <p className="mt-1 text-sm text-gray-400">
            Per-node service readiness. Pending values mean the backend has not exposed the Rust operator heartbeat yet.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.12em] text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Node</th>
                <th className="px-4 py-3 font-medium">Privacy</th>
                <th className="px-4 py-3 font-medium">MemChain</th>
                <th className="px-4 py-3 font-medium">ChatRelay</th>
                <th className="px-4 py-3 font-medium">Data Layer</th>
                <th className="px-4 py-3 font-medium">Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {nodes.length > 0 ? (
                nodes.map((node) => <NodeReadinessRow key={node.id} node={node} />)
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    No nodes are reporting yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
