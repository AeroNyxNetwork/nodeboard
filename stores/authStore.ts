/**
 * ============================================
 * AeroNyx Privacy Network - Auth Store
 * ============================================
 * File Path: stores/authStore.ts
 *
 * Creation Reason: Global state management for authentication
 * Modification Reason: Fix Phantom wallet detection for newer versions
 *   that inject via window.phantom.solana instead of window.solana.
 *   Also fix OKX and MetaMask detection with multiple fallback paths.
 *   Improved error logging — original errors are now logged to console
 *   so developers can debug connection failures.
 * Dependencies:
 *   - types/index.ts (type definitions)
 *   - lib/constants.ts (storage keys)
 *   - lib/api.ts (API client)
 *   - zustand (state management)
 *
 * Main Logical Flow:
 * 1. initialize() reads localStorage to restore session
 * 2. connectWallet() detects and connects to the chosen wallet provider
 * 3. login() requests nonce from backend, signs with wallet, calls backend login
 * 4. logout() clears session and disconnects wallet
 *
 * ⚠️ Important Note for Next Developer:
 * - Wallet providers inject globals at different paths and timings
 * - Always use the getPhantomProvider() / getMetaMaskProvider() / getOKXProvider()
 *   helpers below instead of accessing window.solana / window.ethereum directly
 * - The catch blocks now log original errors — do NOT remove console.error calls
 * - Event listener cleanup for 'auth:logout' is handled by the ref guard
 *   in providers.tsx AuthInitializer — do not call initialize() more than once
 *
 * Last Modified: v1.1.0 - Fixed wallet detection for Phantom, MetaMask, OKX
 * Previous: v1.0.0 - Initial auth store implementation
 * ============================================
 */

import { create } from 'zustand';
import { WalletType, WalletProvider, WalletInfo } from '@/types';
import { STORAGE_KEYS, ERROR_MESSAGES } from '@/lib/constants';
import { api } from '@/lib/api';

// ============================================
// Store State Interface
// ============================================

