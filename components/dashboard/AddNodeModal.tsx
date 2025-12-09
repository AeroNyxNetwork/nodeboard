/**
 * ============================================
 * AeroNyx Add Node Modal Component
 * ============================================
 * File Path: src/components/dashboard/AddNodeModal.tsx
 * 
 * Creation Reason: Modal for generating registration codes to add nodes
 * Main Functionality: Generate registration code, display with countdown,
 *                     copy functionality, and setup instructions
 * Dependencies:
 *   - src/hooks/useRegistrationCodes.ts
 *   - src/components/common/Modal.tsx
 *   - src/components/common/Button.tsx
 * 
 * Main Logical Flow:
 * 1. Show generate code button initially
 * 2. On generate, display code with countdown timer
 * 3. Provide copy functionality
 * 4. Show setup instructions for node binding
 * 
 * ⚠️ Important Note for Next Developer:
 * - Codes expire after 15 minutes
 * - Timer updates every second when code is active
 * - Instructions must match the node binding API
 * 
 * Last Modified: v1.0.0 - Initial add node modal
 * ============================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '@/components/common/Modal';
import Button, { CopyButton } from '@/components/common/Button';
import { useGenerateCode, getCodeTimeRemaining } from '@/hooks/useRegistrationCodes';
import { RegistrationCode } from '@/types';

// ============================================
// Props Interface
// ============================================

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================
// Countdown Timer Component
// ============================================

interface CountdownProps {
  expiresAt: string;
  onExpire: () => void;
}

function Countdown({ expiresAt, onExpire }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState(getCodeTimeRemaining(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getCodeTimeRemaining(expiresAt);
      setTimeLeft(remaining);
      
      if (remaining.isExpired) {
        onExpire();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (timeLeft.isExpired) {
    return <span className="text-red-400">Expired</span>;
  }

  return (
    <span className={timeLeft.totalSeconds < 60 ? 'text-yellow-400' : 'text-gray-400'}>
      {timeLeft.formatted}
    </span>
  );
}

// ============================================
// Code Display Component
// ============================================

interface CodeDisplayProps {
  code: RegistrationCode;
  onExpire: () => void;
}

function CodeDisplay({ code, onExpire }: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      {/* Code Display */}
      <div className="
        relative p-6 rounded-2xl
        bg-gradient-to-br from-purple-500/10 to-pink-500/10
        border border-purple-500/30
      ">
        {/* Glow Effect */}
        <div className="absolute inset-0 rounded-2xl bg-purple-500/5 blur-xl" />
        
        <div className="relative space-y-4">
          {/* Code */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 uppercase tracking-wider">
              Registration Code
            </p>
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <Countdown expiresAt={code.expires_at} onExpire={onExpire} />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <code className="
              flex-1 px-4 py-3 rounded-xl
              bg-black/30 border border-white/10
              text-xl font-mono font-bold text-white
              tracking-wider
            ">
              {code.code}
            </code>
            
            <motion.button
              onClick={handleCopy}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                p-3 rounded-xl transition-all duration-200
                ${copied 
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }
                border
              `}
            >
              {copied ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-white">Setup Instructions</h4>
        
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center font-medium">
              1
            </span>
            <div className="text-sm text-gray-400">
              Download and install the AeroNyx node software on your server
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center font-medium">
              2
            </span>
            <div className="text-sm text-gray-400">
              Run the setup command with your registration code:
              <code className="block mt-2 px-3 py-2 rounded bg-black/30 text-purple-300 font-mono text-xs">
                aeronyx-node bind --code {code.code}
              </code>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center font-medium">
              3
            </span>
            <div className="text-sm text-gray-400">
              Your node will appear in the dashboard once successfully bound
            </div>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm text-yellow-200/80">
          This code expires in 15 minutes. Generate a new code if this one expires before you can use it.
        </p>
      </div>
    </motion.div>
  );
}

// ============================================
// Add Node Modal Component
// ============================================

export default function AddNodeModal({ isOpen, onClose }: AddNodeModalProps) {
  const { generateCode, isLoading, lastGeneratedCode, reset } = useGenerateCode();
  const [activeCode, setActiveCode] = useState<RegistrationCode | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveCode(null);
      reset();
    }
  }, [isOpen, reset]);

  // Handle generate
  const handleGenerate = async () => {
    try {
      const code = await generateCode();
      setActiveCode(code);
    } catch (err) {
      console.error('Failed to generate code:', err);
    }
  };

  // Handle code expiration
  const handleExpire = () => {
    setActiveCode(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Node"
      description="Generate a registration code to bind a new node to your account"
      size="lg"
    >
      <AnimatePresence mode="wait">
        {!activeCode ? (
          <motion.div
            key="generate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Illustration */}
            <div className="flex justify-center py-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border-2 border-[#1A1A24]">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="text-center space-y-2">
              <p className="text-gray-400">
                Generate a unique registration code to bind your node to this account.
                The code will be valid for 15 minutes.
              </p>
            </div>

            {/* Generate Button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleGenerate}
              isLoading={isLoading}
            >
              Generate Registration Code
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="code"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CodeDisplay code={activeCode} onExpire={handleExpire} />
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
