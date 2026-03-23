/**
 * ============================================
 * AeroNyx Privacy Network - Memory Graph
 * ============================================
 * File Path: components/memories/MemoryGraph.tsx
 *
 * Creation Reason: Phase 4 — v2.4.0 cognitive graph exploration panel.
 *   Renders entities and communities extracted by the MemChain Miner.
 *   Supports two sub-views: Entities list and Communities list.
 *   Clicking an entity opens a detail drawer showing relationships,
 *   BFS subgraph summary, and event timeline.
 *
 * Main Functionality:
 *   - Sub-tab: Entities | Communities
 *   - Entity list: name, type badge, mention count, description
 *   - Community list: name, entity count, LLM narrative or placeholder
 *   - Entity detail drawer: relationships + timeline (bottom sheet pattern)
 *   - Empty states for when Miner hasn't run yet
 *   - Skeleton loaders matching existing component style
 *
 * Dependencies:
 *   - hooks/useMemories.ts (useEntityDetail, useEntityTimeline, useCommunities)
 *   - types/memory.ts (Entity, Community, EntityDetailResponse, etc.)
 *   - Follows zero-decoration principle from MemoryHero.tsx
 *
 * ⚠️ Important Note for Next Developer:
 * - useEntityDetail / useEntityTimeline are lazy — only enabled when
 *   selectedEntityId is non-empty (drawer is open)
 * - hasLlmCommunityNarrative() from types/memory.ts checks if summary
 *   is LLM-generated; show "Generating..." placeholder if not
 * - Entity type badges use a fixed color map — add new types to
 *   ENTITY_TYPE_CONFIG if backend adds new entity labels
 * - The graph panel receives nodeId from MemoryOverview via props,
 *   same pattern as all other memory components
 *
 * Last Modified: v1.0.0 - Initial creation (Phase 4)
 * ============================================
 */

'use client';

import React, { useState, useCallback, memo } from 'react';
import {
  useEntityDetail,
  useEntityTimeline,
  useCommunities,
} from '@/hooks/useMemories';
import {
  Entity,
  Community,
  KnowledgeEdge,
  hasLlmCommunityNarrative,
  COGNITIVE_TASK_TYPE_LABELS,
} from '@/types/memory';

// ============================================
// Props
// ============================================

interface MemoryGraphProps {
  nodeId: string;
  entities: Entity[];
  entitiesLoading: boolean;
}

// ============================================
// Entity type color config
// ============================================

const ENTITY_TYPE_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  technology:  { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/25' },
  module:      { bg: 'bg-purple-500/15',  text: 'text-purple-400',  border: 'border-purple-500/25' },
  project:     { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25' },
  person:      { bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  border: 'border-yellow-500/25' },
  file:        { bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/25' },
  concept:     { bg: 'bg-pink-500/15',    text: 'text-pink-400',    border: 'border-pink-500/25' },
  tool:        { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    border: 'border-cyan-500/25' },
  language:    { bg: 'bg-indigo-500/15',  text: 'text-indigo-400',  border: 'border-indigo-500/25' },
};

function entityTypeStyle(type: string) {
  return ENTITY_TYPE_CONFIG[type] ?? { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/25' };
}

// ============================================
// Skeleton
// ============================================

function GraphSkeleton() {
  return (
    <div className="space-y-1.5 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-10 bg-white/[0.03] rounded-lg" />
      ))}
    </div>
  );
}

// ============================================
// Sub-tab bar
// ============================================

type GraphTab = 'entities' | 'communities';

interface TabBarProps {
  active: GraphTab;
  onChange: (tab: GraphTab) => void;
  entityCount: number;
  communityCount: number;
}

