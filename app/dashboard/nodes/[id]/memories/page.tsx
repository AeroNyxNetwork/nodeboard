/**
 * ============================================
 * AeroNyx Privacy Network - Memory Explorer Page
 * ============================================
 * File Path: app/dashboard/nodes/[id]/memories/page.tsx
 *
 * Creation Reason: Route page for the MemChain Memory Explorer.
 *   Route: /dashboard/nodes/[id]/memories
 *   Validates node exists and is online before rendering the explorer.
 *
 * Main Functionality:
 *   - Validates node exists via useNodeDetail
 *   - Checks node is online (MPI requires online node)
 *   - Shows offline/error/loading states with appropriate guidance
 *   - Renders MemoryOverview component when all checks pass
 *   - Back navigation to node detail page
 *
 * Dependencies:
 *   - hooks/useNodes.ts (useNodeDetail)
 *   - components/memories/MemoryOverview.tsx
 *   - components/common/Button.tsx
 *   - components/common/Card.tsx
 *
 * Main Logical Flow:
 *   1. Extract nodeId from route params
 *   2. Fetch node detail to validate existence and status
 *   3. If offline → show offline state with guidance
 *   4. If online → render MemoryOverview
 *
 * ⚠️ Important Note for Next Developer:
 * - All MPI API calls return 503 when node is offline
 * - This page prevents MPI calls when offline (avoids 30s timeout waits)
 * - MemoryOverview assumes node is online — it does NOT check node status
 *
 * Last Modified: v1.0.0 - Initial memory explorer page
 * ============================================
 */

'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useNodeDetail } from '@/hooks/useNodes';
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
// Gate Component (for offline/error states)
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
        <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white/[0.03] rounded-xl animate-pulse" />
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

  const { node, isLoading, isError } = useNodeDetail(nodeId);

  // Loading
  if (isLoading) {
    return <Loading />;
  }

  // Node not found
  if (isError || !node) {
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

  // All checks passed — render Memory Explorer
  return (
    <div className="max-w-7xl mx-auto">
      <BackButton nodeId={nodeId} />

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Memory</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage what {node.name}&apos;s AI remembers about you
          </p>
        </div>
      </div>

      {/* Memory Explorer */}
      <MemoryOverview nodeId={nodeId} />
    </div>
  );
}
