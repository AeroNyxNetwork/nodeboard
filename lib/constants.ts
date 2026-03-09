/**
 * ============================================
 * AeroNyx Privacy Network - Constants
 * ============================================
 * File Path: lib/constants.ts
 *
 * Creation Reason: Centralized configuration and constants
 * Modification Reason:
 *   v1.2.0 - Added MemChain MPI endpoints for Memory Explorer:
 *     - MPI_STATUS, MPI_OVERVIEW, MPI_SEARCH, MPI_RECORD,
 *       MPI_REMEMBER, MPI_FORGET, MPI_EMBED in API_ENDPOINTS
 *     - MEMORY_POLLING_INTERVAL for overview refresh
 *   v1.1.0 - Added Agent-related constants for Phase 1:
 *     - AGENT_ENDPOINTS in API_ENDPOINTS
 *     - AGENT_POLLING_INTERVAL for transitional status polling (2s)
 *     - AGENT_STATUS_CONFIG for UI rendering
 *     - Agent-related ERROR_MESSAGES and SUCCESS_MESSAGES
 *
 * Main Functionality: API endpoints, polling intervals, storage keys,
 *                     and application-wide configuration values
 * Dependencies: None
 *
 * ⚠️ Important Note for Next Developer:
 * - AGENT_STATUS_CONFIG keys MUST match AgentStatus type in types/agent.ts
 * - AGENT_POLLING_INTERVAL (2000ms) is used by useAgent.ts for transitional states
 * - Agent endpoints use function patterns like NODE_DETAIL — pass node ID
 * - MPI_RECORD endpoint takes both nodeId and recordId
 *
 * Last Modified: v1.2.0 - Added MPI endpoints for Memory Explorer
 * Previous: v1.1.0 - Added Agent constants for Phase 1
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

  // Nodes
  NODES_LIST: '/nodes/',
  NODE_DETAIL: (id: string) => `/nodes/${id}/`,
  NODE_STATUS: (id: string) => `/nodes/${id}/status/`,
  NODE_STATS: (id: string) => `/nodes/${id}/stats/`,
  NODE_SESSIONS: (id: string) => `/nodes/${id}/sessions/`,

  // Agent Management (Phase 1)
  AGENT_STATUS: (nodeId: string) => `/nodes/${nodeId}/agent_status/`,
  AGENT_INSTALL: (nodeId: string) => `/nodes/${nodeId}/install_agent/`,
  AGENT_START: (nodeId: string) => `/nodes/${nodeId}/start_agent/`,
  AGENT_STOP: (nodeId: string) => `/nodes/${nodeId}/stop_agent/`,
  AGENT_RESTART: (nodeId: string) => `/nodes/${nodeId}/restart_agent/`,
  AGENT_UNINSTALL: (nodeId: string) => `/nodes/${nodeId}/uninstall_agent/`,

  // MemChain MPI — Memory Explorer (v1.2.0)
  MPI_STATUS: (nodeId: string) => `/nodes/${nodeId}/mpi/status/`,
  MPI_OVERVIEW: (nodeId: string) => `/nodes/${nodeId}/mpi/overview/`,
  MPI_SEARCH: (nodeId: string) => `/nodes/${nodeId}/mpi/search/`,
  MPI_RECORD: (nodeId: string, recordId: string) => `/nodes/${nodeId}/mpi/record/${recordId}/`,
  MPI_REMEMBER: (nodeId: string) => `/nodes/${nodeId}/mpi/remember/`,
  MPI_FORGET: (nodeId: string) => `/nodes/${nodeId}/mpi/forget/`,
  MPI_EMBED: (nodeId: string) => `/nodes/${nodeId}/mpi/embed/`,
} as const;

// ============================================
// Polling Intervals (in milliseconds)
// ============================================

export const POLLING_INTERVALS = {
  NODES_LIST: 30000,
  NODE_STATUS: 30000,
  SESSIONS_LIST: 60000,
  CODES_LIST: 60000,
  /** Agent status polling during transitional states (installing/starting/stopping/etc.) */
  AGENT_TRANSITIONAL: 2000,
  /** Agent status polling during stable states (running/stopped/etc.) — less frequent */
  AGENT_STABLE: 30000,
  /** Memory overview auto-refresh interval (not aggressive — user-triggered mostly) */
  MEMORY_OVERVIEW: 60000,
} as const;

