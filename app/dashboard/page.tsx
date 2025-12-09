/**
 * ============================================
 * AeroNyx Dashboard Overview Page
 * ============================================
 * File Path: app/dashboard/page.tsx
 * 
 * Last Modified: v1.0.1 - Fixed re-render issues
 * ============================================
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useNodes, useAggregatedStats, useDeleteNode } from '@/hooks/useNodes';
import { useAuthStore } from '@/stores/authStore';
import { Node } from '@/types';
import { truncateAddress } from '@/lib/api';
import Card, { StatCard, EmptyState } from '@/components/common/Card';
import Button from '@/components/common/Button';
import NodeCard, { NodeCardSkeleton } from '@/components/dashboard/NodeCard';
import AddNodeModal from '@/components/dashboard/AddNodeModal';
import { ConfirmDialog } from '@/components/common/Modal';

// ============================================
// Page Header Component
// ============================================

function PageHeader({ onAddNode }: { onAddNode: () => void }) {
  const walletAddress = useAuthStore((state) => state.walletAddress);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Welcome back, {truncateAddress(walletAddress || '', 6)}
        </p>
      </div>
      <Button
        variant="primary"
        onClick={onAddNode}
        leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        }
      >
        Add Node
      </Button>
    </div>
  );
}

// ============================================
// Stats Grid Component
// ============================================

function StatsGrid() {
  const { stats, isLoading } = useAggregatedStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard
        label="Total Nodes"
        value={stats.totalNodes}
        subValue={`${stats.onlineNodes} online`}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        }
      />
      <StatCard
        label="Active Sessions"
        value={stats.activeSessions.toLocaleString()}
        subValue={`${stats.totalSessions.toLocaleString()} total`}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      />
      <StatCard
        label="Total Traffic"
        value={`${stats.totalTrafficGB.toFixed(1)} GB`}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        }
      />
      <StatCard
        label="Avg Uptime"
        value={`${stats.avgUptime.toFixed(1)}h`}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
}

// ============================================
// Dashboard Page Component
// ============================================

export default function DashboardPage() {
  const { nodes, isLoading } = useNodes();
  const deleteNodeMutation = useDeleteNode();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<Node | null>(null);

  // Memoize handlers to prevent re-renders
  const handleOpenAddModal = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
  }, []);

  const handleSetNodeToDelete = useCallback((node: Node) => {
    setNodeToDelete(node);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setNodeToDelete(null);
  }, []);

  // Handle node deletion
  const handleDeleteNode = useCallback(async () => {
    if (!nodeToDelete) return;
    
    try {
      await deleteNodeMutation.mutateAsync(nodeToDelete.id);
      setNodeToDelete(null);
    } catch (err) {
      console.error('Failed to delete node:', err);
    }
  }, [nodeToDelete, deleteNodeMutation]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader onAddNode={handleOpenAddModal} />

      {/* Stats Grid */}
      <StatsGrid />

      {/* Nodes Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Your Nodes</h2>
          {nodes.length > 0 && (
            <span className="text-sm text-gray-500">
              {nodes.length} node{nodes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        {isLoading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <NodeCardSkeleton key={i} />
            ))}
          </div>
        ) : nodes.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            }
            title="No Nodes Yet"
            description="Get started by adding your first node to the network. Generate a registration code and run the setup command on your server."
            action={
              <Button variant="primary" onClick={handleOpenAddModal}>
                Add Your First Node
              </Button>
            }
          />
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {nodes.map((node) => (
              <NodeCard key={node.id} node={node} onDelete={handleSetNodeToDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {nodes.length > 0 && (
        <Card variant="outline" padding="md" className="mt-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-white">Need more capacity?</h3>
              <p className="text-sm text-gray-400">Add more nodes to increase your network contribution and earnings.</p>
            </div>
            <Button variant="secondary" onClick={handleOpenAddModal}>
              Add Another Node
            </Button>
          </div>
        </Card>
      )}

      {/* Add Node Modal */}
      <AddNodeModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!nodeToDelete}
        onClose={handleCancelDelete}
        onConfirm={handleDeleteNode}
        title="Delete Node"
        message={`Are you sure you want to delete "${nodeToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteNodeMutation.isPending}
      />
    </div>
  );
}
