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
 *   2. Access password field (shown only when password_protected)
 *   3. Region code input (ISO 3166-1 alpha-2) + city input
 *   4. VPN node toggle
 *   5. Batch save — all fields submitted in a single PATCH request
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
 * Rust consumers:
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/services/node_policy.rs
 *   - /root/open/AeroNyx/crates/aeronyx-server/src/api/vpn_health.rs
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
 *     Clicking "Clear Password" = send "" to clear it
 *   - region_code is validated client-side (2 uppercase letters)
 *     Backend also validates — error will surface in errorMsg
 *   - NODE_VISIBILITY_CONFIG keys must match NodeVisibility type
 *   - This component does NOT handle node name editing —
 *     that remains inline in NodeDetailPage (EditableName component)
 *
 * Last Modified: v1.4.1 - Documented backend API and Rust policy consumers
 * ============================================
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { NodeDetail, NodeVisibility, NodeUpdateRequest } from '@/types';
import { NODE_VISIBILITY_CONFIG } from '@/lib/constants';
import { useUpdateNode } from '@/hooks/useNodes';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';

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
          {cfg.label}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{cfg.description}</p>
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
  const updateNode = useUpdateNode();

  // ── Form state ────────────────────────────────────────────────────────────
  const [visibility, setVisibility] = useState<NodeVisibility>(node.visibility ?? 'private');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [regionCode, setRegionCode] = useState(node.region_code ?? '');
  const [city, setCity] = useState(node.city ?? '');
  const [isVpnNode, setIsVpnNode] = useState(node.is_vpn_node ?? false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Re-sync when node prop changes (e.g. after external refetch)
  useEffect(() => {
    setVisibility(node.visibility ?? 'private');
    setRegionCode(node.region_code ?? '');
    setCity(node.city ?? '');
    setIsVpnNode(node.is_vpn_node ?? false);
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

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    markDirty();
  }, [markDirty]);

  const handleClearPassword = useCallback(() => {
    setPassword('');
    markDirty();
    // Will send "" in payload to clear the hash
  }, [markDirty]);

  // ── Client-side validation ────────────────────────────────────────────────
  const validate = useCallback((): string => {
    // region_code is now always from the dropdown — no format validation needed
    if (visibility === 'password_protected' && !password && !node.has_access_password) {
      return 'A password is required for password-protected nodes.';
    }
    return '';
  }, [visibility, password, node.has_access_password]);

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
    //      don't clear — password is preserved silently (backend behavior)
    const payload: NodeUpdateRequest = {
      visibility,
      region_code: regionCode,
      city,
      is_vpn_node: isVpnNode,
    };

    if (visibility === 'password_protected') {
      if (password) {
        payload.access_password = password;
      }
      // else: leave key out → existing password unchanged
    }
    // "Clear password" button sets password to special sentinel:
    // We handle this via explicit button click in UI below

    try {
      await updateNode.mutateAsync({ nodeId: node.id, data: payload });
      setPassword('');
      setIsDirty(false);
      onToast('Settings saved successfully.');
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings.';
      setErrorMsg(msg);
      onToast(msg, 'error');
    }
  }, [
    validate, visibility, regionCode, city, isVpnNode,
    password, node.id, updateNode, onToast, onSaved,
  ]);

  const handleClearPasswordAndSave = useCallback(async () => {
    setErrorMsg('');
    const payload: NodeUpdateRequest = {
      visibility,
      region_code: regionCode,
      city,
      is_vpn_node: isVpnNode,
      access_password: '', // Explicit clear
    };
    try {
      await updateNode.mutateAsync({ nodeId: node.id, data: payload });
      setPassword('');
      setIsDirty(false);
      onToast('Password cleared.');
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear password.';
      setErrorMsg(msg);
      onToast(msg, 'error');
    }
  }, [visibility, regionCode, city, isVpnNode, node.id, updateNode, onToast, onSaved]);

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
          <h3 className="font-semibold text-white">Node Settings</h3>
        </div>
        {isDirty && (
          <span className="text-xs text-yellow-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            Unsaved changes
          </span>
        )}
      </div>

      <div className="p-6 space-y-8">

        {/* ── Visibility ───────────────────────────────────────────────────── */}
        <section>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Visibility</h4>
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
        </section>

        {/* ── Access Password (only when password_protected) ───────────────── */}
        {visibility === 'password_protected' && (
          <section>
            <h4 className="text-sm font-medium text-gray-300 mb-1">Access Password</h4>
            {node.has_access_password && (
              <p className="text-xs text-gray-500 mb-3">
                A password is already set. Leave blank to keep it, or enter a new one to replace it.
              </p>
            )}
            {!node.has_access_password && (
              <p className="text-xs text-gray-500 mb-3">
                Set a password users must enter to access this node.
              </p>
            )}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                placeholder={node.has_access_password ? '••••••••' : 'Enter password...'}
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
            {node.has_access_password && (
              <button
                type="button"
                onClick={handleClearPassword}
                className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Remove password protection
              </button>
            )}
          </section>
        )}

        {/* ── Region ───────────────────────────────────────────────────────── */}
        <section>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Region</h4>
          <div className="grid grid-cols-2 gap-3">
            {/* Country dropdown */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Country</label>
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
                  Auto-detected: <span className="text-gray-400 font-mono">{node.auto_region}</span>
                </p>
              )}
            </div>

            {/* City input */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">City <span className="text-gray-600">(optional)</span></label>
              <input
                type="text"
                value={city}
                onChange={handleCityChange}
                placeholder="e.g. Tokyo"
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
              <h4 className="text-sm font-medium text-gray-300">VPN Exit Node</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Declare this node as a VPN exit node. Users can filter for VPN nodes in the node pool.
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
          {/* Clear password shortcut (only when password_protected + has existing password) */}
          {visibility === 'password_protected' && node.has_access_password && password === '' && (
            <button
              type="button"
              onClick={handleClearPasswordAndSave}
              disabled={isSaving}
              className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
            >
              Clear existing password
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
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>

      </div>
    </Card>
  );
}
