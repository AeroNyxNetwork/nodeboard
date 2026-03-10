/**
 * ============================================
 * AeroNyx Privacy Network - Memory Hero
 * ============================================
 * File Path: components/memories/MemoryHero.tsx
 *
 * Creation Reason: The "stop scrolling" moment for VCs.
 *   A beautiful neural constellation visualization showing the user's
 *   memory footprint — each node is a memory, colored by layer,
 *   sized by access frequency. Below the visualization: key stats
 *   displayed as elegant metrics.
 *
 * Main Functionality:
 *   - Canvas-based particle constellation (memories as glowing nodes)
 *   - Layer-colored nodes with connection lines between related memories
 *   - Animated: nodes gently float, connections pulse
 *   - Stats row: total memories, layers breakdown, engine status
 *   - Responsive: full-width on mobile, constrained on desktop
 *   - Skeleton state while loading
 *
 * Dependencies:
 *   - types/memory.ts (MemoryStatusData, MemoryOverviewData, etc.)
 *
 * ⚠️ Important Note for Next Developer:
 * - Canvas animation uses requestAnimationFrame, cleaned up on unmount
 * - Node positions are seeded from record_id hash for determinism
 * - The visualization is decorative — clicking nodes does NOT navigate
 * - On mobile, fewer particles are rendered for performance
 * - prefers-reduced-motion disables animation
 *
 * Last Modified: v1.0.0 - Initial hero visualization
 * ============================================
 */

'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  MemoryStatusData,
  MemoryOverviewData,
  MemoryLayer,
  MEMORY_LAYER_CONFIG,
  MEMORY_LAYERS_ORDERED,
} from '@/types/memory';

// ============================================
// Props
// ============================================

interface MemoryHeroProps {
  status: MemoryStatusData | null;
  overview: MemoryOverviewData | null;
  isLoading: boolean;
}

// ============================================
// Color palette for layers
// ============================================

const LAYER_COLORS: Record<MemoryLayer, string> = {
  identity: '#a855f7',  // purple-500
  knowledge: '#3b82f6', // blue-500
  episode: '#10b981',   // emerald-500
  archive: '#6b7280',   // gray-500
};

const LAYER_GLOW: Record<MemoryLayer, string> = {
  identity: 'rgba(168, 85, 247, 0.3)',
  knowledge: 'rgba(59, 130, 246, 0.3)',
  episode: 'rgba(16, 185, 129, 0.3)',
  archive: 'rgba(107, 114, 128, 0.2)',
};

// ============================================
// Particle system types
// ============================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glow: string;
  layer: MemoryLayer;
  alpha: number;
}

// ============================================
// Hash function for deterministic positions
// ============================================

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// ============================================
// Skeleton
// ============================================

