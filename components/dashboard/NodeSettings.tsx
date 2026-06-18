/**
 * ============================================
 * AeroNyx - Node Settings Panel
 * ============================================
 * File Path: components/dashboard/NodeSettings.tsx
 *
 * Creation Reason: v1.4.0 — Node settings panel for the detail page.
 *   Provides the only UI entry point for configuring node visibility,
 *   region, city, VPN flag, and access password.
 *   PC-only management component — not used on mobile.
 *
 * Main Functionality:
 *   1. Visibility selector (private / public / password_protected / unlisted)
 *   2. Access password field with secure generator and copy helper
 *      (shown only when password_protected)
 *   3. Region code input (ISO 3166-1 alpha-2) + city input
 *   4. VPN node toggle
 *   5. Commercial capacity policy: max sessions and bandwidth cap
 *   6. Batch save — all fields submitted in a single PATCH request
 *
 * Dependencies:
 *   - hooks/useNodes.ts (useUpdateNode)
 *   - types/index.ts (NodeDetail, NodeVisibility, NodeUpdateRequest)
 *   - lib/constants.ts (NODE_VISIBILITY_CONFIG)
 *   - components/common/Card.tsx
 *   - components/common/Button.tsx
 *
 * Backend API:
 *   - PATCH /api/privacy_network/nodes/<node_id>/
 * Backend source files:
 *   - /root/aeronyx/privacy_network/api/nodes.py
 *   - /root/aeronyx/privacy_network/serializers.py
 *   - /root/aeronyx/privacy_network/models.py
 * Rust consumers:
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/handlers/packet.rs
 *
 * Main Logical Flow:
 *   1. Initialize local form state from current node values
 *   2. User edits fields — local state updates, no network call yet
 *   3. User clicks "Save Changes" → build NodeUpdateRequest → PATCH
 *   4. On success: call onSaved() so parent can refresh node data
 *   5. On error: show inline error message
 *
 * ⚠️ Important Notes for Next Developer:
 *   - access_password is ONLY included in the PATCH payload when:
 *       a) visibility is password_protected, AND
 *       b) the user has typed something in the password field
 *     Leaving the field blank = keep existing password (omit the key)
 *     Leaving password_protected = send "" to clear the stale hash
 *     Backend rejects password_protected + access_password="" so operators
 *     cannot leave a node password-protected with no usable password.
 *   - region_code is validated client-side (2 uppercase letters)
 *     Backend also validates — error will surface in errorMsg
 *   - NODE_VISIBILITY_CONFIG keys must match NodeVisibility type
 *   - This component does NOT handle node name editing —
 *     that remains inline in NodeDetailPage (EditableName component)
 *   - max_sessions and bandwidth_limit_mbps are backend/Rust operator policy
 *     fields. 0 means unlimited/local default and is passed through exactly
 *     so the Rust node policy can enforce the same value nodeboard displays.
 *   - Generated private access codes use browser crypto where available and
 *     are never sent anywhere until the operator clicks Save Changes.
 *
 * Last Modified: v1.4.4 - Add secure private access code generation
 * Previous: v1.4.3 - Prevent password-protected nodes with empty passwords
 * Previous: v1.4.2 - Added commercial capacity policy controls
 * Previous: v1.4.1 - Documented backend API and Rust policy consumers
 * ============================================
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { NodeDetail, NodeVisibility, NodeUpdateRequest } from '@/types';
import { NODE_VISIBILITY_CONFIG } from '@/lib/constants';
import { useUpdateNode } from '@/hooks/useNodes';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useI18n } from '@/lib/i18n/I18nProvider';

// ============================================
// Region Data
// ============================================

const REGIONS: { code: string; label: string; flag: string }[] = [
  { code: '',   label: 'Not Set',      flag: '🌐' },
  { code: 'US', label: 'United States', flag: '🇺🇸' },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', label: 'Germany',       flag: '🇩🇪' },
  { code: 'FR', label: 'France',        flag: '🇫🇷' },
  { code: 'NL', label: 'Netherlands',   flag: '🇳🇱' },
  { code: 'JP', label: 'Japan',         flag: '🇯🇵' },
  { code: 'SG', label: 'Singapore',     flag: '🇸🇬' },
  { code: 'HK', label: 'Hong Kong',     flag: '🇭🇰' },
  { code: 'TW', label: 'Taiwan',        flag: '🇹🇼' },
  { code: 'KR', label: 'South Korea',   flag: '🇰🇷' },
  { code: 'AU', label: 'Australia',     flag: '🇦🇺' },
  { code: 'CA', label: 'Canada',        flag: '🇨🇦' },
  { code: 'BR', label: 'Brazil',        flag: '🇧🇷' },
  { code: 'IN', label: 'India',         flag: '🇮🇳' },
  { code: 'RU', label: 'Russia',        flag: '🇷🇺' },
  { code: 'TR', label: 'Turkey',        flag: '🇹🇷' },
  { code: 'UA', label: 'Ukraine',       flag: '🇺🇦' },
  { code: 'CH', label: 'Switzerland',   flag: '🇨🇭' },
  { code: 'SE', label: 'Sweden',        flag: '🇸🇪' },
  { code: 'NO', label: 'Norway',        flag: '🇳🇴' },
  { code: 'FI', label: 'Finland',       flag: '🇫🇮' },
];

const MAX_COMMERCIAL_SESSIONS = 100000;
const MAX_BANDWIDTH_LIMIT_MBPS = 100000;
const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACCESS_CODE_CHUNK_COUNT = 4;
const ACCESS_CODE_CHUNK_LENGTH = 4;

function clampWholeNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function secureRandomIndex(maxExclusive: number) {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    return buffer[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function generatePrivateAccessCode() {
  const chunks: string[] = [];
  for (let chunkIndex = 0; chunkIndex < ACCESS_CODE_CHUNK_COUNT; chunkIndex += 1) {
    let chunk = '';
    for (let charIndex = 0; charIndex < ACCESS_CODE_CHUNK_LENGTH; charIndex += 1) {
      chunk += ACCESS_CODE_ALPHABET[secureRandomIndex(ACCESS_CODE_ALPHABET.length)];
    }
    chunks.push(chunk);
  }
  return `ANX-${chunks.join('-')}`;
}

// ============================================
// Props
// ============================================

interface NodeSettingsProps {
  node: NodeDetail;
  onSaved: () => void;
  onToast: (message: string, variant?: 'success' | 'error') => void;
}

// ============================================
// Visibility Option Component
// ============================================

interface VisibilityOptionProps {
  value: NodeVisibility;
  selected: boolean;
  onSelect: (v: NodeVisibility) => void;
}

function VisibilityOption({ value, selected, onSelect }: VisibilityOptionProps) {
  const cfg = NODE_VISIBILITY_CONFIG[value];
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`
        w-full flex items-start gap-3 p-3 rounded-xl border text-left
        transition-all duration-150
        ${selected
          ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.textColor}`
          : 'border-white/10 hover:border-white/20 text-gray-400 hover:text-gray-300'
        }
      `}
    >
      <span className="text-lg leading-none mt-0.5">{cfg.icon}</span>
      <div>
        <p className={`text-sm font-medium ${selected ? cfg.textColor : 'text-white'}`}>
          {t(`nodeSettings.visibility.${value}.label`)}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{t(`nodeSettings.visibility.${value}.description`)}</p>
      </div>
      {selected && (
        <span className="ml-auto flex-shrink-0">
          <svg className={`w-4 h-4 ${cfg.textColor}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </span>
      )}
    </button>
  );
}

// ============================================
// NodeSettings Component
// ============================================

export default function NodeSettings({ node, onSaved, onToast }: NodeSettingsProps) {
  const { t, formatNumber } = useI18n();
  const updateNode = useUpdateNode();

  // ── Form state ────────────────────────────────────────────────────────────
  const [visibility, setVisibility] = useState<NodeVisibility>(node.visibility ?? 'private');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [regionCode, setRegionCode] = useState(node.region_code ?? '');
  const [city, setCity] = useState(node.city ?? '');
  const [isVpnNode, setIsVpnNode] = useState(node.is_vpn_node ?? false);
  const [maxSessions, setMaxSessions] = useState(node.max_sessions ?? 0);
  const [bandwidthLimitMbps, setBandwidthLimitMbps] = useState(node.bandwidth_limit_mbps ?? 0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Re-sync when node prop changes (e.g. after external refetch)
  useEffect(() => {
    setVisibility(node.visibility ?? 'private');
    setRegionCode(node.region_code ?? '');
    setCity(node.city ?? '');
    setIsVpnNode(node.is_vpn_node ?? false);
    setMaxSessions(node.max_sessions ?? 0);
    setBandwidthLimitMbps(node.bandwidth_limit_mbps ?? 0);
    setPassword('');
    setIsDirty(false);
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dirty tracking ────────────────────────────────────────────────────────
  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleVisibilityChange = useCallback((v: NodeVisibility) => {
    setVisibility(v);
    markDirty();
  }, [markDirty]);

  const handleRegionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setRegionCode(e.target.value);
    markDirty();
  }, [markDirty]);

  const handleCityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCity(e.target.value.slice(0, 100));
    markDirty();
  }, [markDirty]);

  const handleVpnToggle = useCallback(() => {
    setIsVpnNode((v) => !v);
    markDirty();
  }, [markDirty]);

  const handleMaxSessionsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxSessions(clampWholeNumber(Number(e.target.value), 0, MAX_COMMERCIAL_SESSIONS));
    markDirty();
  }, [markDirty]);

  const handleBandwidthLimitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBandwidthLimitMbps(clampWholeNumber(Number(e.target.value), 0, MAX_BANDWIDTH_LIMIT_MBPS));
    markDirty();
  }, [markDirty]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    markDirty();
  }, [markDirty]);

  const handleGeneratePassword = useCallback(() => {
    const generated = generatePrivateAccessCode();
    setVisibility('password_protected');
    setPassword(generated);
    setShowPassword(true);
    markDirty();
    onToast(t('nodeSettings.password.generatedToast'));
  }, [markDirty, onToast, t]);

  const handleCopyPassword = useCallback(async () => {
    if (!password) {
      onToast(t('nodeSettings.password.copyEmpty'), 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(password);
      onToast(t('nodeSettings.password.copied'));
    } catch {
      onToast(t('nodeSettings.password.copyFailed'), 'error');
    }
  }, [onToast, password, t]);

  const handleClearPassword = useCallback(() => {
    setVisibility('private');
    setPassword('');
    markDirty();
    // Save will send access_password="" because visibility leaves
    // password_protected, clearing the stored hash without leaving the node in
    // an impossible password-protected/no-password state.
  }, [markDirty]);

  // ── Client-side validation ────────────────────────────────────────────────
  const validate = useCallback((): string => {
    // region_code is now always from the dropdown — no format validation needed
    if (visibility === 'password_protected' && !password && !node.has_access_password) {
      return t('nodeSettings.validation.passwordRequired');
    }
    if (maxSessions < 0 || maxSessions > MAX_COMMERCIAL_SESSIONS) {
      return t('nodeSettings.validation.maxSessions', { max: formatNumber(MAX_COMMERCIAL_SESSIONS) });
    }
    if (bandwidthLimitMbps < 0 || bandwidthLimitMbps > MAX_BANDWIDTH_LIMIT_MBPS) {
      return t('nodeSettings.validation.bandwidth', { max: formatNumber(MAX_BANDWIDTH_LIMIT_MBPS) });
    }
    return '';
  }, [visibility, password, node.has_access_password, maxSessions, bandwidthLimitMbps, t, formatNumber]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setErrorMsg('');
    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    // Build payload — only include access_password when:
    //   a) password_protected AND user typed a new password → set it
    //   b) user explicitly cleared password (we send "")
    //   c) visibility changed AWAY from password_protected with existing password:
    //      clear the hash so stale secrets are not kept after protection ends
    const payload: NodeUpdateRequest = {
      visibility,
      region_code: regionCode,
      city,
      is_vpn_node: isVpnNode,
      max_sessions: maxSessions,
      bandwidth_limit_mbps: bandwidthLimitMbps,
    };

    if (visibility === 'password_protected') {
      if (password) {
        payload.access_password = password;
      }
      // else: leave key out → existing password unchanged
    } else if (node.visibility === 'password_protected' && node.has_access_password) {
      payload.access_password = '';
    }

    try {
      await updateNode.mutateAsync({ nodeId: node.id, data: payload });
      setPassword('');
      setIsDirty(false);
      onToast(t('nodeSettings.toast.saved'));
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('nodeSettings.toast.saveFailed');
      setErrorMsg(msg);
      onToast(msg, 'error');
    }
  }, [
    validate, visibility, regionCode, city, isVpnNode, maxSessions, bandwidthLimitMbps,
    password, node.id, node.visibility, node.has_access_password, updateNode, onToast, onSaved, t,
  ]);

  const handleClearPasswordAndSave = useCallback(async () => {
    setErrorMsg('');
    const payload: NodeUpdateRequest = {
      visibility: 'private',
      region_code: regionCode,
      city,
      is_vpn_node: isVpnNode,
      max_sessions: maxSessions,
      bandwidth_limit_mbps: bandwidthLimitMbps,
      access_password: '', // Explicit clear
    };
    try {
      await updateNode.mutateAsync({ nodeId: node.id, data: payload });
      setPassword('');
      setIsDirty(false);
      setVisibility('private');
      onToast(t('nodeSettings.toast.passwordRemoved'));
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('nodeSettings.toast.clearPasswordFailed');
      setErrorMsg(msg);
      onToast(msg, 'error');
    }
  }, [
    regionCode, city, isVpnNode, maxSessions, bandwidthLimitMbps,
    node.id, updateNode, onToast, onSaved, t,
  ]);

  const isSaving = updateNode.isPending;

  // ============================================
  // Render
  // ============================================

  return (
    <Card variant="default" padding="none" className="mb-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="font-semibold text-white">{t('nodeSettings.title')}</h3>
        </div>
        {isDirty && (
          <span className="text-xs text-yellow-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            {t('nodeSettings.unsavedChanges')}
          </span>
        )}
      </div>

      <div className="p-6 space-y-8">

        {/* ── Visibility ───────────────────────────────────────────────────── */}
        <section>
          <h4 className="text-sm font-medium text-gray-300 mb-3">{t('nodeSettings.visibility.title')}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(NODE_VISIBILITY_CONFIG) as NodeVisibility[]).map((v) => (
              <VisibilityOption
                key={v}
                value={v}
                selected={visibility === v}
                onSelect={handleVisibilityChange}
              />
            ))}
          </div>
          {visibility !== 'password_protected' && (
            <div className="mt-3 rounded-xl border border-purple-500/15 bg-purple-500/[0.06] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-100">{t('nodeSettings.password.quickGenerateTitle')}</p>
                  <p className="mt-1 text-xs leading-5 text-purple-100/60">{t('nodeSettings.password.quickGenerateDetail')}</p>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="w-fit rounded-lg border border-purple-400/30 bg-purple-500/15 px-3 py-2 text-xs font-medium text-purple-100 transition-colors hover:bg-purple-500/20"
                >
                  {t('nodeSettings.password.generate')}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Access Password (only when password_protected) ───────────────── */}
        {visibility === 'password_protected' && (
          <section>
            <h4 className="text-sm font-medium text-gray-300 mb-1">{t('nodeSettings.password.title')}</h4>
            {node.has_access_password && (
              <p className="text-xs text-gray-500 mb-3">
                {t('nodeSettings.password.existingHint')}
              </p>
            )}
            {!node.has_access_password && (
              <p className="text-xs text-gray-500 mb-3">
                {t('nodeSettings.password.newHint')}
              </p>
            )}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                placeholder={node.has_access_password ? '••••••••' : t('nodeSettings.password.placeholder')}
                maxLength={128}
                className="
                  w-full pr-10 pl-4 py-2.5 rounded-xl
                  bg-white/5 border border-white/10
                  text-white placeholder-gray-600
                  focus:outline-none focus:border-purple-500/50
                  transition-colors font-mono
                "
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="rounded-lg border border-purple-500/25 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-200 transition-colors hover:bg-purple-500/15"
              >
                {node.has_access_password ? t('nodeSettings.password.regenerate') : t('nodeSettings.password.generate')}
              </button>
              <button
                type="button"
                onClick={handleCopyPassword}
                disabled={!password}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('nodeSettings.password.copy')}
              </button>
              <span className="text-xs leading-5 text-gray-600">
                {t('nodeSettings.password.generatedHint')}
              </span>
            </div>
            {node.has_access_password && (
              <button
                type="button"
                onClick={handleClearPassword}
                className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                {t('nodeSettings.password.remove')}
              </button>
            )}
          </section>
        )}

        {/* ── Region ───────────────────────────────────────────────────────── */}
        <section>
          <h4 className="text-sm font-medium text-gray-300 mb-3">{t('nodeSettings.region.title')}</h4>
          <div className="grid grid-cols-2 gap-3">
            {/* Country dropdown */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t('nodeSettings.region.country')}</label>
              <div className="relative">
                <select
                  value={regionCode}
                  onChange={handleRegionChange}
                  className="
                    w-full appearance-none px-4 py-2.5 pr-10 rounded-xl
                    bg-white/5 border border-white/10
                    text-white
                    focus:outline-none focus:border-purple-500/50
                    transition-colors cursor-pointer
                  "
                >
                  {REGIONS.map((r) => (
                    <option key={r.code} value={r.code} className="bg-[#1a1a24] text-white">
                      {r.flag} {r.label}
                    </option>
                  ))}
                </select>
                {/* Custom chevron */}
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {/* Show auto-detected region hint when nothing selected */}
              {!regionCode && node.auto_region && (
                <p className="text-xs text-gray-600 mt-1.5">
                  {t('nodeSettings.region.autoDetected')} <span className="text-gray-400 font-mono">{node.auto_region}</span>
                </p>
              )}
            </div>

            {/* City input */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t('nodeSettings.region.city')} <span className="text-gray-600">{t('nodeSettings.region.optional')}</span></label>
              <input
                type="text"
                value={city}
                onChange={handleCityChange}
                placeholder={t('nodeSettings.region.cityPlaceholder')}
                maxLength={100}
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-white/5 border border-white/10
                  text-white placeholder-gray-600
                  focus:outline-none focus:border-purple-500/50
                  transition-colors
                "
              />
            </div>
          </div>
        </section>

        {/* ── VPN Node ─────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-300">{t('nodeSettings.aeronyxExit.title')}</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('nodeSettings.aeronyxExit.description')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleVpnToggle}
              className={`
                relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2
                transition-colors duration-200 focus:outline-none
                ${isVpnNode
                  ? 'bg-purple-600 border-purple-600'
                  : 'bg-gray-700 border-gray-700'
                }
              `}
              role="switch"
              aria-checked={isVpnNode}
            >
              <span className={`
                pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow
                transform transition-transform duration-200
                ${isVpnNode ? 'translate-x-5' : 'translate-x-0'}
              `} />
            </button>
          </div>
        </section>

        {/* ── Commercial Capacity Policy ──────────────────────────────────── */}
        <section>
          <h4 className="text-sm font-medium text-gray-300 mb-1">{t('nodeSettings.capacity.title')}</h4>
          <p className="text-xs text-gray-500 mb-3">
            {t('nodeSettings.capacity.description')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t('nodeSettings.capacity.maxSessions')}</label>
              <input
                type="number"
                min={0}
                max={MAX_COMMERCIAL_SESSIONS}
                step={1}
                value={maxSessions}
                onChange={handleMaxSessionsChange}
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-white/5 border border-white/10
                  text-white placeholder-gray-600
                  focus:outline-none focus:border-purple-500/50
                  transition-colors
                "
              />
              <p className="text-xs text-gray-600 mt-1.5">
                {t('nodeSettings.capacity.unlimitedByNodeboard')}
              </p>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t('nodeSettings.capacity.bandwidth')}</label>
              <input
                type="number"
                min={0}
                max={MAX_BANDWIDTH_LIMIT_MBPS}
                step={1}
                value={bandwidthLimitMbps}
                onChange={handleBandwidthLimitChange}
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-white/5 border border-white/10
                  text-white placeholder-gray-600
                  focus:outline-none focus:border-purple-500/50
                  transition-colors
                "
              />
              <p className="text-xs text-gray-600 mt-1.5">
                {t('nodeSettings.capacity.bandwidthHint')}
              </p>
            </div>
          </div>
        </section>

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {errorMsg && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-400">{errorMsg}</p>
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          {/* Remove protection by switching to private and clearing the stale hash. */}
          {visibility === 'password_protected' && node.has_access_password && password === '' && (
            <button
              type="button"
              onClick={handleClearPasswordAndSave}
              disabled={isSaving}
              className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
            >
              {t('nodeSettings.password.remove')}
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('nodeSettings.saving')}
                </span>
              ) : (
                t('nodeSettings.saveChanges')
              )}
            </Button>
          </div>
        </div>

      </div>
    </Card>
  );
}
