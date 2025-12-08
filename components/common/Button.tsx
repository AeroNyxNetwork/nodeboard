/**
 * ============================================
 * AeroNyx Button Component
 * ============================================
 * File Path: src/components/common/Button.tsx
 * 
 * Creation Reason: Reusable button component with variants
 * Main Functionality: Primary, secondary, ghost, and danger button styles
 *                     with loading states and icon support
 * Dependencies: 
 *   - React
 *   - framer-motion (animations)
 * 
 * Main Logical Flow:
 * 1. Accept variant, size, and state props
 * 2. Apply appropriate styling based on variant
 * 3. Handle loading and disabled states
 * 4. Animate with Framer Motion
 * 
 * ⚠️ Important Note for Next Developer:
 * - Always use this component for buttons to maintain consistency
 * - Loading state automatically disables the button
 * - Icon can be placed left or right
 * 
 * Last Modified: v1.0.0 - Initial button component
 * ============================================
 */

'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

// ============================================
// Types
// ============================================

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

// ============================================
// Style Maps
// ============================================

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-purple-600 to-purple-700
    hover:from-purple-500 hover:to-purple-600
    text-white font-medium
    shadow-lg shadow-purple-500/25
    hover:shadow-purple-500/40
    border border-purple-500/50
  `,
  secondary: `
    bg-white/5 hover:bg-white/10
    text-white font-medium
    border border-white/10 hover:border-white/20
  `,
  ghost: `
    bg-transparent hover:bg-white/5
    text-gray-300 hover:text-white
    border border-transparent
  `,
  danger: `
    bg-red-500/20 hover:bg-red-500/30
    text-red-400 font-medium
    border border-red-500/30 hover:border-red-500/50
  `,
  outline: `
    bg-transparent
    text-purple-400 hover:text-purple-300 font-medium
    border border-purple-500/50 hover:border-purple-500
    hover:bg-purple-500/10
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
};

// ============================================
// Loading Spinner Component
// ============================================

function LoadingSpinner({ size }: { size: ButtonSize }) {
  const spinnerSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <svg
      className={`animate-spin ${spinnerSize[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================
// Button Component
// ============================================

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      className={`
        inline-flex items-center justify-center
        transition-all duration-200
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner size={size} />
      ) : leftIcon ? (
        <span className="flex-shrink-0">{leftIcon}</span>
      ) : null}
      
      <span className={isLoading ? 'opacity-0' : ''}>{children}</span>
      
      {!isLoading && rightIcon && (
        <span className="flex-shrink-0">{rightIcon}</span>
      )}
      
      {/* Shine effect for primary button */}
      {variant === 'primary' && !isDisabled && (
        <span className="absolute inset-0 overflow-hidden rounded-xl">
          <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </span>
      )}
    </motion.button>
  );
}

// ============================================
// Icon Button Variant
// ============================================

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> {
  icon: React.ReactNode;
  'aria-label': string;
}

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}: IconButtonProps) {
  const iconSizeStyles: Record<ButtonSize, string> = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  return (
    <motion.button
      className={`
        inline-flex items-center justify-center
        transition-all duration-200 rounded-lg
        ${variantStyles[variant]}
        ${iconSizeStyles[size]}
        ${props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      whileHover={!props.disabled ? { scale: 1.05 } : undefined}
      whileTap={!props.disabled ? { scale: 0.95 } : undefined}
      {...props}
    >
      {icon}
    </motion.button>
  );
}

// ============================================
// Copy Button (Common Use Case)
// ============================================

interface CopyButtonProps {
  text: string;
  onCopy?: () => void;
  className?: string;
}

export function CopyButton({ text, onCopy, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <IconButton
      icon={
        copied ? (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )
      }
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      onClick={handleCopy}
      className={className}
    />
  );
}
