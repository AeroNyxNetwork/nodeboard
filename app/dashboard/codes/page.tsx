/**
 * ============================================
 * AeroNyx Registration Codes Page
 * ============================================
 * File Path: src/app/dashboard/codes/page.tsx
 * 
 * Creation Reason: Manage registration codes for node binding
 * Modification Reason:
 *   v1.7.0 - Prioritize failed phase and exit code in installer detail chips
 *     when Rust reports a failed install, while keeping normal rows compact.
 *   v1.6.0 - Surface privacy-safe structured installer details as compact
 *     operator chips so failed installs are debuggable without expanding the
 *     Services first-level page.
 *   v1.5.0 - Connect completed install timeline rows to the linked node
 *     detail/capacity/upgrade workflow panels using backend linked_node
 *     summaries, without adding more first-level Services modules.
 *
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
 * Last Modified: v1.7.0 - Prioritize failed installer detail chips
 * Previous: v1.6.0 - Show structured installer detail chips
 * Previous: v1.5.0 - Link install completion to node detail operations
 * Previous: v1.4.0 - Show commercial installer stage timeline
 * Previous: v1.3.0 - Generate unified aeronyx-node.sh and AI assistant commands
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

const INSTALL_STAGE_ORDER = [
  'plan',
  'preflight',
  'dependencies',
  'repository',
  'config',
  'network',
  'build',
  'systemd',
  'register',
  'start',
  'completed',
] as const;

type InstallStageKey = typeof INSTALL_STAGE_ORDER[number];
type InstallStageState = 'complete' | 'active' | 'failed' | 'pending';

function normalizeInstallStep(step: string | undefined): InstallStageKey | '' {
  if (!step) return '';
  if ((INSTALL_STAGE_ORDER as readonly string[]).includes(step)) {
    return step as InstallStageKey;
  }
  return '';
}

function installStageState(stage: InstallStageKey, currentStep: InstallStageKey | '', status: string): InstallStageState {
  if (status === 'not_started' || !currentStep) return 'pending';
  if (status === 'completed') return 'complete';

  const stageIndex = INSTALL_STAGE_ORDER.indexOf(stage);
  const currentIndex = INSTALL_STAGE_ORDER.indexOf(currentStep);
  if (currentIndex < 0) return 'pending';

  if (stageIndex < currentIndex) return 'complete';
  if (stageIndex === currentIndex) return status === 'failed' ? 'failed' : 'active';
  return 'pending';
}

function installStageDotClass(state: InstallStageState) {
  switch (state) {
    case 'complete':
      return 'border-emerald-400 bg-emerald-400 shadow-emerald-400/30';
    case 'active':
      return 'border-yellow-300 bg-yellow-300 shadow-yellow-300/30';
    case 'failed':
      return 'border-red-300 bg-red-300 shadow-red-300/30';
    default:
      return 'border-white/15 bg-white/[0.05]';
  }
}

function installNextActionKey(status: string, step: string) {
  if (status === 'completed') return 'codes.installProgress.next.completed';
  if (status === 'failed') return 'codes.installProgress.next.failed';
  if (status === 'planning') return 'codes.installProgress.next.planning';
  if (status === 'running') return `codes.installProgress.next.${step || 'running'}`;
  return 'codes.installProgress.next.not_started';
}

const INSTALL_PROGRESS_DETAIL_KEYS = [
  'command',
  'repo_dir',
  'branch',
  'service',
  'config',
  'dry_run',
  'no_restart',
  'failed_phase',
  'exit_code',
  'script_version',
  'host',
  'os',
  'arch',
] as const;

type InstallProgressDetailKey = typeof INSTALL_PROGRESS_DETAIL_KEYS[number];

const FAILED_INSTALL_PROGRESS_DETAIL_KEYS: readonly InstallProgressDetailKey[] = [
  'failed_phase',
  'exit_code',
  'command',
  'service',
  'repo_dir',
  'branch',
  'config',
  'dry_run',
  'script_version',
  'host',
  'os',
  'arch',
];

function installProgressDetailLabel(key: InstallProgressDetailKey, t: (key: string, params?: Record<string, string | number>) => string) {
  const translationKey = `codes.installProgress.detail.${key}`;
  const translated = t(translationKey);
  if (translated !== translationKey) return translated;
  return key.replace(/_/g, ' ');
}

function installProgressDetailValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null && item !== undefined && item !== '')
      .map((item) => String(item))
      .join(', ');
  }
  return '';
}

function installProgressDetails(
  progress: RegistrationCode['install_progress'],
  t: (key: string, params?: Record<string, string | number>) => string,
  status: string,
) {
  if (!progress || typeof progress !== 'object') return [];
  const detailKeys = status === 'failed' ? FAILED_INSTALL_PROGRESS_DETAIL_KEYS : INSTALL_PROGRESS_DETAIL_KEYS;

  return detailKeys
    .map((key) => {
      const value = installProgressDetailValue(progress[key]);
      if (!value) return null;
      return {
        key,
        label: installProgressDetailLabel(key, t),
        value,
      };
    })
    .filter((item): item is { key: InstallProgressDetailKey; label: string; value: string } => Boolean(item));
}

function LinkedNodeActions({ code }: { code: RegistrationCode }) {
  const { t, formatDateTime } = useI18n();
  const node = code.linked_node;
  if (!node) return null;

  const detailHref = `/dashboard/nodes/${node.id}`;
  const capacityHref = `${detailHref}#capacity-panel`;
  const upgradeHref = `${detailHref}#upgrade-workflow`;
  const statusKey = `codes.linkedNode.status.${node.status}`;
  const translatedStatus = t(statusKey);

  return (
    <div className="mt-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-100">{t('codes.linkedNode.title')}</p>
          <p className="mt-1 break-words text-xs leading-5 text-emerald-100/70 [overflow-wrap:anywhere]">
            {t('codes.linkedNode.description', {
              name: node.name || t('codes.linkedNode.unnamed'),
              status: translatedStatus === statusKey ? String(node.status || '').replace(/_/g, ' ') : translatedStatus,
            })}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-emerald-100/45">
            {node.last_heartbeat
              ? t('codes.linkedNode.lastHeartbeat', { time: formatDateTime(node.last_heartbeat) })
              : t('codes.linkedNode.waitingHeartbeat')}
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[11px] uppercase tracking-wide text-emerald-100">
          {node.is_vpn_node ? t('codes.linkedNode.privacyNode') : t('codes.linkedNode.boundNode')}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={detailHref} className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-white transition hover:border-white/25 hover:bg-white/[0.06]">
          {t('codes.linkedNode.openDetail')}
        </a>
        <a href={capacityHref} className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/25 hover:bg-white/[0.06]">
          {t('codes.linkedNode.openCapacity')}
        </a>
        <a href={upgradeHref} className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/25 hover:bg-white/[0.06]">
          {t('codes.linkedNode.openUpgrade')}
        </a>
      </div>
    </div>
  );
}

function InstallProgressCell({ code }: { code: RegistrationCode }) {
  const { t, formatDateTime } = useI18n();
  const status = code.install_status || 'not_started';
  const rawStep = code.install_step || '';
  const normalizedStep = normalizeInstallStep(rawStep);
  const step = rawStep || t('codes.installProgress.waiting');
  const message = code.install_message || t('codes.installProgress.noMessage');
  const statusKey = `codes.installProgress.status.${status}`;
  const translatedStatus = t(statusKey);
  const nextActionKey = installNextActionKey(status, rawStep);
  const translatedNextAction = t(nextActionKey);
  const nextAction = translatedNextAction === nextActionKey
    ? t('codes.installProgress.next.running')
    : translatedNextAction;
  const recommendationKey = rawStep ? `codes.installProgress.recommendation.${rawStep}` : '';
  const translatedRecommendation = recommendationKey ? t(recommendationKey) : '';
  const fallbackRecommendation = t('codes.installProgress.recommendation.default');
  const recommendation = status === 'failed'
    ? translatedRecommendation && translatedRecommendation !== recommendationKey
      ? translatedRecommendation
      : fallbackRecommendation
    : '';
  const details = installProgressDetails(code.install_progress, t, status);
  const visibleDetails = details.slice(0, 6);
  const hiddenDetailCount = details.length - visibleDetails.length;

  return (
    <div className="min-w-[320px] max-w-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${installProgressTone(status)}`}>
          {translatedStatus === statusKey ? status.replace(/_/g, ' ') : translatedStatus}
        </span>
        <span className="text-xs font-medium text-gray-300">{step}</span>
      </div>
      <div className="mt-3 rounded-lg border border-white/5 bg-black/20 p-3">
        <div className="grid grid-cols-11 gap-1">
          {INSTALL_STAGE_ORDER.map((stage) => {
            const state = installStageState(stage, normalizedStep, status);
            return (
              <div key={stage} className="flex min-w-0 flex-col items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-full border shadow-sm ${installStageDotClass(state)}`} />
                <span className={`max-w-full truncate text-[10px] leading-3 ${
                  state === 'failed'
                    ? 'text-red-200'
                    : state === 'active'
                      ? 'text-yellow-100'
                      : state === 'complete'
                        ? 'text-emerald-200'
                        : 'text-gray-600'
                }`}>
                  {t(`codes.installProgress.stage.${stage}`)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{message}</p>
      <p className="mt-1 text-xs leading-5 text-purple-100/70">{nextAction}</p>
      {recommendation ? (
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-red-200/80">{recommendation}</p>
      ) : null}
      {visibleDetails.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t('codes.installProgress.details')}>
          {visibleDetails.map((detail) => (
            <span
              key={detail.key}
              className="max-w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] leading-4 text-gray-300"
              title={`${detail.label}: ${detail.value}`}
            >
              <span className="text-gray-500">{detail.label}</span>
              <span className="mx-1 text-gray-600">/</span>
              <span className="break-words text-gray-200 [overflow-wrap:anywhere]">{detail.value}</span>
            </span>
          ))}
          {hiddenDetailCount > 0 ? (
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] leading-4 text-gray-500">
              {t('codes.installProgress.moreDetails', { count: hiddenDetailCount })}
            </span>
          ) : null}
        </div>
      ) : null}
      {code.install_last_reported_at ? (
        <p className="mt-1 text-[11px] text-gray-600">
          {t('codes.installProgress.reportedAt', { time: formatDateTime(code.install_last_reported_at) })}
        </p>
      ) : null}
      <LinkedNodeActions code={code} />
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
