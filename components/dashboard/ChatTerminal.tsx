/**
 * ============================================
 * AeroNyx Privacy Network - Chat Terminal Component
 * ============================================
 * File Path: components/dashboard/ChatTerminal.tsx
 *
 * Modification Reason (v2.1.0):
 *   - Added "Memory Pulse" system: after each AI response completes,
 *     polls /mpi/status/ to detect new memories formed during conversation
 *   - Status bar shows memory count with pulse animation on change
 *   - New memory toast slides in showing what was learned
 *   - "Recalling memories..." indicator during AI thinking phase
 *
 * Main Functionality:
 *   - Connection status header with memory counter
 *   - Scrollable message area with smart auto-scroll
 *   - Memory chain indicator during AI thinking
 *   - New memory detection toast after AI responses
 *   - Input textarea with Enter-to-send
 *   - Reconnect/disconnect controls
 *
 * Dependencies:
 *   - hooks/useWebSocketChat.ts
 *   - hooks/useMemories.ts (useMemoryStatus for polling)
 *   - components/dashboard/ChatMessage.tsx
 *   - components/common/Button.tsx
 *
 * ⚠️ Important Note for Next Developer:
 * - Memory detection works by comparing total_records before and after
 *   each AI response. If the count increased, we show a toast.
 * - The polling happens ONCE after streaming ends, not continuously.
 * - The memory counter in the status bar pulses briefly when count changes.
 * - All of this works without any backend changes.
 *
 * Last Modified: v2.1.0 - Memory Pulse integration
 * Previous: v2.0.0 - Responsive chat UI overhaul
 * ============================================
 */

'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useWebSocketChat, WsConnectionState } from '@/hooks/useWebSocketChat';
import { useMemoryStatus } from '@/hooks/useMemories';
import ChatMessage from '@/components/dashboard/ChatMessage';
import Button from '@/components/common/Button';

// ============================================
// Props
// ============================================

interface ChatTerminalProps {
  nodeId: string;
}

// ============================================
// Connection Status Config
// ============================================

const CONNECTION_STATE_CONFIG: Record<
  WsConnectionState,
  { label: string; shortLabel: string; dotColor: string; textColor: string; animate: boolean }
> = {
  idle:           { label: 'Idle',                  shortLabel: 'Idle',       dotColor: 'bg-gray-400',    textColor: 'text-gray-400',    animate: false },
  connecting:     { label: 'Connecting...',         shortLabel: 'Connecting', dotColor: 'bg-yellow-400',  textColor: 'text-yellow-400',  animate: true  },
  authenticating: { label: 'Authenticating...',     shortLabel: 'Auth...',    dotColor: 'bg-purple-400',  textColor: 'text-purple-400',  animate: true  },
  connected:      { label: 'Secure Tunnel Active',  shortLabel: 'Connected',  dotColor: 'bg-emerald-400', textColor: 'text-emerald-400', animate: true  },
  reconnecting:   { label: 'Reconnecting...',       shortLabel: 'Retry...',   dotColor: 'bg-yellow-400',  textColor: 'text-yellow-400',  animate: true  },
  disconnected:   { label: 'Disconnected',          shortLabel: 'Offline',    dotColor: 'bg-gray-400',    textColor: 'text-gray-400',    animate: false },
  error:          { label: 'Connection Error',      shortLabel: 'Error',      dotColor: 'bg-red-400',     textColor: 'text-red-400',     animate: false },
};

// ============================================
// Status Bar
// ============================================

interface StatusBarProps {
  connectionState: WsConnectionState;
  nodeName: string | null;
  memoryCount: number | null;
  memoryPulse: boolean;
  onReconnect: () => void;
  onDisconnect: () => void;
  onClear: () => void;
  onBack: () => void;
}

