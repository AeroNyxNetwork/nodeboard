/**
 * ============================================
 * AeroNyx Privacy Network - Memory Overview
 * ============================================
 * File Path: components/memories/MemoryOverview.tsx
 *
 * Modification Reason (v3.0.0):
 *   Information architecture redesign — "useful > decorative":
 *   - MemoryHero v2.0.0: Cognitive Summary replaces particle constellation
 *   - MemoryCard v2.0.0: Desktop rows / Mobile cards (responsive)
 *   - Tighter spacing, higher information density
 *   - Search debounce reduced from 600ms to 500ms
 *   - Toast system unchanged
 *
 * Previous (v2.0.0):
 *   "This AI truly knows me" emotional feel with neural constellation,
 *   spotlight search, MemoryHero particles at top.
 *
 * Main Functionality:
 *   - MemoryHero (cognitive summary + stats) at top
 *   - Action bar: search + layer filter + add button
 *   - Grouped memory list (overview) or flat results (search)
 *   - Edit/Create sheet (with tag onBlur fix)
 *   - Toast notifications
 *
 * Dependencies:
 *   - hooks/useMemories.ts (all memory hooks)
 *   - types/memory.ts (types + display helpers)
 *   - components/memories/MemoryHero.tsx (v2.0.0 cognitive summary)
 *   - components/memories/MemoryList.tsx (v2.0.0 compact layout)
 *   - components/memories/MemoryEditSheet.tsx (v1.2.0 tag fix)
 *
 * ⚠️ Important Note for Next Developer:
 * - This component assumes node is online — page.tsx gates offline state
 * - Search uses useMutation (POST), not useQuery — manual trigger
 * - Edit = forget + remember (not atomic); error messaging handles partial failure
 * - The search debounce timer must be cleaned up on unmount
 *
 * Last Modified: v3.0.0 - Information architecture redesign
 * Previous: v2.0.0 - Emotional redesign with neural constellation
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
  MemoryDisplayRecord,
  MemoryRememberRequest,
  MemorySearchRequest,
  MemoryLayer,
} from '@/types/memory';
import MemoryHero from './MemoryHero';
import MemoryList, { MemoryListSkeleton } from './MemoryList';
import MemoryEditSheet from './MemoryEditSheet';

// ============================================
// Props
// ============================================

interface MemoryOverviewProps {
  nodeId: string;
}

// ============================================
// Toast
// ============================================

function Toast({ message, variant }: { message: string; variant: 'success' | 'error' }) {
  return (
    <div className={`
      fixed top-6 left-1/2 -translate-x-1/2 z-[60]
      px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl
      backdrop-blur-lg
      motion-safe:animate-[slideDown_0.3s_ease-out]
      ${variant === 'success'
        ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-300'
        : 'bg-red-500/15 border border-red-500/25 text-red-300'
      }
    `}>
      <div className="flex items-center gap-2">
        {variant === 'success' ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {message}
      </div>
    </div>
  );
}

// ============================================
// Action Bar (search + filter + add)
// ============================================

interface ActionBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  isSearching: boolean;
  onAddMemory: () => void;
  layerFilter: MemoryLayer | null;
  onLayerFilterChange: (layer: MemoryLayer | null) => void;
  isSearchMode: boolean;
}

function ActionBar({
  searchValue,
  onSearchChange,
  isSearching,
  onAddMemory,
  layerFilter,
  onLayerFilterChange,
  isSearchMode,
}: ActionBarProps) {
  return (
    <div className="mb-4">
      <div className="flex gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search memories..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="
              w-full pl-9 pr-4 py-2 rounded-lg
              bg-white/[0.03] border border-white/[0.06]
              text-sm text-white placeholder-gray-600
              focus:outline-none focus:border-purple-500/30 focus:bg-white/[0.05]
              transition-all duration-200
            "
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-3.5 h-3.5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Layer filter */}
        {isSearchMode && (
          <select
            value={layerFilter ?? ''}
            onChange={(e) => onLayerFilterChange(e.target.value ? e.target.value as MemoryLayer : null)}
            className="
              hidden sm:block px-3 py-2 rounded-lg
              bg-white/[0.03] border border-white/[0.06]
              text-sm text-gray-400 outline-none
              focus:border-purple-500/30 transition-colors
              appearance-none cursor-pointer
            "
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              backgroundSize: '14px',
              paddingRight: '28px',
            }}
          >
            <option value="">All layers</option>
            <option value="identity">🧬 Identity</option>
            <option value="knowledge">📚 Knowledge</option>
            <option value="episode">📝 Episodes</option>
            <option value="archive">🗄️ Archive</option>
          </select>
        )}

        {/* Add button */}
        <button
          onClick={onAddMemory}
          className="
            flex items-center justify-center gap-2
            px-3 py-2 rounded-lg
            bg-purple-600 hover:bg-purple-500 active:bg-purple-700
            text-sm font-medium text-white
            shadow-lg shadow-purple-500/20 transition-all duration-200
            hover:shadow-purple-500/30 active:scale-[0.98]
            flex-shrink-0
          "
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Teach AI</span>
        </button>
      </div>
    </div>
  );
}

