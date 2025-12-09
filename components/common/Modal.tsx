/**
 * ============================================
 * AeroNyx Modal Component
 * ============================================
 * File Path: components/common/Modal.tsx
 * 
 * Last Modified: v1.0.1 - Removed framer-motion to fix re-render issues
 * ============================================
 */

'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  children,
  footer,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && closeOnEscape) {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnBackdrop) {
      onClose();
    }
  }, [closeOnBackdrop, onClose]);

  // Don't render on server or if not mounted
  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200"
        onClick={handleBackdropClick}
      />
      
      {/* Modal */}
      <div
        className={`
          relative w-full ${sizeStyles[size]}
          bg-gradient-to-br from-[#1A1A24] to-[#12121A]
          border border-white/10 rounded-2xl shadow-2xl overflow-hidden
          transform transition-all duration-200
        `}
      >
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between p-6 border-b border-white/5">
            <div className="space-y-1 pr-8">
              {title && <h2 className="text-xl font-semibold text-white">{title}</h2>}
              {description && <p className="text-sm text-gray-400">{description}</p>}
            </div>
            {showCloseButton && (
              <IconButton
                icon={<CloseIcon />}
                aria-label="Close modal"
                onClick={onClose}
                variant="ghost"
                className="absolute top-4 right-4"
              />
            )}
          </div>
        )}
        
        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5 bg-black/20">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ============================================
// Confirm Dialog
// ============================================

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const iconColors = {
    danger: 'text-red-400 bg-red-500/10',
    warning: 'text-yellow-400 bg-yellow-500/10',
    info: 'text-blue-400 bg-blue-500/10',
  };

  const buttonColors = {
    danger: 'bg-red-500 hover:bg-red-600',
    warning: 'bg-yellow-500 hover:bg-yellow-600',
    info: 'bg-blue-500 hover:bg-blue-600',
  };

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="sm" showCloseButton={false}>
      <div className="flex flex-col items-center text-center space-y-4">
        <div className={`w-16 h-16 rounded-full ${iconColors[variant]} flex items-center justify-center`}>
          {variant === 'danger' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
          {variant === 'warning' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {variant === 'info' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-400">{message}</p>
        </div>
        
        <div className="flex items-center gap-3 w-full pt-2">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-white ${buttonColors[variant]} transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
          >
            {isLoading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
