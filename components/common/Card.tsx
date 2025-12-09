/**
 * ============================================
 * AeroNyx Card Component
 * ============================================
 * File Path: components/common/Card.tsx
 * 
 * Last Modified: v1.0.0 - Initial card component
 * ============================================
 */

'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type CardVariant = 'default' | 'glow' | 'solid' | 'outline';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'title'> {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
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
  ...props
}: CardProps) {
  const cardContent = (
    <>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
      {header && <div className="border-b border-white/5 px-6 py-4">{header}</div>}
      <div className={padding !== 'none' && !header && !footer ? paddingStyles[padding] : ''}>
        {(header || footer) ? <div className={paddingStyles[padding]}>{children}</div> : children}
      </div>
      {footer && <div className="border-t border-white/5 px-6 py-4">{footer}</div>}
    </>
  );

  if (interactive) {
    return (
      <motion.div
        className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${variantStyles[variant]} ${className}`}
        whileHover={{ scale: 1.01, y: -2 }}
        whileTap={{ scale: 0.99 }}
        {...props}
      >
        {cardContent}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${variantStyles[variant]} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      {...props}
    >
      {cardContent}
    </motion.div>
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
  return (
    <Card variant="default" padding="md" className={className}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
        </div>
        {icon && <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">{icon}</div>}
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1">
          <span className={trend.isPositive ? 'text-emerald-400' : 'text-red-400'}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-gray-500">vs last period</span>
        </div>
      )}
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
