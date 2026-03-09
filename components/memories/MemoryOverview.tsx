/**
 * ============================================
 * AeroNyx Privacy Network - Memory Overview
 * ============================================
 * File Path: components/memories/MemoryOverview.tsx
 *
 * Creation Reason: Main container component for the Memory Explorer.
 *   Combines status card, search, memory list, and edit sheet
 *   into a single cohesive experience.
 *
 * Main Functionality:
 *   - Status card (engine health + layer stats) at the top
 *   - Unified search bar: empty = overview mode, typed = search mode
 *   - "Add Memory" button
 *   - Grouped memory list (overview) or flat results (search)
 *   - Edit/Create sheet (modal on desktop, bottom sheet on mobile)
 *   - Delete with inline confirmation
 *   - Toast notifications for success/error
 *   - Offline node detection with degraded UI
 *
 * Dependencies:
 *   - hooks/useMemories.ts (all memory hooks)
 *   - components/memories/MemoryStatusCard.tsx
 *   - components/memories/MemoryList.tsx
 *   - components/memories/MemoryEditSheet.tsx
 *   - types/memory.ts
 *
 * Main Logical Flow:
 *   1. On mount: parallel fetch status + overview
 *   2. Search bar input triggers debounced search (or clears to overview)
 *   3. Edit button opens sheet with record data
 *   4. "+" button opens sheet empty (create mode)
 *   5. Delete triggers inline confirm → forget mutation → refetch overview
 *   6. Save in sheet triggers remember (or edit=forget+remember) → refetch
 *
 * ⚠️ Important Note for Next Developer:
 * - Search is debounced (500ms) to avoid hammering the API
 * - The component manages search mode vs overview mode via `searchQuery` state
 * - Toast auto-dismisses after 3 seconds
 * - The parent page (memories/page.tsx) handles node status check
 * - This component assumes node is online — offline check is done by parent
 *
 * Last Modified: v1.0.0 - Initial overview for Memory Explorer
 * ============================================
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  useMemoryStatus,
  useMemoryOverview,
  useMemorySearch,
  useForgetMemory,
  useRememberMemory,
  useEditMemory,
} from '@/hooks/useMemories';
import {
  MemoryRecord,
  MemoryRememberRequest,
  MemorySearchRequest,
  MemoryLayer,
} from '@/types/memory';
import MemoryStatusCard from './MemoryStatusCard';
import MemoryList, { MemoryListSkeleton } from './MemoryList';
import MemoryEditSheet from './MemoryEditSheet';

// ============================================
// Props
// ============================================

interface MemoryOverviewProps {
  nodeId: string;
}

// ============================================
// Toast Component (local)
// ============================================

function Toast({ message, variant }: { message: string; variant: 'success' | 'error' }) {
  return (
    <div className={`
      fixed top-6 left-1/2 -translate-x-1/2 z-[60]
      px-4 py-2 rounded-lg text-sm font-medium
      shadow-xl
      ${variant === 'success'
        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
        : 'bg-red-500/20 border border-red-500/30 text-red-300'
      }
    `}>
      {message}
    </div>
  );
}

// ============================================
// Search Bar
// ============================================

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  isSearching: boolean;
  onAddMemory: () => void;
  /** Layer filter for search */
  layerFilter: MemoryLayer | null;
  onLayerFilterChange: (layer: MemoryLayer | null) => void;
}