function StatusBar({
  connectionState,
  nodeName,
  memoryCount,
  memoryPulse,
  onReconnect,
  onDisconnect,
  onClear,
  onBack,
}: StatusBarProps) {
  const config = CONNECTION_STATE_CONFIG[connectionState];
  const showReconnect = connectionState === 'disconnected' || connectionState === 'error';

  return (
    <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#0D0D12]/90 backdrop-blur-xl supports-[padding:env(safe-area-inset-top)]:pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 max-w-3xl mx-auto w-full">
        {/* Left: Back + Status */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors text-gray-400 hover:text-white flex-shrink-0"
            aria-label="Back to node"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <svg
              className={`w-4 h-4 flex-shrink-0 transition-colors ${
                connectionState === 'connected' ? 'text-emerald-400' : 'text-gray-600'
              }`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate max-w-[120px] sm:max-w-none">
                  {nodeName || 'AI Terminal'}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${config.animate ? 'animate-pulse' : ''}`} />
                  <span className={`text-xs ${config.textColor} hidden sm:inline`}>{config.label}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Memory counter + Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Memory counter */}
          {connectionState === 'connected' && memoryCount !== null && (
            <div
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                bg-purple-500/10 border border-purple-500/20
                transition-all duration-500
                ${memoryPulse ? 'scale-110 border-purple-500/40 bg-purple-500/20' : ''}
              `}
              title={`${memoryCount} memories`}
            >
              <svg className={`w-3 h-3 text-purple-400 ${memoryPulse ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span className="text-xs font-medium text-purple-300">{memoryCount}</span>
            </div>
          )}

          {showReconnect && (
            <Button variant="outline" size="sm" onClick={onReconnect}>
              <span className="hidden sm:inline">Reconnect</span>
              <span className="sm:hidden">Retry</span>
            </Button>
          )}
          {connectionState === 'connected' && (
            <>
              <button onClick={onClear} className="p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors text-gray-500 hover:text-gray-300" aria-label="Clear chat">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
              <button onClick={onDisconnect} className="p-2 rounded-lg hover:bg-red-500/10 active:bg-red-500/20 transition-colors text-gray-500 hover:text-red-400" aria-label="Disconnect">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Memory Chain Indicator
// ============================================

function MemoryChainIndicator() {
  return (
    <div className="flex items-center gap-2 mb-3 max-w-3xl mx-auto px-4 sm:px-0">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 motion-safe:animate-[fadeIn_0.3s_ease-out]">
        <svg className="w-3.5 h-3.5 text-purple-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        <span className="text-[12px] text-purple-300 font-medium">Recalling memories...</span>
      </div>
    </div>
  );
}

// ============================================
// New Memory Toast
// ============================================

function NewMemoryToast({ count, onDismiss }: { count: number; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="
        fixed top-16 right-4 sm:right-6 z-50
        flex items-center gap-3 px-4 py-3 rounded-xl
        bg-[#12121A]/95 border border-purple-500/20
        shadow-2xl shadow-purple-500/10 backdrop-blur-lg
        motion-safe:animate-[slideLeft_0.4s_ease-out]
        max-w-xs
      "
    >
      <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">New memory formed</p>
        <p className="text-xs text-gray-400">
          {count} new thing{count > 1 ? 's' : ''} learned from this conversation
        </p>
      </div>
      <button onClick={onDismiss} className="p-1 rounded hover:bg-white/5 text-gray-500 flex-shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ============================================
// Typing Indicator
// ============================================

function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4 max-w-3xl mx-auto px-4 sm:px-0">
      <div className="w-8 h-8 rounded-lg flex-shrink-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.04] border border-white/[0.06]">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

// ============================================
// Empty State
// ============================================

const SUGGESTIONS = [
  { text: 'What can you do?', icon: '✨' },
  { text: 'Run a system health check', icon: '🔍' },
  { text: 'What model are you running?', icon: '🤖' },
  { text: 'Tell me about your capabilities', icon: '💡' },
];

function EmptyState({ isConnected, onSuggestion }: { isConnected: boolean; onSuggestion: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 sm:py-12">
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl mb-5 bg-gradient-to-br from-purple-500/20 via-blue-500/10 to-pink-500/20 border border-white/[0.08] flex items-center justify-center">
        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-purple-500/10 blur-xl -z-10" />
      </div>
      <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Private AI Terminal</h3>
      <p className="text-sm text-gray-500 text-center max-w-xs sm:max-w-sm mb-8">
        {isConnected ? 'Your encrypted tunnel is active. Every conversation helps your AI learn and remember.' : 'Establishing secure tunnel connection...'}
      </p>
      {isConnected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full max-w-sm sm:max-w-md">
          {SUGGESTIONS.map((s) => (
            <button key={s.text} onClick={() => onSuggestion(s.text)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-left bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-purple-500/20 active:bg-white/[0.08] transition-all duration-200 group">
              <span className="text-base flex-shrink-0">{s.icon}</span>
              <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">{s.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Chat Input
// ============================================

function ChatInput({ onSend, disabled, isStreaming }: { onSend: (t: string) => void; disabled: boolean; isStreaming: boolean }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);

  // Robust auto-resize: works across browsers including Safari iOS
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Reset to single row to get accurate scrollHeight
    el.style.height = '0px';
    // Calculate new height, capped at ~6 lines
    const maxHeight = 160;
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(newHeight, 38)}px`;
    // Show scrollbar only when content exceeds max
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const handleSend = useCallback(() => {
    // Don't send during IME composition (Chinese/Japanese/Korean input)
    if (composingRef.current) return;
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue('');
    // Reset height after clearing
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = '38px';
        textareaRef.current.style.overflowY = 'hidden';
      }
    });
  }, [value, disabled, isStreaming, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't intercept Enter during IME composition
    if (e.nativeEvent.isComposing || composingRef.current) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // IME composition handlers (for Chinese/Japanese/Korean input)
  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    composingRef.current = false;
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  const canSend = value.trim().length > 0 && !disabled && !isStreaming;

  return (
    <div
      className="
        flex-shrink-0 border-t border-white/[0.06]
        bg-[#0D0D12]/95 backdrop-blur-xl
      "
      style={{
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
      }}
    >
      <div className="max-w-3xl mx-auto w-full px-3 sm:px-4 pt-3 sm:pt-4">
        <div
          className="
            flex items-end gap-2 sm:gap-3
            bg-white/[0.04] border border-white/[0.08]
            rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5
            focus-within:border-purple-500/30 focus-within:bg-white/[0.05]
            transition-all duration-200
          "
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={
              disabled
                ? 'Waiting for connection...'
                : isStreaming
                ? 'AI is responding...'
                : 'Message...'
            }
            disabled={disabled}
            rows={1}
            className="
              flex-1 bg-transparent text-[15px] sm:text-sm text-white
              placeholder-gray-600 resize-none outline-none
              leading-relaxed disabled:opacity-40
              overflow-hidden
            "
            style={{
              minHeight: '38px',
              maxHeight: '160px',
            }}
            aria-label="Chat message input"
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`
              flex-shrink-0 p-2.5 sm:p-2 rounded-xl
              transition-all duration-200 touch-manipulation
              ${canSend
                ? 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white shadow-lg shadow-purple-500/20 active:scale-95'
                : 'bg-white/[0.04] text-gray-600 cursor-not-allowed'
              }
            `}
            aria-label="Send message"
            type="button"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </div>

        {/* Hint */}
        <p className="hidden sm:block text-[10px] text-gray-700 mt-2 text-center select-none">
          End-to-end encrypted · Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// ============================================
// Time Separator
// ============================================

function TimeSeparator({ timestamp }: { timestamp: number }) {
  const label = useMemo(() => {
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, [timestamp]);

  return (
    <div className="flex items-center justify-center my-4 sm:my-6">
      <div className="flex-1 h-px bg-white/[0.04]" />
      <span className="px-3 text-[10px] text-gray-600 uppercase tracking-wider select-none">{label}</span>
      <div className="flex-1 h-px bg-white/[0.04]" />
    </div>
  );
}

// ============================================
// Main ChatTerminal
// ============================================

export default function ChatTerminal({ nodeId }: ChatTerminalProps) {
  const {
    messages, connectionState, nodeName, sendMessage,
    disconnect, reconnect, clearMessages, isStreaming,
  } = useWebSocketChat(nodeId);

  // Memory tracking
  const { status: memStatus, refetch: refetchMemStatus } = useMemoryStatus(nodeId);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [memoryPulse, setMemoryPulse] = useState(false);
  const [newMemoryToast, setNewMemoryToast] = useState<number | null>(null);
  const prevMemCountRef = useRef<number | null>(null);
  const wasStreamingRef = useRef(false);

  // Track memory count changes
  useEffect(() => {
    if (memStatus) {
      const count = memStatus.stats.total_records;
      setMemoryCount(count);

      if (prevMemCountRef.current !== null && count > prevMemCountRef.current) {
        const diff = count - prevMemCountRef.current;
        setMemoryPulse(true);
        setNewMemoryToast(diff);
        setTimeout(() => setMemoryPulse(false), 2000);
      }
      prevMemCountRef.current = count;
    }
  }, [memStatus]);

  // After streaming ends, poll memory status to detect new memories
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      // Streaming just ended — wait a moment then check for new memories
      const timer = setTimeout(() => {
        refetchMemStatus();
      }, 1500); // small delay for Rust to process and store
      return () => clearTimeout(timer);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, refetchMemStatus]);

  // Auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isUserScrolledUpRef = useRef(false);

  useEffect(() => {
    if (isUserScrolledUpRef.current) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [messages]);

  const handleScroll = useCallback(() => {
    const c = messagesContainerRef.current;
    if (!c) return;
    const isNearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 150;
    isUserScrolledUpRef.current = !isNearBottom;
    setShowScrollButton(!isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    isUserScrolledUpRef.current = false;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  }, []);

  // Time separators
  const messagesWithSeparators = useMemo(() => {
    const result: Array<{ type: 'separator'; timestamp: number } | { type: 'message'; id: string; index: number }> = [];
    let lastDate = '';
    messages.forEach((msg, i) => {
      if (msg.role === 'system') { result.push({ type: 'message', id: msg.id, index: i }); return; }
      const d = new Date(msg.timestamp).toDateString();
      if (d !== lastDate) { lastDate = d; result.push({ type: 'separator', timestamp: msg.timestamp }); }
      result.push({ type: 'message', id: msg.id, index: i });
    });
    return result;
  }, [messages]);

  const handleBack = useCallback(() => { window.location.href = `/dashboard/nodes/${nodeId}`; }, [nodeId]);
  const handleSuggestion = useCallback((text: string) => { sendMessage(text); }, [sendMessage]);

  const isConnected = connectionState === 'connected';
  const hasMessages = messages.filter((m) => m.role !== 'system').length > 0;
  const showTypingIndicator = isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user';
  const showMemoryIndicator = showTypingIndicator;

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F]">
      {/* New memory toast */}
      {newMemoryToast !== null && (
        <NewMemoryToast count={newMemoryToast} onDismiss={() => setNewMemoryToast(null)} />
      )}

      <StatusBar
        connectionState={connectionState}
        nodeName={nodeName}
        memoryCount={memoryCount}
        memoryPulse={memoryPulse}
        onReconnect={reconnect}
        onDisconnect={disconnect}
        onClear={clearMessages}
        onBack={handleBack}
      />

      <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overscroll-contain relative select-text">
        {!hasMessages ? (
          <EmptyState isConnected={isConnected} onSuggestion={handleSuggestion} />
        ) : (
          <div className="max-w-3xl mx-auto w-full px-3 sm:px-4 py-4">
            {messagesWithSeparators.map((item, i) => {
              if (item.type === 'separator') return <TimeSeparator key={`sep-${item.timestamp}`} timestamp={item.timestamp} />;
              const msg = messages[item.index];
              return <ChatMessage key={msg.id} message={msg} />;
            })}
            {showMemoryIndicator && <MemoryChainIndicator />}
            {showTypingIndicator && <TypingIndicator />}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        )}

        {showScrollButton && (
          <button onClick={scrollToBottom} className="fixed bottom-28 sm:bottom-32 right-4 sm:right-8 w-10 h-10 rounded-full bg-[#1A1A24] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/20 active:scale-95 transition-all duration-200 shadow-xl shadow-black/40 z-10" aria-label="Scroll to latest">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </button>
        )}
      </div>

      <ChatInput onSend={sendMessage} disabled={!isConnected} isStreaming={isStreaming} />
    </div>
  );
}
