/**
 * ============================================
 * AeroNyx Privacy Network - Memory Types
 * ============================================
 * File Path: types/memory.ts
 *
 * Modification Reason (v1.4.0):
 *   Added v2.4.0 cognitive graph types and v2.5.0 SuperNode types
 *   to support Phase 4 MemChain Memory Explorer expansion.
 *
 *   New types added:
 *     Core recall (v2.4.0):
 *       MemoryRecallRequest, MemoryRecallResponse,
 *       MemoryRecallDetailRequest, MemoryRecallDetailResponse,
 *       FtsSearchResult, FtsSearchResponse,
 *       ContextInjectResponse
 *     Cognitive graph — Projects (v2.4.0):
 *       Project, ProjectListResponse,
 *       ProjectDetailResponse, ProjectTimelineEntry,
 *       ProjectTimelineResponse
 *     Cognitive graph — Sessions (v2.4.0):
 *       MpiSession, SessionDetailResponse,
 *       ConversationTurn, SessionConversationResponse,
 *       Artifact, ArtifactVersion,
 *       SessionArtifactsResponse, ArtifactDetailResponse,
 *       ArtifactVersionsResponse
 *     Cognitive graph — Entities (v2.4.0):
 *       Entity, KnowledgeEdge, EntityDetailResponse,
 *       EntityGraphNode, EntityGraphEdge, EntityGraphResponse,
 *       EntityTimelineEvent, EntityTimelineResponse
 *     Cognitive graph — Communities (v2.4.0):
 *       Community, CommunityListResponse
 *     SuperNode — Tasks (v2.5.0):
 *       CognitiveTaskStatus, CognitiveTaskType,
 *       CognitiveTask, CognitiveTaskDetail,
 *       TokenUsage, SupernodeTasksResponse,
 *       SupernodeTaskDetailResponse, SupernodeTaskActionResponse
 *     SuperNode — Usage & Health (v2.5.0):
 *       ProviderUsageStat, SupernodeUsageResponse,
 *       ProviderHealthStatus, SupernodeHealthResponse
 *   Extended MemoryStatusData.supernode for v2.5.0 SuperNode status.
 *
 * Modification Reason (v1.3.0):
 *   Rewrote buildCognitiveSummary() for natural-language output.
 *
 * Previous (v1.2.0):
 *   Added defensive timestamp checks, CognitiveSummaryData type,
 *   naive buildCognitiveSummary that concatenated record content.
 *
 * Dependencies:
 *   - Used by hooks/useMemory.ts
 *   - Used by lib/api.ts (MPI methods)
 *   - Used by all components/memories/*.tsx
 *
 * ⚠️ Important Note for Next Developer:
 * - MemoryLayer values MUST match the Rust MemChain layer names exactly
 * - record_id is a hex string (SHA-256 hash), NOT a UUID
 * - API responses always wrap data in { success: boolean, data: T }
 * - The "edit" operation is forget + remember (no atomic update API)
 * - `timestamp` in overview records is Unix SECONDS — multiply by 1000 for JS Date
 * - Records in overview do NOT have a `layer` field; layer is the parent key
 * - buildCognitiveSummary() is frontend template logic — replace with
 *   /mpi/summary/ backend endpoint when available
 * - entity_id / project_id / session_id / artifact_id / community_id are all
 *   string IDs (prefixed hex), NOT UUIDs
 * - CognitiveTaskType string values must match Rust config_supernode.rs as_str()
 *   exactly: "session_title" | "community_narrative" | "conflict_resolution" |
 *   "recall_synthesis" | "code_analysis" | "entity_description"
 * - SuperNode endpoints return 404 when supernode.enabled=false on the node.
 *   Always check MemoryStatusData.supernode?.enabled before showing SuperNode UI.
 *
 * Last Modified: v1.4.0 - Added v2.4.0 cognitive graph types + v2.5.0 SuperNode types
 * Previous: v1.3.0 - Natural-language cognitive summary builder
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
// API Response Types — Core Memory (v1.2.0)
// ============================================

/** GET /mpi/status/ — v2.5.0: extended with supernode field */
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
  /**
   * v2.5.0 SuperNode status (absent when supernode.enabled=false on node).
   * Always check this before rendering SuperNode UI components.
   */
  supernode?: {
    enabled: boolean;
    provider_count: number;
    pending_tasks: number;
    processing_tasks: number;
    completed_tasks_today: number;
    failed_tasks_today: number;
  } | null;
}