// ============================================
// Search Results Header
// ============================================

function SearchResultsHeader({
  query,
  count,
  onClear,
}: {
  query: string;
  count: number;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs text-gray-400">
        <span className="text-white font-medium">{count}</span>
        {' '}result{count !== 1 ? 's' : ''} for{' '}
        <span className="text-purple-300">&quot;{query}&quot;</span>
      </p>
      <button
        onClick={onClear}
        className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
      >
        Clear
      </button>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function MemoryOverview({ nodeId }: MemoryOverviewProps) {
  const { status, isLoading: statusLoading } = useMemoryStatus(nodeId);
  const { overview, isLoading: overviewLoading } = useMemoryOverview(nodeId);
  const { search, results: searchResults, isSearching, reset: resetSearch } = useMemorySearch(nodeId);
  const forgetMutation = useForgetMemory(nodeId);
  const rememberMutation = useRememberMemory(nodeId);
  const editMutation = useEditMemory(nodeId);

  const [searchQuery, setSearchQuery] = useState('');
  const [layerFilter, setLayerFilter] = useState<MemoryLayer | null>(null);
  const [editingRecord, setEditingRecord] = useState<MemoryDisplayRecord | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Debounced search (500ms)
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    const trimmed = value.trim();
    if (!trimmed) {
      resetSearch();
      return;
    }

    searchTimerRef.current = setTimeout(() => {
      const params: MemorySearchRequest = { query: trimmed, top_k: 20 };
      if (layerFilter) params.layer_filter = layerFilter;
      search(params);
    }, 500);
  }, [search, resetSearch, layerFilter]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    resetSearch();
  }, [resetSearch]);

  // Re-search when layer filter changes
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const params: MemorySearchRequest = { query: trimmed, top_k: 20 };
    if (layerFilter) params.layer_filter = layerFilter;
    search(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerFilter]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, []);

  // Handlers
  const handleEdit = useCallback((record: MemoryDisplayRecord) => {
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
        const result = await editMutation.mutateAsync({ oldRecordId, newData: data });
        showToast(result.status === 'duplicate' ? 'This memory already exists.' : 'Memory updated');
      } else {
        const result = await rememberMutation.mutateAsync(data);
        showToast(result.status === 'duplicate' ? 'This memory already exists.' : 'Memory created');
      }

      handleCloseSheet();
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : 'Failed to save memory.');
    }
  }, [editMutation, rememberMutation, showToast, handleCloseSheet]);

  const handleDelete = useCallback(async (recordId: string) => {
    try {
      setDeletingId(recordId);
      await forgetMutation.mutateAsync(recordId);
      showToast('Memory forgotten. Your AI will no longer recall this.');
    } catch {
      showToast('Failed to delete memory.', 'error');
    } finally {
      setDeletingId(null);
    }
  }, [forgetMutation, showToast]);

  const isSearchMode = searchQuery.trim().length > 0;
  const isSaving = editMutation.isPending || rememberMutation.isPending;

  return (
    <div>
      {toast && <Toast message={toast.message} variant={toast.variant} />}

      {/* Hero — cognitive summary + stats */}
      <MemoryHero
        status={status}
        overview={overview}
        isLoading={statusLoading}
      />

      {/* Action bar */}
      <ActionBar
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        isSearching={isSearching}
        onAddMemory={handleAddNew}
        layerFilter={layerFilter}
        onLayerFilterChange={setLayerFilter}
        isSearchMode={isSearchMode}
      />

      {/* Content */}
      {isSearchMode ? (
        isSearching && !searchResults ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
            </div>
            <p className="text-xs text-gray-500">Searching through memories...</p>
          </div>
        ) : (
          <div>
            {searchResults && (
              <SearchResultsHeader
                query={searchResults.query}
                count={searchResults.results.length}
                onClear={handleClearSearch}
              />
            )}
            <MemoryList
              mode="flat"
              records={searchResults?.results ?? []}
              onEdit={handleEdit}
              onDelete={handleDelete}
              deletingId={deletingId}
              emptyMessage={`No memories match "${searchQuery}".`}
            />
          </div>
        )
      ) : (
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
            <p className="text-sm text-gray-500">Start chatting with your AI to build memories, or teach it manually.</p>
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
