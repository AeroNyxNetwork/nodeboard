/**
 * ============================================
 * AeroNyx Privacy Network - Memory Hero (Cognitive Summary)
 * ============================================
 * File Path: components/memories/MemoryHero.tsx
 *
 * Modification Reason (v3.0.0):
 *   Second rewrite. v2.0.0 was still too decorative — summary text
 *   was naive concatenation, layout had too much chrome.
 *
 *   v3.0.0 principles:
 *   - ZERO decoration. No gradients, no glows, no particle legacy.
 *   - Summary reads like "AI self-awareness" — structured natural language
 *   - Stats are inline, compact, secondary to the summary text
 *   - The entire component is ≤120px tall for 5 memories, scales gracefully
 *   - Engine status hidden by default (tooltip or footer elsewhere)
 *   - If summary is empty (no memories), component collapses to minimal state
 *
 * Previous (v2.0.0):
 *   Cognitive Summary card with gradient border, layer dot colors,
 *   engine status indicators. Still had decorative DNA from v1.0.0.
 *
 * Previous (v1.0.0):
 *   Canvas particle constellation. Replaced because it was purely decorative.
 *
 * Dependencies:
 *   - types/memory.ts (MemoryStatusData, MemoryOverviewData,
 *     buildCognitiveSummary, MEMORY_LAYER_CONFIG, MEMORY_LAYERS_ORDERED)
 *
 * ⚠️ Important Note for Next Developer:
 * - buildCognitiveSummary() v1.3.0 does real NLP-lite extraction now,
 *   but it's still template-based. When /mpi/summary/ exists, swap the source.
 * - This component intentionally has NO visual flair. Resist adding it back.
 *   The data IS the interface. If a VC isn't impressed, improve the data quality,
 *   not the decoration.
 *
 * Last Modified: v3.0.0 - Zero-decoration, data-first hero
 * Previous: v2.0.0 - Cognitive summary card (still too decorative)
 * ============================================
 */

'use client';

import React, { useMemo } from 'react';
import {
  MemoryStatusData,
  MemoryOverviewData,
  MEMORY_LAYER_CONFIG,
  MEMORY_LAYERS_ORDERED,
  buildCognitiveSummary,
} from '@/types/memory';

// ============================================
// Props
// ============================================

interface MemoryHeroProps {
  status: MemoryStatusData | null;
  overview: MemoryOverviewData | null;
  isLoading: boolean;
}

// ============================================
// Skeleton
// ============================================

function HeroSkeleton() {
  return (
    <div className="mb-6 animate-pulse">
      <div className="space-y-2 mb-3">
        <div className="h-4 w-4/5 bg-white/[0.06] rounded" />
        <div className="h-4 w-3/5 bg-white/[0.06] rounded" />
      </div>
      <div className="h-3 w-48 bg-white/[0.04] rounded" />
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function MemoryHero({ status, overview, isLoading }: MemoryHeroProps) {
  const cognitiveSummary = useMemo(
    () => buildCognitiveSummary(overview, status),
    [overview, status]
  );

  if (isLoading || !status) {
    return <HeroSkeleton />;
  }

  // No memories — minimal prompt, not a big empty state
  if (!overview || overview.total === 0) {
    return (
      <div className="mb-6">
        <p className="text-sm text-gray-500">
          No memories yet. Start chatting to help your AI learn about you, or teach it manually.
        </p>
      </div>
    );
  }

  const { stats } = status;

  return (
    <div className="mb-6">
      {/* Cognitive summary — the core "wow" */}
      {cognitiveSummary?.summary && (
        <p className="text-[15px] leading-relaxed text-gray-200 mb-3 select-text">
          {cognitiveSummary.summary}
        </p>
      )}

      {/* Compact stats line */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
        <span>
          <span className="text-white font-medium">{stats.total_records}</span>
          {' '}memories
        </span>

        <span className="text-gray-700">·</span>

        {/* Layer breakdown — only non-zero */}
        {MEMORY_LAYERS_ORDERED.map((layer) => {
          const count = stats.by_layer[layer] ?? 0;
          if (count === 0) return null;
          const config = MEMORY_LAYER_CONFIG[layer];
          return (
            <span key={layer} className="flex items-center gap-1">
              <span className="text-xs leading-none">{config.icon}</span>
              <span>{config.labelEn} {count}</span>
            </span>
          );
        })}

        {cognitiveSummary?.lastMemoryLabel && (
          <>
            <span className="text-gray-700">·</span>
            <span>Last learned {cognitiveSummary.lastMemoryLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}
