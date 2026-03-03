/**
 * ============================================
 * AeroNyx Node Card Component
 * ============================================
 * File Path: components/dashboard/NodeCard.tsx
 *
 * Modification Reason:
 *   v1.3.0 - Replaced three-dot menu with hover-on-badge interaction.
 *     PC: hover status badge → dropdown with Copy IP / Copy Node ID.
 *     Mobile: no hover interaction, tap card → detail page.
 *     Delete removed from card — now only in detail page.
 *   v1.2.0 - Menu in footer, opens upward
 *   v1.1.0 - Replaced hover delete button with three-dot menu
 *   v1.0.3 - Fixed delete button / status badge overlap
 *   v1.0.2 - Added safe fallback for unknown status
 * Dependencies:
 *   - next/link (navigation)
 *   - types/index.ts (Node type)
 *   - lib/api.ts (formatRelativeTime, copyToClipboard utilities)
 *   - lib/constants.ts (NODE_STATUS_CONFIG)
 *
 * Main Logical Flow:
 * 1. Card renders node info, entire card is a Link to detail page
 * 2. Status badge in top-right — on PC hover, dropdown appears below it
 * 3. Dropdown has Copy IP and Copy Node ID — click copies and shows toast
 * 4. Mouse leaves badge+dropdown area → dropdown disappears
 * 5. Mobile: no hover, tap card goes to detail page
 *
 * ⚠️ Important Note for Next Developer:
 * - The hover dropdown uses onMouseEnter/onMouseLeave on a wrapper div
 *   that contains both the badge and the dropdown — this keeps the dropdown
 *   open while the mouse moves from badge to dropdown
 * - Delete is intentionally NOT on the card — it's in the detail page only
 * - onDelete prop kept for backward compatibility but no longer rendered
 *
 * Last Modified: v1.3.0 - Hover-on-badge dropdown (Copy IP / Copy ID)
 * Previous: v1.2.0 - Menu in footer, opens upward
 * ============================================
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Node } from '@/types';
import { formatRelativeTime, copyToClipboard } from '@/lib/api';
import { NODE_STATUS_CONFIG } from '@/lib/constants';

// ============================================
// Default Status Config (Fallback)
// ============================================

const DEFAULT_STATUS_CONFIG = {
  label: 'Unknown',
  color: '#6B7280',
  bgColor: 'bg-gray-500/20',
  textColor: 'text-gray-400',
  borderColor: 'border-gray-500/50',
};

// ============================================
// Props Interface
// ============================================

interface NodeCardProps {
  node: Node;
  /** @deprecated Delete is now in detail page only. Kept for backward compat. */
  onDelete?: (node: Node) => void;
  onEdit?: (node: Node) => void;
}

// ============================================
// Stat Item Component
// ============================================

interface StatItemProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

function StatItem({ label, value, icon }: StatItemProps) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-gray-500">{icon}</span>}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-white">{value}</p>
      </div>
    </div>
  );
}

// ============================================
// Node Card Component
// ============================================