function TabBar({ active, onChange, entityCount, communityCount }: TabBarProps) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-4">
      {([
        { key: 'entities' as const, label: 'Entities', count: entityCount },
        { key: 'communities' as const, label: 'Communities', count: communityCount },
      ]).map(({ key, label, count }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`
            flex-1 flex items-center justify-center gap-1.5
            px-3 py-2 rounded-lg text-sm font-medium
            transition-all duration-150
            ${active === key
              ? 'bg-white/[0.07] text-white'
              : 'text-gray-500 hover:text-gray-300'
            }
          `}
        >
          {label}
          <span className={`
            text-[11px] px-1.5 py-0.5 rounded-full
            ${active === key ? 'bg-white/10 text-gray-300' : 'bg-white/5 text-gray-600'}
          `}>
            {count}
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================================
// Entity row
// ============================================

interface EntityRowProps {
  entity: Entity;
  onClick: (entity: Entity) => void;
}

const EntityRow = memo(function EntityRow({ entity, onClick }: EntityRowProps) {
  const style = entityTypeStyle(entity.entity_type);

  return (
    <button
      onClick={() => onClick(entity)}
      className="
        w-full px-3 py-2.5 rounded-lg
        flex items-start gap-3
        hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]
        transition-colors duration-150 text-left
      "
    >
      {/* Type badge */}
      <span className={`
        mt-0.5 flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border
        ${style.bg} ${style.text} ${style.border}
      `}>
        {entity.entity_type}
      </span>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{entity.name}</p>
        {entity.description && (
          <p className="text-[11px] text-gray-500 truncate mt-0.5">{entity.description}</p>
        )}
      </div>

      {/* Mention count */}
      <span className="flex-shrink-0 text-[11px] text-gray-600 mt-0.5">
        {entity.mention_count}×
      </span>

      {/* Chevron */}
      <svg className="flex-shrink-0 w-3.5 h-3.5 text-gray-700 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
});

// ============================================
// Community row
// ============================================

const CommunityRow = memo(function CommunityRow({ community }: { community: Community }) {
  const hasNarrative = hasLlmCommunityNarrative(community);

  return (
    <div className="px-3 py-2.5 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06] transition-colors duration-150">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-sm text-gray-200 font-medium truncate">{community.name}</p>
        <span className="flex-shrink-0 text-[11px] text-gray-600">
          {community.entity_count} entities
        </span>
      </div>
      <p className="text-[11px] text-gray-500 line-clamp-2">
        {hasNarrative
          ? community.summary
          : <span className="text-gray-600 italic">Generating summary...</span>
        }
      </p>
      {community.has_project && (
        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Project
        </span>
      )}
    </div>
  );
});

// ============================================
// Entity Detail Drawer
// ============================================

interface EntityDrawerProps {
  nodeId: string;
  entity: Entity;
  onClose: () => void;
}

function EntityDrawer({ nodeId, entity, onClose }: EntityDrawerProps) {
  const { entity: detail, isLoading: detailLoading } = useEntityDetail(nodeId, entity.entity_id);
  const { events, entityName, isLoading: timelineLoading } = useEntityTimeline(nodeId, entity.entity_id);
  const style = entityTypeStyle(entity.entity_type);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="
        fixed z-50
        inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2
        sm:-translate-x-1/2 sm:-translate-y-1/2
        w-full sm:max-w-lg
        bg-[#12121A] border-t sm:border border-white/[0.08]
        rounded-t-2xl sm:rounded-2xl
        shadow-2xl max-h-[85vh] overflow-y-auto
      ">
        {/* Handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/10" />
        </div>

        <div className="px-5 py-4 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5 gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className={`
                mt-0.5 flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border
                ${style.bg} ${style.text} ${style.border}
              `}>
                {entity.entity_type}
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white truncate">{entity.name}</h2>
                <p className="text-xs text-gray-500">{entity.mention_count} mentions</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Description */}
          {entity.description && (
            <p className="text-sm text-gray-400 mb-5 leading-relaxed">{entity.description}</p>
          )}

          {/* Relationships */}
          <div className="mb-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Relationships</p>
            {detailLoading ? (
              <div className="space-y-1.5 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-7 bg-white/[0.03] rounded" />)}
              </div>
            ) : detail?.edges && detail.edges.length > 0 ? (
              <div className="space-y-1">
                {detail.edges.slice(0, 10).map((edge: KnowledgeEdge) => {
                  const isSource = edge.source_id === entity.entity_id;
                  const otherName = isSource ? edge.target_name : edge.source_name;
                  return (
                    <div key={edge.edge_id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-white/[0.02]">
                      <span className="text-gray-300 font-medium truncate max-w-[120px]">{entity.name}</span>
                      <span className="text-gray-600 flex-shrink-0">
                        {isSource ? '→' : '←'}
                      </span>
                      <span className="text-purple-400/70 flex-shrink-0 text-[10px] uppercase tracking-wide">
                        {edge.relation_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-gray-600 flex-shrink-0">
                        {isSource ? '→' : '←'}
                      </span>
                      <span className="text-gray-300 truncate">{otherName}</span>
                    </div>
                  );
                })}
                {detail.edges.length > 10 && (
                  <p className="text-[11px] text-gray-600 pl-2">
                    +{detail.edges.length - 10} more relationships
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-600">No relationships found yet.</p>
            )}
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Mentioned in sessions</p>
            {timelineLoading ? (
              <div className="space-y-1.5 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-7 bg-white/[0.03] rounded" />)}
              </div>
            ) : events.length > 0 ? (
              <div className="space-y-1">
                {events.slice(0, 8).map((event, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-white/[0.02]">
                    <span className="text-gray-500 flex-shrink-0">
                      {new Date(event.timestamp * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-gray-300 truncate">
                      {event.session_title ?? event.session_id.slice(0, 12) + '...'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600">No session history yet.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================
// Main Component
// ============================================

export default function MemoryGraph({ nodeId, entities, entitiesLoading }: MemoryGraphProps) {
  const [activeTab, setActiveTab] = useState<GraphTab>('entities');
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  const { communities, total: communityTotal, isLoading: communitiesLoading } = useCommunities(nodeId);

  const handleEntityClick = useCallback((entity: Entity) => {
    setSelectedEntity(entity);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setSelectedEntity(null);
  }, []);

  const isEmpty = !entitiesLoading && entities.length === 0 && !communitiesLoading && communities.length === 0;

  if (isEmpty) {
    return (
      <div className="py-12 text-center">
        <svg className="w-10 h-10 mx-auto text-gray-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <p className="text-sm text-gray-500">No knowledge graph yet.</p>
        <p className="text-xs text-gray-600 mt-1">
          The Miner builds this automatically as you chat. Check back after a few sessions.
        </p>
      </div>
    );
  }

  return (
    <div>
      <TabBar
        active={activeTab}
        onChange={setActiveTab}
        entityCount={entities.length}
        communityCount={communityTotal}
      />

      {activeTab === 'entities' ? (
        entitiesLoading ? (
          <GraphSkeleton />
        ) : entities.length === 0 ? (
          <p className="text-xs text-gray-600 py-6 text-center">No entities extracted yet.</p>
        ) : (
          <div className="space-y-0">
            {entities.map((entity) => (
              <EntityRow
                key={entity.entity_id}
                entity={entity}
                onClick={handleEntityClick}
              />
            ))}
          </div>
        )
      ) : (
        communitiesLoading ? (
          <GraphSkeleton />
        ) : communities.length === 0 ? (
          <p className="text-xs text-gray-600 py-6 text-center">No communities detected yet.</p>
        ) : (
          <div className="space-y-0">
            {communities.map((community) => (
              <CommunityRow key={community.community_id} community={community} />
            ))}
          </div>
        )
      )}

      {/* Entity detail drawer */}
      {selectedEntity && (
        <EntityDrawer
          nodeId={nodeId}
          entity={selectedEntity}
          onClose={handleDrawerClose}
        />
      )}
    </div>
  );
}
