/**
 * ============================================
 * AeroNyx Registration Codes Page
 * ============================================
 * File Path: app/dashboard/codes/page.tsx
 * 
 * Creation Reason: Manage registration codes for node binding
 * Modification Reason:
 *   v1.11.0 - [CODE-LIFECYCLE 2026-08-13 by Codex] Added visible failure and
 *     refresh states, expired-command safeguards, accessible confirmations,
 *     client-side node navigation, and a native mobile history layout.
 *   v1.10.0 - Change generated post-install verification from raw
 *     `health --json` to `status`, so operators and AI assistants see the
 *     service state, upgrade state, and operator_next_step recommendation
 *     before deeper JSON diagnostics.
 *   v1.9.0 - Make generated install/preview/status commands self-contained by
 *     creating and entering /root/open before cloning/updating AeroNyx.
 *   v1.8.0 - Add --quick to generated preview and AI assistant plan commands
 *     so the read-only approval step matches the actual quick install command.
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
 *   - hooks/useRegistrationCodes.ts
 *   - components/common/Card.tsx
 *   - components/common/Button.tsx
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
 * Last Modified: v1.11.0 - Commercial registration code lifecycle UX
 * Previous: v1.10.0 - Verify installs with status recommendation
 * Previous: v1.9.0 - Use self-contained /root/open bootstrap commands
 * Previous: v1.8.0 - Align preview command with quick install
 * Previous: v1.7.0 - Prioritize failed installer detail chips
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
import Link from 'next/link';
import {
  useRegistrationCodes,
  useGenerateCode,
  useRevokeCode,
  getCodeTimeRemaining,
  isCodeUsable,
} from '@/hooks/useRegistrationCodes';
import { RegistrationCode } from '@/types';
import { CODE_STATUS_CONFIG } from '@/lib/constants';
import Card from '@/components/common/Card';
import Button, { CopyButton } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/Modal';
import { useI18n } from '@/lib/i18n/I18nProvider';

// ============================================
// Countdown Component
// ============================================

type CodeTimeRemaining = ReturnType<typeof getCodeTimeRemaining>;

const EMPTY_CODE_TIME: CodeTimeRemaining = {
  isExpired: false,
  totalSeconds: 0,
  minutes: 0,
  seconds: 0,
  formatted: '',
};

function useCodeTimeRemaining(expiresAt?: string) {
  const [trackedTime, setTrackedTime] = useState<{
    expiresAt?: string;
    value: CodeTimeRemaining;
  }>(
    { expiresAt, value: expiresAt ? getCodeTimeRemaining(expiresAt) : EMPTY_CODE_TIME },
  );

  useEffect(() => {
    if (!expiresAt) {
      setTrackedTime({ expiresAt, value: EMPTY_CODE_TIME });
      return undefined;
    }

    const initialTime = getCodeTimeRemaining(expiresAt);
    setTrackedTime({ expiresAt, value: initialTime });
    if (initialTime.isExpired) return undefined;

    const interval = window.setInterval(() => {
      const nextTime = getCodeTimeRemaining(expiresAt);
      setTrackedTime({ expiresAt, value: nextTime });
      if (nextTime.isExpired) window.clearInterval(interval);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  if (trackedTime.expiresAt !== expiresAt) {
    return expiresAt ? getCodeTimeRemaining(expiresAt) : EMPTY_CODE_TIME;
  }
  return trackedTime.value;
}

function CodeCountdown({ timeLeft }: { timeLeft: CodeTimeRemaining }) {
  const { t } = useI18n();

  if (timeLeft.isExpired) {
    return <span className="text-red-400">{t('codes.expired')}</span>;
  }

  return (
    <span className={timeLeft.totalSeconds < 120 ? 'text-yellow-400' : 'text-gray-400'}>
      {timeLeft.formatted}
    </span>
  );
}

function CodeStatusBadge({ status }: { status: RegistrationCode['status'] }) {
  const { t } = useI18n();
  const statusConfig = CODE_STATUS_CONFIG[status];
  const statusKey = `codes.status.${status}`;
  const translatedStatus = t(statusKey);

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
      {translatedStatus === statusKey ? statusConfig.label : translatedStatus}
    </span>
  );
}

// ============================================
// Code Row Component
// ============================================

interface CodeRowProps {
  code: RegistrationCode;
  nowMs: number;
  onRevoke: (code: RegistrationCode) => void;
}

// [CODE-LIFECYCLE 2026-08-13 by Codex] Both responsive history views remain
// mounted for CSS breakpoints, so one page clock avoids four timers per code.
function useRegistrationCodeClock(codes: RegistrationCode[]) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const initialNow = Date.now();
    setNowMs(initialNow);
    if (!codes.some((code) => isCodeUsable(code, new Date(initialNow)))) return undefined;

    const interval = window.setInterval(() => {
      const nextNow = Date.now();
      setNowMs(nextNow);
      if (!codes.some((code) => isCodeUsable(code, new Date(nextNow)))) {
        window.clearInterval(interval);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [codes]);

  return nowMs;
}

function codeLifecycle(code: RegistrationCode, nowMs: number) {
  const timeLeft = getCodeTimeRemaining(code.expires_at, new Date(nowMs));
  const isUsable = isCodeUsable(code, new Date(nowMs));
  const effectiveStatus = code.status === 'unused' && !isUsable ? 'expired' : code.status;
  return { effectiveStatus, isUsable, timeLeft };
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
        <Link href={detailHref} className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-white transition hover:border-white/25 hover:bg-white/[0.06]">
          {t('codes.linkedNode.openDetail')}
        </Link>
        <Link href={capacityHref} className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/25 hover:bg-white/[0.06]">
          {t('codes.linkedNode.openCapacity')}
        </Link>
        <Link href={upgradeHref} className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/25 hover:bg-white/[0.06]">
          {t('codes.linkedNode.openUpgrade')}
        </Link>
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
    <div className="w-full min-w-0 sm:min-w-[320px] sm:max-w-md">
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

function CodeRow({ code, nowMs, onRevoke }: CodeRowProps) {
  const { t, formatDateTime } = useI18n();
  const { effectiveStatus, isUsable: isRevokable, timeLeft } = codeLifecycle(code, nowMs);

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
        <CodeStatusBadge status={effectiveStatus} />
      </td>

      {/* Expires */}
      <td className="px-6 py-4 text-sm">
        {code.status === 'unused' ? (
          <CodeCountdown timeLeft={code.is_valid ? timeLeft : { ...timeLeft, isExpired: true }} />
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

function CodeMobileCard({ code, nowMs, onRevoke }: CodeRowProps) {
  const { t, formatDateTime } = useI18n();
  const { effectiveStatus, isUsable: isRevokable, timeLeft } = codeLifecycle(code, nowMs);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
      aria-label={`${t('codes.table.code')} ${code.code}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-gray-600">{t('codes.table.code')}</p>
          <code className="mt-1 block break-all font-mono text-sm font-semibold text-white [overflow-wrap:anywhere]">
            {code.code}
          </code>
        </div>
        <CopyButton text={code.code} />
      </div>

      <div className="mt-3">
        <CodeStatusBadge status={effectiveStatus} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-white/5 py-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-gray-600">{t('codes.table.expiresIn')}</dt>
          <dd className="mt-1 text-sm text-gray-300">
            {code.status === 'unused' ? (
              <CodeCountdown timeLeft={code.is_valid ? timeLeft : { ...timeLeft, isExpired: true }} />
            ) : (
              <span className="text-gray-600">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-gray-600">{t('codes.table.created')}</dt>
          <dd className="mt-1 break-words text-sm text-gray-400">{formatDateTime(code.created_at)}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-gray-600">{t('codes.table.installProgress')}</p>
        <InstallProgressCell code={code} />
      </div>

      {isRevokable ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRevoke(code)}
          className="mt-4 w-full text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          {t('codes.revoke')}
        </Button>
      ) : null}
    </motion.article>
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
  const { generateCode, isLoading, isError, lastGeneratedCode, reset } = useGenerateCode();
  const [showCode, setShowCode] = useState(false);
  const generatedTime = useCodeTimeRemaining(lastGeneratedCode?.expires_at);
  const repoBootstrapCommand = 'mkdir -p /root/open && cd /root/open && if [ -d AeroNyx/.git ]; then cd AeroNyx && git fetch origin main && git checkout main && git pull --ff-only origin main; else git clone https://github.com/AeroNyxNetwork/AeroNyx.git AeroNyx && cd AeroNyx; fi';
  const quotedRegistrationCode = lastGeneratedCode ? shellSingleQuote(lastGeneratedCode.code) : '';
  const quickstartCommand = lastGeneratedCode
    ? `${repoBootstrapCommand} && AERONYX_REGISTRATION_CODE=${quotedRegistrationCode} ./deploy/node/aeronyx-node.sh quickstart --repo-dir "$PWD" --branch main --quick`
    : '';
  const installCommand = lastGeneratedCode
    ? `${repoBootstrapCommand} && sudo env AERONYX_REGISTRATION_CODE=${quotedRegistrationCode} ./deploy/node/aeronyx-node.sh install --repo-dir "$PWD" --branch main --quick`
    : '';
  const previewCommand = lastGeneratedCode
    ? `${repoBootstrapCommand} && AERONYX_REGISTRATION_CODE=${quotedRegistrationCode} ./deploy/node/aeronyx-node.sh plan --repo-dir "$PWD" --branch main --quick`
    : '';
  const statusCommand = lastGeneratedCode
    ? `${repoBootstrapCommand} && ./deploy/node/aeronyx-node.sh status --repo-dir "$PWD"`
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
      '2. Prefer quickstart. It prints a read-only plan first and waits for me to type INSTALL before host changes.',
      '3. Never print my registration code, private keys, API secrets, wallet-level data, DNS contents, destinations, packet payloads, chat plaintext, or client public IPs.',
      '4. After install or upgrade, run status first and summarize operator_status, operator_title, operator_detail, and operator_next_step. Use health --json only when deeper diagnostics are needed.',
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
      './deploy/node/aeronyx-node.sh quickstart --repo-dir /root/open/AeroNyx --branch main --quick --registration-code "$AERONYX_REGISTRATION_CODE"',
      '',
      'Show me the plan, then wait for me to type INSTALL before continuing.',
    ].join('\n')
    : '';

  const handleGenerate = async () => {
    try {
      await generateCode();
      setShowCode(true);
    } catch {
      // The mutation exposes a privacy-safe translated error in the card.
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
            className="space-y-4"
          >
            <div className="flex flex-col items-stretch justify-between gap-6 sm:flex-row sm:items-center">
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
                className="w-full sm:w-auto"
                leftIcon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                {t('codes.generate.button')}
              </Button>
            </div>
            {isError ? (
              <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {t('codes.error.generate')}
              </p>
            ) : null}
          </motion.div>
        ) : lastGeneratedCode ? (
          <motion.div
            key="code"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                  {t('codes.generated.title')}
                </p>
                <div className="flex min-w-0 items-center gap-3">
                  <code className="
                    min-w-0 break-all text-lg font-mono font-bold text-white [overflow-wrap:anywhere] sm:text-2xl
                    bg-black/30 border border-white/10
                    px-4 py-2 rounded-xl
                  ">
                    {lastGeneratedCode.code}
                  </code>
                  {!generatedTime.isExpired ? <CopyButton text={lastGeneratedCode.code} /> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label={t('common.closeModal')}
                className="shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50"
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
                <CodeCountdown timeLeft={generatedTime} />
              </div>
            </div>

            {generatedTime.isExpired ? (
              <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-4">
                <p className="text-sm leading-6 text-red-100">{t('codes.generated.expiredAction')}</p>
                <Button variant="secondary" onClick={handleGenerate} isLoading={isLoading} className="mt-4 w-full sm:w-auto">
                  {t('codes.generated.generateAnother')}
                </Button>
                {isError ? (
                  <p className="mt-3 text-sm text-red-100">{t('codes.error.generate')}</p>
                ) : null}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <p className="text-sm text-purple-200">
                  {t('codes.generated.commandHint')}
                </p>
                <div className="mt-3 space-y-3">
                <p className="text-xs leading-5 text-purple-100/70">
                  {t('codes.generated.scriptOrigin')}
                </p>
                <p className="text-xs font-medium uppercase tracking-wider text-purple-100/60">
                  {t('codes.generated.quickstartCommand')}
                </p>
                <div className="flex items-start gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded bg-black/30 px-3 py-2 font-mono text-xs leading-5 text-gray-200 sm:text-sm">
                    {quickstartCommand}
                  </code>
                  <CopyButton text={quickstartCommand} />
                </div>
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
                  {t('codes.generated.statusCommand')}
                </p>
                <div className="flex items-start gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded bg-black/30 px-3 py-2 font-mono text-xs leading-5 text-gray-400">
                    {statusCommand}
                  </code>
                  <CopyButton text={statusCommand} />
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
            )}
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
  const { codes, isLoading, isFetching, isError, refetch } = useRegistrationCodes({ includeExpired: true });
  const {
    revokeCode,
    isLoading: isRevoking,
    isError: isRevokeError,
    reset: resetRevoke,
  } = useRevokeCode();
  const [codeToRevoke, setCodeToRevoke] = useState<RegistrationCode | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const nowMs = useRegistrationCodeClock(codes);

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const openRevoke = (code: RegistrationCode) => {
    resetRevoke();
    setCodeToRevoke(code);
  };

  const closeRevoke = () => {
    if (isRevoking) return;
    setCodeToRevoke(null);
    resetRevoke();
  };

  const handleRevoke = async () => {
    if (!codeToRevoke) return;
    try {
      await revokeCode(codeToRevoke.code);
      setCodeToRevoke(null);
      resetRevoke();
    } catch {
      // ConfirmDialog owns the translated operation error.
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
        <div className="flex flex-col gap-3 border-b border-white/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h3 className="font-semibold text-white">{t('codes.history.title')}</h3>
            {!isLoading ? (
              <p className="mt-1 text-xs text-gray-600">{t('codes.history.count', { count: codes.length })}</p>
            ) : null}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            isLoading={isManualRefreshing}
            disabled={isFetching}
            className="w-full sm:w-auto"
          >
            {isManualRefreshing ? t('common.refreshing') : t('common.refreshNow')}
          </Button>
        </div>

        {isError && codes.length > 0 ? (
          <p role="alert" className="mx-4 mt-4 rounded-lg border border-yellow-400/25 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100 sm:mx-6">
            {t('codes.error.stale')}
          </p>
        ) : null}

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : isError && codes.length === 0 ? (
          <div className="p-8 text-center sm:p-12">
            <p role="alert" className="text-sm text-yellow-200">{t('codes.error.list')}</p>
            <Button variant="secondary" size="sm" onClick={handleRefresh} isLoading={isManualRefreshing} className="mt-4">
              {t('common.retry')}
            </Button>
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
          <>
            <div className="space-y-3 p-4 xl:hidden">
              <AnimatePresence initial={false}>
                {codes.map((code) => (
                  <CodeMobileCard key={code.id} code={code} nowMs={nowMs} onRevoke={openRevoke} />
                ))}
              </AnimatePresence>
            </div>
            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-[1120px] w-full">
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
                        nowMs={nowMs}
                        onRevoke={openRevoke}
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Revoke Confirmation */}
      <ConfirmDialog
        isOpen={!!codeToRevoke}
        onClose={closeRevoke}
        onConfirm={handleRevoke}
        title={t('codes.revokeTitle')}
        message={t('codes.revokeMessage', { code: codeToRevoke?.code || '' })}
        confirmText={t('codes.revoke')}
        cancelText={t('nodes.cancel')}
        variant="warning"
        isLoading={isRevoking}
        errorMessage={isRevokeError ? t('codes.error.revoke') : undefined}
      />
    </div>
  );
}