export interface MemoryStatusResponse {
  success: boolean;
  data: MemoryStatusData;
}

/** GET /mpi/overview/ */
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

/** POST /mpi/search/ — semantic search (embed + recall combo) */
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
// API Response Types — Hybrid Recall (v1.4.0 / v2.4.0 backend)
// ============================================

/**
 * POST /mpi/recall/ — hybrid recall (vector + BM25 + graph + cross-encoder).
 *
 * mode='full'  (default): returns complete memory content in results
 * mode='index': returns only record IDs — use recallMemoryDetail() for content
 *
 * The index mode enables progressive retrieval (load summaries first,
 * then fetch full content on demand).
 */
export interface MemoryRecallRequest {
  query?: string;
  embedding?: number[];
  embedding_model?: string;
  top_k?: number;
  mode?: 'full' | 'index';
  layer_filter?: MemoryLayer;
  tag_filter?: string[];
  min_score?: number;
}

export interface MemoryRecallData {
  memories: MemoryRecord[];
  total: number;
  mode: 'full' | 'index';
}

export interface MemoryRecallResponse {
  success: boolean;
  data: MemoryRecallData;
}

/**
 * POST /mpi/recall_detail/ — progressive retrieval step 2.
 * Fetch full content for specific record IDs returned by recall(mode='index').
 */
export interface MemoryRecallDetailRequest {
  record_ids: string[];
}

export interface MemoryRecallDetailResponse {
  success: boolean;
  data: {
    memories: MemoryRecord[];
  };
}

// ============================================
// API Response Types — FTS Search (v1.4.0 / v2.4.0 backend)
// ============================================

/** GET /mpi/search_fts/?q=... — FTS5 BM25 keyword search with snippet highlights */
export interface FtsSearchResult {
  record_id: string;
  /** Highlighted snippet with matched terms (HTML-safe, use dangerouslySetInnerHTML or strip tags) */
  snippet: string;
  /** Layer the record belongs to */
  layer: MemoryLayer;
  source_ai: string;
  timestamp: number; // Unix seconds
}

export interface FtsSearchResponse {
  success: boolean;
  data: {
    query: string;
    results: FtsSearchResult[];
    total: number;
  };
}

// ============================================
// API Response Types — Context Inject (v1.4.0 / v2.4.0 backend)
// ============================================

/** GET /mpi/context/ — auto context injection for new sessions */
export interface ContextInjectResponse {
  success: boolean;
  data: {
    context: string;
    record_ids: string[];
    token_count: number;
  };
}

// ============================================
// API Response Types — Projects (v1.4.0 / v2.4.0 backend)
// ============================================

export interface Project {
  project_id: string;
  name: string;
  status: 'active' | 'archived' | 'paused';
  community_id: string;
  /** ISO string or null */
  last_active_at: string | null;
  session_count: number;
  entity_count: number;
  description?: string | null;
}

export interface ProjectListResponse {
  success: boolean;
  data: {
    projects: Project[];
    total: number;
  };
}

export interface ProjectDetailResponse {
  success: boolean;
  data: Project & {
    /** Top entities in this project's community */
    top_entities: Array<{
      entity_id: string;
      name: string;
      entity_type: string;
      mention_count: number;
    }>;
    recent_sessions: Array<{
      session_id: string;
      title: string | null;
      started_at: number;
      turn_count: number;
    }>;
  };
}

export interface ProjectTimelineEntry {
  date: string; // YYYY-MM-DD
  sessions: Array<{
    session_id: string;
    title: string | null;
    started_at: number; // Unix seconds
    turn_count: number;
    summary: string | null;
  }>;
}

