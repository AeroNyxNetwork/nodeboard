/**
 * ============================================
 * AeroNyx Privacy Network - Constants
 * ============================================
 * File Path: lib/constants.ts
 *
 * Creation Reason: Centralized configuration and constants
 * Modification Reason:
 *   v1.4.0 - Added public node pool endpoints and visibility config:
 *     New endpoints: NODES_PUBLIC_LIST, NODES_PUBLIC_DETAIL,
 *       NODE_VERIFY_ACCESS
 *     New constants: NODE_VISIBILITY_CONFIG, EXPLORE_PAGE_SIZE
 *     New polling: EXPLORE_PUBLIC_NODES (60s, low frequency)
 *   v1.3.0 - Added MemChain MPI v2.4.0 + v2.5.0 endpoints
 *   v1.2.0 - Added MemChain MPI endpoints for Memory Explorer
 *   v1.1.0 - Added Agent-related constants for Phase 1
 *
 * Main Functionality: API endpoints, polling intervals, storage keys,
 *                     and application-wide configuration values
 * Dependencies: None
 *
 * ⚠️ Important Note for Next Developer:
 * - NODES_PUBLIC_LIST and NODES_PUBLIC_DETAIL use skipAuth: true in api.ts
 *   because public nodes are genuinely public (no API Key required)
 * - NODE_VERIFY_ACCESS also uses skipAuth: true (anonymous users can unlock)
 * - NODE_VISIBILITY_CONFIG keys MUST match NodeVisibility type in types/index.ts
 * - AGENT_STATUS_CONFIG keys MUST match AgentStatus type in types/agent.ts
 * - MPI_RECORD endpoint takes both nodeId and recordId
 * - WS_BASE_URL updated to /ws/chat in v1.3.0
 *
 * Last Modified: v1.4.0 - Public node pool endpoints + visibility config
 * Previous: v1.3.0 - MPI v2.4.0 graph + v2.5.0 SuperNode endpoints
 * ============================================
 */

// ============================================
// API Configuration
// ============================================

export const API_BASE_URL = 'https://api.aeronyx.network/api/privacy_network';

