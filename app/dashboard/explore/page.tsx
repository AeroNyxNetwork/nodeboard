/**
 * ============================================
 * AeroNyx - Node Explore Page
 * ============================================
 * File Path: app/dashboard/explore/page.tsx
 *
 * Creation Reason: v1.4.0 — Dedicated node discovery page.
 *   Separates "find a node to connect" from "manage my nodes"
 *   to serve two different user intents cleanly.
 *
 * Main Functionality:
 *   1. TRUSTED NODES section — from GET /vpn/servers/ (no auth)
 *   2. PUBLIC NODES section  — from GET /nodes/public/ (no auth, paginated)
 *   3. Region / VPN / Status filters
 *   4. Load more pagination for public nodes
 *   5. Password modal for password_protected nodes (via ExploreCard)
 *   6. onConnect handler — navigates to public node detail page
 *
 * Dependencies:
 *   - hooks/useNodes.ts (usePublicNodes, useVerifyNodeAccess)
 *   - components/dashboard/ExploreCard.tsx
 *   - lib/api.ts (api.getPublicNodes — trusted nodes fetched separately)
 *   - types/index.ts (PublicNode, PublicNodesParams)
 *
 * Main Logical Flow:
 *   1. Page mounts → fetch trusted nodes (GET /vpn/servers/) + public page 1
 *   2. User changes filters → reset page to 1 → refetch public nodes
 *   3. "Load More" → increment page → append results
 *   4. User clicks card:
 *      a) No password → navigate to /dashboard/explore/{id}
 *      b) Password required → ExploreCard shows modal
 *         → onVerify called → verifyNodeAccess mutation
 *         → success → navigate to /dashboard/explore/{id}
 *
 * ⚠️ Important Notes for Next Developer:
 *   - Trusted nodes come from /vpn/servers/ which has a different response
 *     shape. We map it to PublicNode-compatible shape with isTrusted=true.
 *     If /vpn/servers/ response shape changes, update trustedToPublicNode().
 *   - Public nodes pagination is page-based (not cursor).
 *     We accumulate pages in localNodes state rather than useInfiniteQuery
 *     because filters can reset mid-scroll — simpler to manage explicitly.
 *   - verifyNodeAccess is session-based (cookie). After verify, the session
 *     grant allows getPublicNodeDetail to succeed without re-verification.
 *   - No auth guard on this page — trusted + public endpoints are open.
 *     If user IS authenticated, their session may already have grants.
 *
 * Last Modified: v1.4.0 - Initial implementation
 * ============================================
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePublicNodes, useVerifyNodeAccess } from '@/hooks/useNodes';
import ExploreCard, { ExploreCardSkeleton } from '@/components/dashboard/ExploreCard';
import { PublicNode, PublicNodesParams } from '@/types';
import { api } from '@/lib/api';

// ============================================
// Trusted node adapter
// Map /vpn/servers/ response shape → PublicNode-compatible
// Update this function if /vpn/servers/ shape changes.
// ============================================

interface VpnServerRaw {
  id?: string;
  name?: string;
  ip?: string;
  host?: string;
  port?: number;
  country?: string;
  country_code?: string;
  city?: string;
  is_online?: boolean;
  status?: string;
  sessions?: number;
  total_sessions?: number;
  version?: string;
  is_verified?: boolean;
  last_heartbeat?: string;
  created_at?: string;
}

function trustedToPublicNode(raw: VpnServerRaw, index: number): PublicNode {
  return {
    id: raw.id ?? `trusted-${index}`,
    name: raw.name ?? `Trusted Node ${index + 1}`,
    visibility: 'public',
    requires_password: false,
    region_code: raw.country_code ?? raw.country ?? '',
    city: raw.city ?? '',
    effective_region: raw.country_code ?? raw.country ?? '',
    auto_region: raw.country_code ?? '',
    is_vpn_node: true,
    public_ip: raw.ip ?? raw.host ?? '',
    port: raw.port ?? 8001,
    version: raw.version ?? '0.0.0',
    status: raw.is_online || raw.status === 'online' ? 'online' : 'offline',
    current_sessions: raw.sessions ?? 0,
    total_sessions: raw.total_sessions ?? 0,
    is_verified: raw.is_verified ?? true,
    last_heartbeat: raw.last_heartbeat ?? new Date().toISOString(),
    created_at: raw.created_at ?? new Date().toISOString(),
  };
}

// ============================================
// Filter Bar Component
// ============================================

const REGIONS = [
  { code: '', label: 'All Regions' },
  { code: 'US', label: '🇺🇸 US' },
  { code: 'JP', label: '🇯🇵 JP' },
  { code: 'SG', label: '🇸🇬 SG' },
  { code: 'DE', label: '🇩🇪 DE' },
  { code: 'GB', label: '🇬🇧 GB' },
  { code: 'HK', label: '🇭🇰 HK' },
  { code: 'KR', label: '🇰🇷 KR' },
  { code: 'TW', label: '🇹🇼 TW' },
];

interface FilterBarProps {
  region: string;
  onRegionChange: (r: string) => void;
  vpnOnly: boolean;
  onVpnChange: (v: boolean) => void;
  onlineOnly: boolean;
  onOnlineChange: (v: boolean) => void;
}

function FilterBar({
  region, onRegionChange,
  vpnOnly, onVpnChange,
  onlineOnly, onOnlineChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Region pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {REGIONS.map((r) => (
          <button
            key={r.code}
            onClick={() => onRegionChange(r.code)}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${region === r.code
                ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }
            `}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-6 bg-white/10" />

      {/* VPN toggle */}
      <button
        onClick={() => onVpnChange(!vpnOnly)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
          transition-all border
          ${vpnOnly
            ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
          }
        `}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        VPN Only
      </button>

      {/* Online toggle */}
      <button
        onClick={() => onOnlineChange(!onlineOnly)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
          transition-all border
          ${onlineOnly
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
          }
        `}
      >
        <span className={`w-2 h-2 rounded-full ${onlineOnly ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
        Online Only
      </button>
    </div>
  );
}

// ============================================
// Section Header Component
// ============================================

function SectionHeader({ title, count, description }: { title: string; count?: number; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{title}</h2>
          {count !== undefined && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-gray-400">
              {count}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-gray-600 mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

// ============================================
// Explore Page
// ============================================

export default function ExplorePage() {
  const router = useRouter();
  const verifyAccess = useVerifyNodeAccess();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [region, setRegion] = useState('');
  const [vpnOnly, setVpnOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(true);
  const [page, setPage] = useState(1);

  // ── Accumulated public nodes (across pages) ───────────────────────────────
  const [accNodes, setAccNodes] = useState<PublicNode[]>([]);
  const isFirstLoad = useRef(true);

  // ── Trusted nodes (from /vpn/servers/) ───────────────────────────────────
  const [trustedNodes, setTrustedNodes] = useState<PublicNode[]>([]);
  const [trustedLoading, setTrustedLoading] = useState(true);

  // Load trusted nodes once on mount
  useEffect(() => {
    setTrustedLoading(true);
    fetch('https://api.aeronyx.network/api/privacy_network/vpn/servers/')
      .then((r) => r.json())
      .then((data) => {
        const raw: VpnServerRaw[] = Array.isArray(data) ? data : data.data ?? data.results ?? [];
        setTrustedNodes(raw.map(trustedToPublicNode));
      })
      .catch(() => setTrustedNodes([]))
      .finally(() => setTrustedLoading(false));
  }, []);

  // ── Public nodes query ────────────────────────────────────────────────────
  const params: PublicNodesParams = {
    ...(region ? { region } : {}),
    ...(vpnOnly ? { vpn: true } : {}),
    ...(onlineOnly ? { status: 'online' as const } : {}),
    page,
  };

  const { nodes, total, pageSize, hasMore, isLoading, isFetching } = usePublicNodes(params);

  // Accumulate pages — reset when filters change
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      setAccNodes(nodes);
      return;
    }
    if (page === 1) {
      setAccNodes(nodes);
    } else {
      setAccNodes((prev) => {
        // Deduplicate by id
        const existingIds = new Set(prev.map((n) => n.id));
        const newNodes = nodes.filter((n) => !existingIds.has(n.id));
        return [...prev, ...newNodes];
      });
    }
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset page + accumulated nodes when filters change
  const handleRegionChange = useCallback((r: string) => {
    setRegion(r);
    setPage(1);
    setAccNodes([]);
    isFirstLoad.current = true;
  }, []);

  const handleVpnChange = useCallback((v: boolean) => {
    setVpnOnly(v);
    setPage(1);
    setAccNodes([]);
    isFirstLoad.current = true;
  }, []);

  const handleOnlineChange = useCallback((v: boolean) => {
    setOnlineOnly(v);
    setPage(1);
    setAccNodes([]);
    isFirstLoad.current = true;
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      setPage((p) => p + 1);
    }
  }, [hasMore, isFetching]);

  // ── Node actions ──────────────────────────────────────────────────────────
  const handleConnect = useCallback((node: PublicNode) => {
    router.push(`/dashboard/explore/${node.id}`);
  }, [router]);

  const handleVerify = useCallback(async (nodeId: string, password: string): Promise<boolean> => {
    try {
      const res = await verifyAccess.mutateAsync({
        nodeId,
        data: { password },
      });
      return res.success;
    } catch {
      return false;
    }
  }, [verifyAccess]);

  // ============================================
  // Render
  // ============================================

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Explore Nodes</h1>
        <p className="text-sm text-gray-400 mt-1">
          Browse trusted and community nodes to connect to the network
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
        <FilterBar
          region={region}
          onRegionChange={handleRegionChange}
          vpnOnly={vpnOnly}
          onVpnChange={handleVpnChange}
          onlineOnly={onlineOnly}
          onOnlineChange={handleOnlineChange}
        />
      </div>

      {/* ── Trusted Nodes ─────────────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeader
          title="Trusted Nodes"
          count={trustedNodes.length || undefined}
          description="Verified high-quality nodes"
        />

        {trustedLoading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <ExploreCardSkeleton key={i} />)}
          </div>
        ) : trustedNodes.length === 0 ? (
          <div className="text-center py-10 text-gray-600 text-sm">
            No trusted nodes available at the moment.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {trustedNodes.map((node) => (
              <ExploreCard
                key={node.id}
                node={node}
                isTrusted
                onConnect={handleConnect}
                onVerify={handleVerify}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Public Nodes ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Public Nodes"
          count={total || undefined}
          description="Community-operated nodes"
        />

        {isLoading && accNodes.length === 0 ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <ExploreCardSkeleton key={i} />)}
          </div>
        ) : accNodes.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No public nodes match your filters.</p>
            <button
              onClick={() => { handleRegionChange(''); handleVpnChange(false); }}
              className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {accNodes.map((node) => (
                <ExploreCard
                  key={node.id}
                  node={node}
                  onConnect={handleConnect}
                  onVerify={handleVerify}
                />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetching}
                  className="
                    px-6 py-2.5 rounded-xl text-sm font-medium
                    bg-white/5 border border-white/10
                    text-gray-300 hover:text-white hover:border-white/20
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-all flex items-center gap-2 mx-auto
                  "
                >
                  {isFetching ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More
                      <span className="text-gray-500 text-xs">
                        ({accNodes.length} / {total})
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* End of list */}
            {!hasMore && accNodes.length > 0 && (
              <p className="text-center text-xs text-gray-600 mt-6">
                All {total} nodes loaded
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