interface AuthState {
  apiKey: string | null;
  walletAddress: string | null;
  walletType: WalletType | null;
  walletProvider: WalletProvider | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  initialize: () => void;
  connectWallet: (provider: WalletProvider) => Promise<WalletInfo>;
  login: (walletInfo: WalletInfo) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

// ============================================
// Wallet Provider Detection Helpers
// ============================================

/**
 * Get Phantom Solana provider.
 * Newer Phantom versions inject at window.phantom.solana
 * Older versions inject at window.solana
 * Returns the provider object or null if not found.
 */
function getPhantomProvider(): any | null {
  if (typeof window === 'undefined') return null;

  // Prefer window.phantom.solana (newer Phantom versions)
  const phantomSolana = (window as any).phantom?.solana;
  if (phantomSolana?.isPhantom) {
    return phantomSolana;
  }

  // Fallback to window.solana (older Phantom versions)
  const legacySolana = (window as any).solana;
  if (legacySolana?.isPhantom) {
    return legacySolana;
  }

  return null;
}

/**
 * Get MetaMask Ethereum provider.
 * Handles cases where multiple wallets inject window.ethereum.
 * Returns the provider object or null if not found.
 */
function getMetaMaskProvider(): any | null {
  if (typeof window === 'undefined') return null;

  const ethereum = (window as any).ethereum;
  if (!ethereum) return null;

  // If MetaMask is the only provider
  if (ethereum.isMetaMask) {
    return ethereum;
  }

  // If multiple providers exist (e.g. MetaMask + Coinbase),
  // check the providers array
  if (ethereum.providers?.length) {
    const mmProvider = ethereum.providers.find((p: any) => p.isMetaMask);
    if (mmProvider) return mmProvider;
  }

  return null;
}

/**
 * Get OKX Wallet provider.
 * OKX injects at window.okxwallet with .solana and .ethereum sub-providers.
 * Returns { solana?, ethereum? } or null if not found.
 */
function getOKXProvider(): { solana?: any; ethereum?: any } | null {
  if (typeof window === 'undefined') return null;

  const okx = (window as any).okxwallet;
  if (!okx) return null;

  if (okx.solana || okx.ethereum) {
    return { solana: okx.solana, ethereum: okx.ethereum };
  }

  return null;
}

// ============================================
// Wallet Connection Helpers
// ============================================

async function connectPhantom(): Promise<WalletInfo> {
  const provider = getPhantomProvider();

  if (!provider) {
    throw new Error(
      ERROR_MESSAGES.WALLET_NOT_FOUND +
      ' Phantom wallet not detected. Please install it from https://phantom.app/'
    );
  }

  try {
    // Strategy to handle Phantom's "Unexpected error" (known issue):
    // This error occurs when Phantom is locked, in a bad state, or
    // conflicting with other wallet extensions (e.g. Backpack).
    //
    // Approach:
    // 1. Disconnect to clear any stale state (ignore errors)
    // 2. Small delay to let Phantom settle
    // 3. Try connect() which should trigger the approval popup

    // Step 1: Clear any stale connection state
    try {
      await provider.disconnect();
    } catch {
      // disconnect() can fail if never connected — ignore
    }

    // Step 2: Small delay to let Phantom's internal state settle
    await new Promise(resolve => setTimeout(resolve, 200));

    // Step 3: Attempt connection (shows Phantom approval popup)
    const response = await provider.connect();

    return {
      address: response.publicKey.toString(),
      type: 'SOL',
      provider: 'phantom',
    };
  } catch (err) {
    console.error('[AeroNyx] Phantom connect error:', err);

    // Provide specific, actionable error messages
    const errMsg = err instanceof Error ? err.message : String(err);

    if (errMsg.includes('User rejected')) {
      throw new Error('Connection request was rejected. Please try again and approve in Phantom.');
    }

    if (errMsg.includes('Unexpected error')) {
      throw new Error(
        'Phantom returned an unexpected error. Please try:\n' +
        '1. Click the Phantom icon and make sure your wallet is unlocked\n' +
        '2. Temporarily disable other wallet extensions (e.g. Backpack)\n' +
        '3. Refresh the page and try again'
      );
    }

    throw new Error(ERROR_MESSAGES.WALLET_CONNECTION_FAILED);
  }
}

async function connectMetaMask(): Promise<WalletInfo> {
  const provider = getMetaMaskProvider();

  if (!provider) {
    throw new Error(
      ERROR_MESSAGES.WALLET_NOT_FOUND +
      ' MetaMask not detected. Please install it from https://metamask.io/'
    );
  }

  try {
    const accounts = await provider.request({
      method: 'eth_requestAccounts',
    }) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error(ERROR_MESSAGES.WALLET_CONNECTION_FAILED);
    }

    return {
      address: accounts[0],
      type: 'ETH',
      provider: 'metamask',
    };
  } catch (err) {
    console.error('[AeroNyx] MetaMask connect error:', err);
    throw new Error(ERROR_MESSAGES.WALLET_CONNECTION_FAILED);
  }
}

async function connectOKX(): Promise<WalletInfo> {
  const okx = getOKXProvider();

  if (!okx) {
    throw new Error(
      ERROR_MESSAGES.WALLET_NOT_FOUND +
      ' OKX Wallet not detected. Please install it from https://www.okx.com/web3'
    );
  }

  // Try Solana first
  if (okx.solana) {
    try {
      const response = await okx.solana.connect();
      return {
        address: response.publicKey.toString(),
        type: 'SOL',
        provider: 'okx',
      };
    } catch (err) {
      console.error('[AeroNyx] OKX Solana connect error, trying ETH:', err);
      // Fall through to try Ethereum
    }
  }

  // Try Ethereum
  if (okx.ethereum) {
    try {
      const accounts = await okx.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (accounts && accounts.length > 0) {
        return {
          address: accounts[0],
          type: 'ETH',
          provider: 'okx',
        };
      }
    } catch (err) {
      console.error('[AeroNyx] OKX Ethereum connect error:', err);
      // Fall through to error
    }
  }

  throw new Error(ERROR_MESSAGES.WALLET_NOT_FOUND + ' Please install OKX Wallet.');
}

// ============================================
// Signature Helpers
// ============================================

