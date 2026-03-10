/**
 * ============================================
 * AeroNyx Privacy Network - Memory Explorer Page
 * ============================================
 * File Path: app/dashboard/nodes/[id]/memories/page.tsx
 *
 * Modification Reason (v1.1.0):
 *   - BUGFIX #18: Added Agent status check before rendering MemoryOverview.
 *     Problem: Page only checked node.status === 'online', but if the Agent
 *     is not running (stopped/not_installed/error), all MPI requests return 503.
 *     User would see empty state or errors with no explanation.
 *     Fix: Fetch agent status via useAgentStatus hook. Show a clear gate UI
 *     if agent is not in 'running' state, guiding user to start the agent.
 *   - Simplified page header (removed redundant empty right side)
 *
 * Previous (v1.0.0):
 *   Route page that validates node exists and is online, then renders
 *   MemoryOverview. No agent status check.
 *
 * Main Functionality:
 *   - Validates node exists via useNodeDetail
 *   - Checks node is online (MPI requires online node)
 *   - Checks agent is running (MPI requires active agent)
 *   - Shows offline/agent-not-running/error/loading states
 *   - Renders MemoryOverview component when all checks pass
 *   - Back navigation to node detail page
 *
 * Dependencies:
 *   - hooks/useNodes.ts (useNodeDetail)
 *   - hooks/useAgent.ts (useAgentStatus)
 *   - components/memories/MemoryOverview.tsx
 *   - components/common/Button.tsx
 *   - components/common/Card.tsx
 *
 * Main Logical Flow:
 *   1. Extract nodeId from route params
 *   2. Fetch node detail to validate existence and status
 *   3. If offline → show offline gate
 *   4. Fetch agent status
 *   5. If agent not running → show agent gate with guidance
 *   6. If all checks pass → render MemoryOverview
 *
 * ⚠️ Important Note for Next Developer:
 * - All MPI API calls return 503 when node is offline OR agent not running
 * - This page prevents MPI calls in both cases (avoids 30s timeout waits)
 * - MemoryOverview assumes node is online + agent running — it does NOT check
 * - useAgentStatus may return null during loading; handle gracefully
 * - Agent status 'running' is the ONLY state where MPI works
 *
 * Last Modified: v1.1.0 - Added Agent status check (#18)
 * Previous: v1.0.0 - Initial memory explorer page
 * ============================================
 */

'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useNodeDetail } from '@/hooks/useNodes';
import { useAgentStatus } from '@/hooks/useAgent';
import MemoryOverview from '@/components/memories/MemoryOverview';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';

// ============================================
// Back Button
// ============================================

function BackButton({ nodeId }: { nodeId: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/dashboard/nodes/${nodeId}`)}
      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span className="text-sm">Back to Node</span>
    </button>
  );
}

// ============================================
// Gate Component (for offline/error/agent states)
// ============================================

interface GateProps {
  nodeId: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: { label: string; onClick: () => void };
}

function Gate({ nodeId, title, description, icon, action }: GateProps) {
  return (
    <div className="max-w-7xl mx-auto">
      <BackButton nodeId={nodeId} />
      <Card variant="outline" padding="lg" className="max-w-md mx-auto text-center">
        <div className="py-8">
          <div className="
            w-16 h-16 mx-auto mb-4 rounded-2xl
            bg-gradient-to-br from-purple-500/20 to-blue-500/20
            flex items-center justify-center
          ">
            {icon}
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
          <p className="text-sm text-gray-400 mb-6">{description}</p>
          {action && (
            <Button variant="primary" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============================================
// Loading
// ============================================

function Loading() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="h-6 w-24 bg-white/5 rounded mb-6 animate-pulse" />
      <div className="space-y-6">
        <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
        <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-white/[0.03] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Page Component
// ============================================

export default function MemoriesPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params.id as string;

  const { node, isLoading: nodeLoading, isError: nodeError } = useNodeDetail(nodeId);
  // Only fetch agent status when node is confirmed online
  // (avoids unnecessary 503 request when node is offline)
  const isNodeOnline = !!node && node.status === 'online';
  const { agentStatus, isLoading: agentLoading } = useAgentStatus(
    isNodeOnline ? nodeId : ''
  );

  // Loading (node first, then agent)
  if (nodeLoading) {
    return <Loading />;
  }

  // Node not found
  if (nodeError || !node) {
    return (
      <Gate
        nodeId={nodeId}
        title="Node Not Found"
        description="The node you're looking for doesn't exist or has been removed."
        icon={
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        action={{
          label: 'View Nodes',
          onClick: () => router.push('/dashboard/nodes'),
        }}
      />
    );
  }

  // Node offline
  if (node.status !== 'online') {
    return (
      <Gate
        nodeId={nodeId}
        title="Node Offline"
        description={`"${node.name}" is currently ${node.status}. Memory management requires an online node with an active AI agent.`}
        icon={
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
          </svg>
        }
        action={{
          label: 'View Node',
          onClick: () => router.push(`/dashboard/nodes/${nodeId}`),
        }}
      />
    );
  }

  // Agent loading (only after node is confirmed online)
  if (agentLoading) {
    return <Loading />;
  }

  // Agent not running (#18)
  // agentStatus is AgentStatus | null (a string like 'running', not an object)
  const agentNotReady = !agentStatus || agentStatus !== 'running';

  if (agentNotReady) {
    const isInstalled = agentStatus === 'installed' || agentStatus === 'stopped';
    const isTransitional = agentStatus === 'installing' || agentStatus === 'starting' || agentStatus === 'stopping' || agentStatus === 'updating';

    let title = 'AI Agent Not Running';
    let description = `Memory management requires OpenClaw to be running on "${node.name}".`;

    if (!agentStatus || agentStatus === 'not_installed') {
      title = 'AI Agent Not Installed';
      description = `Install and start OpenClaw on "${node.name}" to manage AI memories.`;
    } else if (isTransitional) {
      title = 'AI Agent Starting...';
      description = `OpenClaw is currently ${agentStatus}. Please wait a moment and try again.`;
    } else if (agentStatus === 'error') {
      title = 'AI Agent Error';
      description = `OpenClaw encountered an error on "${node.name}". Please check the agent panel.`;
    } else if (isInstalled) {
      description = `OpenClaw is installed but not running on "${node.name}". Start the agent first.`;
    }

    return (
      <Gate
        nodeId={nodeId}
        title={title}
        description={description}
        icon={
          <svg className="w-8 h-8 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        }
        action={{
          label: isTransitional ? 'Please Wait...' : 'Go to Node',
          onClick: () => router.push(`/dashboard/nodes/${nodeId}`),
        }}
      />
    );
  }

  // All checks passed — render Memory Explorer
  return (
    <div className="max-w-7xl mx-auto">
      <BackButton nodeId={nodeId} />

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">AI Memory</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage what {node.name}&apos;s AI remembers about you
        </p>
      </div>

      {/* Memory Explorer */}
      <MemoryOverview nodeId={nodeId} />
    </div>
  );
}
