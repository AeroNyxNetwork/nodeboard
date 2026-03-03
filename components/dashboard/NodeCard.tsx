/**
 * ============================================
 * AeroNyx Node Card Component
 * ============================================
 * File Path: components/dashboard/NodeCard.tsx
 *
 * Modification Reason:
 *   v1.2.0 - Moved three-dot menu button to footer row (next to version).
 *     Menu now opens UPWARD (bottom-up) so it doesn't obscure card content.
 *     This solves the overlap issue where the menu blocked stats and header.
 *   v1.1.0 - Replaced hover delete button with three-dot menu
 *   v1.0.3 - Fixed delete button / status badge overlap
 *   v1.0.2 - Added safe fallback for unknown status
 * Dependencies:
 *   - next/link (navigation)
 *   - next/navigation (useRouter for View Details)
 *   - types/index.ts (Node type)
 *   - lib/api.ts (formatRelativeTime, copyToClipboard utilities)
 *   - lib/constants.ts (NODE_STATUS_CONFIG)
 *
 * Main Logical Flow:
 * 1. Card renders node info with status badge in header
 * 2. Footer row: last seen, verified badge, version, three-dot button
 * 3. Three-dot button opens dropdown UPWARD above the footer
 * 4. Card body is still clickable (Link) to navigate to detail page
 *
 * ⚠️ Important Note for Next Developer:
 * - Menu opens upward (bottom: 100%) — if card is at the very top of the
 *   viewport, the menu may be clipped. Consider adding viewport detection
 *   logic if this becomes an issue.
 * - onEdit callback is optional — if not provided, Edit option is hidden
 * - All menu clicks use stopPropagation to prevent Link navigation
 *
 * Last Modified: v1.2.0 - Menu in footer, opens upward
 * Previous: v1.1.0 - Three-dot context menu with actions
 * Previous: v1.0.3 - Fixed delete button / status badge overlap
 * Previous: v1.0.2 - Added safe fallback for unknown status
 * ============================================
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
// Menu Item Component
// ============================================

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

function MenuItem({ icon, label, onClick, variant = 'default' }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 text-sm
        transition-colors duration-150 rounded-lg
        ${variant === 'danger'
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-gray-300 hover:bg-white/5 hover:text-white'
        }
      `}
    >
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ============================================
// Node Card Component
// ============================================

export default function NodeCard({ node, onDelete, onEdit }: NodeCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Safe status config with fallback
  const statusConfig = NODE_STATUS_CONFIG[node.status as keyof typeof NODE_STATUS_CONFIG] || DEFAULT_STATUS_CONFIG;

  // Safe value getters
  const currentSessions = node.current_sessions ?? 0;
  const totalSessions = node.total_sessions ?? 0;
  const totalTrafficGb = node.total_traffic_gb ?? 0;
  const onlineDuration = node.online_duration ?? 0;

  // ============================================
  // Menu handlers
  // ============================================

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(prev => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  // Close menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as HTMLElement) &&
        buttonRef.current && !buttonRef.current.contains(e.target as HTMLElement)
      ) {
        closeMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen, closeMenu]);

  // Action handlers
  const handleViewDetails = useCallback(() => {
    closeMenu();
    router.push(`/dashboard/nodes/${node.id}`);
  }, [closeMenu, router, node.id]);

  const handleEdit = useCallback(() => {
    closeMenu();
    if (onEdit) onEdit(node);
  }, [closeMenu, onEdit, node]);

  const handleCopyIP = useCallback(async () => {
    closeMenu();
    const ipText = `${node.public_ip || '0.0.0.0'}:${node.port || 0}`;
    const success = await copyToClipboard(ipText);
    if (success) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  }, [closeMenu, node.public_ip, node.port]);

  const handleCopyID = useCallback(async () => {
    closeMenu();
    const success = await copyToClipboard(node.id);
    if (success) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  }, [closeMenu, node.id]);

  const handleDelete = useCallback(() => {
    closeMenu();
    if (onDelete) onDelete(node);
  }, [closeMenu, onDelete, node]);

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
          Copied to clipboard!
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

                {/* Status Badge */}
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

        {/* ============================================ */}
        {/* Three-Dot Menu — positioned in footer row    */}
        {/* Menu opens UPWARD to avoid blocking content  */}
        {/* ============================================ */}
        <div className="absolute bottom-4 right-4 z-20">
          {/* Menu Trigger Button */}
          <button
            ref={buttonRef}
            onClick={toggleMenu}
            className={`
              p-1.5 rounded-lg
              transition-all duration-200
              ${menuOpen
                ? 'bg-white/10 text-white'
                : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white hover:bg-white/10'
              }
            `}
            aria-label="Node actions"
            aria-expanded={menuOpen}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {/* Dropdown — opens upward */}
          {menuOpen && (
            <div
              ref={menuRef}
              className="
                absolute bottom-full right-0 mb-2
                w-52 py-1.5 rounded-xl
                bg-[#1a1a24] border border-white/10
                shadow-2xl shadow-black/50
                backdrop-blur-xl
              "
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {/* View Details */}
              <div className="px-1.5">
                <MenuItem
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                  label="View Details"
                  onClick={handleViewDetails}
                />
              </div>

              {/* Edit Name — only show if onEdit provided */}
              {onEdit && (
                <div className="px-1.5">
                  <MenuItem
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM16.862 4.487L19.5 7.125" />
                      </svg>
                    }
                    label="Edit Name"
                    onClick={handleEdit}
                  />
                </div>
              )}

              {/* Divider */}
              <div className="my-1.5 border-t border-white/5" />

              {/* Copy IP */}
              <div className="px-1.5">
                <MenuItem
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                  }
                  label={`Copy IP`}
                  onClick={handleCopyIP}
                />
              </div>

              {/* Copy Node ID */}
              <div className="px-1.5">
                <MenuItem
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                  }
                  label="Copy Node ID"
                  onClick={handleCopyID}
                />
              </div>

              {/* Divider before danger zone */}
              {onDelete && (
                <>
                  <div className="my-1.5 border-t border-white/5" />
                  <div className="px-1.5">
                    <MenuItem
                      icon={
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      }
                      label="Delete Node"
                      onClick={handleDelete}
                      variant="danger"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
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
