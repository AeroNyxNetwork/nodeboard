/**
 * ============================================
 * AeroNyx Privacy Network - Memory Edit Sheet
 * ============================================
 * File Path: components/memories/MemoryEditSheet.tsx
 *
 * Modification Reason (v1.1.0):
 *   - Uses MemoryDisplayRecord instead of MemoryRecord
 *   - Works with both overview records and search/detail records
 *
 * Main Functionality:
 *   - Content textarea (required)
 *   - Layer selector (dropdown)
 *   - Tags input (comma-separated, chip display)
 *   - Source display (read-only for existing records)
 *   - Save triggers create or edit (forget + remember)
 *   - Desktop: centered modal. Mobile: bottom sheet.
 *
 * Dependencies:
 *   - types/memory.ts (MemoryDisplayRecord, MemoryLayer, etc.)
 *
 * Last Modified: v1.1.0 - Use MemoryDisplayRecord
 * Previous: v1.0.0 - Initial edit sheet
 * ============================================
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MemoryDisplayRecord,
  MemoryLayer,
  MemoryRememberRequest,
  MEMORY_LAYER_CONFIG,
  MEMORY_LAYERS_ORDERED,
} from '@/types/memory';

// ============================================
// Props
// ============================================

interface MemoryEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MemoryRememberRequest, oldRecordId?: string) => Promise<void>;
  /** Existing record for edit mode; null for create mode */
  record: MemoryDisplayRecord | null;
  isSaving: boolean;
  error: string | null;
}

// ============================================
// Tag Input
// ============================================

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

function TagInput({ tags, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback((value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  }, [tags, onChange]);

  const removeTag = useCallback((tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  }, [tags, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    }
    if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }, [inputValue, tags, addTag, removeTag]);

  return (
    <div
      className="
        flex flex-wrap items-center gap-1.5
        px-3 py-2 rounded-xl
        bg-white/[0.04] border border-white/[0.08]
        focus-within:border-purple-500/30
        transition-colors cursor-text
      "
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="
            inline-flex items-center gap-1 px-2 py-0.5 rounded-md
            bg-purple-500/15 border border-purple-500/25
            text-[12px] text-purple-300
          "
        >
          {tag}
          <button
            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
            className="hover:text-white transition-colors"
            aria-label={`Remove tag ${tag}`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue) addTag(inputValue); }}
        placeholder={tags.length === 0 ? 'Add tags (Enter or comma)' : ''}
        className="flex-1 min-w-[80px] bg-transparent text-sm text-white placeholder-gray-600 outline-none"
      />
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function MemoryEditSheet({
  isOpen,
  onClose,
  onSave,
  record,
  isSaving,
  error,
}: MemoryEditSheetProps) {
  const isEditMode = !!record;

  const [content, setContent] = useState('');
  const [layer, setLayer] = useState<MemoryLayer>('knowledge');
  const [tags, setTags] = useState<string[]>([]);

  // Reset form when record changes or sheet opens
  useEffect(() => {
    if (isOpen) {
      if (record) {
        setContent(record.content);
        setLayer(record.layer);
        setTags([...record.topic_tags]);
      } else {
        setContent('');
        setLayer('knowledge');
        setTags([]);
      }
    }
  }, [isOpen, record]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isSaving, onClose]);

  const handleSave = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const data: MemoryRememberRequest = {
      content: trimmed,
      layer,
      topic_tags: tags,
      source_ai: isEditMode ? record!.source_ai : 'manual',
    };

    await onSave(data, isEditMode ? record!.record_id : undefined);
  }, [content, layer, tags, isEditMode, record, onSave]);

  const canSave = content.trim().length > 0 && !isSaving;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={() => { if (!isSaving) onClose(); }}
      />

      {/* Sheet */}
      <div
        className="
          fixed z-50
          inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2
          sm:-translate-x-1/2 sm:-translate-y-1/2
          w-full sm:max-w-lg
          bg-[#12121A] border-t sm:border border-white/[0.08]
          rounded-t-2xl sm:rounded-2xl
          shadow-2xl
          max-h-[90vh] overflow-y-auto
          supports-[padding:env(safe-area-inset-bottom)]:pb-[env(safe-area-inset-bottom)]
        "
        role="dialog"
        aria-label={isEditMode ? 'Edit memory' : 'Create memory'}
      >
        {/* Handle bar (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/10" />
        </div>

        <div className="px-5 py-4 sm:p-6">
          {/* Title */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">
              {isEditMode ? 'Edit Memory' : 'New Memory'}
            </h2>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What should the AI remember?"
              rows={4}
              disabled={isSaving}
              className="
                w-full px-3 py-2.5 rounded-xl
                bg-white/[0.04] border border-white/[0.08]
                text-sm text-white placeholder-gray-600
                resize-none outline-none
                focus:border-purple-500/30
                disabled:opacity-50
                transition-colors
              "
            />
          </div>

          {/* Layer */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Layer</label>
            <select
              value={layer}
              onChange={(e) => setLayer(e.target.value as MemoryLayer)}
              disabled={isSaving}
              className="
                w-full px-3 py-2.5 rounded-xl
                bg-white/[0.04] border border-white/[0.08]
                text-sm text-white outline-none
                focus:border-purple-500/30 disabled:opacity-50
                transition-colors appearance-none cursor-pointer
              "
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '16px',
              }}
            >
              {MEMORY_LAYERS_ORDERED.map((l) => {
                const c = MEMORY_LAYER_CONFIG[l];
                return (
                  <option key={l} value={l}>
                    {c.icon} {c.labelEn} — {c.description}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Tags</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          {/* Source (edit mode) */}
          {isEditMode && (
            <div className="mb-5">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Source</label>
              <p className="text-sm text-gray-400">{record!.source_ai}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/[0.08] text-sm font-medium text-gray-400 hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-500/20"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : isEditMode ? 'Save Changes' : 'Create Memory'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