export interface ProjectTimelineResponse {
  success: boolean;
  data: {
    project_id: string;
    project_name: string;
    timeline: ProjectTimelineEntry[];
  };
}

// ============================================
// API Response Types — Sessions (v1.4.0 / v2.4.0 backend)
// ============================================

export interface MpiSession {
  session_id: string;
  /**
   * LLM-generated title (v2.5.0 SuperNode).
   * May be null if SuperNode hasn't processed the session yet.
   * Fallback: use summary or session_id prefix.
   */
  title: string | null;
  summary: string | null;
  project_id: string | null;
  started_at: number; // Unix seconds
  ended_at: number | null; // Unix seconds
  turn_count: number;
  source_ai: string;
  entities_extracted: boolean;
  summary_generated: boolean;
}

export interface SessionDetailResponse {
  success: boolean;
  data: MpiSession;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  turn_index: number;
  timestamp: number; // Unix seconds
}

export interface SessionConversationResponse {
  success: boolean;
  data: {
    session_id: string;
    title: string | null;
    turns: ConversationTurn[];
    total_turns: number;
  };
}

export interface Artifact {
  artifact_id: string;
  session_id: string;
  project_id: string | null;
  artifact_type: string; // 'code' | 'text' | ...
  title: string | null;
  language: string | null;
  version: number;
  content_hash: string;
  line_count: number | null;
  created_at: number; // Unix seconds
}

export interface SessionArtifactsResponse {
  success: boolean;
  data: {
    session_id: string;
    artifacts: Artifact[];
    total: number;
  };
}

export interface ArtifactDetail extends Artifact {
  /** Base64-encoded or raw string content */
  content: string;
  description: string | null;
}

export interface ArtifactDetailResponse {
  success: boolean;
  data: ArtifactDetail;
}

export interface ArtifactVersion {
  artifact_id: string;
  version: number;
  content_hash: string;
  created_at: number; // Unix seconds
}

export interface ArtifactVersionsResponse {
  success: boolean;
  data: {
    artifact_id: string;
    versions: ArtifactVersion[];
  };
}

// ============================================
// API Response Types — Entities (v1.4.0 / v2.4.0 backend)
// ============================================

export interface Entity {
  entity_id: string;
  name: string;
  name_normalized: string;
  entity_type: string; // 'technology' | 'module' | 'project' | 'person' | 'concept' | ...
  /**
   * LLM-generated description (v2.5.0 SuperNode).
   * May be null or short auto-description if SuperNode hasn't processed yet.
   */
  description: string | null;
  mention_count: number;
  community_id: string | null;
  created_at: number; // Unix seconds
  updated_at: number; // Unix seconds
}

export interface KnowledgeEdge {
  edge_id: number;
  source_id: string;
  target_id: string;
  source_name: string;
  target_name: string;
  relation_type: string; // 'USES' | 'DEPENDS_ON' | 'RELATED_TO' | 'CO_OCCURS' | ...
  weight: number;
  confidence: number;
  valid_from: number; // Unix seconds
  valid_until: number | null;
  fact_text: string | null;
}

export interface EntityDetailResponse {
  success: boolean;
  data: Entity & {
    edges: KnowledgeEdge[];
    edge_count: number;
  };
}

/** BFS subgraph node (may include entities beyond the root entity) */
export interface EntityGraphNode {
  entity_id: string;
  name: string;
  entity_type: string;
  mention_count: number;
  /** true = the queried entity, false = neighbor */
  is_root: boolean;
}

export interface EntityGraphEdge {
  source_id: string;
  target_id: string;
  relation_type: string;
  weight: number;
}

export interface EntityGraphResponse {
  success: boolean;
  data: {
    root_entity_id: string;
    nodes: EntityGraphNode[];
    edges: EntityGraphEdge[];
  };
}

export interface EntityTimelineEvent {
  session_id: string;
  session_title: string | null;
  episode_id: string;
  role: string;
  timestamp: number; // Unix seconds
}

export interface EntityTimelineResponse {
  success: boolean;
  data: {
    entity_id: string;
    entity_name: string;
    events: EntityTimelineEvent[];
    total: number;
  };
}