function SearchBar({ value, onChange, isSearching, onAddMemory, layerFilter, onLayerFilterChange }: SearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      {/* Search input */}
      <div className="relative flex-1">
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
          placeholder="Search memories semantically..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="
            w-full pl-10 pr-4 py-2.5 rounded-xl
            bg-white/[0.04] border border-white/[0.08]
            text-sm text-white placeholder-gray-500
            focus:outline-none focus:border-purple-500/30
            transition-colors
          "
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Layer filter (shown during search) */}
      {value.trim().length > 0 && (
        <select
          value={layerFilter ?? ''}
          onChange={(e) => onLayerFilterChange(e.target.value ? e.target.value as MemoryLayer : null)}
          className="
            px-3 py-2.5 rounded-xl
            bg-white/[0.04] border border-white/[0.08]
            text-sm text-gray-400
            outline-none focus:border-purple-500/30
            transition-colors
            appearance-none cursor-pointer
          "
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '16px',
            paddingRight: '32px',
          }}
        >
          <option value="">All layers</option>
          <option value="identity">🧬 Identity</option>
          <option value="knowledge">📚 Knowledge</option>
          <option value="episode">📝 Episodes</option>
          <option value="archive">🗄️ Archive</option>
        </select>
      )}

      {/* Add memory button */}
      <button
        onClick={onAddMemory}
        className="
          flex items-center justify-center gap-2
          px-4 py-2.5 rounded-xl
          bg-purple-600 hover:bg-purple-500 active:bg-purple-700
          text-sm font-medium text-white
          shadow-lg shadow-purple-500/20
          transition-colors
          flex-shrink-0
        "
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="hidden sm:inline">Add Memory</span>
      </button>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function MemoryOverview({ nodeId }: MemoryOverviewProps) {
  // ---- Data hooks ----
  const { status, isLoading: statusLoading } = useMemoryStatus(nodeId);
  const { overview, isLoading: overviewLoading, refetch: refetchOverview } = useMemoryOverview(nodeId);
  const { search, results: searchResults, isSearching, reset: resetSearch } = useMemorySearch(nodeId);
  const forgetMutation = useForgetMemory(nodeId);
  const rememberMutation = useRememberMemory(nodeId);
  const editMutation = useEditMemory(nodeId);

  // ---- Local state ----
  const [searchQuery, setSearchQuery] = useState('');
  const [layerFilter, setLayerFilter] = useState<MemoryLayer | null>(null);
  const [editingRecord, setEditingRecord] = useState<MemoryRecord | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Toast helper ----
  const showToast = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ---- Debounced search ----
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      resetSearch();
      return;
    }

    searchTimerRef.current = setTimeout(() => {
      const params: MemorySearchRequest = {
        query: trimmed,
        top_k: 20,
      };
      if (layerFilter) {
        params.layer_filter = layerFilter;
      }
      search(params);
    }, 500);
  }, [search, resetSearch, layerFilter]);

  // Re-search when layer filter changes (if searching)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    const params: MemorySearchRequest = { query: trimmed, top_k: 20 };
    if (layerFilter) params.layer_filter = layerFilter;
    search(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerFilter]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // ---- Handlers ----
  const handleEdit = useCallback((record: MemoryRecord) => {
    setEditingRecord(record);
    setSheetError(null);
    setIsSheetOpen(true);
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingRecord(null);
    setSheetError(null);
    setIsSheetOpen(true);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setIsSheetOpen(false);
    setEditingRecord(null);
    setSheetError(null);
  }, []);

  const handleSave = useCallback(async (data: MemoryRememberRequest, oldRecordId?: string) => {
    try {
      setSheetError(null);

      if (oldRecordId) {
        // Edit mode: forget + remember
        const result = await editMutation.mutateAsync({ oldRecordId, newData: data });
        if (result.status === 'duplicate') {
          showToast('This memory already exists.', 'error');
        } else {
          showToast('Memory updated successfully.');
        }
      } else {
        // Create mode
        const result = await rememberMutation.mutateAsync(data);
        if (result.status === 'duplicate') {
          showToast('This memory already exists.', 'error');
        } else {
          showToast('Memory created successfully.');
        }
      }

      handleCloseSheet();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save memory.';
      setSheetError(message);
    }
  }, [editMutation, rememberMutation, showToast, handleCloseSheet]);

  const handleDelete = useCallback(async (recordId: string) => {
    try {
      setDeletingId(recordId);
      await forgetMutation.mutateAsync(recordId);
      showToast('Memory deleted. AI will no longer recall this.');
    } catch (err) {
      showToast('Failed to delete memory.', 'error');
    } finally {
      setDeletingId(null);
    }
  }, [forgetMutation, showToast]);

  // ---- Determine display mode ----
  const isSearchMode = searchQuery.trim().length > 0;
  const isSaving = editMutation.isPending || rememberMutation.isPending;

  return (
    <div>
      {/* Toast */}
      {toast && <Toast message={toast.message} variant={toast.variant} />}

      {/* Status Card */}
      <MemoryStatusCard status={status} isLoading={statusLoading} />

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={handleSearchChange}
        isSearching={isSearching}
        onAddMemory={handleAddNew}
        layerFilter={layerFilter}
        onLayerFilterChange={setLayerFilter}
      />

      {/* Content: search results or overview */}
      {isSearchMode ? (
        // Search mode
        isSearching && !searchResults ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Searching memories...</p>
          </div>
        ) : (
          <div>
            {searchResults && (
              <p className="text-xs text-gray-500 mb-3">
                {searchResults.results.length} result{searchResults.results.length !== 1 ? 's' : ''} for &quot;{searchResults.query}&quot;
              </p>
            )}
            <MemoryList
              mode="flat"
              records={searchResults?.results ?? []}
              onEdit={handleEdit}
              onDelete={handleDelete}
              deletingId={deletingId}
              emptyMessage={`No memories found for "${searchQuery}". Your AI agent is still learning.`}
            />
          </div>
        )
      ) : (
        // Overview mode
        overviewLoading ? (
          <MemoryListSkeleton />
        ) : overview ? (
          <MemoryList
            mode="grouped"
            overview={overview}
            onEdit={handleEdit}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No memories loaded.</p>
          </div>
        )
      )}

      {/* Edit / Create Sheet */}
      <MemoryEditSheet
        isOpen={isSheetOpen}
        onClose={handleCloseSheet}
        onSave={handleSave}
        record={editingRecord}
        isSaving={isSaving}
        error={sheetError}
      />
    </div>
  );
}
