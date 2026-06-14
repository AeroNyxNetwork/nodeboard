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
 * Data Contract:
 *   Rust reports service readiness under:
 *     heartbeat.system_stats.operator_status
 *   Django stores it in:
 *     Node.hardware_info["operator_status"]
 *   Django exposes it to nodeboard as:
 *     GET /api/privacy_network/vpn/overview/
 *       data.nodes[].system.operator_status
 *
 * Product Requirement:
 *   Treat this as a commercial node readiness console, not a VPN-only page.
 *   Operators need a clear answer to: which nodes can serve AeroNyx Privacy
 *   Protocol traffic today, which service layers are enabled, what risks need
 *   remediation, and whether the backend/Rust heartbeat path is fresh.
 *
 * Last Modified: v1.1.0 - Production operator readiness view
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
  reportingCount: number;
  metricChips: string[];
}

interface FleetSummary {
  totalNodes: number;
  reportingNodes: number;
  healthyPrivacyNodes: number;
  attentionNodes: number;
  enabledServices: number;
  totalServiceSlots: number;
}

interface RiskView extends OperatorRisk {
  nodeName: string;
}

interface PendingOperatorNode {
  id: string;
  name: string;
  publicIp: string | null;
  activeSessions: number;
  healthStatus: string;
  lastHeartbeat: string | null;
  version: string;
}

