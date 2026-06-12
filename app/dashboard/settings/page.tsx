/**
 * AeroNyx VPN Settings page.
 *
 * Source path:
 *   /root/open/nodeboard/app/dashboard/settings/page.tsx
 *
 * Backend:
 *   PATCH /api/privacy_network/nodes/{id}/
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useNodes, useUpdateNode, useVpnEvents, useVpnOverview } from '@/hooks/useNodes';
import { Node, NodeTier, NodeUpdateRequest, NodeVisibility, VpnEvent, VpnPolicySync } from '@/types';
import { formatRelativeTime } from '@/lib/api';
import Card, { EmptyState, LoadingCard } from '@/components/common/Card';
import Button from '@/components/common/Button';

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
type PolicyPreset = {
  id: string;
  name: string;
  description: string;
  policy: PolicyForm;
};

const POLICY_PRESETS: PolicyPreset[] = [
  {
    id: 'public-standard',
    name: 'Public Standard',
    description: 'Open capacity pool with normal heartbeat and no hard session cap.',
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
    name: 'Premium Capacity',
    description: 'Premium routing pool with faster policy refresh for paid traffic.',
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
    name: 'Maintenance Drain',
    description: 'Stop new handshakes and keep telemetry fast while draining sessions.',
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
    name: 'Limited Recovery',
    description: 'Bring unstable nodes back gently with bounded sessions and bandwidth.',
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
          <h2 className="text-base font-semibold text-white">Recent Settings Audit</h2>
          <p className="text-xs text-gray-500 mt-1">Last 30 days for the selected node</p>
        </div>
        <Button variant="secondary" onClick={() => refetch()}>
          Refresh
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
            {error?.message || 'Unable to load policy audit events.'}
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="p-5 text-sm text-gray-500">
            No policy changes recorded for this node yet.
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
                    {event.created_at ? formatRelativeTime(event.created_at) : 'time pending'} - {actor}
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
  const styles = {
    online: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    offline: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
    suspended: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
  return (
    <span className={`inline-flex px-2 py-1 rounded-full border text-xs font-medium ${styles[node.status]}`}>
      {node.status}
    </span>
  );
}

function PolicySyncBadge({ sync, compact = false }: { sync?: VpnPolicySync; compact?: boolean }) {
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
        sync {status}
      </span>
    );
  }

  return (
    <section className={`rounded-lg border px-4 py-3 ${styles}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
        <div>
          <h3 className="text-sm font-medium text-white">Policy Sync</h3>
          <p className="text-xs mt-1 opacity-80">
            {sync?.message || 'Waiting for Rust node policy snapshot in heartbeat.'}
          </p>
        </div>
        <div className="text-sm font-semibold uppercase">{status}</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs opacity-80">
        <span>heartbeat {sync?.heartbeat_age_seconds ?? 'pending'}s</span>
        {pending ? <span>pending {pending}</span> : null}
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
  const syncStatus = sync?.status || 'unknown';
  const statusClass = syncStatus === 'synced'
    ? 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300'
    : syncStatus === 'pending'
      ? 'border-yellow-500/25 bg-yellow-500/[0.06] text-yellow-300'
      : 'border-sky-500/25 bg-sky-500/[0.06] text-sky-300';
  const isFleet = followUp.mode === 'fleet';

  return (
    <Card variant="default" padding="md">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-white">Policy Verification</h2>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${statusClass}`}>
              {isFleet ? `${followUp.nodeCount} nodes saved` : `sync ${syncStatus}`}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            {isFleet
              ? `Fleet policy was saved for ${followUp.nodeCount} nodes. Check each node's Policy Sync and command history as heartbeats arrive.`
              : `${followUp.nodeName} policy was saved. Confirm the Rust node acknowledges it on the next heartbeat.`}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Saved {formatRelativeTime(followUp.savedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isFleet && followUp.nodeId ? (
            <>
              <Link
                href={`/dashboard/nodes/${followUp.nodeId}`}
                className="inline-flex items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/15"
              >
                Node Detail
              </Link>
              <Link
                href={`/dashboard/nodes/${followUp.nodeId}#vpn-commands`}
                className="inline-flex items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-sm font-medium text-purple-300 hover:bg-purple-500/15"
              >
                Commands
              </Link>
            </>
          ) : (
            <Link
              href="/dashboard/nodes"
              className="inline-flex items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/15"
            >
              Nodes
            </Link>
          )}
          <Link
            href="/dashboard/events"
            className="inline-flex items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-sky-500/15"
          >
            Events
          </Link>
        </div>
      </div>

      <div className="mt-4 grid md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-gray-600 uppercase">Expected</p>
          <p className="mt-1 text-gray-300">`apply_policy` command appears in node command history.</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-gray-600 uppercase">Confirm</p>
          <p className="mt-1 text-gray-300">Policy Sync changes from pending or unknown to synced.</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-gray-600 uppercase">Privacy</p>
          <p className="mt-1 text-gray-300">Only policy metadata is shown; no traffic destinations or packet contents.</p>
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
  return (
    <Card variant="default" padding="none">
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="text-base font-semibold text-white">Nodes</h2>
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
                    {node.region_code || node.auto_region || 'unknown'} {node.public_ip || 'no ip'}
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
                    maintenance
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
  onForm,
  onSave,
  saving,
  policySync,
}: {
  node: Node;
  form: NodeSettingsForm;
  onForm: (form: NodeSettingsForm) => void;
  onSave: () => void;
  saving: boolean;
  policySync?: VpnPolicySync;
}) {
  const changed = policyChanged(node, form);
  return (
    <Card variant="default" padding="none">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{node.name}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {node.last_heartbeat ? `Last heartbeat ${formatRelativeTime(node.last_heartbeat)}` : 'No heartbeat yet'}
          </p>
        </div>
        <Button variant="primary" onClick={onSave} disabled={!changed || saving} isLoading={saving}>
          Save Settings
        </Button>
      </div>

      <div className="p-5 space-y-6">
        <PolicySyncBadge sync={policySync} />

        <section>
          <h3 className="text-sm font-medium text-white mb-3">Placement & Access</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-gray-500">Region Code</span>
              <input
                type="text"
                value={form.region_code}
                onChange={(event) => onForm({ ...form, region_code: normalizeRegionCode(event.target.value) })}
                placeholder={node.auto_region || 'US'}
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">City</span>
              <input
                type="text"
                value={form.city}
                onChange={(event) => onForm({ ...form, city: event.target.value.slice(0, 100) })}
                placeholder="Tokyo"
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500">Visibility</span>
              <select
                value={form.visibility}
                onChange={(event) => onForm({ ...form, visibility: event.target.value as NodeVisibility })}
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
              >
                <option value="private" className="bg-[#111118]">private</option>
                <option value="public" className="bg-[#111118]">public</option>
                <option value="unlisted" className="bg-[#111118]">unlisted</option>
                {form.visibility === 'password_protected' && (
                  <option value="password_protected" className="bg-[#111118]">password protected</option>
                )}
              </select>
            </label>

            <section className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <div>
                <h4 className="text-sm font-medium text-white">VPN Exit Pool</h4>
                <p className="text-xs text-gray-500 mt-1">Controls whether this node is advertised as a VPN candidate.</p>
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

        <section className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-gray-500">Node Tier</span>
            <select
              value={form.node_tier}
              onChange={(event) => onForm({ ...form, node_tier: event.target.value as NodeTier })}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
            >
              <option value="public" className="bg-[#111118]">public</option>
              <option value="premium" className="bg-[#111118]">premium</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-gray-500">Heartbeat Interval</span>
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
            <span className="text-xs text-gray-500">Max Sessions</span>
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
            <span className="text-xs text-gray-500">Bandwidth Mbps</span>
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
            <h3 className="text-sm font-medium text-white">Maintenance Mode</h3>
            <p className="text-xs text-gray-500 mt-1">Policy is sent to the Rust node on heartbeat.</p>
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
            <p className="text-xs text-gray-500">Active Sessions</p>
            <p className="text-lg text-white mt-1">{node.current_sessions}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-gray-500">Visibility</p>
            <p className="text-lg text-white mt-1">{node.visibility}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-gray-500">VPN Exit</p>
            <p className="text-lg text-white mt-1">{node.is_vpn_node ? 'yes' : 'no'}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-gray-500">Version</p>
            <p className="text-lg text-white mt-1">{node.version || 'unknown'}</p>
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
  return (
    <Card variant="default" padding="none">
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="text-base font-semibold text-white">Fleet Presets</h2>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 p-5">
        {POLICY_PRESETS.map((preset) => (
          <div key={preset.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-white">{preset.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{preset.description}</p>
              </div>
              {preset.policy.maintenance_mode && (
                <span className="px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 text-xs">
                  maintenance
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-gray-400">
              <span>tier {preset.policy.node_tier}</span>
              <span>{preset.policy.heartbeat_interval_seconds}s heartbeat</span>
              <span>{preset.policy.max_sessions || 'unlimited'} sessions</span>
              <span>{preset.policy.bandwidth_limit_mbps || 'unlimited'} Mbps</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button variant="secondary" onClick={() => onUsePreset(preset)}>
                Use on {selectedNodeName}
              </Button>
              <Button
                variant="primary"
                onClick={() => onApplyFleet(preset)}
                disabled={Boolean(savingPresetId)}
                isLoading={savingPresetId === preset.id}
              >
                Apply to {nodeCount}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { nodes, isLoading, isError, error, refetch } = useNodes();
  const { overview, refetch: refetchVpnOverview } = useVpnOverview();
  const updateNode = useUpdateNode();
  const [selectedId, setSelectedId] = useState('');
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? nodes[0] ?? null,
    [nodes, selectedId]
  );
  const [form, setForm] = useState<NodeSettingsForm>(DEFAULT_FORM);
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
    setMessage('');
  }, [selectedNode?.id]);

  const save = async () => {
    if (!selectedNode) return;
    setMessage('');
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
    try {
      await updateNode.mutateAsync({ nodeId: selectedNode.id, data: payload });
      setMessage('Settings saved.');
      setMessageTone('success');
      setLastPolicySave({
        mode: 'single',
        nodeId: selectedNode.id,
        nodeName: selectedNode.name,
        nodeCount: 1,
        savedAt: new Date().toISOString(),
      });
      refetch();
      refetchVpnOverview();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save policy.');
      setMessageTone('error');
    }
  };

  const usePreset = (preset: PolicyPreset) => {
    setForm((current) => ({ ...current, ...preset.policy }));
    setMessage(`${preset.name} loaded for ${selectedNode?.name || 'selected node'}.`);
    setMessageTone('success');
  };

  const applyFleetPreset = async (preset: PolicyPreset) => {
    if (!nodes.length) return;
    const confirmed = window.confirm(
      `Apply "${preset.name}" to all ${nodes.length} nodes?`
    );
    if (!confirmed) return;

    setSavingPresetId(preset.id);
    setMessage('');
    try {
      for (const node of nodes) {
        await updateNode.mutateAsync({ nodeId: node.id, data: preset.policy });
      }
      if (selectedNode) setForm((current) => ({ ...current, ...preset.policy }));
      setMessage(`${preset.name} applied to ${nodes.length} nodes.`);
      setMessageTone('success');
      setLastPolicySave({
        mode: 'fleet',
        nodeName: preset.name,
        nodeCount: nodes.length,
        savedAt: new Date().toISOString(),
      });
      refetch();
      refetchVpnOverview();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to apply fleet preset.');
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
        title="Settings Unavailable"
        description={error?.message || 'Unable to load node settings.'}
        action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  if (!nodes.length || !selectedNode) {
    return (
      <EmptyState
        icon={<SettingsIcon />}
        title="No Nodes"
        description="Node settings will appear after a node is registered."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Commercial VPN placement and policy per node</p>
        </div>
        {message && (
          <div className={`text-sm ${messageTone === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
            {message}
          </div>
        )}
      </div>

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
            onForm={setForm}
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
