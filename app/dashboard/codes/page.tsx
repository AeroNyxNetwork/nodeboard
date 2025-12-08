/**
 * ============================================
 * AeroNyx Registration Codes Page
 * ============================================
 * File Path: src/app/dashboard/codes/page.tsx
 * 
 * Creation Reason: Manage registration codes for node binding
 * Main Functionality: Generate, view, copy, and revoke registration codes
 * Dependencies:
 *   - src/hooks/useRegistrationCodes.ts
 *   - src/components/common/Card.tsx
 *   - src/components/common/Button.tsx
 * 
 * Main Logical Flow:
 * 1. Fetch all registration codes
 * 2. Display codes in a table with status
 * 3. Allow generating new codes
 * 4. Allow revoking unused codes
 * 
 * ⚠️ Important Note for Next Developer:
 * - Codes expire after 15 minutes
 * - Only unused codes can be revoked
 * - Used codes show linked node info
 * 
 * Last Modified: v1.0.0 - Initial codes page
 * ============================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useRegistrationCodes,
  useGenerateCode,
  useRevokeCode,
  getCodeTimeRemaining,
} from '@/hooks/useRegistrationCodes';
import { RegistrationCode } from '@/types';
import { CODE_STATUS_CONFIG } from '@/lib/constants';
import Card, { EmptyState } from '@/components/common/Card';
import Button, { CopyButton } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/Modal';

// ============================================
// Countdown Component
// ============================================

function CodeCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState(getCodeTimeRemaining(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getCodeTimeRemaining(expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (timeLeft.isExpired) {
    return <span className="text-red-400">Expired</span>;
  }

  return (
    <span className={timeLeft.totalSeconds < 120 ? 'text-yellow-400' : 'text-gray-400'}>
      {timeLeft.formatted}
    </span>
  );
}

// ============================================
// Code Row Component
// ============================================

interface CodeRowProps {
  code: RegistrationCode;
  onRevoke: (code: RegistrationCode) => void;
}

function CodeRow({ code, onRevoke }: CodeRowProps) {
  const statusConfig = CODE_STATUS_CONFIG[code.status];
  const isRevokable = code.status === 'unused' && code.is_valid;

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="hover:bg-white/[0.02]"
    >
      {/* Code */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <code className="font-mono text-sm text-white bg-white/5 px-2 py-1 rounded">
            {code.code}
          </code>
          <CopyButton text={code.code} />
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <span className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
          ${statusConfig.bgColor} ${statusConfig.textColor}
        `}>
          {statusConfig.label}
        </span>
      </td>

      {/* Expires */}
      <td className="px-6 py-4 text-sm">
        {code.status === 'unused' && code.is_valid ? (
          <CodeCountdown expiresAt={code.expires_at} />
        ) : (
          <span className="text-gray-500">—</span>
        )}
      </td>

      {/* Created */}
      <td className="px-6 py-4 text-sm text-gray-400">
        {new Date(code.created_at).toLocaleString()}
      </td>

      {/* Actions */}
      <td className="px-6 py-4">
        {isRevokable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevoke(code)}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            Revoke
          </Button>
        )}
      </td>
    </motion.tr>
  );
}

// ============================================
// Generate Code Card
// ============================================

function GenerateCodeCard() {
  const { generateCode, isLoading, lastGeneratedCode, reset } = useGenerateCode();
  const [showCode, setShowCode] = useState(false);

  const handleGenerate = async () => {
    try {
      await generateCode();
      setShowCode(true);
    } catch (err) {
      console.error('Failed to generate code:', err);
    }
  };

  const handleClose = () => {
    setShowCode(false);
    reset();
  };

  return (
    <Card variant="glow" padding="lg" className="mb-8">
      <AnimatePresence mode="wait">
        {!showCode ? (
          <motion.div
            key="generate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col sm:flex-row items-center justify-between gap-6"
          >
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Generate Registration Code</h3>
              <p className="text-sm text-gray-400">
                Create a new code to register a node. Codes expire after 15 minutes.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={handleGenerate}
              isLoading={isLoading}
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Generate Code
            </Button>
          </motion.div>
        ) : lastGeneratedCode ? (
          <motion.div
            key="code"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Your New Registration Code
                </p>
                <div className="flex items-center gap-3">
                  <code className="
                    text-2xl font-mono font-bold text-white
                    bg-black/30 border border-white/10
                    px-4 py-2 rounded-xl
                  ">
                    {lastGeneratedCode.code}
                  </code>
                  <CopyButton text={lastGeneratedCode.code} />
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Expires in:</span>
                <CodeCountdown expiresAt={lastGeneratedCode.expires_at} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <p className="text-sm text-purple-200">
                Run this command on your server to bind the node:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 bg-black/30 px-3 py-2 rounded text-sm font-mono text-gray-300">
                  aeronyx-node bind --code {lastGeneratedCode.code}
                </code>
                <CopyButton text={`aeronyx-node bind --code ${lastGeneratedCode.code}`} />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  );
}

// ============================================
// Codes Page Component
// ============================================

export default function CodesPage() {
  const { codes, isLoading } = useRegistrationCodes({ includeExpired: true });
  const { revokeCode, isLoading: isRevoking } = useRevokeCode();
  const [codeToRevoke, setCodeToRevoke] = useState<RegistrationCode | null>(null);

  const handleRevoke = async () => {
    if (!codeToRevoke) return;
    try {
      await revokeCode(codeToRevoke.code);
      setCodeToRevoke(null);
    } catch (err) {
      console.error('Failed to revoke code:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Registration Codes</h1>
        <p className="text-sm text-gray-400 mt-1">
          Generate and manage registration codes for binding nodes
        </p>
      </div>

      {/* Generate Card */}
      <GenerateCodeCard />

      {/* Codes Table */}
      <Card variant="default" padding="none">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white">Code History</h3>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <p className="text-gray-500">No registration codes yet</p>
            <p className="text-sm text-gray-600 mt-1">Generate your first code above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Expires In</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence>
                  {codes.map((code) => (
                    <CodeRow
                      key={code.id}
                      code={code}
                      onRevoke={setCodeToRevoke}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Revoke Confirmation */}
      <ConfirmDialog
        isOpen={!!codeToRevoke}
        onClose={() => setCodeToRevoke(null)}
        onConfirm={handleRevoke}
        title="Revoke Code"
        message={`Are you sure you want to revoke code "${codeToRevoke?.code}"? This code will no longer be usable.`}
        confirmText="Revoke"
        cancelText="Cancel"
        variant="warning"
        isLoading={isRevoking}
      />
    </div>
  );
}
