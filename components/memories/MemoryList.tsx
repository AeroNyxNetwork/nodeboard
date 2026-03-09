/**
 * ============================================
 * AeroNyx Privacy Network - Memory List
 * ============================================
 * File Path: components/memories/MemoryList.tsx
 *
 * Modification Reason (v1.2.0):
 *   - Fixed TypeScript union type inference issue with onEdit callback
 *   - Separated grouped and flat rendering into distinct components
 *     to avoid union destructuring issues
 *   - Both modes accept onEdit as (record: MemoryDisplayRecord) => void
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
 * Last Modified: v1.2.0 - Fixed union type inference for onEdit
 * Previous: v1.1.0 - Aligned with actual API response format
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

  return (
    <div className="mb-4">
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
// Grouped List (overview mode)
// ============================================

interface GroupedListProps extends MemoryListCallbacks {
  overview: MemoryOverviewData;
}

function GroupedList({ overview, onEdit, onDelete, deletingId }: GroupedListProps) {
  return (
    <div>
      {MEMORY_LAYERS_ORDERED.map((layer) => {
        const count = overview.by_layer[layer] ?? 0;
        const rawRecords = overview.recent_by_layer[layer] ?? [];
        const displayRecords = rawRecords.map((r) => toDisplayRecord(r, layer));

        return (
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
        );
      })}
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
