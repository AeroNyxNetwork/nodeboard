/**
 * ============================================
 * AeroNyx - Explore Node Card Component
 * ============================================
 * File Path: components/dashboard/ExploreCard.tsx
 *
 * Creation Reason: v1.4.0 — Dedicated card for the public node pool.
 *   Separate from NodeCard (owner management) because the information
 *   hierarchy and interactions are completely different:
 *     NodeCard     → management context (owner), copy IP, go to detail
 *     ExploreCard  → discovery context (any user), region/vpn/sessions,
 *                    connect intent, password lock indicator
 *
 * Main Functionality:
 *   1. Display public node info: name, region, status, sessions, VPN badge
 *   2. Password lock indicator (🔒) for password_protected nodes
 *   3. Trusted badge for nodes from /vpn/servers/ (isTrusted prop)
 *   4. Click → password modal if required, else navigate to node detail
 *   5. Password modal → calls onVerify → parent handles verifyNodeAccess
 *
 * Dependencies:
 *   - types/index.ts (PublicNode)
 *   - lib/api.ts (formatRelativeTime)
 *   - lib/constants.ts (NODE_STATUS_CONFIG)
 *
 * Main Logical Flow:
 *   1. Render card with sanitized public node data
 *   2. If requires_password: click opens inline password modal
 *   3. User submits password → onVerify(nodeId, password) called
 *   4. Parent (ExplorePage) calls verifyNodeAccess mutation
 *   5. On success: modal closes, onConnect(node) called
 *   6. If !requires_password: onClick → onConnect(node) directly
 *
 * ⚠️ Important Notes for Next Developer:
 *   - This card never receives owner/sensitive data (PublicNode is sanitized)
 *   - isTrusted prop is set by ExplorePage for nodes from /vpn/servers/
 *     Backend /vpn/servers/ returns a different shape — ExplorePage maps it
 *     to PublicNode-compatible shape before passing here
 *   - onVerify is async — ExploreCard shows its own loading state during verify
 *   - Do NOT add delete/edit actions here — this is a read-only discovery card
 *
 * Last Modified: v1.4.0 - Initial implementation
 * ============================================
 */

'use client';

import React, { useState, useCallback } from 'react';
import { PublicNode } from '@/types';
import { formatRelativeTime } from '@/lib/api';
import { NODE_STATUS_CONFIG } from '@/lib/constants';

// ============================================
// Props
// ============================================

interface ExploreCardProps {
  node: PublicNode;
  /** True for nodes from /vpn/servers/ — shows Trusted badge */
  isTrusted?: boolean;
  /** Called when user wants to connect (password verified or not required) */
  onConnect: (node: PublicNode) => void;
  /**
   * Called when user submits password for password_protected node.
   * Returns true on success, false on wrong password.
   */
  onVerify: (nodeId: string, password: string) => Promise<boolean>;
}

// ============================================
// Password Modal (inline)
// ============================================

interface PasswordModalProps {
  nodeName: string;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string;
}

