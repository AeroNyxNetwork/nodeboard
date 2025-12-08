/**
 * ============================================
 * AeroNyx Wallet Connect Component
 * ============================================
 * File Path: src/components/auth/WalletConnect.tsx
 * 
 * Creation Reason: Main authentication component for Web3 wallet connection
 * Main Functionality: Display wallet options, handle connection flow,
 *                     and manage authentication state
 * Dependencies:
 *   - src/stores/authStore.ts (auth state)
 *   - src/components/common/Button.tsx
 *   - src/components/common/Card.tsx
 *   - framer-motion (animations)
 * 
 * Main Logical Flow:
 * 1. Display available wallet options
 * 2. Handle wallet connection request
 * 3. Trigger signature request
 * 4. Complete authentication and redirect
 * 
 * ⚠️ Important Note for Next Developer:
 * - Each wallet provider has different availability detection
 * - OKX wallet supports both ETH and SOL
 * - Error states should be user-friendly
 * 
 * Last Modified: v1.0.0 - Initial wallet connect component
 * ============================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { WalletProvider, WalletInfo } from '@/types';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';

// ============================================
// Wallet Configuration
// ============================================

interface WalletOption {
  id: WalletProvider;
  name: string;
  description: string;
  chain: string;
  icon: React.ReactNode;
  checkAvailable: () => boolean;
  downloadUrl: string;
}

const walletOptions: WalletOption[] = [
  {
    id: 'phantom',
    name: 'Phantom',
    description: 'Connect with Solana',
    chain: 'SOL',
    icon: (
      <svg viewBox="0 0 128 128" className="w-full h-full">
        <rect fill="#AB9FF2" width="128" height="128" rx="26"/>
        <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3057 14.4118 64.0583C13.936 87.577 36.0852 107 60.1629 107H65.5765C86.839 107 111.119 89.4991 110.584 64.9142ZM40.4561 63.4584C40.4561 58.5338 44.4469 54.5765 49.4124 54.5765C54.378 54.5765 58.3688 58.5338 58.3688 63.4584C58.3688 68.383 54.378 72.3404 49.4124 72.3404C44.4308 72.3404 40.4561 68.399 40.4561 63.4584ZM74.3331 72.3404C69.3676 72.3404 65.3768 68.383 65.3768 63.4584C65.3768 58.5338 69.3676 54.5765 74.3331 54.5765C79.2987 54.5765 83.2895 58.5338 83.2895 63.4584C83.2895 68.399 79.2826 72.3404 74.3331 72.3404Z" fill="#FFFDF8"/>
      </svg>
    ),
    checkAvailable: () => typeof window !== 'undefined' && !!window.solana?.isPhantom,
    downloadUrl: 'https://phantom.app/',
  },
  {
    id: 'metamask',
    name: 'MetaMask',
    description: 'Connect with Ethereum',
    chain: 'ETH',
    icon: (
      <svg viewBox="0 0 128 128" className="w-full h-full">
        <rect fill="#F5841F" width="128" height="128" rx="26"/>
        <path d="M104.446 36L70.014 61.198l6.395-15.1L104.446 36z" fill="#E2761B" stroke="#E2761B"/>
        <path d="M23.536 36l34.13 25.397-6.077-15.299L23.536 36zM92.133 82.525l-9.166 14.035 19.616 5.396 5.63-19.095-16.08-.336zM19.805 82.861l5.612 19.095 19.615-5.396-9.166-14.035-16.061.336z" fill="#E4761B" stroke="#E4761B"/>
        <path d="M44.166 57.342l-5.46 8.253 19.447.869-.683-20.919-13.304 11.797zM83.816 57.342l-13.455-11.98-.452 21.102 19.43-.869-5.523-8.253zM45.032 96.56l11.713-5.713-10.103-7.889-.161 13.602h-1.449zM71.237 90.847l11.731 5.713-1.61-13.602-10.12 7.889z" fill="#E4761B" stroke="#E4761B"/>
        <path d="M82.968 96.56l-11.73-5.713.936 7.654-.101 3.229 10.895-5.17zM45.032 96.56l10.912 5.17-.084-3.229.92-7.654-11.748 5.713z" fill="#D7C1B3" stroke="#D7C1B3"/>
        <path d="M56.21 77.646l-9.75-2.867 6.882-3.162 2.868 6.029zM71.772 77.646l2.868-6.029 6.899 3.162-9.767 2.867z" fill="#233447" stroke="#233447"/>
        <path d="M45.032 96.56l1.66-14.035-10.826.336 9.166 13.699zM81.308 82.525l1.66 14.035 9.165-13.7-10.825-.335zM89.339 65.595l-19.43.869 1.805 11.182 2.868-6.03 6.899 3.163 7.858-9.184zM46.46 74.779l6.882-3.162 2.868 6.029 1.822-11.182-19.447-.87 7.875 9.185z" fill="#CD6116" stroke="#CD6116"/>
        <path d="M38.585 65.595l8.21 16.008-.285-7.824-7.925-8.184zM81.481 73.779l-.302 7.824 8.16-16.008-7.858 8.184zM58.032 66.464l-1.822 11.182 2.29 11.815.502-15.566-.97-7.431zM69.909 66.464l-.953 7.414.452 15.583 2.306-11.815-1.805-11.182z" fill="#E4751F" stroke="#E4751F"/>
        <path d="M71.714 77.646l-2.306 11.815.167 1.084 10.103-7.889.302-7.877-8.266 2.867zM46.46 74.779l.285 7.877 10.103 7.889.168-1.084-2.29-11.815-8.266-2.867z" fill="#F6851B" stroke="#F6851B"/>
        <path d="M71.882 101.73l.101-3.229-.869-.752H56.887l-.853.752.084 3.229-10.912-5.17 3.817 3.129 7.74 5.362h14.495l7.757-5.362 3.817-3.129-10.95 5.17z" fill="#C0AD9E" stroke="#C0AD9E"/>
        <path d="M71.237 90.847l-.168-1.084H56.93l-.167 1.084-.92 7.654.853-.752h14.227l.869.752-.555-7.654z" fill="#161616" stroke="#161616"/>
        <path d="M106.292 63.478l2.926-14.086-4.418-13.152-33.563 24.93 12.92 10.925 18.261 5.328 4.032-4.702-1.76-1.27 2.79-2.532-2.138-1.655 2.789-2.13-1.839-1.656zM18.782 49.392l2.943 14.086-1.877 1.387 2.79 2.13-2.122 1.656 2.789 2.532-1.76 1.27 4.032 4.702 18.244-5.328 12.92-10.925-33.563-24.93-4.396 13.152z" fill="#763D16" stroke="#763D16"/>
      </svg>
    ),
    checkAvailable: () => typeof window !== 'undefined' && !!window.ethereum?.isMetaMask,
    downloadUrl: 'https://metamask.io/',
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    description: 'Connect with ETH or SOL',
    chain: 'Multi',
    icon: (
      <svg viewBox="0 0 128 128" className="w-full h-full">
        <rect fill="#000" width="128" height="128" rx="26"/>
        <path d="M76.8 51.2H51.2v25.6h25.6V51.2z" fill="#fff"/>
        <path d="M51.2 25.6H25.6v25.6h25.6V25.6zM102.4 25.6H76.8v25.6h25.6V25.6zM51.2 76.8H25.6v25.6h25.6V76.8zM102.4 76.8H76.8v25.6h25.6V76.8z" fill="#fff"/>
      </svg>
    ),
    checkAvailable: () => typeof window !== 'undefined' && !!(window.okxwallet?.solana || window.okxwallet?.ethereum),
    downloadUrl: 'https://www.okx.com/web3',
  },
];

// ============================================
// Connection Steps
// ============================================

type ConnectionStep = 'select' | 'connecting' | 'signing' | 'success' | 'error';

// ============================================
// Wallet Connect Component
// ============================================

export default function WalletConnect() {
  const [step, setStep] = useState<ConnectionStep>('select');
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(null);
  const [availableWallets, setAvailableWallets] = useState<Record<string, boolean>>({});
  
  const { connectWallet, login, error, clearError, isLoading } = useAuthStore();

  // Check wallet availability on mount
  useEffect(() => {
    const checkWallets = () => {
      const availability: Record<string, boolean> = {};
      walletOptions.forEach(wallet => {
        availability[wallet.id] = wallet.checkAvailable();
      });
      setAvailableWallets(availability);
    };

    // Check immediately and after a delay (some wallets inject slowly)
    checkWallets();
    const timeout = setTimeout(checkWallets, 1000);
    
    return () => clearTimeout(timeout);
  }, []);

  // Handle wallet selection
  const handleSelectWallet = async (wallet: WalletOption) => {
    setSelectedWallet(wallet);
    clearError();
    setStep('connecting');

    try {
      // Step 1: Connect wallet
      const walletInfo: WalletInfo = await connectWallet(wallet.id);
      
      setStep('signing');
      
      // Step 2: Sign message and login
      await login(walletInfo);
      
      setStep('success');
    } catch (err) {
      setStep('error');
    }
  };

  // Reset to selection
  const handleRetry = () => {
    setStep('select');
    setSelectedWallet(null);
    clearError();
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {/* Wallet Selection */}
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet</h2>
              <p className="text-gray-400">Choose your preferred wallet to continue</p>
            </div>

            <div className="space-y-3">
              {walletOptions.map((wallet) => {
                const isAvailable = availableWallets[wallet.id];
                
                return (
                  <motion.button
                    key={wallet.id}
                    onClick={() => isAvailable && handleSelectWallet(wallet)}
                    disabled={!isAvailable}
                    className={`
                      w-full p-4 rounded-xl border transition-all duration-200
                      flex items-center gap-4
                      ${isAvailable 
                        ? 'border-white/10 bg-white/5 hover:border-purple-500/50 hover:bg-purple-500/10 cursor-pointer' 
                        : 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
                      }
                    `}
                    whileHover={isAvailable ? { scale: 1.01 } : undefined}
                    whileTap={isAvailable ? { scale: 0.99 } : undefined}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                      {wallet.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{wallet.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                          {wallet.chain}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{wallet.description}</p>
                    </div>
                    {!isAvailable && (
                      <a
                        href={wallet.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-purple-400 hover:text-purple-300"
                      >
                        Install
                      </a>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Connecting State */}
        {(step === 'connecting' || step === 'signing') && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card variant="glow" padding="lg" className="text-center">
              <div className="space-y-6">
                {/* Wallet Icon with Animation */}
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-2xl overflow-hidden">
                    {selectedWallet?.icon}
                  </div>
                  <div className="absolute inset-0 animate-ping rounded-2xl bg-purple-500/20" />
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">
                    {step === 'connecting' ? 'Connecting...' : 'Waiting for Signature'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {step === 'connecting' 
                      ? `Opening ${selectedWallet?.name}...` 
                      : 'Please sign the message in your wallet'
                    }
                  </p>
                </div>

                {/* Loading Indicator */}
                <div className="flex justify-center">
                  <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                </div>

                {/* Cancel Button */}
                <Button variant="ghost" onClick={handleRetry} className="mt-4">
                  Cancel
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Error State */}
        {step === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card variant="default" padding="lg" className="text-center">
              <div className="space-y-6">
                {/* Error Icon */}
                <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>

                {/* Error Message */}
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">Connection Failed</h3>
                  <p className="text-sm text-gray-400">{error || 'Something went wrong. Please try again.'}</p>
                </div>

                {/* Retry Button */}
                <Button variant="primary" onClick={handleRetry} fullWidth>
                  Try Again
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Success State - Brief flash before redirect */}
        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card variant="glow" padding="lg" className="text-center">
              <div className="space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">Connected!</h3>
                  <p className="text-sm text-gray-400">Redirecting to dashboard...</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