export const API_ENDPOINTS = {
  // Authentication
  AUTH_NONCE: '/auth/nonce/',
  AUTH_LOGIN: '/auth/login/',

  // Registration Codes
  CODES_GENERATE: '/codes/generate/',
  CODES_LIST: '/codes/',
  CODES_REVOKE: '/codes/',

  // Owner Nodes (API Key required)
  NODES_LIST: '/nodes/',
  NODE_DETAIL: (id: string) => `/nodes/${id}/`,
  NODE_STATUS: (id: string) => `/nodes/${id}/status/`,
  NODE_STATS: (id: string) => `/nodes/${id}/stats/`,
  NODE_SESSIONS: (id: string) => `/nodes/${id}/sessions/`,
  NODE_WALLET_BANS: (id: string) => `/nodes/${id}/wallet_bans/`,
  NODE_COMMANDS: (id: string) => `/nodes/${id}/commands/`,
  NODE_COMMAND_RUN: (id: string) => `/nodes/${id}/commands/run/`,

  // VPN Observability (operator control plane)
  VPN_OVERVIEW: '/vpn/overview/',
  VPN_SESSIONS: '/vpn/sessions/',
  VPN_BILLING: '/vpn/billing/',
  VPN_EVENTS: '/vpn/events/',
  VPN_NODE_METRICS: (id: string) => `/vpn/nodes/${id}/metrics/`,

  // Public Node Pool (no API Key required) [v1.4.0]
  NODES_PUBLIC_LIST: '/nodes/public/',
  NODES_PUBLIC_DETAIL: (id: string) => `/nodes/public/${id}/`,
  NODE_VERIFY_ACCESS: (id: string) => `/nodes/${id}/verify_access/`,

  // Agent Management (Phase 1)
  AGENT_STATUS: (nodeId: string) => `/nodes/${nodeId}/agent_status/`,
  AGENT_INSTALL: (nodeId: string) => `/nodes/${nodeId}/install_agent/`,
  AGENT_START: (nodeId: string) => `/nodes/${nodeId}/start_agent/`,
  AGENT_STOP: (nodeId: string) => `/nodes/${nodeId}/stop_agent/`,
  AGENT_RESTART: (nodeId: string) => `/nodes/${nodeId}/restart_agent/`,
  AGENT_UNINSTALL: (nodeId: string) => `/nodes/${nodeId}/uninstall_agent/`,

  // MemChain MPI — Core Memory (v1.2.0)
  MPI_STATUS: (nodeId: string) => `/nodes/${nodeId}/mpi/status/`,
  MPI_OVERVIEW: (nodeId: string) => `/nodes/${nodeId}/mpi/overview/`,
  MPI_RECALL: (nodeId: string) => `/nodes/${nodeId}/mpi/recall/`,
  MPI_RECALL_DETAIL: (nodeId: string) => `/nodes/${nodeId}/mpi/recall_detail/`,
  MPI_SEARCH: (nodeId: string) => `/nodes/${nodeId}/mpi/search/`,
  MPI_SEARCH_FTS: (nodeId: string) => `/nodes/${nodeId}/mpi/search_fts/`,
  MPI_RECORD: (nodeId: string, recordId: string) => `/nodes/${nodeId}/mpi/record/${recordId}/`,
  MPI_REMEMBER: (nodeId: string) => `/nodes/${nodeId}/mpi/remember/`,
  MPI_FORGET: (nodeId: string) => `/nodes/${nodeId}/mpi/forget/`,
  MPI_EMBED: (nodeId: string) => `/nodes/${nodeId}/mpi/embed/`,
  MPI_CONTEXT_INJECT: (nodeId: string) => `/nodes/${nodeId}/mpi/context/`,

  // MemChain MPI — Cognitive Graph (v2.4.0)
  MPI_PROJECTS: (nodeId: string) => `/nodes/${nodeId}/mpi/projects/`,
  MPI_PROJECT_DETAIL: (nodeId: string, projectId: string) =>
    `/nodes/${nodeId}/mpi/projects/${projectId}/`,
  MPI_PROJECT_TIMELINE: (nodeId: string, projectId: string) =>
    `/nodes/${nodeId}/mpi/projects/${projectId}/timeline/`,
  MPI_SESSION_DETAIL: (nodeId: string, sessionId: string) =>
    `/nodes/${nodeId}/mpi/sessions/${sessionId}/`,
  MPI_SESSION_CONVERSATION: (nodeId: string, sessionId: string) =>
    `/nodes/${nodeId}/mpi/sessions/${sessionId}/conversation/`,
  MPI_SESSION_ARTIFACTS: (nodeId: string, sessionId: string) =>
    `/nodes/${nodeId}/mpi/sessions/${sessionId}/artifacts/`,
  MPI_ARTIFACT_DETAIL: (nodeId: string, artifactId: string) =>
    `/nodes/${nodeId}/mpi/artifacts/${artifactId}/`,
  MPI_ARTIFACT_VERSIONS: (nodeId: string, artifactId: string) =>
    `/nodes/${nodeId}/mpi/artifacts/${artifactId}/versions/`,
  MPI_ENTITIES: (nodeId: string) => `/nodes/${nodeId}/mpi/entities/`,
  MPI_ENTITY_DETAIL: (nodeId: string, entityId: string) =>
    `/nodes/${nodeId}/mpi/entities/${entityId}/`,
  MPI_ENTITY_GRAPH: (nodeId: string, entityId: string) =>
    `/nodes/${nodeId}/mpi/entities/${entityId}/graph/`,
  MPI_ENTITY_TIMELINE: (nodeId: string, entityId: string) =>
    `/nodes/${nodeId}/mpi/entities/${entityId}/timeline/`,
  MPI_COMMUNITIES: (nodeId: string) => `/nodes/${nodeId}/mpi/communities/`,

  // MemChain MPI — SuperNode Management (v2.5.0)
  MPI_SUPERNODE_TASKS: (nodeId: string) => `/nodes/${nodeId}/mpi/supernode/tasks/`,
  MPI_SUPERNODE_TASK_DETAIL: (nodeId: string, taskId: string) =>
    `/nodes/${nodeId}/mpi/supernode/tasks/${taskId}/`,
  MPI_SUPERNODE_TASK_RETRY: (nodeId: string, taskId: string) =>
    `/nodes/${nodeId}/mpi/supernode/tasks/${taskId}/retry/`,
  MPI_SUPERNODE_TASK_CANCEL: (nodeId: string, taskId: string) =>
    `/nodes/${nodeId}/mpi/supernode/tasks/${taskId}/cancel/`,
  MPI_SUPERNODE_USAGE: (nodeId: string) => `/nodes/${nodeId}/mpi/supernode/usage/`,
  MPI_SUPERNODE_HEALTH: (nodeId: string) => `/nodes/${nodeId}/mpi/supernode/health/`,
} as const;

