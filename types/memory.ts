/**
 * ============================================
 * AeroNyx Privacy Network - Memory Types
 * ============================================
 * File Path: types/memory.ts
 *
 * Modification Reason (v1.3.0):
 *   - Rewrote buildCognitiveSummary() for natural-language output:
 *     • Extracts name from identity records (regex pattern matching)
 *     • Builds structured sentence: "Your AI knows you as [name], ..."
 *     • Groups knowledge into preferences/interests/skills categories
 *     • Falls back gracefully when data is sparse
 *   - Previous v1.2.0 just concatenated raw record content which read
 *     like a database dump, not an AI's cognitive understanding
 *
 * Previous (v1.2.0):
 *   Added defensive timestamp checks, CognitiveSummaryData type,
 *   naive buildCognitiveSummary that concatenated record content.
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
 * - buildCognitiveSummary() is frontend template logic — replace with
 *   /mpi/summary/ backend endpoint when available for true AI summarization
 *
 * Last Modified: v1.3.0 - Natural-language cognitive summary builder
 * Previous: v1.2.0 - Defensive timestamp checks + naive summary
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

/**
 * Cognitive summary data — generated on the frontend from
 * identity + knowledge layer memories for the Hero component.
 */
export interface CognitiveSummaryData {
  /** Human-readable summary paragraph (reads like AI speaking) */
  summary: string;
  /** Total memory count */
  totalMemories: number;
  /** Active layer count (layers with > 0 memories) */
  activeLayers: number;
  /** Relative label for last memory time (e.g., "5m ago") */
  lastMemoryLabel: string | null;
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
// Utility: Safe timestamp parsing
// ============================================

function safeUnixSecondsToMs(timestamp: number | null | undefined): number {
  if (timestamp == null || timestamp <= 0 || !Number.isFinite(timestamp)) {
    return Date.now();
  }
  return timestamp * 1000;
}

function safeIsoToMs(isoString: string | null | undefined): number {
  if (!isoString) return Date.now();
  const ms = new Date(isoString).getTime();
  if (Number.isNaN(ms)) return Date.now();
  return ms;
}

// ============================================
// Utility: Normalize records for UI
// ============================================

export function toDisplayRecord(
  record: MemoryOverviewRecord,
  layer: MemoryLayer
): MemoryDisplayRecord {
  return {
    record_id: record.record_id,
    content: record.content,
    layer,
    topic_tags: record.topic_tags ?? [],
    source_ai: record.source_ai ?? 'unknown',
    timestamp_ms: safeUnixSecondsToMs(record.timestamp),
    access_count: record.access_count ?? 0,
    positive_feedback: record.positive_feedback ?? 0,
    negative_feedback: record.negative_feedback ?? 0,
  };
}

export function fullRecordToDisplay(record: MemoryRecord): MemoryDisplayRecord {
  return {
    record_id: record.record_id,
    content: record.content,
    layer: record.layer,
    topic_tags: record.topic_tags ?? [],
    source_ai: record.source_ai ?? 'unknown',
    timestamp_ms: safeIsoToMs(record.created_at),
    access_count: record.access_count ?? 0,
    positive_feedback: record.positive_feedback ?? 0,
    negative_feedback: record.negative_feedback ?? 0,
    score: record.score,
  };
}

// ============================================
// Utility: Build Cognitive Summary (frontend)
// ============================================

/**
 * Try to extract a user name from identity records.
 * Looks for patterns like "name is X", "called X", "user's name is X", etc.
 */
function extractName(identityRecords: MemoryOverviewRecord[]): string | null {
  for (const r of identityRecords) {
    const c = r.content.toLowerCase();
    // "The user's name is Jonas" / "name is Jonas" / "User is called Jonas"
    const patterns = [
      /(?:user'?s?\s+)?name\s+is\s+(\w+)/i,
      /(?:called|named|known as)\s+(\w+)/i,
      /^(\w+)\s+is\s+(?:the\s+)?user/i,
    ];
    for (const pat of patterns) {
      const match = r.content.match(pat);
      if (match?.[1]) {
        // Capitalize first letter
        const name = match[1];
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
  }
  return null;
}

/**
 * Extract descriptive phrases from record content.
 * Strips common prefixes like "User", "The user", etc.
 * Returns a lowercased phrase suitable for embedding in a sentence.
 */
function toPhrase(content: string): string {
  return content
    .replace(/^(the\s+)?user('?s?)?\s*/i, '')
    .replace(/\.$/, '')
    .trim();
}

/**
 * Build a cognitive summary that reads like AI self-awareness.
 *
 * Strategy:
 * 1. Extract name from identity (if present) → "Your AI knows you as [name]"
 * 2. Pull identity traits (non-name) → "a [trait] who [trait]"
 * 3. Pull knowledge facts → "You [preference], [preference], and [interest]"
 * 4. Mention recent episode if present → "Recently you discussed [topic]"
 * 5. If very few records, keep it short and honest
 *
 * This is NOT AI-generated — it's structured template assembly.
 * Replace with /mpi/summary/ when backend supports it.
 */
export function buildCognitiveSummary(
  overview: MemoryOverviewData | null,
  status: MemoryStatusData | null
): CognitiveSummaryData | null {
  if (!overview || !status) return null;

  const identityRecords = overview.recent_by_layer.identity ?? [];
  const knowledgeRecords = overview.recent_by_layer.knowledge ?? [];
  const episodeRecords = overview.recent_by_layer.episode ?? [];

  const activeLayers = MEMORY_LAYERS_ORDERED.filter(
    (l) => (overview.by_layer[l] ?? 0) > 0
  ).length;

  // Last memory relative label
  let lastMemoryLabel: string | null = null;
  if (overview.last_memory_at) {
    const diff = Math.floor(Date.now() / 1000 - overview.last_memory_at);
    if (diff < 60) lastMemoryLabel = 'just now';
    else if (diff < 3600) lastMemoryLabel = `${Math.floor(diff / 60)}m ago`;
    else if (diff < 86400) lastMemoryLabel = `${Math.floor(diff / 3600)}h ago`;
    else lastMemoryLabel = `${Math.floor(diff / 86400)}d ago`;
  }

  // --- Build summary ---

  // No memories at all
  if (overview.total === 0) {
    return {
      summary: '',
      totalMemories: 0,
      activeLayers: 0,
      lastMemoryLabel: null,
    };
  }

  const sentences: string[] = [];

  // 1. Opening: name + identity
  const name = extractName(identityRecords);
  const otherIdentity = identityRecords
    .filter((r) => {
      const c = r.content.toLowerCase();
      return !c.includes('name is') && !c.includes('called') && !c.includes('named');
    })
    .slice(0, 3)
    .map((r) => toPhrase(r.content))
    .filter((p) => p.length > 0 && p.length < 120);

  if (name && otherIdentity.length > 0) {
    sentences.push(`Your AI knows you as ${name}, ${otherIdentity[0]}.`);
    otherIdentity.slice(1).forEach((trait) => {
      sentences.push(trait.charAt(0).toUpperCase() + trait.slice(1) + '.');
    });
  } else if (name) {
    sentences.push(`Your AI knows you as ${name}.`);
  } else if (otherIdentity.length > 0) {
    const first = otherIdentity[0];
    sentences.push(`Your AI recognizes you as ${first}.`);
  }

  // 2. Knowledge / preferences
  const knowledgePhrases = knowledgeRecords
    .slice(0, 5)
    .map((r) => toPhrase(r.content))
    .filter((p) => p.length > 0 && p.length < 120);

  if (knowledgePhrases.length > 0) {
    if (knowledgePhrases.length === 1) {
      sentences.push(`It knows that you ${knowledgePhrases[0]}.`);
    } else if (knowledgePhrases.length === 2) {
      sentences.push(
        `It knows that you ${knowledgePhrases[0]} and ${knowledgePhrases[1]}.`
      );
    } else {
      const last = knowledgePhrases[knowledgePhrases.length - 1];
      const rest = knowledgePhrases.slice(0, -1).join(', ');
      sentences.push(`It knows that you ${rest}, and ${last}.`);
    }
  }

  // 3. Recent episode
  if (episodeRecords.length > 0) {
    const recentPhrase = toPhrase(episodeRecords[0].content);
    if (recentPhrase.length > 0 && recentPhrase.length < 120) {
      sentences.push(`Recently: ${recentPhrase}.`);
    }
  }

  // 4. Fallback if we have records but couldn't build sentences
  //    (e.g. all records are archive layer)
  if (sentences.length === 0) {
    sentences.push(
      `Your AI has ${overview.total} memory${overview.total !== 1 ? 's' : ''} about you.`
    );
  }

  // Clean up double periods
  const summary = sentences
    .join(' ')
    .replace(/\.\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    summary,
    totalMemories: overview.total,
    activeLayers,
    lastMemoryLabel,
  };
}
