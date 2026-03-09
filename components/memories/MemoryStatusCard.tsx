/**
 * ============================================
 * AeroNyx Privacy Network - Memory Status Card
 * ============================================
 * File Path: components/memories/MemoryStatusCard.tsx
 *
 * Creation Reason: Top-of-page status overview for the Memory Explorer.
 *   Shows total memories, per-layer breakdown, and engine health indicators.
 *
 * Main Functionality:
 *   - Total memory count with animated number
 *   - Per-layer breakdown chips (identity/knowledge/episode/archive)
 *   - Engine health dots (embed engine, vector index)
 *   - Compact on mobile (2-col grid), expanded on desktop (inline)
 *   - Skeleton loader during data fetch
 *
 * Dependencies:
 *   - types/memory.ts (MemoryStatusData, MEMORY_LAYER_CONFIG, MEMORY_LAYERS_ORDERED)
 *   - components/common/Card.tsx
 *
 * ⚠️ Important Note for Next Developer:
 * - This component receives data via props, not via hooks directly
 * - The parent (MemoryOverview) calls useMemoryStatus and passes data down
 * - Layer chips use MEMORY_LAYER_CONFIG for consistent colors across the app
 *
 * Last Modified: v1.0.0 - Initial status card for Memory Explorer
 * ============================================
 */

'use client';

import React from 'react';
import { MemoryStatusData, MEMORY_LAYER_CONFIG, MEMORY_LAYERS_ORDERED } from '@/types/memory';
import Card from '@/components/common/Card';

// ============================================
// Props
// ============================================

interface MemoryStatusCardProps {
  status: MemoryStatusData | null;
  isLoading: boolean;
}

// ============================================
// Skeleton
// ============================================

function StatusSkeleton() {
  return (
    <Card variant="default" padding="md" className="mb-6">
      <div className="animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/5" />
          <div>
            <div className="h-5 w-24 bg-white/5 rounded mb-1" />
            <div className="h-3 w-32 bg-white/5 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Layer Chip
// ============================================

interface LayerChipProps {
  layer: typeof MEMORY_LAYERS_ORDERED[number];
  count: number;
}

function LayerChip({ layer, count }: LayerChipProps) {
  const config = MEMORY_LAYER_CONFIG[layer];

  return (
    <div
      className={`
        flex items-center gap-2.5 px-3 py-2.5 rounded-xl
        ${config.bgColor} border ${config.borderColor}
        transition-colors
      `}
    >
      <span className="text-base leading-none">{config.icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${config.textColor}`}>{count}</p>
        <p className="text-[11px] text-gray-500 truncate">{config.labelEn}</p>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function MemoryStatusCard({ status, isLoading }: MemoryStatusCardProps) {
  if (isLoading || !status) {
    return <StatusSkeleton />;
  }

  const { stats, embed_ready, index_ready } = status;

  return (
    <Card variant="default" padding="md" className="mb-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Brain icon */}
          <div className="
            w-10 h-10 rounded-xl
            bg-gradient-to-br from-purple-500/20 to-blue-500/20
            border border-white/[0.08]
            flex items-center justify-center flex-shrink-0
          ">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {stats.total_records} Memories
            </h3>
            <p className="text-xs text-gray-500">
              {stats.active_records} active · {stats.records_with_embedding} vectorized
            </p>
          </div>
        </div>

        {/* Engine health indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" title={embed_ready ? 'Embedding engine online' : 'Embedding engine offline'}>
            <span className={`w-1.5 h-1.5 rounded-full ${embed_ready ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-[11px] text-gray-500 hidden sm:inline">Embed</span>
          </div>
          <div className="flex items-center gap-1.5" title={index_ready ? 'Vector index ready' : 'Vector index not ready'}>
            <span className={`w-1.5 h-1.5 rounded-full ${index_ready ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-[11px] text-gray-500 hidden sm:inline">Index</span>
          </div>
        </div>
      </div>

      {/* Layer breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {MEMORY_LAYERS_ORDERED.map((layer) => (
          <LayerChip
            key={layer}
            layer={layer}
            count={stats.by_layer[layer] ?? 0}
          />
        ))}
      </div>
    </Card>
  );
}