// ============================================
// Polling Intervals (ms)
// ============================================

export const POLLING_INTERVALS = {
  NODES_LIST: 30000,
  NODE_STATUS: 30000,
  SESSIONS_LIST: 60000,
  VPN_OVERVIEW: 30000,
  VPN_SESSIONS: 15000,
  VPN_EVENTS: 15000,
  VPN_NODE_METRICS: 30000,
  CODES_LIST: 60000,
  AGENT_TRANSITIONAL: 2000,
  AGENT_STABLE: 30000,
  MEMORY_OVERVIEW: 60000,
  SUPERNODE_TASKS: 5000,
  /** Public node pool — low frequency, data doesn't change rapidly */
  EXPLORE_PUBLIC_NODES: 60000,
} as const;

// ============================================
// React Query Stale Times (ms)
// ============================================

export const STALE_TIMES = {
  MEMORY_GRAPH: 5 * 60 * 1000,
  MEMORY_DETAIL: 10 * 60 * 1000,
  SUPERNODE_TASKS: 5000,
  /** Public nodes list — 30s stale, refreshes on window focus */
  PUBLIC_NODES: 30 * 1000,
} as const;

// ============================================
// Public Node Pool Config [v1.4.0]
// ============================================

export const EXPLORE_PAGE_SIZE = 20;

// ============================================
// WebSocket Configuration
// ============================================

export const WS_BASE_URL = 'wss://api.aeronyx.network/ws/chat';

export const getWsUrl = (nodeId: string, apiKey: string) =>
  `${WS_BASE_URL}/${nodeId}/?api_key=${apiKey}`;

export const WS_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 10,
  RECONNECT_BASE_DELAY: 1000,
  RECONNECT_MAX_DELAY: 30000,
  PING_INTERVAL: 25000,
  PONG_TIMEOUT: 10000,
} as const;

// ============================================
// Local Storage Keys
// ============================================

export const STORAGE_KEYS = {
  API_KEY: 'aeronyx_api_key',
  WALLET_ADDRESS: 'aeronyx_wallet_address',
  WALLET_TYPE: 'aeronyx_wallet_type',
  THEME: 'aeronyx_theme',
} as const;

// ============================================
// Theme Colors
// ============================================

export const THEME_COLORS = {
  primary: {
    DEFAULT: '#8A2BE2',
    light: '#A855F7',
    dark: '#6B21A8',
  },
  status: {
    online: '#10B981',
    offline: '#6B7280',
    suspended: '#EF4444',
    warning: '#F59E0B',
    ai_running: '#3B82F6',
    ai_installing: '#8B5CF6',
  },
} as const;

// ============================================
// Node Status Configuration
// ============================================

export const NODE_STATUS_CONFIG = {
  online: {
    label: 'Online',
    color: THEME_COLORS.status.online,
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/50',
  },
  offline: {
    label: 'Offline',
    color: THEME_COLORS.status.offline,
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/50',
  },
  suspended: {
    label: 'Suspended',
    color: THEME_COLORS.status.suspended,
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/50',
  },
} as const;

// ============================================
// Node Visibility Configuration [v1.4.0]
// Keys MUST match NodeVisibility type in types/index.ts
// ============================================

