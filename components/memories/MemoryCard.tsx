/**
 * ============================================
 * AeroNyx Privacy Network - Memory Card
 * ============================================
 * File Path: components/memories/MemoryCard.tsx
 *
 * Modification Reason (v3.0.0):
 *   Second rewrite. v2.0.0 tried responsive row/card split with CSS
 *   show/hide — too much duplication, desktop row tried to cram
 *   everything on one line (tags + stats + time + actions + chevron),
 *   resulting in visual noise.
 *
 *   v3.0.0 principles (inspired by Linear's issue rows):
 *   - ONE component, not two — responsive via spacing/wrapping
 *   - Two-line structure everywhere:
 *       Line 1: Content text (full width, single-line truncate on desktop,
 *               multi-line on mobile via responsive line-clamp)
 *       Line 2: Tags + metadata + actions (always visible, muted)
 *   - Actions (Edit / Forget) are ALWAYS visible as text buttons,
 *     not icon-only hover ghosts. Users must know they can act.
 *   - Two-click delete preserved with 3s auto-cancel
 *   - Search score shown inline when present
 *   - No expand/collapse — what you see is what you get.
 *     Full content is in the edit sheet.
 *
 * Previous (v2.0.0):
 *   Desktop compact row with click-to-expand + Mobile card.
 *   Two separate components with CSS show/hide.
 *
 * Dependencies:
 *   - types/memory.ts (MemoryDisplayRecord, MEMORY_LAYER_CONFIG)
 *
 * ⚠️ Important Note for Next Developer:
 * - Actions are text buttons ("Edit" / "Forget"), not icons.
 *   This is intentional — icons require learning, text is instant.
 * - Two-click delete: first click shows "Forget?", second confirms.
 *   Auto-cancels after 3 seconds. Don't simplify to one click.
 * - memo() is critical — parent re-renders on toast/search state changes
 * - Content truncation is CSS line-clamp, not JS — respects font rendering
 *
 * Last Modified: v3.0.0 - Two-line layout, always-visible actions
 * Previous: v2.0.0 - Desktop row / Mobile card responsive split
 * ============================================
 */

'use client';

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
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
  if (seconds < 0) return 'now';
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ============================================
// Main Component
// ============================================

function MemoryCardComponent({
  record,
  onEdit,
  onDelete,
  isDeleting = false,
}: MemoryCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = MEMORY_LAYER_CONFIG[record.layer];

  // Auto-cancel delete confirmation after 3 seconds
  useEffect(() => {
    if (confirmDelete) {
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
      return () => {
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      };
    }
  }, [confirmDelete]);

  const handleEdit = useCallback(() => {
    onEdit(record);
  }, [onEdit, record]);

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

  // Truncated tags (max 3 on desktop, 2 on mobile)
  const visibleTags = record.topic_tags.slice(0, 3);
  const extraTagCount = Math.max(0, record.topic_tags.length - 3);

  return (
    <div
      className={`
        px-3 py-2.5 sm:px-4 sm:py-3
        rounded-lg border border-transparent
        hover:bg-white/[0.02] hover:border-white/[0.06]
        transition-colors duration-150
        ${isDeleting ? 'opacity-40 pointer-events-none' : ''}
      `}
    >
      {/* Line 1: Layer icon + Content */}
      <div className="flex items-start gap-2.5 mb-1.5">
        {/* Layer icon */}
        <span
          className="text-sm leading-none mt-0.5 flex-shrink-0"
          title={config.labelEn}
        >
          {config.icon}
        </span>

        {/* Content — 1 line on desktop, 2 lines on mobile */}
        <p className="
          text-sm text-gray-200 leading-relaxed
          line-clamp-2 sm:line-clamp-1
          break-words select-text min-w-0 flex-1
        ">
          {record.content}
        </p>
      </div>

      {/* Line 2: Tags + Metadata + Actions */}
      <div className="flex items-center gap-2 ml-7 flex-wrap">
        {/* Tags */}
        {visibleTags.map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[10px] text-gray-500 border border-white/[0.05]"
          >
            {tag}
          </span>
        ))}
        {extraTagCount > 0 && (
          <span className="text-[10px] text-gray-600">+{extraTagCount}</span>
        )}

        {/* Search score */}
        {record.score !== undefined && (
          <span className={`
            px-1.5 py-0.5 rounded text-[10px] font-medium border
            ${record.score >= 0.8
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : record.score >= 0.5
                ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                : 'text-gray-400 bg-gray-500/10 border-gray-500/20'
            }
          `}>
            {Math.round(record.score * 100)}%
          </span>
        )}

        {/* Recalls + Time */}
        <span className="text-[11px] text-gray-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {record.access_count}
        </span>

        <span className="text-[11px] text-gray-600">
          {formatRelTime(record.timestamp_ms)}
        </span>

        {/* Spacer pushes actions right */}
        <span className="flex-1" />

        {/* Actions — always visible */}
        {confirmDelete ? (
          <span className="flex items-center gap-1.5">
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Confirm?'}
            </button>
            <span className="text-gray-700">·</span>
            <button
              onClick={handleCancelDelete}
              className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <button
              onClick={handleEdit}
              className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Edit
            </button>
            <span className="text-gray-700">·</span>
            <button
              onClick={handleDeleteClick}
              className="text-[11px] text-gray-500 hover:text-red-400 transition-colors"
            >
              Forget
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(MemoryCardComponent);
