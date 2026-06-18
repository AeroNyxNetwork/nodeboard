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
 * Last Modified: v1.3.0 - Generate unified aeronyx-node.sh and AI assistant commands
 * Previous: v1.2.0 - Show full preview/install one-line commands
 * Previous: v1.1.0 - Use Rust install.sh --quick setup commands
 * Previous: v1.0.0 - Initial codes page
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
import { useI18n } from '@/lib/i18n/I18nProvider';

// ============================================
// Countdown Component
// ============================================

function CodeCountdown({ expiresAt }: { expiresAt: string }) {
  const { t } = useI18n();
  const [timeLeft, setTimeLeft] = useState(getCodeTimeRemaining(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getCodeTimeRemaining(expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (timeLeft.isExpired) {
    return <span className="text-red-400">{t('codes.expired')}</span>;
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

function installProgressTone(status: string | undefined) {
  switch (status) {
    case 'completed':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
    case 'failed':
      return 'border-red-500/20 bg-red-500/10 text-red-200';
    case 'planning':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-200';
    case 'running':
      return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-100';
    default:
      return 'border-white/10 bg-white/[0.03] text-gray-400';
  }
}

function InstallProgressCell({ code }: { code: RegistrationCode }) {
  const { t, formatDateTime } = useI18n();
  const status = code.install_status || 'not_started';
  const step = code.install_step || t('codes.installProgress.waiting');
  const message = code.install_message || t('codes.installProgress.noMessage');
  const statusKey = `codes.installProgress.status.${status}`;
  const translatedStatus = t(statusKey);

  return (
    <div className="min-w-[220px] max-w-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${installProgressTone(status)}`}>
          {translatedStatus === statusKey ? status.replace(/_/g, ' ') : translatedStatus}
        </span>
        <span className="text-xs font-medium text-gray-300">{step}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{message}</p>
      {code.install_last_reported_at ? (
        <p className="mt-1 text-[11px] text-gray-600">
          {t('codes.installProgress.reportedAt', { time: formatDateTime(code.install_last_reported_at) })}
        </p>
      ) : null}
    </div>
  );
}

function CodeRow({ code, onRevoke }: CodeRowProps) {
  const { t, formatDateTime } = useI18n();
  const statusConfig = CODE_STATUS_CONFIG[code.status];
  const isRevokable = code.status === 'unused' && code.is_valid;
  const statusKey = `codes.status.${code.status}`;
  const translatedStatus = t(statusKey);

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
          {translatedStatus === statusKey ? statusConfig.label : translatedStatus}
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
        {formatDateTime(code.created_at)}
      </td>

      {/* Install Progress */}
      <td className="px-6 py-4">
        <InstallProgressCell code={code} />
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
            {t('codes.revoke')}
          </Button>
        )}
      </td>
    </motion.tr>
  );
}

// ============================================
// Generate Code Card
// ============================================

function shellSingleQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function GenerateCodeCard() {
  const { t } = useI18n();
  const { generateCode, isLoading, lastGeneratedCode, reset } = useGenerateCode();
  const [showCode, setShowCode] = useState(false);
  const repoBootstrapCommand = 'if [ -d AeroNyx/.git ]; then cd AeroNyx && git fetch origin main && git checkout main && git pull --ff-only origin main; else git clone https://github.com/AeroNyxNetwork/AeroNyx.git AeroNyx && cd AeroNyx; fi';
  const quotedRegistrationCode = lastGeneratedCode ? shellSingleQuote(lastGeneratedCode.code) : '';
  const installCommand = lastGeneratedCode
    ? `${repoBootstrapCommand} && sudo env AERONYX_REGISTRATION_CODE=${quotedRegistrationCode} ./deploy/node/aeronyx-node.sh install --repo-dir "$PWD" --branch main --quick`
    : '';
  const previewCommand = lastGeneratedCode
    ? `${repoBootstrapCommand} && AERONYX_REGISTRATION_CODE=${quotedRegistrationCode} ./deploy/node/aeronyx-node.sh plan --repo-dir "$PWD" --branch main`
    : '';
  const healthCommand = lastGeneratedCode
    ? `${repoBootstrapCommand} && ./deploy/node/aeronyx-node.sh health --repo-dir "$PWD" --json`
    : '';
  const aiAssistantPrompt = lastGeneratedCode
    ? [
      'You are helping me install or maintain an AeroNyx privacy protocol node.',
      '',
      'The operator script comes from the AeroNyx GitHub repository:',
      'https://github.com/AeroNyxNetwork/AeroNyx',
      'After cloning or updating the repository, the script path is:',
      'AeroNyx/deploy/node/aeronyx-node.sh',
      '',
      'Rules:',
      '1. Use deploy/node/aeronyx-node.sh as the only operator entrypoint.',
      '2. First run a read-only plan. Do not install, restart, or change host networking before showing me the plan.',
      '3. Never print my registration code, private keys, API secrets, wallet-level data, DNS contents, destinations, packet payloads, chat plaintext, or client public IPs.',
      '4. After install or upgrade, run health --json and summarize the result.',
      '5. Do not use --force and do not restart a node with active sessions unless I explicitly approve a maintenance window.',
      '',
      `AERONYX_REGISTRATION_CODE=${lastGeneratedCode.code}`,
      'REPO_DIR=/root/open/AeroNyx',
      'BRANCH=main',
      '',
      'Start with:',
      'mkdir -p /root/open',
      'cd /root/open',
      'if [ -d AeroNyx/.git ]; then cd AeroNyx && git fetch origin main && git checkout main && git pull --ff-only origin main; else git clone https://github.com/AeroNyxNetwork/AeroNyx.git AeroNyx && cd AeroNyx; fi',
      'cd /root/open/AeroNyx',
      './deploy/node/aeronyx-node.sh plan --repo-dir /root/open/AeroNyx --branch main --registration-code "$AERONYX_REGISTRATION_CODE"',
      '',
      'Then wait for my approval before install.',
    ].join('\n')
    : '';

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
              <h3 className="text-lg font-semibold text-white mb-1">{t('codes.generate.title')}</h3>
              <p className="text-sm text-gray-400">
                {t('codes.generate.description')}
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
              {t('codes.generate.button')}
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
                  {t('codes.generated.title')}
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
                <span>{t('codes.generated.expiresIn')}</span>
                <CodeCountdown expiresAt={lastGeneratedCode.expires_at} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <p className="text-sm text-purple-200">
                {t('codes.generated.commandHint')}
              </p>
              <div className="mt-3 space-y-3">
                <p className="text-xs leading-5 text-purple-100/70">
                  {t('codes.generated.scriptOrigin')}
                </p>
                <p className="text-xs font-medium uppercase tracking-wider text-purple-100/60">
                  {t('codes.generated.previewCommand')}
                </p>
                <div className="flex items-start gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded bg-black/30 px-3 py-2 font-mono text-xs leading-5 text-gray-400">
                    {previewCommand}
                  </code>
                  <CopyButton text={previewCommand} />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-purple-100/60">
                  {t('codes.generated.installCommand')}
                </p>
                <div className="flex items-start gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded bg-black/30 px-3 py-2 font-mono text-xs leading-5 text-gray-300 sm:text-sm">
                    {installCommand}
                  </code>
                  <CopyButton text={installCommand} />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-purple-100/60">
                  {t('codes.generated.healthCommand')}
                </p>
                <div className="flex items-start gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded bg-black/30 px-3 py-2 font-mono text-xs leading-5 text-gray-400">
                    {healthCommand}
                  </code>
                  <CopyButton text={healthCommand} />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-purple-100/60">
                  {t('codes.generated.aiPrompt')}
                </p>
                <div className="flex items-start gap-2">
                  <code className="max-h-56 min-w-0 flex-1 overflow-auto whitespace-pre-wrap rounded bg-black/30 px-3 py-2 font-mono text-xs leading-5 text-gray-400">
                    {aiAssistantPrompt}
                  </code>
                  <CopyButton text={aiAssistantPrompt} />
                </div>
                <p className="text-xs leading-5 text-purple-100/60">
                  {t('codes.generated.quickNote')}
                </p>
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
  const { t } = useI18n();
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
        <h1 className="text-2xl font-bold text-white">{t('codes.title')}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {t('codes.subtitle')}
        </p>
      </div>

      {/* Generate Card */}
      <GenerateCodeCard />

      {/* Codes Table */}
      <Card variant="default" padding="none">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white">{t('codes.history.title')}</h3>
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
            <p className="text-gray-500">{t('codes.empty.title')}</p>
            <p className="text-sm text-gray-600 mt-1">{t('codes.empty.description')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                  <th className="px-6 py-3 font-medium">{t('codes.table.code')}</th>
                  <th className="px-6 py-3 font-medium">{t('codes.table.status')}</th>
                  <th className="px-6 py-3 font-medium">{t('codes.table.expiresIn')}</th>
                  <th className="px-6 py-3 font-medium">{t('codes.table.created')}</th>
                  <th className="px-6 py-3 font-medium">{t('codes.table.installProgress')}</th>
                  <th className="px-6 py-3 font-medium">{t('codes.table.actions')}</th>
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
        title={t('codes.revokeTitle')}
        message={t('codes.revokeMessage', { code: codeToRevoke?.code || '' })}
        confirmText={t('codes.revoke')}
        cancelText={t('nodes.cancel')}
        variant="warning"
        isLoading={isRevoking}
      />
    </div>
  );
}
