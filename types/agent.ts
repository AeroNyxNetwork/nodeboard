/**
 * ============================================
 * AeroNyx Privacy Network - Agent Type Definitions
 * ============================================
 * File Path: types/agent.ts
 *
 * Creation Reason: Phase 1 — Agent Lifecycle Management requires dedicated
 *   type definitions for agent status, control commands, and API responses.
 *   Separated from types/index.ts to keep concerns modular as the agent
 *   system grows (future: multiple agent types, MemChain, etc.)
 *
 * Main Functionality:
 *   - AgentStatus union type (state machine values)
 *   - AgentInfo interface (full agent data from GET /agent_status/)
 *   - API request/response types for install, start, stop, restart, uninstall
 *   - AgentCommand interface (command issued to Rust node)
 *
 * Dependencies:
 *   - None (base types file)
 *
 * Main Logical Flow:
 * 1. AgentStatus defines all valid state machine states
 * 2. AgentInfo represents a single agent instance on a node
 * 3. AgentStatusResponse wraps the GET /agent_status/ response
 * 4. AgentActionResponse wraps POST install/start/stop/restart/uninstall responses
 * 5. InstallAgentRequest defines optional install parameters
 *
 * ⚠️ Important Note for Next Developer:
 * - AgentStatus values MUST match backend exactly (see API doc section 2)
 * - AgentInfo fields map 1:1 to the backend agent object in responses
 * - TRANSITIONAL_STATUSES is used by useAgent.ts for polling logic —
 *   if backend adds new transitional states, add them here too
 * - AgentActionRequest uses agent_type field; currently only "openclaw"
 *   is supported, but the type is string for future extensibility
 *
 * Last Modified: v1.0.0 - Initial agent types for Phase 1
 * ============================================
 */

// ============================================
// Agent Status (State Machine)
// ============================================

/**
 * All possible agent statuses.
 * Maps to the backend state machine:
 *
 *                     install
 * not_installed ─────────────→ installing ──(progress=100)──→ installed
 *       ↑                                                        │
 *       │                                                   start│
 *       │ uninstall                                              ↓
 *       ├──────────── stopped ←──── stopping ←──── running ←── starting
 *       │                              ↑              │
 *       │                              │    restart    │
 *       │                              └──────────────┘
 *       │
 *       └──────────── error (can re-install or start from error)
 */
export type AgentStatus =
  | 'not_installed'
  | 'installing'
  | 'installed'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'updating'
  | 'uninstalling';

/**
 * Statuses that represent an in-progress transition.
 * Used by useAgent.ts to enable polling (every 2s) during these states.
 * When status is NOT in this set, polling stops.
 */
export const TRANSITIONAL_STATUSES: ReadonlySet<AgentStatus> = new Set([
  'installing',
  'starting',
  'stopping',
  'updating',
  'uninstalling',
]);

/**
 * Agent types supported by the system.
 * Currently only "openclaw", but typed as string union for extensibility.
 */
export type AgentType = 'openclaw';

// ============================================
// Agent Info (from GET /agent_status/)
// ============================================

/**
 * Full agent instance data returned by the backend.
 * Represents one agent running (or not) on a specific node.
 */
export interface AgentInfo {
  agent_type: AgentType;
  status: AgentStatus;
  install_progress: number;        // 0-100 during installing
  install_message: string;         // Human-readable progress text
  agent_version: string;           // e.g. "1.0.0" or "" if not installed
  local_port: number | null;       // Port the agent listens on when running
  pid: number | null;              // Process ID when running
  cpu_usage: number;               // CPU usage percentage (0-100)
  memory_mb: number;               // Memory usage in MB
  last_error: string;              // Last error message (empty if no error)
  error_count: number;             // Cumulative error count
  config: Record<string, unknown>; // Agent-specific configuration
  started_at: string | null;       // ISO datetime
  installed_at: string | null;     // ISO datetime
  stopped_at: string | null;       // ISO datetime
  last_health_check: string | null; // ISO datetime
  updated_at: string;              // ISO datetime
}

// ============================================
// API Response Types
// ============================================

/**
 * Response from GET /nodes/{id}/agent_status/
 */
export interface AgentStatusResponse {
  success: boolean;
  data: {
    node_id: string;
    node_name: string;
    node_status: string;
    agents: AgentInfo[];
  };
}

/**
 * Command object returned when an action is triggered.
 * Represents the command queued for the Rust node to execute.
 */
export interface AgentCommand {
  id: string;
  action: string;
  params: Record<string, unknown>;
  priority: number;
  issued_at: string;
}

/**
 * Response from POST install/start/stop/restart/uninstall endpoints.
 * All five endpoints return the same structure.
 */
export interface AgentActionResponse {
  success: boolean;
  data: {
    agent: AgentInfo;
    command: AgentCommand;
  };
  message: string;
}

/**
 * Error response from agent endpoints (e.g. 400 Bad Request).
 */
export interface AgentErrorResponse {
  success: false;
  error: string;
}

// ============================================
// API Request Types
// ============================================

/**
 * Request body for POST /nodes/{id}/install_agent/
 * All fields are optional — backend defaults to agent_type="openclaw", version="latest"
 */
export interface InstallAgentRequest {
  agent_type?: AgentType;
  version?: string;
  config?: Record<string, unknown>;
  download_url?: string;
}

/**
 * Request body for POST start/stop/restart/uninstall endpoints.
 * Only agent_type is needed.
 */
export interface AgentActionRequest {
  agent_type: AgentType;
}
