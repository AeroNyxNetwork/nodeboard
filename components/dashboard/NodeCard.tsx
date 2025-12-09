/**
 * ============================================
 * AeroNyx Node Card Component
 * ============================================
 * File Path: components/dashboard/NodeCard.tsx
 * 
 * Last Modified: v1.0.1 - Removed motion animations to prevent re-renders
 * ============================================
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Node } from '@/types';
import { formatRelativeTime } from '@/lib/api';
import { NODE_STATUS_CONFIG } from '@/lib/constants';

// ============================================
// Props Interface
// ============================================

interface NodeCardProps {
  node: Node;
  onDelete?: (node: Node) => void;
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

export default function NodeCard({ node, onDelete }: NodeCardProps) {
  const statusConfig = NODE_STATUS_CONFIG[node.status];

  return (
    <div className="group relative">
      <Link href={`/dashboard/nodes/${node.id}`}>
        <div className="
          relative overflow-hidden rounded-2xl
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
                    {node.name}
                  </h3>
                  <p className="text-sm text-gray-500 font-mono">
                    {node.public_ip}:{node.port}
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
                    node.status === 'offline' ? 'bg-gray-400' : 'bg-red-400'}
                `} />
                <span className="text-xs font-medium">{statusConfig.label}</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <StatItem
                label="Active Sessions"
                value={node.current_sessions}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
              <StatItem
                label="Total Sessions"
                value={node.total_sessions.toLocaleString()}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
              <StatItem
                label="Traffic"
                value={`${node.total_traffic_gb.toFixed(2)} GB`}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                }
              />
              <StatItem
                label="Uptime"
                value={`${node.online_duration.toFixed(1)}h`}
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
                <span>Last seen {formatRelativeTime(node.last_heartbeat)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                {node.is_verified && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Verified
                  </span>
                )}
                <span className="text-xs text-gray-500">v{node.version}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Quick Delete Button (appears on hover) */}
      {onDelete && (
        <button
          className="
            absolute top-4 right-4
            opacity-0 group-hover:opacity-100
            p-2 rounded-lg
            bg-red-500/20 hover:bg-red-500/30
            text-red-400
            transition-all duration-200
            z-10
          "
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(node);
          }}
          aria-label="Delete node"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
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
