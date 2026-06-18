/**
 * ============================================
 * AeroNyx Nodeboard - Settings Page
 * ============================================
 * File Path: app/dashboard/settings/page.tsx
 *
 * Product Requirement:
 *   Node operators need one place to manage commercial AeroNyx Privacy
 *   Protocol policy and verify the nodeboard control plane runtime. This page
 *   combines per-node policy controls with the nodeboard /api/health metadata
 *   so an operator can confirm which frontend commit is deployed and which
 *   backend/Rust contracts the UI is using.
 *
 * Frontend API and File Paths:
 *   - GET /api/health
 *     /root/open/nodeboard/app/api/health/route.ts
 *   - Settings page:
 *     /root/open/nodeboard/app/dashboard/settings/page.tsx
 *
 * Backend API and File Paths:
 *   - PATCH /api/privacy_network/nodes/{id}/
 *     /root/aeronyx/privacy_network/api/nodes.py
 *   - GET /api/privacy_network/vpn/overview/
 *     /root/aeronyx/privacy_network/api/vpn_observability.py
 *   - GET /api/privacy_network/vpn/events/
 *     /root/aeronyx/privacy_network/api/vpn_events.py
 *   - Node policy command service:
 *     /root/aeronyx/privacy_network/services/command_service.py
 *
 * Rust Producer Paths:
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/management/reporter.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 *
 * Privacy Boundary:
 *   This page shows operator policy metadata, nodeboard runtime metadata, and
 *   aggregate service status only. It must not expose packet payloads, DNS
 *   contents, traffic destinations, domains, URLs, browsing history, voucher
 *   secrets, wallet-level traffic, or plaintext social graph data.
 *
 * Last Modified: v1.6.3 - Wire private access code generation and save flow
 * Previous: v1.6.2 - Added dashboard language selector
 * Previous: v1.6.1 - Control plane runtime panel
 * ============================================
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useNodeboardHealth, useNodes, useUpdateNode, useVpnEvents, useVpnOverview } from '@/hooks/useNodes';
import {
  Node,
  NodeTier,
  NodeUpdateRequest,
  NodeVisibility,
  NodeboardHealthResponse,
  VpnEvent,
  VpnPolicySync,
} from '@/types';
import Card, { EmptyState, LoadingCard } from '@/components/common/Card';
import Button from '@/components/common/Button';
import LanguageSelector from '@/components/common/LanguageSelector';
import { useI18n } from '@/lib/i18n/I18nProvider';

const DEFAULT_POLICY = {
  node_tier: 'public' as NodeTier,
  maintenance_mode: false,
  max_sessions: 0,
  bandwidth_limit_mbps: 0,
  heartbeat_interval_seconds: 30,
};

const DEFAULT_FORM = {
  ...DEFAULT_POLICY,
  visibility: 'private' as NodeVisibility,
  region_code: '',
  city: '',
  is_vpn_node: true,
};

type PolicyForm = typeof DEFAULT_POLICY;
type NodeSettingsForm = typeof DEFAULT_FORM;
type PolicySaveFollowUp = {
  mode: 'single' | 'fleet';
  nodeId?: string;
  nodeName: string;
  nodeCount: number;
  savedAt: string;
};
type AccessPasswordDraft = {
  value: string;
  dirty: boolean;
  generated: boolean;
};
type PolicyPreset = {
  id: string;
  policy: PolicyForm;
};

const POLICY_PRESETS: PolicyPreset[] = [
  {
    id: 'public-standard',
    policy: {
      node_tier: 'public',
      maintenance_mode: false,
      max_sessions: 0,
      bandwidth_limit_mbps: 0,
      heartbeat_interval_seconds: 30,
    },
  },
  {
    id: 'premium-capacity',
    policy: {
      node_tier: 'premium',
      maintenance_mode: false,
      max_sessions: 0,
      bandwidth_limit_mbps: 0,
      heartbeat_interval_seconds: 20,
    },
  },
  {
    id: 'maintenance-drain',
    policy: {
      node_tier: 'public',
      maintenance_mode: true,
      max_sessions: 0,
      bandwidth_limit_mbps: 10,
      heartbeat_interval_seconds: 15,
    },
  },
  {
    id: 'limited-recovery',
    policy: {
      node_tier: 'public',
      maintenance_mode: false,
      max_sessions: 50,
      bandwidth_limit_mbps: 100,
      heartbeat_interval_seconds: 15,
    },
  },
];

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(value, max));
}

function normalizeRegionCode(value: string) {
  return value.trim().toUpperCase().slice(0, 2);
}

function generatePrivateAccessCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function shortValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function fieldLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function auditChanges(event: VpnEvent) {
  const changes = event.details.changes;
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];
  return Object.entries(changes as Record<string, { old?: unknown; new?: unknown }>)
    .slice(0, 6)
    .map(([field, change]) => ({
      field,
      oldValue: shortValue(change?.old),
      newValue: shortValue(change?.new),
    }));
}

function formatRuntimeTime(
  value: string | null | undefined,
  relativeTime: (value: string | number | Date | null | undefined) => string,
  pendingLabel: string
) {
  return value ? relativeTime(value) : pendingLabel;
}

function runtimeStatusClass(status: string | null | undefined) {
  if (status === 'ok') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'degraded') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300';
  if (status === 'error') return 'border-red-500/30 bg-red-500/10 text-red-300';
  return 'border-white/10 bg-white/5 text-gray-300';
}

function policySyncStatusLabel(t: (key: string) => string, status: string) {
  const key = `settings.policySync.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

function RuntimeValue({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[11px] uppercase text-gray-600">{label}</p>
      <p className={`mt-1 truncate text-sm text-gray-200 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function LanguageSettingsPanel() {
  const { t } = useI18n();
  return (
    <Card variant="default" padding="md">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div>
          <h2 className="text-base font-semibold text-white">{t('settings.languageTitle')}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            {t('settings.languageDescription')}
          </p>
        </div>
        <LanguageSelector showHelper />
      </div>
    </Card>
  );
}

function ControlPlaneRuntimePanel() {
  const { t } = useI18n();
  const { health, isLoading, isError, error, refetch } = useNodeboardHealth();

  if (isLoading) {
    return (
      <Card variant="default" padding="md">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-56 rounded bg-white/10" />
          <div className="grid gap-3 md:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-16 rounded-lg bg-white/5" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (isError || !health) {
    return (
      <Card variant="outline" padding="md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">{t('settings.runtime.title')}</h2>
            <p className="mt-1 text-sm text-red-300">
              {error?.message || t('settings.runtime.unavailable')}
            </p>
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      </Card>
    );
  }

  return <ControlPlaneRuntimeContent health={health} onRefresh={refetch} />;
}

function ControlPlaneRuntimeContent({
  health,
  onRefresh,
}: {
  health: NodeboardHealthResponse;
  onRefresh: () => void;
}) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  const runtime = health.runtime;
  const privacyBoundary = health.privacy_boundary.slice(0, 4).join(' - ');
  const pendingLabel = t('common.status.pending');

  return (
    <Card variant="default" padding="none">
      <div className="border-b border-white/5 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-white">{t('settings.runtime.title')}</h2>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${runtimeStatusClass(health.status)}`}>
                {t(`common.status.${health.status}`)}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {t('settings.runtime.generated', {
                version: health.version,
                time: formatRuntimeTime(health.generated_at, i18nRelativeTime, pendingLabel),
              })}
            </p>
          </div>
          <Button variant="secondary" onClick={onRefresh}>
            {t('common.refreshNow')}
          </Button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <RuntimeValue label={t('settings.runtime.gitSha')} value={runtime.git_sha} mono />
          <RuntimeValue label={t('settings.runtime.deployed')} value={formatRuntimeTime(runtime.deployed_at, i18nRelativeTime, pendingLabel)} />
          <RuntimeValue label={t('settings.runtime.apiBase')} value={health.api_base_url} mono />
          <RuntimeValue label={t('settings.runtime.port')} value={runtime.port} mono />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <RuntimeValue label={t('settings.runtime.sourceDir')} value={runtime.source_dir} mono />
          <RuntimeValue label={t('settings.runtime.envFile')} value={runtime.env_file} mono />
          <RuntimeValue
            label={t('settings.runtime.contracts')}
            value={t('settings.runtime.contractCount', {
              backend: formatNumber(health.backend_contracts.length),
              rust: formatNumber(health.rust_producers.length),
            })}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-medium uppercase text-gray-600">{t('settings.runtime.backendContract')}</p>
            <div className="mt-3 space-y-2">
              {health.backend_contracts.slice(0, 3).map((contract) => (
                <div key={`${contract.endpoint}-${contract.file}`} className="min-w-0">
                  <p className="truncate text-xs text-gray-300">{contract.endpoint || contract.purpose}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-gray-600">{contract.file}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-medium uppercase text-gray-600">{t('settings.runtime.rustProducers')}</p>
            <div className="mt-3 space-y-2">
              {health.rust_producers.slice(0, 2).map((producer) => (
                <div key={producer.file} className="min-w-0">
                  <p className="truncate text-xs text-gray-300">{producer.purpose}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-gray-600">{producer.file}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs leading-5 text-gray-600">{privacyBoundary}</p>
      </div>
    </Card>
  );
}

function nodePolicy(node: Node | null): NodeSettingsForm {
  if (!node) return DEFAULT_FORM;
  return {
    node_tier: node.node_tier === 'premium' ? 'premium' : 'public',
    maintenance_mode: Boolean(node.maintenance_mode),
    max_sessions: node.max_sessions ?? 0,
    bandwidth_limit_mbps: node.bandwidth_limit_mbps ?? 0,
    heartbeat_interval_seconds: node.heartbeat_interval_seconds ?? 30,
    visibility: node.visibility || 'private',
    region_code: node.region_code || '',
    city: node.city || '',
    is_vpn_node: Boolean(node.is_vpn_node),
  };
}

function policyChanged(node: Node | null, form: NodeSettingsForm) {
  if (!node) return false;
  const current = nodePolicy(node);
  return (
    current.node_tier !== form.node_tier ||
    current.maintenance_mode !== form.maintenance_mode ||
    current.max_sessions !== form.max_sessions ||
    current.bandwidth_limit_mbps !== form.bandwidth_limit_mbps ||
    current.heartbeat_interval_seconds !== form.heartbeat_interval_seconds ||
    current.visibility !== form.visibility ||
    current.region_code !== form.region_code ||
    current.city !== form.city ||
    current.is_vpn_node !== form.is_vpn_node
  );
}

function PolicyAuditPanel({ nodeId }: { nodeId: string }) {
  const { t, formatRelativeTime: i18nRelativeTime } = useI18n();
  const { events, isLoading, isError, error, refetch } = useVpnEvents({
    days: 30,
    type: 'node_policy_changed',
    nodeId,
    limit: 5,
  });
  const items = events?.events ?? [];

  return (
    <Card variant="default" padding="none">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{t('settings.audit.title')}</h2>
          <p className="text-xs text-gray-500 mt-1">{t('settings.audit.subtitle')}</p>
        </div>
        <Button variant="secondary" onClick={() => refetch()}>
          {t('common.refreshNow')}
        </Button>
      </div>

      <div className="divide-y divide-white/5">
        {isLoading && (
          <div className="p-5 space-y-3 animate-pulse">
            <div className="h-4 w-56 rounded bg-white/10" />
            <div className="h-4 w-80 rounded bg-white/5" />
          </div>
        )}

        {!isLoading && isError && (
          <div className="p-5 text-sm text-red-300">
            {error?.message || t('settings.audit.unavailable')}
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="p-5 text-sm text-gray-500">
            {t('settings.audit.empty')}
          </div>
        )}

        {!isLoading && !isError && items.map((event) => {
          const changes = auditChanges(event);
          const actor = shortValue(event.details.changed_by_wallet);
          return (
            <div key={event.id} className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{event.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {event.created_at ? i18nRelativeTime(event.created_at) : t('settings.audit.timePending')} - {actor}
                  </p>
                </div>
                <span className="inline-flex w-fit px-2 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-gray-400">
                  {event.action || 'settings_update'}
                </span>
              </div>
              {changes.length > 0 && (
                <div className="mt-3 grid md:grid-cols-2 gap-2">
                  {changes.map((change) => (
                    <div key={change.field} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                      <p className="text-gray-400">{fieldLabel(change.field)}</p>
                      <p className="text-gray-500 mt-1">
                        {change.oldValue}
                        <span className="text-purple-300 mx-1">-&gt;</span>
                        <span className="text-gray-200">{change.newValue}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StatusBadge({ node }: { node: Node }) {
  const { t } = useI18n();
  const styles = {
    online: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    offline: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
    suspended: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
  return (
    <span className={`inline-flex px-2 py-1 rounded-full border text-xs font-medium ${styles[node.status]}`}>
      {t(`common.status.${node.status}`)}
    </span>
  );
}

function PolicySyncBadge({ sync, compact = false }: { sync?: VpnPolicySync; compact?: boolean }) {
  const { t } = useI18n();
  const status = sync?.status || 'unknown';
  const styles = status === 'synced'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : status === 'pending'
      ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
      : 'bg-gray-500/15 text-gray-300 border-gray-500/30';
  const pending = sync?.mismatched_fields?.map((field) => field.replace(/_/g, ' ')).join(', ') || '';

  if (compact) {
    return (
      <span className={`px-2 py-1 rounded-full border text-xs ${styles}`}>
        {t('settings.policySync.compact', { status: policySyncStatusLabel(t, status) })}
      </span>
    );
  }

  return (
    <section className={`rounded-lg border px-4 py-3 ${styles}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
        <div>
          <h3 className="text-sm font-medium text-white">{t('settings.policySync.title')}</h3>
          <p className="text-xs mt-1 opacity-80">
            {sync?.message || t('settings.policySync.waiting')}
          </p>
        </div>
        <div className="text-sm font-semibold uppercase">{policySyncStatusLabel(t, status)}</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs opacity-80">
        <span>{t('settings.policySync.heartbeat', { value: sync?.heartbeat_age_seconds ?? t('common.status.pending') })}</span>
        {pending ? <span>{t('settings.policySync.pendingFields', { fields: pending })}</span> : null}
      </div>
    </section>
  );
}

function PolicySaveFollowUpPanel({
  followUp,
  sync,
}: {
  followUp: PolicySaveFollowUp;
  sync?: VpnPolicySync;
}) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  const syncStatus = sync?.status || 'unknown';
  const statusClass = syncStatus === 'synced'
    ? 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300'
    : syncStatus === 'pending'
      ? 'border-yellow-500/25 bg-yellow-500/[0.06] text-yellow-300'
      : 'border-sky-500/25 bg-sky-500/[0.06] text-sky-300';
  const isFleet = followUp.mode === 'fleet';
  const eventsHref = isFleet || !followUp.nodeId
    ? '/dashboard/events?days=30&type=node_policy_changed'
    : `/dashboard/events?days=30&type=node_policy_changed&node=${encodeURIComponent(followUp.nodeId)}`;

  return (
    <Card variant="default" padding="md">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-white">{t('settings.policyVerification.title')}</h2>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${statusClass}`}>
              {isFleet
                ? t('settings.policyVerification.nodesSaved', { count: formatNumber(followUp.nodeCount) })
                : t('settings.policySync.compact', { status: policySyncStatusLabel(t, syncStatus) })}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            {isFleet
              ? t('settings.policyVerification.fleetSaved', { count: formatNumber(followUp.nodeCount) })
              : t('settings.policyVerification.nodeSaved', { name: followUp.nodeName })}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {t('settings.policyVerification.savedAt', { time: i18nRelativeTime(followUp.savedAt) })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isFleet && followUp.nodeId ? (
            <>
              <Link
                href={`/dashboard/nodes/${followUp.nodeId}`}
                className="inline-flex items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/15"
              >
                {t('settings.policyVerification.nodeDetail')}
              </Link>
              <Link
                href={`/dashboard/nodes/${followUp.nodeId}?command_action=apply_policy#vpn-commands`}
                className="inline-flex items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-sm font-medium text-purple-300 hover:bg-purple-500/15"
              >
                {t('settings.policyVerification.commands')}
              </Link>
            </>
          ) : (
            <Link
              href="/dashboard/nodes"
              className="inline-flex items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/15"
            >
              {t('nav.nodes')}
            </Link>
          )}
          <Link
            href={eventsHref}
            className="inline-flex items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-sky-500/15"
          >
            {t('nav.events')}
          </Link>
        </div>
      </div>

      <div className="mt-4 grid md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-gray-600 uppercase">{t('settings.policyVerification.expected')}</p>
          <p className="mt-1 text-gray-300">{t('settings.policyVerification.expectedDetail')}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-gray-600 uppercase">{t('settings.policyVerification.confirm')}</p>
          <p className="mt-1 text-gray-300">{t('settings.policyVerification.confirmDetail')}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-gray-600 uppercase">{t('settings.policyVerification.privacy')}</p>
          <p className="mt-1 text-gray-300">{t('settings.policyVerification.privacyDetail')}</p>
        </div>
      </div>
    </Card>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.094c.55 0 1.019.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.854.142 1.204-.108l.738-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.894.15c.542.09.94.56.94 1.109v1.094c0 .55-.398 1.02-.94 1.11l-.894.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.27 1.06-.12 1.45l-.773.773a1.125 1.125 0 01-1.45.12l-.738-.527c-.35-.25-.806-.272-1.204-.107-.397.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.109.94h-1.094c-.55 0-1.02-.398-1.11-.94l-.149-.894c-.07-.424-.383-.764-.78-.929-.398-.165-.854-.143-1.204.107l-.738.527a1.125 1.125 0 01-1.45-.12l-.773-.773a1.125 1.125 0 01-.12-1.45l.527-.738c.25-.35.272-.806.107-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.929-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.738.527c.35.25.806.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function NodeList({
  nodes,
  selectedId,
  onSelect,
  policySyncByNodeId,
}: {
  nodes: Node[];
  selectedId: string;
  onSelect: (nodeId: string) => void;
  policySyncByNodeId: Record<string, VpnPolicySync | undefined>;
}) {
  const { t } = useI18n();
  return (
    <Card variant="default" padding="none">
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="text-base font-semibold text-white">{t('nav.nodes')}</h2>
      </div>
      <div className="divide-y divide-white/5">
        {nodes.map((node) => {
          const selected = node.id === selectedId;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node.id)}
              className={`w-full text-left px-5 py-4 transition-colors ${selected ? 'bg-purple-500/10' : 'hover:bg-white/[0.03]'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{node.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {node.region_code || node.auto_region || t('common.status.unknown')} {node.public_ip || t('settings.nodeList.noIp')}
                  </p>
                </div>
                <StatusBadge node={node} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10">
                  {node.node_tier || 'public'}
                </span>
                {node.maintenance_mode && (
                  <span className="px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                    {t('settings.policyEditor.maintenanceMode')}
                  </span>
                )}
                <PolicySyncBadge sync={policySyncByNodeId[node.id]} compact />
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function PolicyEditor({
  node,
  form,
  accessPassword,
  onForm,
  onAccessPassword,
  onSave,
  saving,
  policySync,
}: {
  node: Node;
  form: NodeSettingsForm;
  accessPassword: AccessPasswordDraft;
  onForm: (form: NodeSettingsForm) => void;
  onAccessPassword: (draft: AccessPasswordDraft) => void;
  onSave: () => void;
  saving: boolean;
  policySync?: VpnPolicySync;
}) {
  const { t, formatNumber, formatRelativeTime: i18nRelativeTime } = useI18n();
  const changed = policyChanged(node, form);
  const canSave = changed || accessPassword.dirty;
  const handleGenerateAccessCode = () => {
    const value = generatePrivateAccessCode();
    onAccessPassword({ value, dirty: true, generated: true });
    onForm({ ...form, visibility: 'password_protected' });
  };
  const handleCopyAccessCode = async () => {
    if (!accessPassword.value) return;
    await navigator.clipboard.writeText(accessPassword.value);
  };
  const handleRemoveAccessCode = () => {
    onAccessPassword({ value: '', dirty: true, generated: false });
    onForm({ ...form, visibility: 'private' });
  };

  return (
    <Card variant="default" padding="none">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{node.name}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {node.last_heartbeat
              ? t('settings.policyEditor.lastHeartbeat', { time: i18nRelativeTime(node.last_heartbeat) })
              : t('settings.policyEditor.noHeartbeat')}
          </p>
        </div>
        <Button variant="primary" onClick={onSave} disabled={!canSave || saving} isLoading={saving}>
          {t('settings.policyEditor.saveSettings')}
        </Button>
      </div>

      <div className="p-5 space-y-6">
        <PolicySyncBadge sync={policySync} />

        <section>
          <h3 className="text-sm font-medium text-white mb-3">{t('settings.policyEditor.placementAccess')}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-gray-500">{t('settings.policyEditor.regionCode')}</span>
              <input
                type="text"
                value={form.region_code}
                onChange={(event) => onForm({ ...form, region_code: normalizeRegionCode(event.target.value) })}
                placeholder={node.auto_region || 'US'}
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">{t('nodeSettings.region.city')}</span>
              <input
                type="text"
                value={form.city}
                onChange={(event) => onForm({ ...form, city: event.target.value.slice(0, 100) })}
                placeholder={t('nodeSettings.region.cityPlaceholder')}
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">{t('nodeSettings.visibility.title')}</span>
              <select
                value={form.visibility}
                onChange={(event) => onForm({ ...form, visibility: event.target.value as NodeVisibility })}
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
              >
                <option value="private" className="bg-[#111118]">{t('nodeSettings.visibility.private.label')}</option>
                <option value="public" className="bg-[#111118]">{t('nodeSettings.visibility.public.label')}</option>
                <option value="unlisted" className="bg-[#111118]">{t('nodeSettings.visibility.unlisted.label')}</option>
                <option value="password_protected" className="bg-[#111118]">{t('nodeSettings.visibility.password_protected.label')}</option>
              </select>
            </label>

            <section className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <div>
                <h4 className="text-sm font-medium text-white">{t('settings.policyEditor.aeronyxExitPool')}</h4>
                <p className="text-xs text-gray-500 mt-1">{t('settings.policyEditor.aeronyxExitDescription')}</p>
              </div>
              <button
                type="button"
                onClick={() => onForm({ ...form, is_vpn_node: !form.is_vpn_node })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors duration-200 ${form.is_vpn_node ? 'bg-emerald-500 border-emerald-500' : 'bg-gray-700 border-gray-700'}`}
                role="switch"
                aria-checked={form.is_vpn_node}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${form.is_vpn_node ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </section>
          </div>
        </section>

        <section className="rounded-lg border border-purple-500/20 bg-purple-500/[0.05] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">{t('nodeSettings.password.title')}</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {node.has_access_password
                  ? t('nodeSettings.password.existingHint')
                  : t('nodeSettings.password.newHint')}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-600">{t('nodeSettings.password.generatedHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleGenerateAccessCode}>
                {accessPassword.dirty ? t('nodeSettings.password.regenerate') : t('nodeSettings.password.generate')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void handleCopyAccessCode().catch(() => undefined);
                }}
                disabled={!accessPassword.value}
              >
                {t('nodeSettings.password.copy')}
              </Button>
              {(node.has_access_password || form.visibility === 'password_protected') && (
                <Button variant="secondary" onClick={handleRemoveAccessCode}>
                  {t('nodeSettings.password.remove')}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="block">
              <span className="text-xs text-gray-500">{t('nodeSettings.password.title')}</span>
              <input
                type="text"
                value={accessPassword.value}
                onChange={(event) => onAccessPassword({
                  value: event.target.value,
                  dirty: true,
                  generated: false,
                })}
                placeholder={node.has_access_password
                  ? t('nodeSettings.password.existingHint')
                  : t('nodeSettings.password.placeholder')}
                className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 font-mono text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50"
              />
            </label>
            <span className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-xs ${
              form.visibility === 'password_protected'
                ? 'border-purple-500/30 bg-purple-500/10 text-purple-200'
                : 'border-white/10 bg-white/[0.04] text-gray-400'
            }`}>
              {t(`nodeSettings.visibility.${form.visibility}.label`)}
            </span>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-gray-500">{t('settings.policyEditor.nodeTier')}</span>
            <select
              value={form.node_tier}
              onChange={(event) => onForm({ ...form, node_tier: event.target.value as NodeTier })}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
            >
              <option value="public" className="bg-[#111118]">{t('settings.policyEditor.tierPublic')}</option>
              <option value="premium" className="bg-[#111118]">{t('settings.policyEditor.tierPremium')}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-gray-500">{t('settings.policyEditor.heartbeatInterval')}</span>
            <input
              type="number"
              min={10}
              max={300}
              value={form.heartbeat_interval_seconds}
              onChange={(event) => onForm({
                ...form,
                heartbeat_interval_seconds: clampNumber(Number(event.target.value), 10, 300),
              })}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
            />
          </label>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-gray-500">{t('settings.policyEditor.maxSessions')}</span>
            <input
              type="number"
              min={0}
              max={100000}
              value={form.max_sessions}
              onChange={(event) => onForm({
                ...form,
                max_sessions: clampNumber(Number(event.target.value), 0, 100000),
              })}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
            />
          </label>

          <label className="block">
            <span className="text-xs text-gray-500">{t('settings.policyEditor.bandwidthMbps')}</span>
            <input
              type="number"
              min={0}
              max={100000}
              value={form.bandwidth_limit_mbps}
              onChange={(event) => onForm({
                ...form,
                bandwidth_limit_mbps: clampNumber(Number(event.target.value), 0, 100000),
              })}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
            />
          </label>
        </section>

        <section className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <h3 className="text-sm font-medium text-white">{t('settings.policyEditor.maintenanceMode')}</h3>
            <p className="text-xs text-gray-500 mt-1">{t('settings.policyEditor.maintenanceDescription')}</p>
          </div>
          <button
            type="button"
            onClick={() => onForm({ ...form, maintenance_mode: !form.maintenance_mode })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors duration-200 ${form.maintenance_mode ? 'bg-yellow-500 border-yellow-500' : 'bg-gray-700 border-gray-700'}`}
            role="switch"
            aria-checked={form.maintenance_mode}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${form.maintenance_mode ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </section>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-gray-500">{t('settings.policyEditor.activeSessions')}</p>
            <p className="text-lg text-white mt-1">{formatNumber(node.current_sessions)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-gray-500">{t('nodeSettings.visibility.title')}</p>
            <p className="text-lg text-white mt-1">{t(`nodeSettings.visibility.${node.visibility}.label`)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-gray-500">{t('settings.policyEditor.aeronyxExit')}</p>
            <p className="text-lg text-white mt-1">{node.is_vpn_node ? t('settings.policyEditor.yes') : t('settings.policyEditor.no')}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-gray-500">{t('settings.policyEditor.version')}</p>
            <p className="text-lg text-white mt-1">{node.version || t('common.status.unknown')}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function FleetPresets({
  selectedNodeName,
  nodeCount,
  onUsePreset,
  onApplyFleet,
  savingPresetId,
}: {
  selectedNodeName: string;
  nodeCount: number;
  onUsePreset: (preset: PolicyPreset) => void;
  onApplyFleet: (preset: PolicyPreset) => void;
  savingPresetId: string;
}) {
  const { t, formatNumber } = useI18n();
  return (
    <Card variant="default" padding="none">
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="text-base font-semibold text-white">{t('settings.fleetPresets.title')}</h2>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 p-5">
        {POLICY_PRESETS.map((preset) => (
          <div key={preset.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-white">{t(`settings.fleetPresets.${preset.id}.name`)}</h3>
                <p className="text-xs text-gray-500 mt-1">{t(`settings.fleetPresets.${preset.id}.description`)}</p>
              </div>
              {preset.policy.maintenance_mode && (
                <span className="px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-xs">
                  {t('settings.policyEditor.maintenanceMode')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-gray-400">
              <span>{t('settings.fleetPresets.tier', { value: preset.policy.node_tier })}</span>
              <span>{t('settings.fleetPresets.heartbeat', { seconds: preset.policy.heartbeat_interval_seconds })}</span>
              <span>{t('settings.fleetPresets.sessions', { value: preset.policy.max_sessions ? formatNumber(preset.policy.max_sessions) : t('billing.summary.unlimited') })}</span>
              <span>{t('settings.fleetPresets.bandwidth', { value: preset.policy.bandwidth_limit_mbps ? formatNumber(preset.policy.bandwidth_limit_mbps) : t('billing.summary.unlimited') })}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button variant="secondary" onClick={() => onUsePreset(preset)}>
                {t('settings.fleetPresets.useOn', { name: selectedNodeName })}
              </Button>
              <Button
                variant="primary"
                onClick={() => onApplyFleet(preset)}
                disabled={Boolean(savingPresetId)}
                isLoading={savingPresetId === preset.id}
              >
                {t('settings.fleetPresets.applyTo', { count: formatNumber(nodeCount) })}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { t, formatNumber } = useI18n();
  const { nodes, isLoading, isError, error, refetch } = useNodes();
  const { overview, refetch: refetchVpnOverview } = useVpnOverview();
  const updateNode = useUpdateNode();
  const [selectedId, setSelectedId] = useState('');
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? nodes[0] ?? null,
    [nodes, selectedId]
  );
  const [form, setForm] = useState<NodeSettingsForm>(DEFAULT_FORM);
  const [accessPassword, setAccessPassword] = useState<AccessPasswordDraft>({
    value: '',
    dirty: false,
    generated: false,
  });
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');
  const [lastPolicySave, setLastPolicySave] = useState<PolicySaveFollowUp | null>(null);
  const [savingPresetId, setSavingPresetId] = useState('');
  const policySyncByNodeId = useMemo(() => {
    const pairs = (overview?.nodes ?? []).map((node) => [node.id, node.system.policy_sync] as const);
    return Object.fromEntries(pairs) as Record<string, VpnPolicySync | undefined>;
  }, [overview?.nodes]);

  useEffect(() => {
    if (!selectedId && nodes[0]) setSelectedId(nodes[0].id);
  }, [nodes, selectedId]);

  useEffect(() => {
    setForm(nodePolicy(selectedNode));
    setAccessPassword({ value: '', dirty: false, generated: false });
    setMessage('');
  }, [selectedNode?.id]);

  const save = async () => {
    if (!selectedNode) return;
    setMessage('');
    const nextAccessPassword = accessPassword.value.trim();
    if (
      form.visibility === 'password_protected'
      && !selectedNode.has_access_password
      && !nextAccessPassword
    ) {
      setMessage(t('nodeSettings.validation.passwordRequired'));
      setMessageTone('error');
      return;
    }

    const payload: NodeUpdateRequest = {
      visibility: form.visibility,
      region_code: form.region_code,
      city: form.city,
      is_vpn_node: form.is_vpn_node,
      node_tier: form.node_tier,
      maintenance_mode: form.maintenance_mode,
      max_sessions: form.max_sessions,
      bandwidth_limit_mbps: form.bandwidth_limit_mbps,
      heartbeat_interval_seconds: form.heartbeat_interval_seconds,
    };
    if (accessPassword.dirty) {
      payload.access_password = nextAccessPassword;
    }

    try {
      await updateNode.mutateAsync({ nodeId: selectedNode.id, data: payload });
      setMessage(t('settings.policyEditor.saved'));
      setMessageTone('success');
      setLastPolicySave({
        mode: 'single',
        nodeId: selectedNode.id,
        nodeName: selectedNode.name,
        nodeCount: 1,
        savedAt: new Date().toISOString(),
      });
      setAccessPassword({ value: '', dirty: false, generated: false });
      refetch();
      refetchVpnOverview();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('settings.policyEditor.saveFailed'));
      setMessageTone('error');
    }
  };

  const usePreset = (preset: PolicyPreset) => {
    const presetName = t(`settings.fleetPresets.${preset.id}.name`);
    setForm((current) => ({ ...current, ...preset.policy }));
    setMessage(t('settings.fleetPresets.loadedFor', {
      preset: presetName,
      node: selectedNode?.name || t('settings.fleetPresets.selectedNode'),
    }));
    setMessageTone('success');
  };

  const applyFleetPreset = async (preset: PolicyPreset) => {
    if (!nodes.length) return;
    const presetName = t(`settings.fleetPresets.${preset.id}.name`);
    const confirmed = window.confirm(
      t('settings.fleetPresets.confirmApply', {
        preset: presetName,
        count: formatNumber(nodes.length),
      })
    );
    if (!confirmed) return;

    setSavingPresetId(preset.id);
    setMessage('');
    try {
      for (const node of nodes) {
        await updateNode.mutateAsync({ nodeId: node.id, data: preset.policy });
      }
      if (selectedNode) setForm((current) => ({ ...current, ...preset.policy }));
      setMessage(t('settings.fleetPresets.appliedTo', {
        preset: presetName,
        count: formatNumber(nodes.length),
      }));
      setMessageTone('success');
      setLastPolicySave({
        mode: 'fleet',
        nodeName: presetName,
        nodeCount: nodes.length,
        savedAt: new Date().toISOString(),
      });
      refetch();
      refetchVpnOverview();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('settings.fleetPresets.applyFailed'));
      setMessageTone('error');
    } finally {
      setSavingPresetId('');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCard />
        <div className="grid xl:grid-cols-[360px_1fr] gap-6">
          <LoadingCard />
          <LoadingCard />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<SettingsIcon />}
        title={t('settings.unavailableTitle')}
        description={error?.message || t('settings.unavailableDescription')}
        action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
      />
    );
  }

  if (!nodes.length || !selectedNode) {
    return (
      <EmptyState
        icon={<SettingsIcon />}
        title={t('settings.noNodesTitle')}
        description={t('settings.noNodesDescription')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('settings.subtitle')}</p>
        </div>
        {message && (
          <div className={`text-sm ${messageTone === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
            {message}
          </div>
        )}
      </div>

      <LanguageSettingsPanel />

      <ControlPlaneRuntimePanel />

      <FleetPresets
        selectedNodeName={selectedNode.name}
        nodeCount={nodes.length}
        onUsePreset={usePreset}
        onApplyFleet={applyFleetPreset}
        savingPresetId={savingPresetId}
      />

      {lastPolicySave && (
        <PolicySaveFollowUpPanel
          followUp={lastPolicySave}
          sync={lastPolicySave.mode === 'single' && lastPolicySave.nodeId
            ? policySyncByNodeId[lastPolicySave.nodeId]
            : undefined}
        />
      )}

      <div className="grid xl:grid-cols-[360px_1fr] gap-6 items-start">
        <NodeList
          nodes={nodes}
          selectedId={selectedNode.id}
          onSelect={setSelectedId}
          policySyncByNodeId={policySyncByNodeId}
        />
        <div className="space-y-6">
          <PolicyEditor
            node={selectedNode}
            form={form}
            accessPassword={accessPassword}
            onForm={setForm}
            onAccessPassword={setAccessPassword}
            onSave={save}
            saving={updateNode.isPending}
            policySync={policySyncByNodeId[selectedNode.id]}
          />
          <PolicyAuditPanel nodeId={selectedNode.id} />
        </div>
      </div>
    </div>
  );
}
