/**
 * ============================================
 * AeroNyx Privacy Network - Auth Store
 * ============================================
 * File Path: stores/authStore.ts
 * 
 * Creation Reason: Global state management for authentication
 * Dependencies:
 *   - types/index.ts (type definitions)
 *   - lib/constants.ts (storage keys)
 *   - lib/api.ts (API client)
 *   - zustand (state management)
 * 
 * Last Modified: v1.0.0 - Initial auth store implementation
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
// Wallet Connection Helpers
// ============================================

async function connectPhantom(): Promise<WalletInfo> {
  if (!window.solana?.isPhantom) {
    throw new Error(ERROR_MESSAGES.WALLET_NOT_FOUND + ' Please install Phantom.');
  }

  try {
    const response = await window.solana.connect();
    return {
      address: response.publicKey.toString(),
      type: 'SOL',
      provider: 'phantom',
    };
  } catch {
    throw new Error(ERROR_MESSAGES.WALLET_CONNECTION_FAILED);
  }
}

async function connectMetaMask(): Promise<WalletInfo> {
  if (!window.ethereum?.isMetaMask) {
    throw new Error(ERROR_MESSAGES.WALLET_NOT_FOUND + ' Please install MetaMask.');
  }

  try {
    const accounts = await window.ethereum.request({
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
  } catch {
    throw new Error(ERROR_MESSAGES.WALLET_CONNECTION_FAILED);
  }
}

async function connectOKX(): Promise<WalletInfo> {
  if (window.okxwallet?.solana) {
    try {
      const response = await window.okxwallet.solana.connect();
      return {
        address: response.publicKey.toString(),
        type: 'SOL',
        provider: 'okx',
      };
    } catch {
      // Fall through to try Ethereum
    }
  }

  if (window.okxwallet?.ethereum) {
    try {
      const accounts = await window.okxwallet.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[];
      
      if (accounts && accounts.length > 0) {
        return {
          address: accounts[0],
          type: 'ETH',
          provider: 'okx',
        };
      }
    } catch {
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
  
  let signedMessage: { signature: Uint8Array };
  
  if (provider === 'phantom' && window.solana) {
    signedMessage = await window.solana.signMessage(encodedMessage, 'utf8');
  } else if (provider === 'okx' && window.okxwallet?.solana) {
    signedMessage = await window.okxwallet.solana.signMessage(encodedMessage, 'utf8');
  } else {
    throw new Error(ERROR_MESSAGES.SIGNATURE_FAILED);
  }

  return Array.from(signedMessage.signature)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function signEthereumMessage(
  message: string,
  address: string,
  provider: WalletProvider
): Promise<string> {
  let signature: string;

  if (provider === 'metamask' && window.ethereum) {
    signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address],
    }) as string;
  } else if (provider === 'okx' && window.okxwallet?.ethereum) {
    signature = await window.okxwallet.ethereum.request({
      method: 'personal_sign',
      params: [message, address],
    }) as string;
  } else {
    throw new Error(ERROR_MESSAGES.SIGNATURE_FAILED);
  }

  return signature;
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
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    localStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESS);
    localStorage.removeItem(STORAGE_KEYS.WALLET_TYPE);

    if (window.solana?.isPhantom) {
      window.solana.disconnect().catch(() => {});
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
