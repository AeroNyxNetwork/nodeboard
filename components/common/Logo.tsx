/**
 * ============================================
 * AeroNyx Logo Component
 * ============================================
 * File Path: src/components/common/Logo.tsx
 * 
 * Creation Reason: Reusable logo component to avoid SSR/hydration issues
 * Main Functionality: Renders the AeroNyx logo as an SVG component
 *                     with customizable size and color
 * Dependencies: React
 * 
 * Main Logical Flow:
 * 1. Accept size and color props
 * 2. Render SVG with proper viewBox
 * 3. Apply CSS classes for sizing
 * 
 * ⚠️ Important Note for Next Developer:
 * - Use this component instead of importing SVG files
 * - Color can be customized via the color prop
 * - The viewBox is fixed at 512x512
 * 
 * Last Modified: v1.0.0 - Initial TypeScript conversion
 * ============================================
 */

'use client';

import React from 'react';

// ============================================
// Props Interface
// ============================================

interface LogoProps {
  /** Tailwind size classes (e.g., "w-10 h-10") */
  className?: string;
  /** SVG fill color (hex or CSS color) */
  color?: string;
  /** Whether to show the text logo beside the icon */
  showText?: boolean;
}

// ============================================
// Logo Component
// ============================================

export default function Logo({ 
  className = "w-10 h-10", 
  color = "#8A2BE2",
  showText = false
}: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${showText ? '' : ''}`}>
      {/* Icon Logo */}
      <div className={`relative ${className}`}>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 512 512" 
          className="w-full h-full"
          aria-label="AeroNyx Logo"
        >
          <g transform="translate(0,512) scale(0.1,-0.1)" fill={color} stroke="none">
            <path d="M1277 3833 l-1277 -1278 0 -1275 0 -1275 1280 1280 1280 1280 -2 1273 -3 1272 -1278 -1277z"/>
            <path d="M3838 3833 l-1278 -1278 0 -1275 0 -1275 1280 1280 1280 1280 -2 1273 -3 1272 -1277 -1277z"/>
          </g>
        </svg>
        
        {/* Glow effect */}
        <div 
          className="absolute inset-0 blur-xl opacity-50 -z-10"
          style={{ 
            background: `radial-gradient(circle, ${color}40, transparent)` 
          }}
        />
      </div>

      {/* Text Logo */}
      {showText && (
        <span 
          className="text-2xl font-bold tracking-wider"
          style={{ 
            background: `linear-gradient(135deg, ${color}, #EC4899)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          AERONYX
        </span>
      )}
    </div>
  );
}

// ============================================
// Logo Variants
// ============================================

export function LogoSmall({ color = "#8A2BE2" }: { color?: string }) {
  return <Logo className="w-8 h-8" color={color} />;
}

export function LogoLarge({ color = "#8A2BE2" }: { color?: string }) {
  return <Logo className="w-16 h-16" color={color} showText />;
}

export function LogoWithText({ color = "#8A2BE2" }: { color?: string }) {
  return <Logo className="w-10 h-10" color={color} showText />;
}
