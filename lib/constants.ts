/**
 * ============================================
 * AeroNyx Privacy Network - Constants
 * ============================================
 * File Path: lib/constants.ts
 * 
 * Creation Reason: Centralized configuration and constants
 * Main Functionality: API endpoints, polling intervals, storage keys,
 *                     and application-wide configuration values
 * 
 * Last Modified: v1.0.0 - Initial constants setup
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
} as const;

// ============================================
// Polling Intervals (in milliseconds)
// ============================================

export const POLLING_INTERVALS = {
  NODES_LIST: 30000,
  NODE_STATUS: 30000,
  SESSIONS_LIST: 60000,
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
} as const;
