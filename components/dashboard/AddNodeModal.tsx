/**
 * ============================================
 * AeroNyx Add Node Modal Component
 * ============================================
 * File Path: components/dashboard/AddNodeModal.tsx
 *
 * Modification Reason:
 *   v1.6.0 - [CODE-LIFECYCLE 2026-08-13 by Codex] Aligned modal generation
 *   failures, expiration, pending-close protection, and narrow-screen code
 *   layout with the registration code management page.
 *   v1.5.0 - Make generated post-install verification use
 *   `aeronyx-node.sh status` first, because status now includes service
 *   state, local endpoints, upgrade state, and the healthcheck
 *   operator_next_step recommendation.
 *   v1.4.0 - Make generated onboarding commands self-contained by creating
 *   and entering /root/open before cloning/updating AeroNyx. Operators can
 *   paste the command from any current directory on a fresh Linux server.
 *   v1.3.0 - Add --quick to the preview command so the read-only plan mirrors
 *   the exact first-install path shown by the install command.
 *   v1.2.0 - Replace the legacy raw install.sh bootstrap with the unified
 *   deploy/node/aeronyx-node.sh operator entrypoint. The modal now mirrors
 *   the Codes page: fetch/refresh the repo, run plan, run install, then offer
 *   a verification command.
 *   v1.1.0 - Replace legacy bind command with production Rust privacy node
 *   quick install and read-only preview commands. This aligns nodeboard
 *   onboarding with deploy/node/install.sh --quick and --print-plan.
 *
 * Main Functionality:
 *   - Generate a short-lived node registration code.
 *   - Show a safe preview command that does not mutate the host.
 *   - Show a one-command production install path for new Linux/systemd nodes.
 *   - Show the unified status command so operators can verify service
 *     readiness and see the recommended next step.
 *   - Allow copying the code or install commands without exposing private
 *     keys, node secrets, traffic metadata, or user data.
 *
 * Dependencies:
 *   - hooks/useRegistrationCodes.ts
 *   - deploy/node/aeronyx-node.sh in AeroNyxNetwork/AeroNyx
 *   - common Modal/Button components and nodeboard i18n dictionary
 *
 * ⚠️ Important Note for Next Developer:
 * - Keep the registration code scoped to this modal and clipboard only.
 * - Do not add node private keys, wallet secrets, DNS contents, packet
 *   payloads, client IPs, or browsing destinations to setup commands.
 * - If deploy/node/aeronyx-node.sh changes flags, update preview, install,
 *   status, and healthcheck guidance together.
 *
 * Last Modified: v1.6.0 - Transaction-safe registration modal lifecycle
 * Previous: v1.5.0 - Verify installs with status recommendation
 * Previous: v1.4.0 - Use self-contained /root/open bootstrap commands
 * Previous: v1.3.0 - Align preview command with quick install
 * Previous: v1.2.0 - Unified node operator entrypoint onboarding
 * Previous: v1.1.0 - Production quick install onboarding
 * Previous: v1.0.1 - Removed framer-motion to fix re-render issues
 * ============================================
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { useGenerateCode, getCodeTimeRemaining } from '@/hooks/useRegistrationCodes';
import { RegistrationCode } from '@/types';
import { useI18n } from '@/lib/i18n/I18nProvider';

const REPO_BOOTSTRAP_COMMAND =
  'mkdir -p /root/open && cd /root/open && if [ -d AeroNyx/.git ]; then cd AeroNyx && git fetch origin main && git checkout main && git pull --ff-only origin main; else git clone https://github.com/AeroNyxNetwork/AeroNyx.git AeroNyx && cd AeroNyx; fi';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildPreviewCommand(code: string): string {
  return [
    REPO_BOOTSTRAP_COMMAND,
    `AERONYX_REGISTRATION_CODE=${shellQuote(code)} ./deploy/node/aeronyx-node.sh plan --repo-dir "$PWD" --branch main --quick`,
  ].join(' && ');
}

function buildInstallCommand(code: string): string {
  return [
    REPO_BOOTSTRAP_COMMAND,
    `sudo env AERONYX_REGISTRATION_CODE=${shellQuote(code)} ./deploy/node/aeronyx-node.sh install --repo-dir "$PWD" --branch main --quick`,
  ].join(' && ');
}

function buildStatusCommand(): string {
  return [
    REPO_BOOTSTRAP_COMMAND,
    './deploy/node/aeronyx-node.sh status --repo-dir "$PWD"',
  ].join(' && ');
}

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
  const { t } = useI18n();
  const [timeLeft, setTimeLeft] = useState(getCodeTimeRemaining(expiresAt));

  useEffect(() => {
    const updateRemaining = () => {
      const remaining = getCodeTimeRemaining(expiresAt);
      setTimeLeft(remaining);
      if (remaining.isExpired) {
        onExpire();
        return true;
      }
      return false;
    };

    if (updateRemaining()) return undefined;

    const interval = window.setInterval(() => {
      if (updateRemaining()) window.clearInterval(interval);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (timeLeft.isExpired) {
    return <span className="text-red-400">{t('codes.expired')}</span>;
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

interface CopyCommandCardProps {
  label: string;
  helper?: string;
  command: string;
  accent?: 'purple' | 'emerald';
}

function CopyCommandCard({
  label,
  helper,
  command,
  accent = 'purple',
}: CopyCommandCardProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy command:', err);
    }
  }, [command]);

  const accentClass = accent === 'emerald'
    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
    : 'border-purple-500/20 bg-purple-500/5 text-purple-300';

  return (
    <div className={`rounded-xl border ${accentClass} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{label}</p>
          {helper && (
            <p className="mt-1 text-xs text-gray-400 leading-relaxed">{helper}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={`
            flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs transition-all
            ${copied
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
            }
          `}
        >
          {copied ? t('common.copied') : t('common.copyToClipboard')}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto bg-black/40">
        <code className="block text-xs leading-relaxed font-mono text-gray-100 whitespace-pre-wrap break-all">
          {command}
        </code>
      </pre>
    </div>
  );
}

function CodeDisplay({ code, onExpire }: CodeDisplayProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const previewCommand = buildPreviewCommand(code.code);
  const installCommand = buildInstallCommand(code.code);
  const statusCommand = buildStatusCommand();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code.code]);

  return (
    <div className="space-y-6">
      {/* Code Display */}
      <div className="
        relative p-6 rounded-2xl
        bg-gradient-to-br from-purple-500/10 to-pink-500/10
        border border-purple-500/30
      ">
        <div className="relative space-y-4">
          {/* Code Header */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 uppercase tracking-wider">
              {t('codes.table.code')}
            </p>
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <Countdown expiresAt={code.expires_at} onExpire={onExpire} />
            </div>
          </div>
          
          {/* Code Value */}
          <div className="flex min-w-0 items-center gap-3">
            <code className="
              min-w-0 flex-1 break-all px-4 py-3 rounded-xl [overflow-wrap:anywhere]
              bg-black/30 border border-white/10
              text-base font-mono font-bold text-white sm:text-xl
              tracking-wider
            ">
              {code.code}
            </code>
            
            <button
              onClick={handleCopy}
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
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-white">{t('addNode.setup.title')}</h4>

        <div className="space-y-3">
          <CopyCommandCard
            label={t('codes.generated.previewCommand')}
            helper={t('codes.generated.previewHint')}
            command={previewCommand}
          />
          <CopyCommandCard
            label={t('codes.generated.installCommand')}
            helper={t('codes.generated.quickNote')}
            command={installCommand}
            accent="emerald"
          />
          <CopyCommandCard
            label={t('codes.generated.statusCommand')}
            helper={t('codes.generated.commandHint')}
            command={statusCommand}
            accent="emerald"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center font-medium">
              1
            </span>
            <div className="text-sm text-gray-400">
              {t('addNode.setup.download')}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center font-medium">
              2
            </span>
            <div className="text-sm text-gray-400">
              {t('addNode.setup.runCommand')}
              <span className="block mt-2 text-xs text-purple-300">
                {t('codes.generated.commandHint')}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center font-medium">
              3
            </span>
            <div className="text-sm text-gray-400">
              {t('addNode.setup.bound')}
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
          {t('addNode.warning.expires')}
        </p>
      </div>
    </div>
  );
}

