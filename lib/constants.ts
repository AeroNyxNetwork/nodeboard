/**
 * ============================================
 * AeroNyx Privacy Network - Constants
 * ============================================
 * File Path: lib/constants.ts
 *
 * Creation Reason: Centralized configuration and constants
 * Modification Reason:
 *   v1.5.3 - Added service readiness live refresh cadence for drain/rollout
 *     monitoring on the operator services page.
 *   v1.5.2 - Added VPN server placement endpoint for operator failover view.
 *   v1.5.1 - Removed public discovery endpoints and polling constants.
 *   v1.5.0 - Focused endpoints and polling on VPN operations
 *
 * Main Functionality: API endpoints, polling intervals, storage keys,
 *                     and application-wide configuration values
 * Dependencies: None
 *
 * ⚠️ Important Note for Next Developer:
 * - NODE_VISIBILITY_CONFIG keys MUST match NodeVisibility type in types/index.ts
 *
 * Last Modified: v1.5.3 - Service readiness refresh cadence
 * Previous: v1.4.0 - Public node pool endpoints + visibility config
 * ============================================
 */

// ============================================
// API Configuration
// ============================================

// Backend base:
//   https://api.aeronyx.network/api/privacy_network
// Route registry:
//   /root/aeronyx/privacy_network/urls.py
// Keep endpoint names aligned with lib/api.ts and hooks/useNodes.ts so the
// operator UI can be traced from a component to the exact Django view file.
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
  // Backend: /root/aeronyx/privacy_network/api/nodes.py
  // Serializers: /root/aeronyx/privacy_network/serializers.py
  NODES_LIST: '/nodes/',
  NODE_DETAIL: (id: string) => `/nodes/${id}/`,
  NODE_STATUS: (id: string) => `/nodes/${id}/status/`,
  NODE_STATS: (id: string) => `/nodes/${id}/stats/`,
  NODE_SESSIONS: (id: string) => `/nodes/${id}/sessions/`,

  // VPN node safety controls.
  // Backend: /root/aeronyx/privacy_network/api/vpn_commands.py
  // Service: /root/aeronyx/privacy_network/services/command_service.py
  NODE_WALLET_BANS: (id: string) => `/nodes/${id}/wallet_bans/`,
  NODE_COMMANDS: (id: string) => `/nodes/${id}/commands/`,
  NODE_COMMAND_RUN: (id: string) => `/nodes/${id}/commands/run/`,
  NODE_COMMAND_CANCEL: (id: string, commandId: string) => `/nodes/${id}/commands/${commandId}/cancel/`,

  // VPN Observability (operator control plane)
  // Overview/sessions/metrics backend:
  //   /root/aeronyx/privacy_network/api/vpn_observability.py
  // Billing backend:
  //   /root/aeronyx/privacy_network/api/vpn_billing.py
  // Events backend:
  //   /root/aeronyx/privacy_network/api/vpn_events.py
  // Server placement backend:
  //   /root/aeronyx/privacy_network/api/vpn_servers.py
  VPN_OVERVIEW: '/vpn/overview/',
  VPN_SESSIONS: '/vpn/sessions/',
  VPN_BILLING: '/vpn/billing/',
  VPN_EVENTS: '/vpn/events/',
  VPN_SERVERS: '/vpn/servers/',
  VPN_NODE_METRICS: (id: string) => `/vpn/nodes/${id}/metrics/`,

} as const;

// ============================================
// Polling Intervals (ms)
// ============================================

export const POLLING_INTERVALS = {
  NODES_LIST: 30000,
  NODE_STATUS: 30000,
  SESSIONS_LIST: 60000,
  // Services page live-readiness view:
  // GET /api/privacy_network/vpn/overview/
  // Backend: /root/aeronyx/privacy_network/api/vpn_observability.py
  // Rust: /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
  SERVICE_READINESS: 15000,
  VPN_OVERVIEW: 30000,
  VPN_SESSIONS: 15000,
  VPN_EVENTS: 15000,
  VPN_SERVERS: 30000,
  VPN_NODE_METRICS: 30000,
  CODES_LIST: 60000,
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
  // Node settings [v1.4.0]
  NODE_UPDATE_FAILED: 'Failed to update node settings. Please try again.',
  NODE_PASSWORD_REQUIRED: 'A password is required for password-protected nodes.',
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
} as const;