// ============================================
// WebSocket Configuration (Phase 2)
// ============================================

export const WS_BASE_URL = 'wss://api.aeronyx.network/ws/frontend/tunnel';

/**
 * Build the full WebSocket URL for a node tunnel.
 * @param nodeId - Node UUID
 * @param apiKey - User API key for authentication
 */
export const getWsUrl = (nodeId: string, apiKey: string) =>
  `${WS_BASE_URL}/${nodeId}/?api_key=${apiKey}`;

export const WS_CONFIG = {
  /** Max reconnection attempts before giving up */
  MAX_RECONNECT_ATTEMPTS: 10,
  /** Base delay for exponential backoff (ms) */
  RECONNECT_BASE_DELAY: 1000,
  /** Maximum reconnect delay cap (ms) */
  RECONNECT_MAX_DELAY: 30000,
  /** Ping interval to keep connection alive (ms) */
  PING_INTERVAL: 25000,
  /** Time to wait for pong before considering connection dead (ms) */
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
// Agent Status Configuration (Phase 1)
// ============================================

/**
 * UI configuration for each AgentStatus value.
 * Keys match AgentStatus type in types/agent.ts exactly.
 */
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
  // Agent-specific errors (Phase 1)
  AGENT_INSTALL_FAILED: 'Failed to install OpenClaw. Please try again.',
  AGENT_START_FAILED: 'Failed to start OpenClaw. Please try again.',
  AGENT_STOP_FAILED: 'Failed to stop OpenClaw. Please try again.',
  AGENT_RESTART_FAILED: 'Failed to restart OpenClaw. Please try again.',
  AGENT_UNINSTALL_FAILED: 'Failed to uninstall OpenClaw. Please try again.',
  AGENT_STATUS_FAILED: 'Failed to fetch agent status.',
  // Memory-specific errors (v1.2.0)
  MEMORY_STATUS_FAILED: 'Failed to fetch memory status.',
  MEMORY_OVERVIEW_FAILED: 'Failed to load memories.',
  MEMORY_SEARCH_FAILED: 'Memory search failed. Please try again.',
  MEMORY_REMEMBER_FAILED: 'Failed to create memory. Please try again.',
  MEMORY_FORGET_FAILED: 'Failed to delete memory. Please try again.',
  MEMORY_EDIT_FAILED: 'Failed to edit memory. The old memory was deleted but the new one could not be created. Please try again.',
  MEMORY_NODE_OFFLINE: 'Node is offline. Memory management requires an online node.',
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
  NODE_UPDATED: 'Node updated successfully.',
  COPIED_TO_CLIPBOARD: 'Copied to clipboard!',
  // Agent-specific messages (Phase 1)
  AGENT_INSTALL_TRIGGERED: 'OpenClaw installation started!',
  AGENT_START_TRIGGERED: 'OpenClaw is starting...',
  AGENT_STOP_TRIGGERED: 'OpenClaw is stopping...',
  AGENT_RESTART_TRIGGERED: 'OpenClaw is restarting...',
  AGENT_UNINSTALL_TRIGGERED: 'OpenClaw uninstall started.',
  // Memory-specific messages (v1.2.0)
  MEMORY_CREATED: 'Memory created successfully.',
  MEMORY_DELETED: 'Memory deleted. AI will no longer recall this.',
  MEMORY_UPDATED: 'Memory updated successfully.',
  MEMORY_DUPLICATE: 'This memory already exists.',
} as const;
