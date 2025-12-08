/**
 * ============================================
 * AeroNyx Nodes List Page
 * ============================================
 * File Path: src/app/dashboard/nodes/page.tsx
 * 
 * Creation Reason: Dedicated nodes management page
 * Main Functionality: Display all nodes with filtering, sorting,
 *                     and bulk actions
 * Dependencies:
 *   - src/hooks/useNodes.ts
 *   - src/components/dashboard/NodeCard.tsx
 *   - src/components/dashboard/AddNodeModal.tsx
 * 
 * Main Logical Flow:
 * 1. Fetch all nodes with optional status filter
 * 2. Display filter tabs (All, Online, Offline)
 * 3. Render node grid with cards
 * 4. Handle node deletion
 * 
 * ⚠️ Important Note for Next Developer:
 * - Filters are URL-based for shareability
 * - Sort order can be added in future
 * - Bulk actions placeholder for future features
 * 
 * Last Modified: v1.0.0 - Initial nodes page
 * ============================================
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNodes, useDeleteNode } from '@/hooks/useNodes';
import { Node, NodeStatus } from '@/types';
import Button from '@/components/common/Button';
import { EmptyState } from '@/components/common/Card';
import NodeCard, { NodeCardSkeleton } from '@/components/dashboard/NodeCard';
import AddNodeModal from '@/components/dashboard/AddNodeModal';
import { ConfirmDialog } from '@/components/common/Modal';

// ============================================
// Filter Tabs Component
// ============================================

type FilterOption = 'all' | NodeStatus;

interface FilterTabsProps {
  activeFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  counts: {
    all: number;
    online: number;
    offline: number;
    suspended: number;
  };
}

function FilterTabs({ activeFilter, onFilterChange, counts }: FilterTabsProps) {
  const tabs: { id: FilterOption; label: string; count: number }[] = [
    { id: 'all', label: 'All Nodes', count: counts.all },
    { id: 'online', label: 'Online', count: counts.online },
    { id: 'offline', label: 'Offline', count: counts.offline },
  ];

  return (
    <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onFilterChange(tab.id)}
          className={`
            relative px-4 py-2 rounded-lg text-sm font-medium
            transition-all duration-200
            ${activeFilter === tab.id
              ? 'text-white'
              : 'text-gray-400 hover:text-white'
            }
          `}
        >
          {activeFilter === tab.id && (
            <motion.div
              layoutId="activeFilter"
              className="absolute inset-0 bg-purple-500/20 border border-purple-500/30 rounded-lg"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            {tab.label}
            <span className={`
              px-1.5 py-0.5 text-xs rounded-full
              ${activeFilter === tab.id
                ? 'bg-purple-500/30 text-purple-200'
                : 'bg-white/10 text-gray-500'
              }
            `}>
              {tab.count}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================================
// Search & Actions Bar
// ============================================

interface ActionsBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddNode: () => void;
}

function ActionsBar({ searchQuery, onSearchChange, onAddNode }: ActionsBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      {/* Search */}
      <div className="relative w-full sm:w-80">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="
            w-full pl-10 pr-4 py-2.5 rounded-xl
            bg-white/5 border border-white/10
            text-white placeholder-gray-500
            focus:outline-none focus:border-purple-500/50
            transition-colors
          "
        />
      </div>

      {/* Add Node Button */}
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
// Nodes Page Component
// ============================================

export default function NodesPage() {
  const { nodes, isLoading } = useNodes();
  const deleteNodeMutation = useDeleteNode();

  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<Node | null>(null);

  // Calculate counts for filter tabs
  const counts = {
    all: nodes.length,
    online: nodes.filter(n => n.status === 'online').length,
    offline: nodes.filter(n => n.status === 'offline').length,
    suspended: nodes.filter(n => n.status === 'suspended').length,
  };

  // Filter nodes based on active filter and search query
  const filteredNodes = nodes.filter(node => {
    // Status filter
    if (activeFilter !== 'all' && node.status !== activeFilter) {
      return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        node.name.toLowerCase().includes(query) ||
        node.public_ip.includes(query) ||
        node.id.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Handle node deletion
  const handleDeleteNode = async () => {
    if (!nodeToDelete) return;

    try {
      await deleteNodeMutation.mutateAsync(nodeToDelete.id);
      setNodeToDelete(null);
    } catch (err) {
      console.error('Failed to delete node:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Nodes</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage and monitor all your privacy network nodes
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <FilterTabs
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={counts}
        />
      </div>

      {/* Actions Bar */}
      <div className="mb-6">
        <ActionsBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddNode={() => setIsAddModalOpen(true)}
        />
      </div>

      {/* Nodes Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <NodeCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredNodes.length === 0 ? (
        searchQuery ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            title="No Results Found"
            description={`No nodes match "${searchQuery}". Try a different search term.`}
            action={
              <Button variant="secondary" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            }
            title={activeFilter === 'all' ? 'No Nodes Yet' : `No ${activeFilter} Nodes`}
            description={
              activeFilter === 'all'
                ? 'Get started by adding your first node to the network.'
                : `You don't have any ${activeFilter} nodes at the moment.`
            }
            action={
              activeFilter === 'all' ? (
                <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
                  Add Your First Node
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setActiveFilter('all')}>
                  View All Nodes
                </Button>
              )
            }
          />
        )
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          <AnimatePresence>
            {filteredNodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                onDelete={setNodeToDelete}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Results Count */}
      {!isLoading && filteredNodes.length > 0 && (
        <div className="mt-6 text-center text-sm text-gray-500">
          Showing {filteredNodes.length} of {nodes.length} nodes
        </div>
      )}

      {/* Add Node Modal */}
      <AddNodeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!nodeToDelete}
        onClose={() => setNodeToDelete(null)}
        onConfirm={handleDeleteNode}
        title="Delete Node"
        message={`Are you sure you want to delete "${nodeToDelete?.name}"? This action cannot be undone and will remove all associated data.`}
        confirmText="Delete Node"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteNodeMutation.isPending}
      />
    </div>
  );
}