export const NODE_VISIBILITY_CONFIG = {
  private: {
    label: 'Private',
    description: 'Only visible to you',
    icon: '🔒',
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/50',
  },
  public: {
    label: 'Public',
    description: 'Visible to all users in the node pool',
    icon: '🌐',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/50',
  },
  password_protected: {
    label: 'Password Protected',
    description: 'Visible to users who know the password',
    icon: '🔑',
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/50',
  },
  unlisted: {
    label: 'Unlisted',
    description: 'Accessible via direct link only',
    icon: '🔗',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/50',
  },
} as const;

// ============================================
// Agent Status Configuration (Phase 1)
// ============================================

export const AGENT_STATUS_CONFIG = {
  not_installed: {
    label: 'Not Installed',
    description: 'Deploy OpenClaw AI engine on this node',
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/50',
    dotColor: 'bg-gray-400',
    animate: false,
  },
  installing: {
    label: 'Installing',
    description: 'OpenClaw is being installed...',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/50',
    dotColor: 'bg-purple-400',
    animate: true,
  },
  installed: {
    label: 'Installed',
    description: 'OpenClaw is installed and ready to start',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/50',
    dotColor: 'bg-blue-400',
    animate: false,
  },
  starting: {
    label: 'Starting',
    description: 'OpenClaw is starting up...',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/50',
    dotColor: 'bg-blue-400',
    animate: true,
  },
  running: {
    label: 'Running',
    description: 'OpenClaw is active and serving requests',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/50',
    dotColor: 'bg-emerald-400',
    animate: true,
  },
  stopping: {
    label: 'Stopping',
    description: 'OpenClaw is shutting down...',
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/50',
    dotColor: 'bg-yellow-400',
    animate: true,
  },
  stopped: {
    label: 'Stopped',
    description: 'OpenClaw is installed but not running',
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/50',
    dotColor: 'bg-yellow-400',
    animate: false,
  },
  error: {
    label: 'Error',
    description: 'OpenClaw encountered an error',
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/50',
    dotColor: 'bg-red-400',
    animate: false,
  },
  updating: {
    label: 'Updating',
    description: 'OpenClaw is being updated...',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/50',
    dotColor: 'bg-purple-400',
    animate: true,
  },
  uninstalling: {
    label: 'Uninstalling',
    description: 'OpenClaw is being removed...',
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/50',
    dotColor: 'bg-red-400',
    animate: true,
  },
} as const;

// ============================================
// Registration Code Status Configuration
// ============================================

export const CODE_STATUS_CONFIG = {
  unused: {
    label: 'Available',
    color: THEME_COLORS.status.online,
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
  },
  used: {
    label: 'Used',
    color: THEME_COLORS.status.offline,
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400',
  },
  expired: {
    label: 'Expired',
    color: THEME_COLORS.status.warning,
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
  },
  revoked: {
    label: 'Revoked',
    color: THEME_COLORS.status.suspended,
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
  },
} as const;

// ============================================
// SuperNode Task Status Configuration (v2.5.0)
// ============================================

export const SUPERNODE_TASK_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/50',
    dotColor: 'bg-yellow-400',
    animate: true,
  },
  processing: {
    label: 'Processing',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/50',
    dotColor: 'bg-blue-400',
    animate: true,
  },
  completed: {
    label: 'Completed',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/50',
    dotColor: 'bg-emerald-400',
    animate: false,
  },
  failed: {
    label: 'Failed',
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/50',
    dotColor: 'bg-red-400',
    animate: false,
  },
  cancelled: {
    label: 'Cancelled',
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/50',
    dotColor: 'bg-gray-400',
    animate: false,
  },
} as const;

// ============================================
// Error Messages
// ============================================