function HeroSkeleton() {
  return (
    <div className="relative mb-8 rounded-2xl overflow-hidden bg-gradient-to-b from-purple-500/[0.03] to-transparent border border-white/[0.04]">
      <div className="h-[240px] sm:h-[280px] animate-pulse bg-white/[0.02]" />
      <div className="px-6 pb-6">
        <div className="flex items-center gap-6 flex-wrap">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 w-28 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Stats Row
// ============================================

interface StatsRowProps {
  status: MemoryStatusData;
  overview: MemoryOverviewData | null;
}

function StatsRow({ status, overview }: StatsRowProps) {
  const { stats, embed_ready, index_ready } = status;

  const lastMemoryLabel = useMemo(() => {
    if (!overview?.last_memory_at) return null;
    const diff = Math.floor((Date.now() / 1000) - overview.last_memory_at);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }, [overview?.last_memory_at]);

  return (
    <div className="px-5 sm:px-6 pb-5 sm:pb-6">
      {/* Main stat */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          {stats.total_records}
        </span>
        <span className="text-sm text-gray-500">
          memories
        </span>
        {lastMemoryLabel && (
          <span className="text-xs text-gray-600 ml-auto">
            Last memory {lastMemoryLabel}
          </span>
        )}
      </div>

      {/* Layer chips */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
        {MEMORY_LAYERS_ORDERED.map((layer) => {
          const count = stats.by_layer[layer] ?? 0;
          const config = MEMORY_LAYER_CONFIG[layer];
          return (
            <div
              key={layer}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: LAYER_COLORS[layer] }}
              />
              <span className="text-xs text-gray-400">{config.labelEn}</span>
              <span className="text-xs font-medium text-white">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Engine status */}
      <div className="flex items-center gap-4 text-[11px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${embed_ready ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span>Embedding {embed_ready ? 'Online' : 'Offline'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${index_ready ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span>Vector Index {index_ready ? 'Ready' : 'Not Ready'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{stats.records_with_embedding} vectorized</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Canvas Constellation
// ============================================

interface ConstellationProps {
  overview: MemoryOverviewData | null;
  status: MemoryStatusData;
}

function Constellation({ overview, status }: ConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -999, y: -999 });

  // Build particles from overview data
  const buildParticles = useCallback((width: number, height: number): Particle[] => {
    const particles: Particle[] = [];
    const isMobile = width < 640;
    const maxParticles = isMobile ? 40 : 80;

    if (overview) {
      for (const layer of MEMORY_LAYERS_ORDERED) {
        const records = overview.recent_by_layer[layer] ?? [];
        for (const record of records) {
          if (particles.length >= maxParticles) break;
          const hash = simpleHash(record.record_id);
          const accessNorm = Math.min(record.access_count / 20, 1);

          particles.push({
            x: (hash % 1000) / 1000 * width * 0.8 + width * 0.1,
            y: ((hash >> 10) % 1000) / 1000 * height * 0.7 + height * 0.15,
            vx: (Math.random() - 0.5) * 0.15,
            vy: (Math.random() - 0.5) * 0.15,
            radius: 2 + accessNorm * 3,
            color: LAYER_COLORS[layer],
            glow: LAYER_GLOW[layer],
            layer,
            alpha: 0.5 + accessNorm * 0.5,
          });
        }
      }
    }

    // Fill remaining with ambient particles
    while (particles.length < maxParticles * 0.6) {
      const layer = MEMORY_LAYERS_ORDERED[Math.floor(Math.random() * 4)];
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        radius: 1 + Math.random() * 1.5,
        color: LAYER_COLORS[layer],
        glow: LAYER_GLOW[layer],
        layer,
        alpha: 0.2 + Math.random() * 0.3,
      });
    }

    return particles;
  }, [overview]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check reduced motion
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      particlesRef.current = buildParticles(rect.width, rect.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -999, y: -999 };
    };
    canvas.addEventListener('mousemove', handleMouse);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    let time = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);
      time += 0.005;

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      // Draw connections
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 80;

          if (dist < maxDist && particles[i].layer === particles[j].layer) {
            const alpha = (1 - dist / maxDist) * 0.12;
            ctx.strokeStyle = particles[i].color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw + update particles
      for (const p of particles) {
        if (!reducedMotion) {
          p.x += p.vx + Math.sin(time + p.y * 0.01) * 0.05;
          p.y += p.vy + Math.cos(time + p.x * 0.01) * 0.05;

          // Mouse repulsion
          const mdx = p.x - mouse.x;
          const mdy = p.y - mouse.y;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mDist < 80 && mDist > 0) {
            const force = (80 - mDist) / 80 * 0.5;
            p.x += (mdx / mDist) * force;
            p.y += (mdy / mDist) * force;
          }

          // Wrap edges
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
        }

        // Glow
        ctx.globalAlpha = p.alpha * 0.3;
        ctx.fillStyle = p.glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouse);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [buildParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-[220px] sm:h-[260px]"
      style={{ display: 'block' }}
    />
  );
}

// ============================================
// Main Component
// ============================================

export default function MemoryHero({ status, overview, isLoading }: MemoryHeroProps) {
  if (isLoading || !status) {
    return <HeroSkeleton />;
  }

  return (
    <div className="relative mb-8 rounded-2xl overflow-hidden bg-gradient-to-b from-[#0f0a1a] to-[#0a0a0f] border border-white/[0.04]">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-blue-500/[0.02] pointer-events-none" />

      {/* Constellation */}
      <Constellation overview={overview} status={status} />

      {/* Fade at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0a0a0f] to-transparent pointer-events-none" />

      {/* Stats */}
      <StatsRow status={status} overview={overview} />
    </div>
  );
}
