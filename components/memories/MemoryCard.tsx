/**
 * ============================================
 * AeroNyx Privacy Network - Memory Card
 * ============================================
 * File Path: components/memories/MemoryCard.tsx
 *
 * Creation Reason: Single memory record card for the Memory Explorer.
 *
 * Modification Reason (v1.1.0):
 *   - Uses MemoryDisplayRecord (unified type with timestamp_ms)
 *   - Supports records from both overview (Unix seconds) and search (ISO string)
 *   - All timestamp handling uses timestamp_ms (already in milliseconds)
 *
 * Main Functionality:
 *   - Memory content (truncated line-clamp-3)
 *   - Layer badge with color coding
 *   - Topic tags as chips
 *   - Metadata: time, access count, feedback
 *   - Search relevance score (when present)
 *   - Actions: Edit, Delete (with inline confirmation)
 *   - Mobile: actions always visible; Desktop: actions on hover
 *
 * Dependencies:
 *   - types/memory.ts (MemoryDisplayRecord, MEMORY_LAYER_CONFIG)
 *   - lib/api.ts (formatRelativeTime)
 *
 * Last Modified: v1.1.0 - Use MemoryDisplayRecord unified type
 * Previous: v1.0.0 - Initial memory card
 * ============================================
 */

'use client';

import React, { useState, useCallback, memo } from 'react';
import { MemoryDisplayRecord, MEMORY_LAYER_CONFIG } from '@/types/memory';

// ============================================
// Props
// ============================================

interface MemoryCardProps {
  record: MemoryDisplayRecord;
  onEdit: (record: MemoryDisplayRecord) => void;
  onDelete: (recordId: string) => void;
  isDeleting?: boolean;
}

// ============================================
// Helpers
// ============================================

function formatRelTime(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(ms).toLocaleDateString();
}

// ============================================
// Layer Badge
// ============================================

function LayerBadge({ layer }: { layer: MemoryDisplayRecord['layer'] }) {
  const config = MEMORY_LAYER_CONFIG[layer];
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium
        ${config.bgColor} ${config.textColor} border ${config.borderColor}
      `}
    >
      <span className="leading-none">{config.icon}</span>
      <span>{config.labelEn}</span>
    </span>
  );
}

// ============================================
// Score Badge
// ============================================

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80
    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
    : pct >= 50
    ? 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30'
    : 'text-gray-400 bg-gray-500/15 border-gray-500/30';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${color}`}>
      {pct}% match
    </span>
  );
}

// ============================================
// Main Component
// ============================================

function MemoryCardComponent({ record, onEdit, onDelete, isDeleting }: MemoryCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = useCallback(() => {
    if (confirmDelete) {
      onDelete(record.record_id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }, [confirmDelete, onDelete, record.record_id]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  const handleEdit = useCallback(() => {
    onEdit(record);
  }, [onEdit, record]);

  return (
    <div
      className={`
        group relative px-4 py-3 rounded-xl
        bg-white/[0.02] border border-white/[0.06]
        hover:bg-white/[0.04] hover:border-white/[0.10]
        transition-all duration-200
        ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <LayerBadge layer={record.layer} />
          {record.score !== undefined && <ScoreBadge score={record.score} />}
        </div>
        <span className="text-[11px] text-gray-600 flex-shrink-0">
          {formatRelTime(record.timestamp_ms)}
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-gray-200 leading-relaxed line-clamp-3 mb-2 break-words">
        {record.content}
      </p>

      {/* Tags */}
      {record.topic_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {record.topic_tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[11px] text-gray-500"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Stats */}
        <div className="flex items-center gap-3 text-[11px] text-gray-600">
          <span className="flex items-center gap-1" title="Times accessed">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {record.access_count}
          </span>
          {(record.positive_feedback > 0 || record.negative_feedback > 0) && (
            <span className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5 text-emerald-500/70">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
                {record.positive_feedback}
              </span>
              {record.negative_feedback > 0 && (
                <span className="flex items-center gap-0.5 text-red-500/70">
                  <svg className="w-3 h-3 rotate-180" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                  </svg>
                  {record.negative_feedback}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {confirmDelete ? (
            <>
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                onClick={handleCancelDelete}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEdit}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 active:bg-white/10 transition-colors"
                aria-label="Edit memory"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
              <button
                onClick={handleDeleteClick}
                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-colors"
                aria-label="Delete memory"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(MemoryCardComponent);
