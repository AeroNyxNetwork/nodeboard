/**
 * ============================================
 * AeroNyx Privacy Network - AI Chat Page
 * ============================================
 * File Path: app/dashboard/nodes/[id]/chat/page.tsx
 *
 * Creation Reason: Phase 2 — AI Encrypted Terminal page.
 *   Route: /dashboard/nodes/[id]/chat
 *   Provides a full-screen chat experience connected to the node's
 *   AI agent via WebSocket tunnel.
 *
 * Main Functionality:
 *   - Validates node exists and agent is running before showing chat
 *   - Full-height ChatTerminal component
 *   - Graceful error states (node not found, agent not running, offline)
 *   - Back navigation to node detail page
 *
 * Dependencies:
 *   - hooks/useNodes.ts (useNodeDetail for validation)
 *   - hooks/useAgent.ts (useAgentStatus to check agent state)
 *   - components/dashboard/ChatTerminal.tsx (main chat UI)
 *   - components/common/Button.tsx
 *   - components/common/Card.tsx
 *
 * Main Logical Flow:
 * 1. Extract nodeId from route params
 * 2. Fetch node detail to validate node exists
 * 3. Fetch agent status to check if agent is running
 * 4. If all checks pass, render ChatTerminal
 * 5. Otherwise show appropriate error/guidance state
 *
 * ⚠️ Important Note for Next Developer:
 * - This page uses a special full-height layout — it calculates height
 *   to fill the viewport minus the sidebar/mobile header
 * - The chat terminal manages its own WebSocket lifecycle
 * - If the agent stops while chatting, the WebSocket will receive an
 *   error from the backend — the terminal handles this gracefully
 * - Do NOT wrap ChatTerminal in additional scroll containers
 *
 * Last Modified: v1.0.0 - Initial chat page for Phase 2
 * ============================================
 */

'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useNodeDetail } from '@/hooks/useNodes';
import { useAgentStatus } from '@/hooks/useAgent';
import ChatTerminal from '@/components/dashboard/ChatTerminal';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';

// ============================================
// Pre-Chat Gate Component
// ============================================

interface PreChatGateProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function PreChatGate({ title, description, icon, action }: PreChatGateProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
      <Card variant="outline" padding="lg" className="max-w-md text-center">
        <div className="py-8">
          <div className="
            w-16 h-16 mx-auto mb-4 rounded-2xl
            bg-gradient-to-br from-purple-500/20 to-pink-500/20
            flex items-center justify-center
          ">
            {icon}
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
          <p className="text-sm text-gray-400 mb-6">{description}</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={() => router.back()}>
              Go Back
            </Button>
            {action && (
              <Button variant="primary" onClick={action.onClick}>
                {action.label}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================
// Loading State
// ============================================

function ChatLoading() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Preparing secure tunnel...</p>
      </div>
    </div>
  );
}

// ============================================
// Chat Page Component
// ============================================

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params.id as string;

  const { node, isLoading: nodeLoading, isError: nodeError } = useNodeDetail(nodeId);
  const { agentStatus, isLoading: agentLoading } = useAgentStatus(nodeId);

  // ---- Loading ----
  if (nodeLoading || agentLoading) {
    return <ChatLoading />;
  }

  // ---- Node not found ----
  if (nodeError || !node) {
    return (
      <PreChatGate
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

  // ---- Node offline ----
  if (node.status !== 'online') {
    return (
      <PreChatGate
        title="Node Offline"
        description={`"${node.name}" is currently ${node.status}. The node must be online to use the AI terminal.`}
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

  // ---- Agent not running ----
  if (agentStatus !== 'running') {
    const statusText = agentStatus
      ? `is currently "${agentStatus}"`
      : 'is not installed';

    return (
      <PreChatGate
        title="Agent Not Ready"
        description={`The OpenClaw AI engine ${statusText} on "${node.name}". Please start the agent before using the terminal.`}
        icon={
          <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        }
        action={{
          label: 'Manage Agent',
          onClick: () => router.push(`/dashboard/nodes/${nodeId}`),
        }}
      />
    );
  }

  // ---- All checks passed — render terminal ----
  return (
    <div className="h-[calc(100vh-2rem)] lg:h-screen -mx-4 sm:-mx-6 lg:-mx-8 -my-4 sm:-my-6 lg:-my-8">
      <ChatTerminal nodeId={nodeId} />
    </div>
  );
}