// ============================================
// API Response Types — Communities (v1.4.0 / v2.4.0 backend)
// ============================================

export interface Community {
  community_id: string;
  name: string;
  entity_count: number;
  /**
   * LLM-generated narrative summary (v2.5.0 SuperNode).
   * May start with "Community with" if SuperNode hasn't generated a narrative yet.
   * Use this as a fallback indicator: if starts with "Community with", show a
   * "Generating summary..." placeholder instead.
   */
  summary: string | null;
  description: string | null;
  /** True if this community has been promoted to a tracked project */
  has_project: boolean;
  project_id: string | null;
}

export interface CommunityListResponse {
  success: boolean;
  data: {
    communities: Community[];
    total: number;
  };
}

// ============================================
// API Response Types — SuperNode Tasks (v1.4.0 / v2.5.0 backend)
// ============================================

/**
 * Cognitive task status values.
 * Matches Rust storage_supernode.rs status strings exactly.
 */
export type CognitiveTaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Cognitive task type string values.
 * Matches Rust CognitiveTaskType::as_str() exactly.
 */
export type CognitiveTaskType =
  | 'session_title'
  | 'community_narrative'
  | 'conflict_resolution'
  | 'recall_synthesis'
  | 'code_analysis'
  | 'entity_description';

export interface TokenUsage {
  input: number;
  output: number;
  cached: number;
}

/** Task row in the queue listing */
export interface CognitiveTask {
  id: number;
  task_type: CognitiveTaskType;
  status: CognitiveTaskStatus;
  priority: number;
  target_table: string | null;
  target_id: string | null;
  privacy_level: string;
  provider_used: string | null;
  model_used: string | null;
  token_usage: TokenUsage | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: number; // Unix seconds
  started_at: number | null;
  completed_at: number | null;
}

/** Task detail — includes payload, result, and prompt messages */
export interface CognitiveTaskDetail extends CognitiveTask {
  /** JSON string of the input data sent to the prompt builder */
  payload: string;
  /** LLM result (may be truncated to 8192 chars) */
  result: string | null;
  /** JSON array of messages sent to the LLM */
  prompt_messages: string | null;
}

export interface SupernodeTasksResponse {
  success: boolean;
  data: {
    tasks: CognitiveTask[];
    total: number;
  };
}

export interface SupernodeTaskDetailResponse {
  success: boolean;
  data: CognitiveTaskDetail;
}

export interface SupernodeTaskActionResponse {
  success: boolean;
  data: {
    task_id: number;
    status: CognitiveTaskStatus;
    message: string;
  };
}

// ============================================
// API Response Types — SuperNode Usage & Health (v1.4.0 / v2.5.0 backend)
// ============================================

export interface ProviderUsageStat {
  provider: string;
  model: string;
  task_type: CognitiveTaskType;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cached_tokens: number;
  avg_latency_ms: number;
  /** Estimated cost in USD (calculated at query time, may change if rates change) */
  estimated_cost_usd: number;
}

export interface SupernodeUsageResponse {
  success: boolean;
  data: {
    period: string; // YYYY-MM
    stats: ProviderUsageStat[];
    totals: {
      total_calls: number;
      total_input_tokens: number;
      total_output_tokens: number;
      estimated_cost_usd: number;
    };
  };
}

export interface ProviderHealthStatus {
  provider_name: string;
  model: string;
  is_healthy: boolean;
  latency_ms: number | null;
  error: string | null;
  last_checked_at: number; // Unix seconds
}

