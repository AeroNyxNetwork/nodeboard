/**
 * ============================================
 * AeroNyx Privacy Network - Memory List
 * ============================================
 * File Path: components/memories/MemoryList.tsx
 *
 * Creation Reason: Displays memories grouped by layer with collapsible sections.
 *   Used as the main content area in the Memory Explorer overview.
 *
 * Main Functionality:
 *   - Groups memories by layer (identity → knowledge → episode → archive)
 *   - Each layer section is collapsible with count badge
 *   - Archive layer collapsed by default
 *   - Empty state per layer when no records exist
 *   - Skeleton loader during fetch
 *   - Also supports flat list mode for search results (no grouping)
 *
 * Dependencies:
 *   - types/memory.ts (MemoryOverviewData, MemoryRecord, MEMORY_LAYER_CONFIG, etc.)
 *   - components/memories/MemoryCard.tsx
 *
 * ⚠️ Important Note for Next Developer:
 * - Two modes: "grouped" (overview) and "flat" (search results)
 * - In grouped mode, receives MemoryOverviewData
 * - In flat mode, receives MemoryRecord[] directly
 * - Collapsed state is local to this component (not persisted)
 *
 * Last Modified: v1.0.0 - Initial memory list for Memory Explorer
 * ============================================
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  MemoryOverviewData,
  MemoryRecord,
  MemoryLayer,
  MEMORY_LAYER_CONFIG,
  MEMORY_LAYERS_ORDERED,
} from '@/types/memory';
import MemoryCard from './MemoryCard';

// ============================================
// Props
// ============================================

interface MemoryListGroupedProps {
  mode: 'grouped';
  overview: MemoryOverviewData;
  onEdit: (record: MemoryRecord) => void;
  onDelete: (recordId: string) => void;
  deletingId: string | null;
}

interface MemoryListFlatProps {
  mode: 'flat';
  records: MemoryRecord[];
  onEdit: (record: MemoryRecord) => void;
  onDelete: (recordId: string) => void;
  deletingId: string | null;
  emptyMessage?: string;
}

type MemoryListProps = MemoryListGroupedProps | MemoryListFlatProps;

// ============================================
// Skeleton
// ============================================

export function MemoryListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-6 w-32 bg-white/5 rounded mb-3" />
          <div className="space-y-2">
            <div className="h-24 bg-white/[0.03] rounded-xl" />
            <div className="h-24 bg-white/[0.03] rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Layer Section (collapsible)
// ============================================

interface LayerSectionProps {
  layer: MemoryLayer;
  count: number;
  records: MemoryRecord[];
  defaultCollapsed: boolean;
  onEdit: (record: MemoryRecord) => void;
  onDelete: (recordId: string) => void;
  deletingId: string | null;
}

function LayerSection({
  layer,
  count,
  records,
  defaultCollapsed,
  onEdit,
  onDelete,
  deletingId,
}: LayerSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const config = MEMORY_LAYER_CONFIG[layer];

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return (
    <div className="mb-4">
      {/* Section header */}
      <button
        onClick={toggle}
        className="
          w-full flex items-center justify-between gap-2
          px-3 py-2 rounded-lg
          hover:bg-white/[0.03] active:bg-white/[0.05]
          transition-colors text-left
        "
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{config.icon}</span>
          <span className="text-sm font-medium text-white">{config.labelEn}</span>
          <span className={`
            px-1.5 py-0.5 rounded-md text-[11px] font-medium
            ${config.bgColor} ${config.textColor}
          `}>
            {count}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
            collapsed ? '' : 'rotate-180'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Records */}
      {!collapsed && (
        <div className="mt-2 space-y-2">
          {records.length === 0 ? (
            <p className="text-sm text-gray-600 px-3 py-4 text-center">
              No {config.labelEn.toLowerCase()} memories yet
            </p>
          ) : (
            records.map((record) => (
              <MemoryCard
                key={record.record_id}
                record={record}
                onEdit={onEdit}
                onDelete={onDelete}
                isDeleting={deletingId === record.record_id}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function MemoryList(props: MemoryListProps) {
  const { mode, onEdit, onDelete, deletingId } = props;

  // Flat mode — search results
  if (mode === 'flat') {
    const { records, emptyMessage } = props;

    if (records.length === 0) {
      return (
        <div className="py-12 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm text-gray-500">
            {emptyMessage || 'No memories found. Your AI agent is still learning.'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {records.map((record) => (
          <MemoryCard
            key={record.record_id}
            record={record}
            onEdit={onEdit}
            onDelete={onDelete}
            isDeleting={deletingId === record.record_id}
          />
        ))}
      </div>
    );
  }

  // Grouped mode — overview
  const { overview } = props;

  return (
    <div>
      {MEMORY_LAYERS_ORDERED.map((layer) => {
        const layerData = overview.by_layer[layer];
        return (
          <LayerSection
            key={layer}
            layer={layer}
            count={layerData?.count ?? 0}
            records={layerData?.records ?? []}
            defaultCollapsed={MEMORY_LAYER_CONFIG[layer].defaultCollapsed}
            onEdit={onEdit}
            onDelete={onDelete}
            deletingId={deletingId}
          />
        );
      })}
    </div>
  );
}