export default function NodeCard({ node }: NodeCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safe status config with fallback
  const statusConfig = NODE_STATUS_CONFIG[node.status as keyof typeof NODE_STATUS_CONFIG] || DEFAULT_STATUS_CONFIG;

  // Safe value getters
  const currentSessions = node.current_sessions ?? 0;
  const totalSessions = node.total_sessions ?? 0;
  const totalTrafficGb = node.total_traffic_gb ?? 0;
  const onlineDuration = node.online_duration ?? 0;

  // ============================================
  // Hover handlers — with small delay to prevent flicker
  // ============================================

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    setShowActions(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverTimeout.current = setTimeout(() => {
      setShowActions(false);
    }, 150);
  }, []);

  // ============================================
  // Copy handlers
  // ============================================

  const showCopyToast = useCallback((text: string) => {
    setCopyFeedback(text);
    setTimeout(() => setCopyFeedback(null), 2000);
  }, []);

  const handleCopyIP = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ipText = `${node.public_ip || '0.0.0.0'}:${node.port || 0}`;
    const success = await copyToClipboard(ipText);
    if (success) showCopyToast('IP copied!');
  }, [node.public_ip, node.port, showCopyToast]);

  const handleCopyID = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const success = await copyToClipboard(node.id);
    if (success) showCopyToast('Node ID copied!');
  }, [node.id, showCopyToast]);

  return (
    <>
      {/* Copy Feedback Toast */}
      {copyFeedback && (
        <div className="
          fixed top-6 left-1/2 -translate-x-1/2 z-50
          px-4 py-2 rounded-lg
          bg-emerald-500/20 border border-emerald-500/30
          text-emerald-300 text-sm font-medium
        ">
          {copyFeedback}
        </div>
      )}

      <div className="group relative">
        <Link href={`/dashboard/nodes/${node.id}`}>
          <div className="
            relative overflow-visible rounded-2xl
            bg-gradient-to-br from-white/[0.08] to-white/[0.02]
            border border-white/10 hover:border-purple-500/30
            backdrop-blur-xl
            transition-all duration-300
            hover:shadow-lg hover:shadow-purple-500/10
            hover:-translate-y-0.5
          ">
            {/* Top Gradient Line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

            {/* Status Glow */}
            {node.status === 'online' && (
              <div className="absolute top-4 right-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -z-10" />
            )}

            {/* Content */}
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  {/* Node Icon */}
                  <div className="
                    w-12 h-12 rounded-xl
                    bg-gradient-to-br from-purple-500/20 to-pink-500/20
                    flex items-center justify-center
                  ">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                    </svg>
                  </div>

                  {/* Name & IP */}
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                      {node.name || 'Unnamed Node'}
                    </h3>
                    <p className="text-sm text-gray-500 font-mono">
                      {node.public_ip || '0.0.0.0'}:{node.port || 0}
                    </p>
                  </div>
                </div>

                {/* Status Badge + Hover Dropdown Wrapper */}
                <div
                  className="relative hidden md:block"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* Badge */}
                  <div className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full cursor-default
                    ${statusConfig.bgColor} ${statusConfig.textColor}
                    border ${statusConfig.borderColor}
                    transition-all duration-200
                    ${showActions ? 'border-purple-500/40 ring-1 ring-purple-500/20' : ''}
                  `}>
                    <span className={`
                      w-2 h-2 rounded-full
                      ${node.status === 'online' ? 'bg-emerald-400 animate-pulse' :
                        node.status === 'offline' ? 'bg-gray-400' :
                        node.status === 'suspended' ? 'bg-red-400' : 'bg-gray-400'}
                    `} />
                    <span className="text-xs font-medium">{statusConfig.label}</span>
                  </div>

                  {/* Hover Dropdown — appears below badge */}
                  {showActions && (
                    <div className="
                      absolute top-full right-0 mt-2 z-30
                      w-44 py-1 rounded-xl
                      bg-[#1a1a24] border border-white/10
                      shadow-2xl shadow-black/50
                      backdrop-blur-xl
                    ">
                      {/* Copy IP */}
                      <button
                        onClick={handleCopyIP}
                        className="
                          w-full flex items-center gap-3 px-3 py-2.5 text-sm
                          text-gray-300 hover:bg-white/5 hover:text-white
                          transition-colors duration-150 rounded-lg mx-0
                        "
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                        <span>Copy IP</span>
                      </button>

                      {/* Divider */}
                      <div className="my-1 mx-3 border-t border-white/5" />

                      {/* Copy Node ID */}
                      <button
                        onClick={handleCopyID}
                        className="
                          w-full flex items-center gap-3 px-3 py-2.5 text-sm
                          text-gray-300 hover:bg-white/5 hover:text-white
                          transition-colors duration-150 rounded-lg mx-0
                        "
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                        <span>Copy Node ID</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile: Static badge only (no hover interaction) */}
                <div className="md:hidden">
                  <div className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full
                    ${statusConfig.bgColor} ${statusConfig.textColor}
                    border ${statusConfig.borderColor}
                  `}>
                    <span className={`
                      w-2 h-2 rounded-full
                      ${node.status === 'online' ? 'bg-emerald-400 animate-pulse' :
                        node.status === 'offline' ? 'bg-gray-400' :
                        node.status === 'suspended' ? 'bg-red-400' : 'bg-gray-400'}
                    `} />
                    <span className="text-xs font-medium">{statusConfig.label}</span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <StatItem
                  label="Active Sessions"
                  value={currentSessions}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                />
                <StatItem
                  label="Total Sessions"
                  value={totalSessions.toLocaleString()}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                />
                <StatItem
                  label="Traffic"
                  value={`${totalTrafficGb.toFixed(2)} GB`}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  }
                />
                <StatItem
                  label="Uptime"
                  value={`${onlineDuration.toFixed(1)}h`}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Last seen {node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : 'Never'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {node.is_verified && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Verified
                    </span>
                  )}
                  <span className="text-xs text-gray-500">v{node.version || '0.0.0'}</span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </>
  );
}

// ============================================
// Node Card Skeleton
// ============================================

export function NodeCardSkeleton() {
  return (
    <div className="
      rounded-2xl
      bg-gradient-to-br from-white/[0.08] to-white/[0.02]
      border border-white/10
      p-6
      animate-pulse
    ">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-white/10 rounded" />
            <div className="h-3 w-32 bg-white/10 rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-white/10 rounded-full" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-16 bg-white/10 rounded" />
            <div className="h-4 w-12 bg-white/10 rounded" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="h-3 w-32 bg-white/10 rounded" />
        <div className="h-3 w-16 bg-white/10 rounded" />
      </div>
    </div>
  );
}