export interface SupernodeHealthResponse {
  success: boolean;
  data: {
    providers: ProviderHealthStatus[];
    queue_summary: {
      pending: number;
      processing: number;
      failed_last_hour: number;
    };
  };
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
// Cognitive Task Type UI Labels
// ============================================

export const COGNITIVE_TASK_TYPE_LABELS: Record<CognitiveTaskType, string> = {
  session_title: 'Session Title',
  community_narrative: 'Community Narrative',
  conflict_resolution: 'Conflict Resolution',
  recall_synthesis: 'Recall Synthesis',
  code_analysis: 'Code Analysis',
  entity_description: 'Entity Description',
};

// ============================================
// Utility: Community summary quality check
// ============================================

/**
 * Returns true if the community summary was generated by LLM (SuperNode),
 * false if it's the no-LLM placeholder from Step 11.
 * Use this to show "Generating..." placeholders in the UI.
 */
export function hasLlmCommunityNarrative(community: Community): boolean {
  if (!community.summary) return false;
  return !community.summary.startsWith('Community with');
}

/**
 * Returns true if the session title was generated by LLM (SuperNode),
 * false if it's the no-LLM placeholder from Step 10.
 */
export function hasLlmSessionTitle(session: MpiSession): boolean {
  if (!session.title) return false;
  // no-LLM titles look like "JWT, React, TypeScript" (entity list)
  // or "Project Alpha: JWT, React" — no way to distinguish from LLM without
  // checking if summary starts with "Topics:" (not available here).
  // Best heuristic: title exists = show it, null = show "Processing..."
  return true;
}

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
 */
function extractName(identityRecords: MemoryOverviewRecord[]): string | null {
  for (const r of identityRecords) {
    const patterns = [
      /(?:user'?s?\s+)?name\s+is\s+(\w+)/i,
      /(?:called|named|known as)\s+(\w+)/i,
      /^(\w+)\s+is\s+(?:the\s+)?user/i,
    ];
    for (const pat of patterns) {
      const match = r.content.match(pat);
      if (match?.[1]) {
        const name = match[1];
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
  }
  return null;
}

function toPhrase(content: string): string {
  return content
    .replace(/^(the\s+)?user('?s?)?\s*/i, '')
    .replace(/\.$/, '')
    .trim();
}

/**
 * Build a cognitive summary that reads like AI self-awareness.
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

  let lastMemoryLabel: string | null = null;
  if (overview.last_memory_at) {
    const diff = Math.floor(Date.now() / 1000 - overview.last_memory_at);
    if (diff < 60) lastMemoryLabel = 'just now';
    else if (diff < 3600) lastMemoryLabel = `${Math.floor(diff / 60)}m ago`;
    else if (diff < 86400) lastMemoryLabel = `${Math.floor(diff / 3600)}h ago`;
    else lastMemoryLabel = `${Math.floor(diff / 86400)}d ago`;
  }

  if (overview.total === 0) {
    return { summary: '', totalMemories: 0, activeLayers: 0, lastMemoryLabel: null };
  }

  const sentences: string[] = [];

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
    sentences.push(`Your AI recognizes you as ${otherIdentity[0]}.`);
  }

  const knowledgePhrases = knowledgeRecords
    .slice(0, 5)
    .map((r) => toPhrase(r.content))
    .filter((p) => p.length > 0 && p.length < 120);

  if (knowledgePhrases.length > 0) {
    if (knowledgePhrases.length === 1) {
      sentences.push(`It knows that you ${knowledgePhrases[0]}.`);
    } else if (knowledgePhrases.length === 2) {
      sentences.push(`It knows that you ${knowledgePhrases[0]} and ${knowledgePhrases[1]}.`);
    } else {
      const last = knowledgePhrases[knowledgePhrases.length - 1];
      const rest = knowledgePhrases.slice(0, -1).join(', ');
      sentences.push(`It knows that you ${rest}, and ${last}.`);
    }
  }

  if (episodeRecords.length > 0) {
    const recentPhrase = toPhrase(episodeRecords[0].content);
    if (recentPhrase.length > 0 && recentPhrase.length < 120) {
      sentences.push(`Recently: ${recentPhrase}.`);
    }
  }

  if (sentences.length === 0) {
    sentences.push(
      `Your AI has ${overview.total} memory${overview.total !== 1 ? 's' : ''} about you.`
    );
  }

  const summary = sentences.join(' ').replace(/\.\./g, '.').replace(/\s+/g, ' ').trim();

  return { summary, totalMemories: overview.total, activeLayers, lastMemoryLabel };
}
