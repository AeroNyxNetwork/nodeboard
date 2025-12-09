/**
 * ============================================
 * AeroNyx Sessions Page
 * ============================================
 * File Path: app/dashboard/sessions/page.tsx
 * 
 * Creation Reason: Display all sessions across all nodes
 * Main Functionality: Aggregated sessions view with filtering
 * 
 * Last Modified: v1.0.0 - Initial sessions page
 * ============================================
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNodes } from '@/hooks/useNodes';
import { formatDuration, formatRelativeTime } from '@/lib/api';
import Card, { EmptyState } from '@/components/common/Card';
import Button from '@/components/common/Button';

// ============================================
// Session Status Badge
// ============================================

function SessionStatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-emerald-500/20 text-emerald-400',
    completed: 'bg-gray-500/20 text-gray-400',
    error: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.completed}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'active' ? 'bg-emerald-400 animate-pulse' :
        status === 'completed' ? 'bg-gray-400' : 'bg-red-400'
      }`} />
      {status}
    </span>
  );
}

// ============================================
// Sessions Page Component
// ============================================

export default function SessionsPage() {
  const { nodes, isLoading } = useNodes();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Aggregate sessions from all nodes (for demo - in production you'd have a dedicated API)
  const totalActiveSessions = nodes.reduce((sum, node) => sum + node.current_sessions, 0);
  const totalSessions = nodes.reduce((sum, node) => sum + node.total_sessions, 0);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Sessions</h1>
        <p className="text-sm text-gray-400 mt-1">
          Monitor active and historical sessions across all your nodes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card variant="default" padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Sessions</p>
              <p className="text-2xl font-bold text-white">{totalActiveSessions}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card variant="default" padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Sessions</p>
              <p className="text-2xl font-bold text-white">{totalSessions.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/20">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card variant="default" padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Nodes</p>
              <p className="text-2xl font-bold text-white">
                {nodes.filter(n => n.status === 'online').length} / {nodes.length}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-cyan-500/20">
              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {['all', 'active', 'completed'].map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === filter
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Sessions by Node */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          title="No Sessions Yet"
          description="Sessions will appear here once your nodes start receiving connections."
        />
      ) : (
        <div className="space-y-4">
          {nodes.map((node) => (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card variant="default" padding="none">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      node.status === 'online' ? 'bg-emerald-400' : 'bg-gray-500'
                    }`} />
                    <h3 className="font-medium text-white">{node.name}</h3>
                    <span className="text-sm text-gray-500">{node.public_ip}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">
                      <span className="text-white font-medium">{node.current_sessions}</span> active
                    </span>
                    <span className="text-gray-400">
                      <span className="text-white font-medium">{node.total_sessions.toLocaleString()}</span> total
                    </span>
                  </div>
                </div>
                
                {node.current_sessions > 0 ? (
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>{node.current_sessions} active session{node.current_sessions !== 1 ? 's' : ''} right now</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-gray-500">
                    No active sessions
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card variant="outline" padding="md" className="mt-8">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-white mb-1">Session Privacy</h4>
            <p className="text-sm text-gray-400">
              For privacy reasons, detailed session information is only visible in the individual node detail pages. 
              This overview shows aggregate statistics across all your nodes.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
