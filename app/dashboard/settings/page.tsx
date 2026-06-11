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
import { useNodes, useUpdateNode } from '@/hooks/useNodes';
import { Node, NodeTier, NodeUpdateRequest } from '@/types';
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

type PolicyForm = typeof DEFAULT_POLICY;

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(value, max));
}

function nodePolicy(node: Node | null): PolicyForm {
  if (!node) return DEFAULT_POLICY;
  return {
    node_tier: node.node_tier === 'premium' ? 'premium' : 'public',
    maintenance_mode: Boolean(node.maintenance_mode),
    max_sessions: node.max_sessions ?? 0,
    bandwidth_limit_mbps: node.bandwidth_limit_mbps ?? 0,
    heartbeat_interval_seconds: node.heartbeat_interval_seconds ?? 30,
  };
}

function policyChanged(node: Node | null, form: PolicyForm) {
  if (!node) return false;
  const current = nodePolicy(node);
  return (
    current.node_tier !== form.node_tier ||
    current.maintenance_mode !== form.maintenance_mode ||
    current.max_sessions !== form.max_sessions ||
    current.bandwidth_limit_mbps !== form.bandwidth_limit_mbps ||
    current.heartbeat_interval_seconds !== form.heartbeat_interval_seconds
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
}: {
  nodes: Node[];
  selectedId: string;
  onSelect: (nodeId: string) => void;
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
}: {
  node: Node;
  form: PolicyForm;
  onForm: (form: PolicyForm) => void;
  onSave: () => void;
  saving: boolean;
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
          Save Policy
        </Button>
      </div>

      <div className="p-5 space-y-6">
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

export default function SettingsPage() {
  const { nodes, isLoading, isError, error, refetch } = useNodes();
  const updateNode = useUpdateNode();
  const [selectedId, setSelectedId] = useState('');
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? nodes[0] ?? null,
    [nodes, selectedId]
  );
  const [form, setForm] = useState<PolicyForm>(DEFAULT_POLICY);
  const [message, setMessage] = useState('');

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
      node_tier: form.node_tier,
      maintenance_mode: form.maintenance_mode,
      max_sessions: form.max_sessions,
      bandwidth_limit_mbps: form.bandwidth_limit_mbps,
      heartbeat_interval_seconds: form.heartbeat_interval_seconds,
    };
    try {
      await updateNode.mutateAsync({ nodeId: selectedNode.id, data: payload });
      setMessage('Policy saved.');
      refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save policy.');
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
          <p className="text-sm text-gray-500 mt-1">Commercial VPN policy per node</p>
        </div>
        {message && (
          <div className={`text-sm ${message === 'Policy saved.' ? 'text-emerald-300' : 'text-red-300'}`}>
            {message}
          </div>
        )}
      </div>

      <div className="grid xl:grid-cols-[360px_1fr] gap-6 items-start">
        <NodeList nodes={nodes} selectedId={selectedNode.id} onSelect={setSelectedId} />
        <PolicyEditor
          node={selectedNode}
          form={form}
          onForm={setForm}
          onSave={save}
          saving={updateNode.isPending}
        />
      </div>
    </div>
  );
}