// ============================================
// Add Node Modal Component
// ============================================

export default function AddNodeModal({ isOpen, onClose }: AddNodeModalProps) {
  const { t } = useI18n();
  const { generateCode, isLoading, isError, reset } = useGenerateCode();
  const [activeCode, setActiveCode] = useState<RegistrationCode | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveCode(null);
      reset();
    }
  }, [isOpen, reset]);

  // Handle generate
  const handleGenerate = useCallback(async () => {
    try {
      const code = await generateCode();
      setActiveCode(code);
    } catch {
      // The modal renders a translated, privacy-safe error below the action.
    }
  }, [generateCode]);

  // Handle code expiration
  const handleExpire = useCallback(() => {
    setActiveCode(null);
    reset();
  }, [reset]);

  const handleClose = useCallback(() => {
    if (!isLoading) onClose();
  }, [isLoading, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('addNode.title')}
      description={t('addNode.description')}
      size="xl"
      closeOnBackdrop={!isLoading}
      closeOnEscape={!isLoading}
    >
      {!activeCode ? (
        <div className="space-y-6">
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
              {t('addNode.intro')}
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
            {t('codes.generate.button')}
          </Button>
          {isError ? (
            <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
              {t('codes.error.generate')}
            </p>
          ) : null}
        </div>
      ) : (
        <CodeDisplay code={activeCode} onExpire={handleExpire} />
      )}
    </Modal>
  );
}
