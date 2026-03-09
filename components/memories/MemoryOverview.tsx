/**
 * ============================================
 * AeroNyx Privacy Network - Memory Overview
 * ============================================
 * File Path: components/memories/MemoryOverview.tsx
 *
 * Modification Reason (v1.1.0):
 *   - Updated for new API format (recent_by_layer, Unix timestamps)
 *   - Uses MemoryDisplayRecord throughout
 *   - Edit sheet receives MemoryDisplayRecord instead of MemoryRecord
 *   - Save handler maps MemoryDisplayRecord back to MemoryRememberRequest
 *
 * Main Functionality:
 *   - Status card + search bar + memory list + edit sheet
 *   - Search/browse mode auto-switch
 *   - Toast notifications
 *   - Offline node detection handled by parent page
 *
 * Last Modified: v1.1.0 - Aligned with actual API format
 * Previous: v1.0.0 - Initial overview
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
// Toast
// ============================================

function Toast({ message, variant }: { message: string; variant: 'success' | 'error' }) {
  return (
    <div className={`
      fixed top-6 left-1/2 -translate-x-1/2 z-[60]
      px-4 py-2 rounded-lg text-sm font-medium shadow-xl
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
  layerFilter: MemoryLayer | null;
  onLayerFilterChange: (layer: MemoryLayer | null) => void;
}

function SearchBar({ value, onChange, isSearching, onAddMemory, layerFilter, onLayerFilterChange }: SearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
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

      {value.trim().length > 0 && (
        <select
          value={layerFilter ?? ''}
          onChange={(e) => onLayerFilterChange(e.target.value ? e.target.value as MemoryLayer : null)}
          className="
            px-3 py-2.5 rounded-xl
            bg-white/[0.04] border border-white/[0.08]
            text-sm text-gray-400 outline-none
            focus:border-purple-500/30 transition-colors
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

      <button
        onClick={onAddMemory}
        className="
          flex items-center justify-center gap-2
          px-4 py-2.5 rounded-xl
          bg-purple-600 hover:bg-purple-500 active:bg-purple-700
          text-sm font-medium text-white
          shadow-lg shadow-purple-500/20 transition-colors flex-shrink-0
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

  // Debounced search
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

  // Re-search when layer filter changes
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const params: MemorySearchRequest = { query: trimmed, top_k: 20 };
    if (layerFilter) params.layer_filter = layerFilter;
    search(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerFilter]);

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
        if (result.status === 'duplicate') {
          showToast('This memory already exists.', 'error');
        } else {
          showToast('Memory updated successfully.');
        }
      } else {
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

      <MemoryStatusCard status={status} isLoading={statusLoading} />

      <SearchBar
        value={searchQuery}
        onChange={handleSearchChange}
        isSearching={isSearching}
        onAddMemory={handleAddNew}
        layerFilter={layerFilter}
        onLayerFilterChange={setLayerFilter}
      />

      {isSearchMode ? (
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