function PasswordModal({ nodeName, onSubmit, onCancel, isLoading, error }: PasswordModalProps) {
  const [value, setValue] = useState('');
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    await onSubmit(value);
  }, [value, onSubmit]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-2xl bg-[#13131f] border border-white/10 p-6 shadow-2xl">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
        </div>

        <h3 className="text-base font-semibold text-white text-center mb-1">
          Password Required
        </h3>
        <p className="text-sm text-gray-500 text-center mb-5">
          <span className="text-gray-300">{nodeName}</span> is password protected
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter password"
              autoFocus
              maxLength={128}
              className="
                w-full pl-4 pr-10 py-2.5 rounded-xl
                bg-white/5 border border-white/10
                text-white placeholder-gray-600
                focus:outline-none focus:border-yellow-500/50
                transition-colors font-mono
              "
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d={showPw
                    ? "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                    : "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  }
                />
              </svg>
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.trim() || isLoading}
              className="
                flex-1 py-2.5 rounded-xl text-sm font-medium
                bg-yellow-500/20 border border-yellow-500/30 text-yellow-300
                hover:bg-yellow-500/30 disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors flex items-center justify-center gap-2
              "
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-yellow-300/30 border-t-yellow-300 rounded-full animate-spin" />
              ) : (
                'Unlock'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// ExploreCard Component
// ============================================

export default function ExploreCard({ node, isTrusted = false, onConnect, onVerify }: ExploreCardProps) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const statusConfig = NODE_STATUS_CONFIG[node.status] ?? {
    label: 'Unknown',
    bgColor: 'bg-gray-500/20',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/50',
  };

  const displayRegion = node.effective_region || node.region_code || node.auto_region || '';
  const displayLocation = [displayRegion, node.city].filter(Boolean).join(' · ');

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleCardClick = useCallback(() => {
    if (node.requires_password) {
      setVerifyError('');
      setShowPasswordModal(true);
    } else {
      onConnect(node);
    }
  }, [node, onConnect]);

  // ── Password submit ───────────────────────────────────────────────────────
  const handlePasswordSubmit = useCallback(async (password: string) => {
    setVerifyLoading(true);
    setVerifyError('');
    try {
      const ok = await onVerify(node.id, password);
      if (ok) {
        setShowPasswordModal(false);
        onConnect(node);
      } else {
        setVerifyError('Invalid password. Please try again.');
      }
    } catch {
      setVerifyError('Invalid password. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  }, [node, onVerify, onConnect]);

  // ============================================
  // Render
  // ============================================

  return (
    <>
      <button
        type="button"
        onClick={handleCardClick}
        className="
          w-full text-left group
          relative rounded-2xl overflow-hidden
          bg-gradient-to-br from-white/[0.07] to-white/[0.02]
          border border-white/10
          hover:border-purple-500/30
          transition-all duration-300
          hover:shadow-lg hover:shadow-purple-500/10
          hover:-translate-y-0.5
          focus:outline-none focus:ring-2 focus:ring-purple-500/40
        "
      >
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

        {/* Trusted glow */}
        {isTrusted && (
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -z-10" />
        )}

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            {/* Icon + name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="
                w-10 h-10 rounded-xl flex-shrink-0
                bg-gradient-to-br from-purple-500/15 to-pink-500/15
                flex items-center justify-center
              ">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                    {node.name}
                  </h3>
                  {/* Lock icon */}
                  {node.requires_password && (
                    <span className="text-yellow-400 flex-shrink-0" title="Password required">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </span>
                  )}
                </div>
                {displayLocation && (
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{displayLocation}</p>
                )}
              </div>
            </div>

            {/* Badges column */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              {/* Status badge */}
              <div className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                ${statusConfig.bgColor} ${statusConfig.textColor} border ${statusConfig.borderColor}
              `}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  node.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'
                }`} />
                {statusConfig.label}
              </div>

              {/* Trusted badge */}
              {isTrusted && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Trusted
                </span>
              )}

              {/* VPN badge */}
              {node.is_vpn_node && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  VPN
                </span>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-500">Sessions</p>
              <p className="text-sm font-medium text-white mt-0.5">{node.current_sessions}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-sm font-medium text-white mt-0.5">
                {node.total_sessions.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Version</p>
              <p className="text-sm font-mono text-white mt-0.5">v{node.version || '—'}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-gray-600">
              {node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : 'Never seen'}
            </span>
            <div className="flex items-center gap-2">
              {node.is_verified && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Verified
                </span>
              )}
              <span className="text-xs text-purple-400 group-hover:text-purple-300 flex items-center gap-1 transition-colors">
                {node.requires_password ? 'Unlock' : 'Connect'}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Password Modal */}
      {showPasswordModal && (
        <PasswordModal
          nodeName={node.name}
          onSubmit={handlePasswordSubmit}
          onCancel={() => { setShowPasswordModal(false); setVerifyError(''); }}
          isLoading={verifyLoading}
          error={verifyError}
        />
      )}
    </>
  );
}

// ============================================
// Skeleton
// ============================================

export function ExploreCardSkeleton() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-28 bg-white/10 rounded" />
            <div className="h-3 w-16 bg-white/10 rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-white/10 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-10 bg-white/10 rounded mx-auto" />
            <div className="h-4 w-8 bg-white/10 rounded mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
