/**
 * ============================================
 * AeroNyx Privacy Network - Memory Card
 * ============================================
 * File Path: components/memories/MemoryCard.tsx
 *
 * Modification Reason (v2.0.0):
 *   Complete redesign for information density + responsive layout:
 *   - Desktop (sm+): Compact single-line row (Linear-style)
 *     • Layer icon | Content (truncated) | Tags | Access count | Time | Actions
 *     • Actions appear on hover
 *     • Click row to expand inline detail (content + metadata)
 *   - Mobile (<sm): Card layout with visible actions
 *     • Stacked: Layer badge + time → Content → Tags → Stats + Actions
 *   - Preserved: two-click delete confirmation, edit callback, score badge
 *
 *   Design philosophy: "every pixel earns its place"
 *   - Removed line-clamp-3 on desktop → single line truncate
 *   - Tags shown inline (max 3, then +N)
 *   - Feedback stats hidden unless non-zero
 *   - Source shown only in expanded detail
 *
 * Previous (v1.1.0):
 *   Uniform card layout for all screen sizes, line-clamp-3 content,
 *   layer badge + score badge top row, tags row, footer with stats + actions.
 *
 * Dependencies:
 *   - types/memory.ts (MemoryDisplayRecord, MEMORY_LAYER_CONFIG)
 *
 * ⚠️ Important Note for Next Developer:
 * - The two-click delete pattern is intentional UX — don't simplify to one click
 * - confirmDelete state resets on mouse leave (desktop) and after 3s timeout
 * - Desktop row is a <button> for keyboard accessibility; Enter expands detail
 * - Mobile card does NOT expand — content is already multi-line
 * - memo() wrapping is critical; parent re-renders on toast state changes
 *
 * Last Modified: v2.0.0 - Responsive row/card redesign
 * Previous: v1.1.0 - Use MemoryDisplayRecord unified type
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
  if (seconds < 0) return 'Just now';
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ============================================
// Score Badge (search results only)
// ============================================

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80
    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
    : pct >= 50
      ? 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30'
      : 'text-gray-400 bg-gray-500/15 border-gray-500/30';

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${color}`}>
      {pct}%
    </span>
  );
}

// ============================================
// Delete Confirmation (shared between layouts)
// ============================================

interface DeleteActionsProps {
  isDeleting: boolean;
  confirmDelete: boolean;
  onDeleteClick: () => void;
  onCancelDelete: () => void;
  onEdit: () => void;
  compact?: boolean;
}

function ActionButtons({
  isDeleting,
  confirmDelete,
  onDeleteClick,
  onCancelDelete,
  onEdit,
  compact = false,
}: DeleteActionsProps) {
  if (confirmDelete) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onDeleteClick}
          disabled={isDeleting}
          className={`
            rounded-lg font-medium bg-red-500/20 text-red-400 border border-red-500/30
            hover:bg-red-500/30 transition-colors disabled:opacity-50
            ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}
          `}
        >
          {isDeleting ? '...' : 'Confirm'}
        </button>
        <button
          onClick={onCancelDelete}
          className={`
            rounded-lg font-medium bg-white/5 text-gray-400 hover:bg-white/10 transition-colors
            ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}
          `}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onEdit}
        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 active:bg-white/10 transition-colors"
        aria-label="Edit memory"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      </button>
      <button
        onClick={onDeleteClick}
        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-colors"
        aria-label="Delete memory"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
    </div>
  );
}

// ============================================
// Desktop Row — Compact, Linear-style
// ============================================

function DesktopRow({
  record,
  onEdit,
  onDelete,
  isDeleting = false,
}: MemoryCardProps) {
  const [expanded, setExpanded] = useState(false);
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

  const handleRowClick = useCallback(() => {
    if (!confirmDelete) setExpanded((e) => !e);
  }, [confirmDelete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick();
    }
  }, [handleRowClick]);

  // Truncated tags for inline display (max 3)
  const visibleTags = record.topic_tags.slice(0, 3);
  const extraTagCount = record.topic_tags.length - 3;

  return (
    <div
      className={`
        group rounded-lg border transition-all duration-150
        ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
        ${expanded
          ? 'bg-white/[0.03] border-white/[0.08]'
          : 'bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/[0.06]'
        }
      `}
      onMouseLeave={() => { if (confirmDelete) setConfirmDelete(false); }}
    >
      {/* Main row */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none"
      >
        {/* Layer icon */}
        <span className="text-sm leading-none flex-shrink-0" title={config.labelEn}>
          {config.icon}
        </span>

        {/* Content — single line truncate */}
        <span className="flex-1 text-sm text-gray-200 truncate min-w-0">
          {record.content}
        </span>

        {/* Score (search only) */}
        {record.score !== undefined && (
          <ScoreBadge score={record.score} />
        )}

        {/* Inline tags (desktop) */}
        {visibleTags.length > 0 && (
          <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
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
          </div>
        )}

        {/* Access count */}
        <span className="flex items-center gap-1 text-[11px] text-gray-600 flex-shrink-0" title="Times recalled">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {record.access_count}
        </span>

        {/* Time */}
        <span className="text-[11px] text-gray-600 flex-shrink-0 w-10 text-right">
          {formatRelTime(record.timestamp_ms)}
        </span>

        {/* Actions (hover visible) */}
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionButtons
            isDeleting={isDeleting}
            confirmDelete={confirmDelete}
            onDeleteClick={handleDeleteClick}
            onCancelDelete={handleCancelDelete}
            onEdit={handleEdit}
            compact
          />
        </div>

        {/* Expand chevron */}
        <svg
          className={`w-3.5 h-3.5 text-gray-600 flex-shrink-0 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 ml-8 border-t border-white/[0.04] mt-0">
          <div className="pt-3 space-y-2.5">
            {/* Full content */}
            <p className="text-sm text-gray-300 leading-relaxed break-words select-text">
              {record.content}
            </p>

            {/* All tags */}
            {record.topic_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
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

            {/* Metadata row */}
            <div className="flex items-center gap-4 text-[11px] text-gray-500">
              <span>
                Layer: <span className={config.textColor}>{config.labelEn}</span>
              </span>
              <span>Source: {record.source_ai}</span>
              <span>Accessed {record.access_count} time{record.access_count !== 1 ? 's' : ''}</span>
              {(record.positive_feedback > 0 || record.negative_feedback > 0) && (
                <span className="flex items-center gap-2">
                  {record.positive_feedback > 0 && (
                    <span className="flex items-center gap-0.5 text-emerald-500/70">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                      </svg>
                      {record.positive_feedback}
                    </span>
                  )}
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
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Mobile Card — Stacked, touch-friendly
// ============================================

function MobileCard({
  record,
  onEdit,
  onDelete,
  isDeleting = false,
}: MemoryCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = MEMORY_LAYER_CONFIG[record.layer];

  useEffect(() => {
    if (confirmDelete) {
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
      return () => {
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      };
    }
  }, [confirmDelete]);

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
        px-4 py-3 rounded-xl
        bg-white/[0.02] border border-white/[0.06]
        ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      {/* Header: layer + score + time */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium
            ${config.bgColor} ${config.textColor} border ${config.borderColor}
          `}>
            <span className="leading-none">{config.icon}</span>
            <span>{config.labelEn}</span>
          </span>
          {record.score !== undefined && <ScoreBadge score={record.score} />}
        </div>
        <span className="text-[11px] text-gray-600 flex-shrink-0">
          {formatRelTime(record.timestamp_ms)}
        </span>
      </div>

      {/* Content — multi-line on mobile */}
      <p className="text-sm text-gray-200 leading-relaxed line-clamp-3 mb-2 break-words select-text">
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

      {/* Footer: stats + actions (always visible on mobile) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-gray-600">
          <span className="flex items-center gap-1" title="Times recalled">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {record.access_count}
          </span>
          {record.positive_feedback > 0 && (
            <span className="flex items-center gap-0.5 text-emerald-500/70">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              {record.positive_feedback}
            </span>
          )}
        </div>

        <ActionButtons
          isDeleting={isDeleting}
          confirmDelete={confirmDelete}
          onDeleteClick={handleDeleteClick}
          onCancelDelete={handleCancelDelete}
          onEdit={handleEdit}
        />
      </div>
    </div>
  );
}

// ============================================
// Main Component — responsive switch
// ============================================
// Uses CSS to show/hide rather than JS media query
// to avoid hydration mismatch with SSR.
// ============================================

function MemoryCardComponent(props: MemoryCardProps) {
  return (
    <>
      {/* Desktop: hidden on mobile, visible on sm+ */}
      <div className="hidden sm:block">
        <DesktopRow {...props} />
      </div>
      {/* Mobile: visible on mobile, hidden on sm+ */}
      <div className="sm:hidden">
        <MobileCard {...props} />
      </div>
    </>
  );
}

export default memo(MemoryCardComponent);
