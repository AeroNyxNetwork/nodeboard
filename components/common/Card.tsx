/**
 * ============================================
 * AeroNyx Card Component
 * ============================================
 * File Path: components/common/Card.tsx
 *
 * Modification Reason:
 *   v1.0.2 - [DASHBOARD-TRUTH 2026-08-13 by Codex] Hardened StatCard for
 *     narrow mobile grids with responsive padding, stable icon dimensions,
 *     and safe wrapping for localized labels and large values.
 *
 * Last Modified: v1.0.2 - Responsive localized StatCard layout
 * Previous: v1.0.1 - Removed motion animations to prevent re-renders
 * ============================================
 */

'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';

type CardVariant = 'default' | 'glow' | 'solid' | 'outline';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<CardVariant, string> = {
  default: `bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 backdrop-blur-xl`,
  glow: `bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-purple-500/20 backdrop-blur-xl hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10`,
  solid: `bg-[#1A1A24] border border-white/5`,
  outline: `bg-transparent border border-white/10 hover:border-white/20`,
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export default function Card({
  variant = 'default',
  padding = 'md',
  interactive = false,
  header,
  footer,
  children,
  className = '',
}: CardProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl transition-all duration-300
        ${variantStyles[variant]}
        ${interactive ? 'cursor-pointer hover:scale-[1.01] hover:-translate-y-0.5' : ''}
        ${className}
      `}
    >
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
      
      {/* Header */}
      {header && <div className="border-b border-white/5 px-6 py-4">{header}</div>}
      
      {/* Content */}
      <div className={padding !== 'none' && !header && !footer ? paddingStyles[padding] : ''}>
        {(header || footer) ? <div className={paddingStyles[padding]}>{children}</div> : children}
      </div>
      
      {/* Footer */}
      {footer && <div className="border-t border-white/5 px-6 py-4">{footer}</div>}
    </div>
  );
}

// Stat Card
interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  className?: string;
}

export function StatCard({ label, value, subValue, icon, trend, className = '' }: StatCardProps) {
  const { t, formatNumber } = useI18n();

  return (
    <Card variant="default" padding="none" className={className}>
      <div className="p-4 sm:p-6">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="break-words text-sm leading-5 text-gray-400">{label}</p>
            <p className="break-words text-xl font-bold text-white sm:text-2xl">{value}</p>
            {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
          </div>
          {icon && <div className="shrink-0 rounded-lg bg-purple-500/10 p-2 text-purple-400">{icon}</div>}
        </div>
        {trend && (
          <div className="mt-4 flex flex-wrap items-center gap-1">
            <span className={trend.isPositive ? 'text-emerald-400' : 'text-red-400'}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-gray-500">
              {t('common.trend.vsLastPeriod', { value: formatNumber(Math.abs(trend.value)) })}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

// Empty State
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <Card variant="outline" padding="lg" className={`text-center ${className}`}>
      <div className="flex flex-col items-center gap-4">
        {icon && <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">{icon}</div>}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-400 max-w-sm">{description}</p>
        </div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </Card>
  );
}

// Loading Card
export function LoadingCard({ className = '' }: { className?: string }) {
  return (
    <Card variant="default" padding="md" className={`animate-pulse ${className}`}>
      <div className="space-y-4">
        <div className="h-4 bg-white/10 rounded w-1/3" />
        <div className="h-8 bg-white/10 rounded w-2/3" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
      </div>
    </Card>
  );
}
