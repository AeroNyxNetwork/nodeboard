/**
 * ============================================
 * AeroNyx Privacy Network - Memory Types
 * ============================================
 * File Path: types/memory.ts
 *
 * Creation Reason: Type definitions for the MemChain Memory Explorer
 *   (AI Memory Management module). Covers all MPI API request/response
 *   shapes, UI state types, and configuration constants.
 *
 * Modification Reason (v1.1.0):
 *   Updated to match actual API response format (v1.5.0 backend doc):
 *   - overview: `recent_by_layer` instead of `by_layer.*.records`
 *   - `timestamp` is Unix seconds (int), not ISO string
 *   - Record items in overview don't have `layer` field (inferred from parent key)
 *   - `total` instead of `total_records` in overview
 *   - Added `last_memory_at`, `embed_ready`, `embed_dim` to overview
 *
 * Dependencies:
 *   - Used by hooks/useMemories.ts
 *   - Used by lib/api.ts (MPI methods)
 *   - Used by all components/memories/*.tsx
 *
 * ⚠️ Important Note for Next Developer:
 * - MemoryLayer values MUST match the Rust MemChain layer names exactly
 * - record_id is a hex string (SHA-256 hash), NOT a UUID
 * - API responses always wrap data in { success: boolean, data: T }
 * - The "edit" operation is forget + remember (no atomic update API)
 * - `timestamp` in overview records is Unix SECONDS — multiply by 1000 for JS Date
 * - Records in overview do NOT have a `layer` field; the layer is the parent key
 *
 * Last Modified: v1.1.0 - Aligned with actual API response format
 * Previous: v1.0.0 - Initial type definitions
 * ============================================
 */

// ============================================
// Core Types
// ============================================

/** Memory layer — matches Rust MemChain layer names exactly */
export type MemoryLayer = 'identity' | 'knowledge' | 'episode' | 'archive';

/**
 * Memory record as returned by overview endpoint (recent_by_layer).
 * Note: does NOT include `layer` — that's inferred from the parent key.
 * Note: `timestamp` is Unix seconds, NOT milliseconds.
 */
export interface MemoryOverviewRecord {
  record_id: string;
  content: string;
  topic_tags: string[];
  timestamp: number; // Unix seconds
  access_count: number;
  positive_feedback: number;
  negative_feedback: number;
  source_ai: string;
}

/**
 * Memory record with full detail (from /mpi/record/ or /mpi/search/).
 * Search results include `score` and `layer`.
 * Detail results include `embedding_model`, `last_accessed`, `conflict_with`.
 */
export interface MemoryRecord {
  record_id: string;
  content: string;
  layer: MemoryLayer;
  topic_tags: string[];
  source_ai: string;
  created_at: string; // ISO string (from search/detail)
  last_accessed?: string | null;
  access_count: number;
  positive_feedback: number;
  negative_feedback: number;
  /** Only present in search results */
  score?: number;
  /** Only present in detail view */
  embedding_model?: string;
  conflict_with?: string | null;
}

/**
 * Unified record type for UI rendering.
 * Normalizes both overview records (Unix timestamp, no layer)
 * and full records (ISO string, has layer) into a single shape.
 */
export interface MemoryDisplayRecord {
  record_id: string;
  content: string;
  layer: MemoryLayer;
  topic_tags: string[];
  source_ai: string;
  /** Always in milliseconds (JS Date compatible) */
  timestamp_ms: number;
  access_count: number;
  positive_feedback: number;
  negative_feedback: number;
  /** Only present in search results */
  score?: number;
}

// ============================================
// API Response Types
// ============================================

/** GET /mpi/status/ */
export interface MemoryStatusData {
  memchain_enabled: boolean;
  mode: string;
  stats: {
    total_records: number;
    active_records: number;
    by_layer: Record<MemoryLayer, number>;
    content_bytes: number;
    records_with_embedding: number;
    session_inserts: number;
    session_rejects: number;
  };
  vector_index_total: number;
  vector_partitions: number;
  last_block_height: number;
  index_ready: boolean;
  embed_ready: boolean;
  embed_dim: number;
  mvf: {
    enabled: boolean;
    alpha: number;
    total_positive_feedback: number;
    total_negative_feedback: number;
    baseline_positive_rate: number | null;
    baseline_sample_size: number | null;
    mvf_positive_rate: number | null;
    mvf_sample_size: number | null;
    lift: number | null;
    weights_version: number;
  };
}

export interface MemoryStatusResponse {
  success: boolean;
  data: MemoryStatusData;
}

