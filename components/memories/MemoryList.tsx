/**
 * ============================================
 * AeroNyx Privacy Network - Memory List
 * ============================================
 * File Path: components/memories/MemoryList.tsx
 *
 * Modification Reason (v2.0.0):
 *   - Added useMemo for GroupedList record mapping (fixes #12 unnecessary re-maps)
 *   - Tightened spacing to match new compact MemoryCard v2.0.0
 *   - Layer section headers simplified: icon + name + count, minimal chrome
 *   - Collapse/expand with smooth visual, keyboard accessible
 *   - No functional changes to flat list mode
 *
 * Previous (v1.2.0):
 *   Fixed TypeScript union type inference issue with onEdit callback.
 *   Separated grouped and flat rendering into distinct components.
 *
 * Main Functionality:
 *   - Groups memories by layer (identity → knowledge → episode → archive)
 *   - Each layer section is collapsible with count badge
 *   - Archive layer collapsed by default
 *   - Flat list mode for search results
 *   - Skeleton loader during fetch
 *
 * Dependencies:
 *   - types/memory.ts
 *   - components/memories/MemoryCard.tsx
 *
 * ⚠️ Important Note for Next Developer:
 * - GroupedList now uses useMemo per layer — invalidates only when overview changes
 * - The MemoryListProps union type requires explicit mode discrimination
 * - MemoryCard v2.0.0 renders different layouts for desktop/mobile internally
 *
 * Last Modified: v2.0.0 - useMemo optimization + spacing for new MemoryCard
 * Previous: v1.2.0 - Fixed union type inference for onEdit
 * ============================================
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  MemoryOverviewData,
  MemoryRecord,
  MemoryDisplayRecord,
  MemoryLayer,
  MEMORY_LAYER_CONFIG,
  MEMORY_LAYERS_ORDERED,
  toDisplayRecord,
  fullRecordToDisplay,
} from '@/types/memory';
import MemoryCard from './MemoryCard';

// ============================================
// Shared callback types
// ============================================

interface MemoryListCallbacks {
  onEdit: (record: MemoryDisplayRecord) => void;
  onDelete: (recordId: string) => void;
  deletingId: string | null;
}

// ============================================
// Skeleton
// ============================================

export function MemoryListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-5 w-28 bg-white/5 rounded mb-2" />
          <div className="space-y-1.5">
            <div className="h-10 bg-white/[0.03] rounded-lg" />
            <div className="h-10 bg-white/[0.03] rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Layer Section (collapsible)
// ============================================

interface LayerSectionProps extends MemoryListCallbacks {
  layer: MemoryLayer;
  count: number;
  records: MemoryDisplayRecord[];
  defaultCollapsed: boolean;
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  }, [toggle]);

  return (
    <div className="mb-3">
      {/* Section header */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className="
          flex items-center justify-between gap-2
          px-2 py-1.5 rounded-lg
          hover:bg-white/[0.03] active:bg-white/[0.05]
          transition-colors cursor-pointer select-none
        "
      >
        <div className="flex items-center gap-2">
          <span className="text-sm leading-none">{config.icon}</span>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {config.labelEn}
          </span>
          <span className={`
            px-1.5 py-0.5 rounded text-[10px] font-medium
            ${config.bgColor} ${config.textColor}
          `}>
            {count}
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-600 transition-transform duration-200 ${
            collapsed ? '' : 'rotate-180'
          }`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Records */}
      {!collapsed && (
        <div className="mt-1 space-y-1 sm:space-y-0.5">
          {records.length === 0 ? (
            <p className="text-xs text-gray-600 px-2 py-3 text-center">
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
// Grouped List (overview mode)
// ============================================

interface GroupedListProps extends MemoryListCallbacks {
  overview: MemoryOverviewData;
}

function GroupedList({ overview, onEdit, onDelete, deletingId }: GroupedListProps) {
  // Memoize record conversion per layer to avoid re-mapping on unrelated re-renders (#12)
  const layerData = useMemo(() => {
    return MEMORY_LAYERS_ORDERED.map((layer) => {
      const count = overview.by_layer[layer] ?? 0;
      const rawRecords = overview.recent_by_layer[layer] ?? [];
      const displayRecords = rawRecords.map((r) => toDisplayRecord(r, layer));
      return { layer, count, displayRecords };
    });
  }, [overview]);

  return (
    <div>
      {layerData.map(({ layer, count, displayRecords }) => (
        <LayerSection
          key={layer}
          layer={layer}
          count={count}
          records={displayRecords}
          defaultCollapsed={MEMORY_LAYER_CONFIG[layer].defaultCollapsed}
          onEdit={onEdit}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      ))}
    </div>
  );
}

// ============================================
// Flat List (search results mode)
// ============================================

interface FlatListProps extends MemoryListCallbacks {
  records: MemoryRecord[];
  emptyMessage?: string;
}

function FlatList({ records, onEdit, onDelete, deletingId, emptyMessage }: FlatListProps) {
  const displayRecords = useMemo(
    () => records.map(fullRecordToDisplay),
    [records]
  );

  if (displayRecords.length === 0) {
    return (
      <div className="py-12 text-center">
        <svg className="w-10 h-10 mx-auto text-gray-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-sm text-gray-500">
          {emptyMessage || 'No memories found. Your AI agent is still learning.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 sm:space-y-0.5">
      {displayRecords.map((record) => (
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

// ============================================
// Main Component — delegates to Grouped or Flat
// ============================================

type MemoryListProps =
  | { mode: 'grouped'; overview: MemoryOverviewData; onEdit: (record: MemoryDisplayRecord) => void; onDelete: (recordId: string) => void; deletingId: string | null }
  | { mode: 'flat'; records: MemoryRecord[]; onEdit: (record: MemoryDisplayRecord) => void; onDelete: (recordId: string) => void; deletingId: string | null; emptyMessage?: string };

export default function MemoryList(props: MemoryListProps) {
  if (props.mode === 'grouped') {
    return (
      <GroupedList
        overview={props.overview}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
        deletingId={props.deletingId}
      />
    );
  }

  return (
    <FlatList
      records={props.records}
      onEdit={props.onEdit}
      onDelete={props.onDelete}
      deletingId={props.deletingId}
      emptyMessage={props.emptyMessage}
    />
  );
}