const serviceMeta: Record<ServiceKey, { label: string; eyebrow: string }> = {
  privacy_protocol: {
    label: 'AeroNyx Privacy Protocol',
    eyebrow: 'Privacy transport',
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
  healthy: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  attention: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  degraded: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  planned: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  pending: 'border-white/10 bg-white/5 text-gray-300',
  disabled: 'border-white/10 bg-white/5 text-gray-400',
  failed: 'border-red-500/30 bg-red-500/10 text-red-300',
  critical: 'border-red-500/30 bg-red-500/10 text-red-300',
  offline: 'border-red-500/30 bg-red-500/10 text-red-300',
  overloaded: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
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

function nodeOperatorStatus(node: VpnNodeHealth): NodeOperatorStatus | null {
  return node.system?.operator_status ?? null;
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

function metricValue(metrics: Record<string, unknown>, key: string): string | null {
  const value = metrics[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }
  if (typeof value === 'string' && value.trim()) {
    return value.length > 28 ? `${value.slice(0, 25)}...` : value;
  }
  return null;
}

function serviceMetricChips(service: OperatorServiceStatus | undefined): string[] {
  if (!service?.metrics) return [];
  const preferredKeys = [
    'active_sessions',
    'active_wallet_devices',
    'configured_mtu',
    'mode',
    'api_listen_addr',
    'enabled',
    'remote_enabled',
    'supernode_enabled',
    'failed_checks',
  ];

  return preferredKeys
    .map((key) => {
      const value = metricValue(service.metrics, key);
      return value ? `${key.replaceAll('_', ' ')}: ${value}` : null;
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
}

function buildFleetSummary(nodes: VpnNodeHealth[], statuses: NodeOperatorStatus[]): FleetSummary {
  const serviceSlots = statuses.flatMap((status) => status.services);
  return {
    totalNodes: nodes.length,
    reportingNodes: statuses.length,
    healthyPrivacyNodes: nodes.filter((node) => node.is_vpn_node && node.health_status === 'healthy').length,
    attentionNodes: nodes.filter((node) => {
      const status = nodeOperatorStatus(node)?.status ?? node.health_status;
      return ['attention', 'degraded', 'failed', 'critical', 'offline', 'overloaded'].includes(status);
    }).length,
    enabledServices: serviceSlots.filter((service) => service.enabled).length,
    totalServiceSlots: serviceSlots.length,
  };
}

function buildServiceViews(nodes: VpnNodeHealth[], statuses: NodeOperatorStatus[]): ServiceView[] {
  const privacyNodes = nodes.filter((node) => node.is_vpn_node);
  const healthyPrivacyNodes = privacyNodes.filter((node) => node.health_status === 'healthy');
  const privacyServices = collectService(statuses, 'privacy_protocol');
  const latestPrivacy = privacyServices[0];

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
    summary: latestPrivacy?.summary ?? `${healthyPrivacyNodes.length}/${privacyNodes.length} privacy protocol nodes healthy`,
    enabledCount: privacyNodes.length,
    totalCount: nodes.length,
    reportingCount: privacyServices.length,
    metricChips: serviceMetricChips(latestPrivacy),
    detail: 'Transport health, policy sync, encrypted packet counters, and commercial placement readiness.',
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
      reportingCount: services.length,
      metricChips: serviceMetricChips(latest),
      detail: key === 'sovereign_data_layer'
        ? 'Encrypted user-owned records, node RPC, full-network sync readiness, and Ethereum settlement boundary.'
        : 'Reported by signed Rust node heartbeat through the backend overview API.',
    };
  });

  return [privacyView, ...rest];
}

function collectRisks(nodes: VpnNodeHealth[]): RiskView[] {
  return nodes
    .flatMap((node) => {
      const status = nodeOperatorStatus(node);
      return (status?.risks ?? []).map((risk) => ({
        ...risk,
        nodeName: node.name,
      }));
    })
    .slice(0, 10);
}

function collectPendingOperatorNodes(nodes: VpnNodeHealth[]): PendingOperatorNode[] {
  return nodes
    .filter((node) => node.is_vpn_node && !nodeOperatorStatus(node))
    .map((node) => ({
      id: node.id,
      name: node.name,
      publicIp: node.public_ip,
      activeSessions: node.active_sessions,
      healthStatus: node.health_status,
      lastHeartbeat: node.last_heartbeat,
      version: node.version,
    }));
}

function latestReportTime(statuses: NodeOperatorStatus[]) {
  const values = statuses
    .map((status) => status.last_reported_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  return values.length > 0 ? values[values.length - 1] : null;
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
        <h1 className="mt-2 text-2xl font-bold text-white">AeroNyx Service Readiness</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
          Privacy Protocol transport, MemChain memory, encrypted relay, sovereign data RPC,
          and SuperNode worker status from signed Rust heartbeats.
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

function SummaryTile({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail: string;
  status: string;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
        <StatusPill status={status} />
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500">{detail}</p>
    </section>
  );
}

function FleetSummaryGrid({
  summary,
  latestReportedAt,
}: {
  summary: FleetSummary;
  latestReportedAt: string | null;
}) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryTile
        label="Reporting Nodes"
        value={`${summary.reportingNodes}/${summary.totalNodes}`}
        detail={latestReportedAt ? `Latest operator heartbeat ${formatRelativeTime(latestReportedAt)}` : 'Waiting for Rust operator heartbeat'}
        status={summary.reportingNodes > 0 ? 'ok' : 'pending'}
      />
      <SummaryTile
        label="Privacy Ready"
        value={summary.healthyPrivacyNodes.toLocaleString()}
        detail="AeroNyx Privacy Protocol nodes with healthy tunnel checks."
        status={summary.healthyPrivacyNodes > 0 ? 'ok' : 'attention'}
      />
      <SummaryTile
        label="Enabled Services"
        value={`${summary.enabledServices}/${summary.totalServiceSlots || 0}`}
        detail="Service slots enabled across reporting nodes."
        status={summary.enabledServices > 0 ? 'ok' : 'pending'}
      />
      <SummaryTile
        label="Needs Attention"
        value={summary.attentionNodes.toLocaleString()}
        detail="Nodes reporting degraded, failed, or attention status."
        status={summary.attentionNodes > 0 ? 'attention' : 'ok'}
      />
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
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-400">
          reporting {service.reportingCount.toLocaleString()}
        </span>
        {service.metricChips.map((chip) => (
          <span
            key={chip}
            className="max-w-full truncate rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-400"
          >
            {chip}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-500">{service.detail}</p>
    </section>
  );
}

function NodeReadinessRow({ node }: { node: VpnNodeHealth }) {
  const operatorStatus = nodeOperatorStatus(node);
  const services = operatorStatus?.services ?? [];
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
      <td className="px-4 py-4"><StatusPill status={operatorStatus?.status ?? 'pending'} /></td>
      <td className="px-4 py-4 text-sm text-gray-400">
        {node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : 'pending'}
      </td>
    </tr>
  );
}

function PendingOperatorRolloutPanel({ nodes }: { nodes: PendingOperatorNode[] }) {
  if (nodes.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-sky-100">Operator Status Rollout Pending</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-100/70">
            These privacy protocol nodes are healthy enough to heartbeat, but they are not reporting
            <span className="font-mono"> system_stats.operator_status</span>. In production this usually means the Rust
            binary has not been upgraded or the process has not restarted after the operator-status build.
          </p>
        </div>
        <StatusPill status="info" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {nodes.map((node) => (
          <div key={node.id} className="rounded-xl border border-sky-300/10 bg-black/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-white">{node.name}</p>
                <p className="mt-1 truncate text-xs text-sky-100/50">
                  {node.publicIp ?? 'no public IP'} · v{node.version}
                </p>
              </div>
              <StatusPill status={node.healthStatus} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-sky-100/60">
              <div>
                <p className="text-sky-100/35">Active Sessions</p>
                <p className="mt-1 text-sky-100">{node.activeSessions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sky-100/35">Heartbeat</p>
                <p className="mt-1 text-sky-100">
                  {node.lastHeartbeat ? formatRelativeTime(node.lastHeartbeat) : 'pending'}
                </p>
              </div>
              <div>
                <p className="text-sky-100/35">Next Step</p>
                <p className="mt-1 text-sky-100">
                  {node.activeSessions > 0 ? 'drain first' : 'restart node'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-sky-100/45">
        Backend contract: GET /api/privacy_network/vpn/overview/ from
        /root/aeronyx/privacy_network/api/vpn_observability.py. Rust producer:
        /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs and
        /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs.
      </p>
    </section>
  );
}

function NodeDetailCard({ node }: { node: VpnNodeHealth }) {
  const operatorStatus = nodeOperatorStatus(node);
  const services = operatorStatus?.services ?? [];
  const privacyBoundary = operatorStatus?.privacy_boundary;

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/dashboard/nodes" className="font-semibold text-white hover:text-purple-300">
            {node.name}
          </Link>
          <p className="mt-1 truncate text-xs text-gray-500">
            {node.city || node.region_code || 'unknown region'} · {node.public_ip ?? 'no public IP'}
          </p>
        </div>
        <StatusPill status={operatorStatus?.status ?? node.health_status} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(['privacy_protocol', 'memchain', 'chat_relay', 'sovereign_data_layer'] as ServiceKey[]).map((key) => {
          const service = services.find((item) => item.key === key);
          return (
            <div key={key} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-gray-300">
                  {service?.label ?? serviceMeta[key].label}
                </p>
                <StatusPill status={service?.status ?? 'pending'} />
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
                {service?.summary ?? 'Awaiting signed Rust service snapshot'}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
        <span className="rounded-md border border-white/10 px-2 py-1">
          heartbeat {node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : 'pending'}
        </span>
        <span className="rounded-md border border-white/10 px-2 py-1">
          source {operatorStatus?.source ?? node.system?.source ?? 'pending'}
        </span>
        {operatorStatus?.last_reported_at && (
          <span className="rounded-md border border-white/10 px-2 py-1">
            operator {formatRelativeTime(operatorStatus.last_reported_at)}
          </span>
        )}
      </div>

      {privacyBoundary && (
        <p className="mt-3 text-xs leading-5 text-gray-600">{privacyBoundary}</p>
      )}
    </section>
  );
}

export default function NodeServicesPage() {
  const { overview, isLoading, isError, refetch } = useVpnOverview();

  const nodes = overview?.nodes ?? [];
  const operatorStatuses = useMemo(() => collectOperatorStatuses(nodes), [nodes]);
  const fleetSummary = useMemo(() => buildFleetSummary(nodes, operatorStatuses), [nodes, operatorStatuses]);
  const services = useMemo(() => buildServiceViews(nodes, operatorStatuses), [nodes, operatorStatuses]);
  const risks = useMemo(() => collectRisks(nodes), [nodes]);
  const pendingOperatorNodes = useMemo(() => collectPendingOperatorNodes(nodes), [nodes]);
  const latestReportedAt = useMemo(() => latestReportTime(operatorStatuses), [operatorStatuses]);

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
            The operator console could not load service overview data from the backend.
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

      <FleetSummaryGrid summary={fleetSummary} latestReportedAt={latestReportedAt} />

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
                ? `${operatorStatuses.length} node(s) reporting operator_status through signed Rust heartbeat`
                : 'Waiting for system_stats.operator_status from Rust heartbeats'}
            </p>
          </div>
          <StatusPill status={operatorStatuses.length > 0 ? 'ok' : 'pending'} />
        </div>
      </div>

      <PendingOperatorRolloutPanel nodes={pendingOperatorNodes} />

      {risks.length > 0 && (
        <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
          <h2 className="text-lg font-semibold text-yellow-100">Service Risks</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {risks.map((risk, index) => (
              <div key={`${risk.code}-${index}`} className="rounded-xl border border-yellow-300/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-yellow-100">
                    {risk.nodeName}: {risk.message}
                  </p>
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
            Per-node service readiness from Django overview snapshots and Rust operator heartbeats.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.12em] text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Node</th>
                <th className="px-4 py-3 font-medium">Privacy</th>
                <th className="px-4 py-3 font-medium">MemChain</th>
                <th className="px-4 py-3 font-medium">ChatRelay</th>
                <th className="px-4 py-3 font-medium">Data Layer</th>
                <th className="px-4 py-3 font-medium">Operator</th>
                <th className="px-4 py-3 font-medium">Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {nodes.length > 0 ? (
                nodes.map((node) => <NodeReadinessRow key={node.id} node={node} />)
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    No nodes are reporting yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {nodes.length > 0 && (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {nodes.map((node) => (
            <NodeDetailCard key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}