/** GET /mpi/overview/ — actual API format (v1.5.0) */
export interface MemoryOverviewData {
  total: number;
  by_layer: Record<MemoryLayer, number>;
  recent_by_layer: Record<MemoryLayer, MemoryOverviewRecord[]>;
  last_memory_at: number | null;
  embed_ready: boolean;
  embed_dim: number;
}

export interface MemoryOverviewResponse {
  success: boolean;
  data: MemoryOverviewData;
}

/** POST /mpi/search/ */
export interface MemorySearchRequest {
  query: string;
  top_k?: number;
  layer_filter?: MemoryLayer;
}

export interface MemorySearchData {
  query: string;
  embedding_model: string;
  results: MemoryRecord[];
}

export interface MemorySearchResponse {
  success: boolean;
  data: MemorySearchData;
}

/** GET /mpi/record/{record_id}/ */
export interface MemoryRecordResponse {
  success: boolean;
  data: MemoryRecord;
}

/** POST /mpi/remember/ */
export interface MemoryRememberRequest {
  content: string;
  layer?: MemoryLayer;
  topic_tags?: string[];
  source_ai?: string;
}

export interface MemoryRememberData {
  record_id: string;
  status: 'created' | 'duplicate';
  duplicate_of?: string;
}

export interface MemoryRememberResponse {
  success: boolean;
  data: MemoryRememberData;
}

/** POST /mpi/forget/ */
export interface MemoryForgetRequest {
  record_id: string;
}

export interface MemoryForgetData {
  forgotten: boolean;
  record_id: string;
}

export interface MemoryForgetResponse {
  success: boolean;
  data: MemoryForgetData;
}

/** POST /mpi/embed/ */
export interface MemoryEmbedRequest {
  text: string;
}

export interface MemoryEmbedData {
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface MemoryEmbedResponse {
  success: boolean;
  data: MemoryEmbedData;
}

// ============================================
// UI Configuration Types
// ============================================

/** Layer display configuration for UI rendering */
export interface LayerConfig {
  key: MemoryLayer;
  label: string;
  labelEn: string;
  icon: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  /** Default collapsed state in overview */
  defaultCollapsed: boolean;
}

// ============================================
// Layer Configuration Constant
// ============================================

/**
 * Display configuration for each memory layer.
 * Order matches the recommended display order:
 *   identity → knowledge → episode → archive
 */
export const MEMORY_LAYER_CONFIG: Record<MemoryLayer, LayerConfig> = {
  identity: {
    key: 'identity',
    label: '核心身份',
    labelEn: 'Identity',
    icon: '🧬',
    description: 'Core identity facts that rarely change',
    bgColor: 'bg-purple-500/15',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    defaultCollapsed: false,
  },
  knowledge: {
    key: 'knowledge',
    label: '知识偏好',
    labelEn: 'Knowledge',
    icon: '📚',
    description: 'Preferences and knowledge that update occasionally',
    bgColor: 'bg-blue-500/15',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    defaultCollapsed: false,
  },
  episode: {
    key: 'episode',
    label: '近期上下文',
    labelEn: 'Episodes',
    icon: '📝',
    description: 'Recent conversation context that changes frequently',
    bgColor: 'bg-emerald-500/15',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    defaultCollapsed: false,
  },
  archive: {
    key: 'archive',
    label: '归档',
    labelEn: 'Archive',
    icon: '🗄️',
    description: 'Older memories no longer actively used',
    bgColor: 'bg-gray-500/15',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/30',
    defaultCollapsed: true,
  },
};

/** Ordered array for iteration in display order */
export const MEMORY_LAYERS_ORDERED: MemoryLayer[] = [
  'identity',
  'knowledge',
  'episode',
  'archive',
];

// ============================================
// Utility: Normalize records for UI
// ============================================

/**
 * Convert an overview record (Unix seconds, no layer) to a display record.
 */
export function toDisplayRecord(
  record: MemoryOverviewRecord,
  layer: MemoryLayer
): MemoryDisplayRecord {
  return {
    record_id: record.record_id,
    content: record.content,
    layer,
    topic_tags: record.topic_tags,
    source_ai: record.source_ai,
    timestamp_ms: record.timestamp * 1000,
    access_count: record.access_count,
    positive_feedback: record.positive_feedback,
    negative_feedback: record.negative_feedback,
  };
}

/**
 * Convert a full record (ISO string, has layer) to a display record.
 */
export function fullRecordToDisplay(record: MemoryRecord): MemoryDisplayRecord {
  return {
    record_id: record.record_id,
    content: record.content,
    layer: record.layer,
    topic_tags: record.topic_tags,
    source_ai: record.source_ai,
    timestamp_ms: new Date(record.created_at).getTime(),
    access_count: record.access_count,
    positive_feedback: record.positive_feedback,
    negative_feedback: record.negative_feedback,
    score: record.score,
  };
}