async function signSolanaMessage(
  message: string,
  provider: WalletProvider
): Promise<string> {
  const encodedMessage = new TextEncoder().encode(message);

  let solanaProvider: any = null;

  if (provider === 'phantom') {
    solanaProvider = getPhantomProvider();
  } else if (provider === 'okx') {
    solanaProvider = getOKXProvider()?.solana;
  }

  if (!solanaProvider) {
    throw new Error(ERROR_MESSAGES.SIGNATURE_FAILED);
  }

  try {
    const signedMessage = await solanaProvider.signMessage(encodedMessage, 'utf8');

    // IMPORTANT: Phantom returns signature as a custom class (not Uint8Array).
    // We must wrap it with new Uint8Array() to ensure Array.from() iterates
    // correctly over all 64 bytes. Without this, some bytes may be skipped,
    // resulting in a signature shorter than the expected 128 hex characters.
    const signatureBytes = new Uint8Array(signedMessage.signature);

    const hex = Array.from(signatureBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Sanity check: ed25519 signature must be exactly 128 hex chars (64 bytes)
    if (hex.length !== 128) {
      console.error(`[AeroNyx] Signature length mismatch: expected 128, got ${hex.length}`);
    }

    return hex;
  } catch (err) {
    console.error('[AeroNyx] Solana signMessage error:', err);
    throw new Error(ERROR_MESSAGES.SIGNATURE_FAILED);
  }
}

async function signEthereumMessage(
  message: string,
  address: string,
  provider: WalletProvider
): Promise<string> {
  let ethProvider: any = null;

  if (provider === 'metamask') {
    ethProvider = getMetaMaskProvider();
  } else if (provider === 'okx') {
    ethProvider = getOKXProvider()?.ethereum;
  }

  if (!ethProvider) {
    throw new Error(ERROR_MESSAGES.SIGNATURE_FAILED);
  }

  try {
    const signature = await ethProvider.request({
      method: 'personal_sign',
      params: [message, address],
    }) as string;
    return signature;
  } catch (err) {
    console.error('[AeroNyx] Ethereum personal_sign error:', err);
    throw new Error(ERROR_MESSAGES.SIGNATURE_FAILED);
  }
}

// ============================================
// Auth Store
// ============================================

export const useAuthStore = create<AuthState>((set, get) => ({
  apiKey: null,
  walletAddress: null,
  walletType: null,
  walletProvider: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  initialize: () => {
    if (typeof window === 'undefined') return;

    const apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    const walletAddress = localStorage.getItem(STORAGE_KEYS.WALLET_ADDRESS);
    const walletType = localStorage.getItem(STORAGE_KEYS.WALLET_TYPE) as WalletType | null;

    if (apiKey && walletAddress && walletType) {
      set({
        apiKey,
        walletAddress,
        walletType,
        isAuthenticated: true,
      });
    }

    window.addEventListener('auth:logout', () => {
      get().logout();
    });
  },

  connectWallet: async (provider: WalletProvider): Promise<WalletInfo> => {
    set({ isLoading: true, error: null });

    try {
      let walletInfo: WalletInfo;

      switch (provider) {
        case 'phantom':
          walletInfo = await connectPhantom();
          break;
        case 'metamask':
          walletInfo = await connectMetaMask();
          break;
        case 'okx':
          walletInfo = await connectOKX();
          break;
        default:
          throw new Error('Unsupported wallet provider');
      }

      set({ walletProvider: provider });
      return walletInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : ERROR_MESSAGES.WALLET_CONNECTION_FAILED;
      console.error('[AeroNyx] connectWallet failed:', error);
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  login: async (walletInfo: WalletInfo): Promise<void> => {
    const { walletProvider } = get();

    if (!walletProvider) {
      throw new Error('Wallet not connected');
    }

    set({ isLoading: true, error: null });

    try {
      const nonceResponse = await api.getNonce(walletInfo.address);

      let signature: string;

      if (walletInfo.type === 'SOL') {
        signature = await signSolanaMessage(nonceResponse.message, walletProvider);
      } else {
        signature = await signEthereumMessage(
          nonceResponse.message,
          walletInfo.address,
          walletProvider
        );
      }

      const loginResponse = await api.login({
        wallet_address: walletInfo.address,
        wallet_type: walletInfo.type,
        signature,
      });

      localStorage.setItem(STORAGE_KEYS.API_KEY, loginResponse.api_key);
      localStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, loginResponse.user.wallet_address);
      localStorage.setItem(STORAGE_KEYS.WALLET_TYPE, loginResponse.user.wallet_type);

      set({
        apiKey: loginResponse.api_key,
        walletAddress: loginResponse.user.wallet_address,
        walletType: loginResponse.user.wallet_type,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : ERROR_MESSAGES.SIGNATURE_FAILED;
      console.error('[AeroNyx] login failed:', error);
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    localStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESS);
    localStorage.removeItem(STORAGE_KEYS.WALLET_TYPE);

    // Disconnect Phantom (try both injection paths)
    const phantomProvider = getPhantomProvider();
    if (phantomProvider) {
      phantomProvider.disconnect().catch(() => {});
    }

    set({
      apiKey: null,
      walletAddress: null,
      walletType: null,
      walletProvider: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