export const ERROR_MESSAGES = {
  WALLET_NOT_FOUND: 'Wallet not detected. Please install a Web3 wallet.',
  WALLET_CONNECTION_FAILED: 'Failed to connect wallet. Please try again.',
  SIGNATURE_REJECTED: 'Signature request was rejected.',
  SIGNATURE_FAILED: 'Signature verification failed. Please try again.',
  API_ERROR: 'An error occurred. Please try again later.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SESSION_EXPIRED: 'Session expired. Please reconnect your wallet.',
  UNAUTHORIZED: 'Unauthorized. Please reconnect your wallet.',
  // Node settings [v1.4.0]
  NODE_UPDATE_FAILED: 'Failed to update node settings. Please try again.',
  NODE_PASSWORD_REQUIRED: 'A password is required for password-protected nodes.',
  // Public node pool [v1.4.0]
  EXPLORE_LOAD_FAILED: 'Failed to load nodes. Please try again.',
  VERIFY_ACCESS_FAILED: 'Invalid password. Please try again.',
  // Agent-specific errors (Phase 1)
  AGENT_INSTALL_FAILED: 'Failed to install OpenClaw. Please try again.',
  AGENT_START_FAILED: 'Failed to start OpenClaw. Please try again.',
  AGENT_STOP_FAILED: 'Failed to stop OpenClaw. Please try again.',
  AGENT_RESTART_FAILED: 'Failed to restart OpenClaw. Please try again.',
  AGENT_UNINSTALL_FAILED: 'Failed to uninstall OpenClaw. Please try again.',
  AGENT_STATUS_FAILED: 'Failed to fetch agent status.',
  // Memory errors (v1.2.0)
  MEMORY_STATUS_FAILED: 'Failed to fetch memory status.',
  MEMORY_OVERVIEW_FAILED: 'Failed to load memories.',
  MEMORY_SEARCH_FAILED: 'Memory search failed. Please try again.',
  MEMORY_REMEMBER_FAILED: 'Failed to create memory. Please try again.',
  MEMORY_FORGET_FAILED: 'Failed to delete memory. Please try again.',
  MEMORY_EDIT_FAILED: 'Failed to edit memory.',
  MEMORY_NODE_OFFLINE: 'Node is offline. Memory management requires an online node.',
  MEMORY_PROJECTS_FAILED: 'Failed to load projects.',
  MEMORY_SESSION_FAILED: 'Failed to load session details.',
  MEMORY_ENTITY_FAILED: 'Failed to load entity details.',
  MEMORY_COMMUNITIES_FAILED: 'Failed to load communities.',
  MEMORY_CONVERSATION_FAILED: 'Failed to load conversation replay.',
  MEMORY_ARTIFACTS_FAILED: 'Failed to load code artifacts.',
  // SuperNode errors (v1.3.0)
  SUPERNODE_TASKS_FAILED: 'Failed to load SuperNode task queue.',
  SUPERNODE_TASK_RETRY_FAILED: 'Failed to retry task.',
  SUPERNODE_TASK_CANCEL_FAILED: 'Failed to cancel task.',
  SUPERNODE_USAGE_FAILED: 'Failed to load usage statistics.',
  SUPERNODE_HEALTH_FAILED: 'Failed to check SuperNode health.',
} as const;

// ============================================
// Success Messages
// ============================================

export const SUCCESS_MESSAGES = {
  WALLET_CONNECTED: 'Wallet connected successfully!',
  LOGIN_SUCCESS: 'Login successful!',
  CODE_GENERATED: 'Registration code generated successfully!',
  CODE_REVOKED: 'Registration code revoked.',
  NODE_DELETED: 'Node deleted successfully.',
  NODE_UPDATED: 'Node settings saved.',
  COPIED_TO_CLIPBOARD: 'Copied to clipboard!',
  // Public node pool [v1.4.0]
  VERIFY_ACCESS_SUCCESS: 'Access granted.',
  // Agent messages (Phase 1)
  AGENT_INSTALL_TRIGGERED: 'OpenClaw installation started!',
  AGENT_START_TRIGGERED: 'OpenClaw is starting...',
  AGENT_STOP_TRIGGERED: 'OpenClaw is stopping...',
  AGENT_RESTART_TRIGGERED: 'OpenClaw is restarting...',
  AGENT_UNINSTALL_TRIGGERED: 'OpenClaw uninstall started.',
  // Memory messages (v1.2.0)
  MEMORY_CREATED: 'Memory created successfully.',
  MEMORY_DELETED: 'Memory deleted.',
  MEMORY_UPDATED: 'Memory updated successfully.',
  MEMORY_DUPLICATE: 'This memory already exists.',
  // SuperNode messages (v1.3.0)
  SUPERNODE_TASK_RETRIED: 'Task queued for retry.',
  SUPERNODE_TASK_CANCELLED: 'Task cancelled.',
} as const;
