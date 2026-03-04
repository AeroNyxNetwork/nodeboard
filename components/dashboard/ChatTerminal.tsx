/**
 * ============================================
 * AeroNyx Privacy Network - Chat Terminal Component
 * ============================================
 * File Path: components/dashboard/ChatTerminal.tsx
 *
 * Creation Reason: Phase 2 — The immersive AI encrypted terminal UI.
 *   Provides the full chat interface: connection status bar, message list
 *   with auto-scroll, and input area with send controls.
 *
 * Main Functionality:
 *   - Connection status header (lock icon, node name, state indicator)
 *   - Scrollable message area with auto-scroll on new messages
 *   - "Scroll to bottom" button when user scrolls up
 *   - Input textarea with Enter-to-send, Shift+Enter for newline
 *   - Send button disabled during streaming or when disconnected
 *   - Reconnect button when disconnected/error
 *   - Clear chat action
 *   - Empty state with helpful prompt suggestions
 *
 * Dependencies:
 *   - hooks/useWebSocketChat.ts (useWebSocketChat hook)
 *   - components/dashboard/ChatMessage.tsx (message rendering)
 *   - components/common/Button.tsx (buttons)
 *
 * ⚠️ Important Note for Next Developer:
 * - Auto-scroll uses a sentinel div at the bottom + scrollIntoView
 * - The "user has scrolled up" detection uses onScroll with threshold
 * - Input auto-resizes up to 5 lines via scrollHeight measurement
 * - The component is designed to fill its parent container (h-full)
 *   — the chat page must provide an appropriate height container
 * - Connection state colors match the AGENT_STATUS_CONFIG palette
 *
 * Last Modified: v1.0.0 - Initial chat terminal for Phase 2
 * ============================================
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocketChat, WsConnectionState } from '@/hooks/useWebSocketChat';
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
  { label: string; dotColor: string; textColor: string; animate: boolean }
> = {
  idle: { label: 'Idle', dotColor: 'bg-gray-400', textColor: 'text-gray-400', animate: false },
  connecting: { label: 'Connecting...', dotColor: 'bg-yellow-400', textColor: 'text-yellow-400', animate: true },
  authenticating: { label: 'Authenticating...', dotColor: 'bg-purple-400', textColor: 'text-purple-400', animate: true },
  connected: { label: 'Secure Tunnel Active', dotColor: 'bg-emerald-400', textColor: 'text-emerald-400', animate: true },
  reconnecting: { label: 'Reconnecting...', dotColor: 'bg-yellow-400', textColor: 'text-yellow-400', animate: true },
  disconnected: { label: 'Disconnected', dotColor: 'bg-gray-400', textColor: 'text-gray-400', animate: false },
  error: { label: 'Connection Error', dotColor: 'bg-red-400', textColor: 'text-red-400', animate: false },
};

// ============================================
// Connection Status Bar
// ============================================

interface StatusBarProps {
  connectionState: WsConnectionState;
  nodeName: string | null;
  onReconnect: () => void;
  onDisconnect: () => void;
  onClear: () => void;
  onBack: () => void;
}

function StatusBar({
  connectionState,
  nodeName,
  onReconnect,
  onDisconnect,
  onClear,
  onBack,
}: StatusBarProps) {
  const config = CONNECTION_STATE_CONFIG[connectionState];
  const showReconnect = connectionState === 'disconnected' || connectionState === 'error';

  return (
    <div className="flex-shrink-0 border-b border-white/5 bg-[#0D0D12]/80 backdrop-blur-lg">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Back + Status */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white flex-shrink-0"
            title="Back to node"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Lock + Tunnel info */}
          <div className="flex items-center gap-2 min-w-0">
            <svg
              className={`w-4 h-4 flex-shrink-0 ${
                connectionState === 'connected' ? 'text-emerald-400' : 'text-gray-500'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">
                  {nodeName || 'AI Terminal'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${
                      config.animate ? 'animate-pulse' : ''
                    }`}
                  />
                  <span className={`text-xs ${config.textColor} hidden sm:inline`}>
                    {config.label}
                  </span>
                </div>
              </div>
              {connectionState === 'connected' && (
                <p className="text-[10px] text-gray-600 hidden sm:block">
                  End-to-end encrypted tunnel
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {showReconnect && (
            <Button variant="outline" size="sm" onClick={onReconnect}>
              Reconnect
            </Button>
          )}
          {connectionState === 'connected' && (
            <button
              onClick={onClear}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-500 hover:text-gray-300"
              title="Clear chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
          {connectionState === 'connected' && (
            <button
              onClick={onDisconnect}
              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-gray-500 hover:text-red-400"
              title="Disconnect"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Empty State
// ============================================

interface EmptyStateProps {
  isConnected: boolean;
  onSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  'What can you do?',
  'Tell me about your capabilities',
  'Run a system health check',
  'What model are you running?',
];

function EmptyState({ isConnected, onSuggestion }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12">
      <div
        className="
          w-16 h-16 rounded-2xl mb-4
          bg-gradient-to-br from-blue-500/20 to-purple-500/20
          border border-white/10
          flex items-center justify-center
        "
      >
        <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
          />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">Secure AI Terminal</h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-6">
        {isConnected
          ? 'Your encrypted tunnel is ready. Send a message to start a conversation with your private AI.'
          : 'Waiting for secure tunnel connection...'}
      </p>

      {isConnected && (
        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion(s)}
              className="
                px-3 py-1.5 rounded-full text-xs
                bg-white/5 border border-white/10
                text-gray-400 hover:text-white hover:border-purple-500/30 hover:bg-purple-500/10
                transition-all duration-200
              "
            >
              {s}
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

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
  isStreaming: boolean;
}

function ChatInput({ onSend, disabled, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`; // max ~5 lines
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue('');
    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend = value.trim().length > 0 && !disabled && !isStreaming;

  return (
    <div className="flex-shrink-0 border-t border-white/5 bg-[#0D0D12]/80 backdrop-blur-lg p-4">
      <div
        className="
          flex items-end gap-3
          bg-white/[0.04] border border-white/10
          rounded-2xl px-4 py-3
          focus-within:border-purple-500/40 focus-within:ring-1 focus-within:ring-purple-500/20
          transition-all duration-200
        "
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Waiting for connection...'
              : isStreaming
              ? 'AI is responding...'
              : 'Type a message... (Enter to send, Shift+Enter for newline)'
          }
          disabled={disabled}
          rows={1}
          className="
            flex-1 bg-transparent text-sm text-white
            placeholder-gray-600 resize-none
            outline-none
            max-h-[150px]
            disabled:opacity-50
          "
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`
            flex-shrink-0 p-2 rounded-xl transition-all duration-200
            ${canSend
              ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/25 hover:scale-105 active:scale-95'
              : 'bg-white/5 text-gray-600 cursor-not-allowed'
            }
          `}
          title="Send message"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
            />
          </svg>
        </button>
      </div>

      {/* Hint */}
      <p className="text-[10px] text-gray-700 mt-2 text-center">
        Messages are encrypted through the AeroNyx privacy tunnel
      </p>
    </div>
  );
}

// ============================================
// Main ChatTerminal Component
// ============================================

export default function ChatTerminal({ nodeId }: ChatTerminalProps) {
  const {
    messages,
    connectionState,
    nodeName,
    sendMessage,
    disconnect,
    reconnect,
    clearMessages,
    isStreaming,
  } = useWebSocketChat(nodeId);

  // ---- Auto-scroll ----
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Only auto-scroll if user is near the bottom
    const threshold = 100;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Track scroll position for "scroll to bottom" button
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 200;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setShowScrollButton(!isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ---- Handlers ----
  const handleBack = useCallback(() => {
    window.location.href = `/dashboard/nodes/${nodeId}`;
  }, [nodeId]);

  const handleSuggestion = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  const isConnected = connectionState === 'connected';
  const inputDisabled = !isConnected;
  const hasMessages = messages.filter((m) => m.role !== 'system').length > 0;

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F]">
      {/* Status Bar */}
      <StatusBar
        connectionState={connectionState}
        nodeName={nodeName}
        onReconnect={reconnect}
        onDisconnect={disconnect}
        onClear={clearMessages}
        onBack={handleBack}
      />

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 relative"
      >
        {!hasMessages ? (
          <EmptyState isConnected={isConnected} onSuggestion={handleSuggestion} />
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="
              sticky bottom-4 left-1/2 -translate-x-1/2
              w-8 h-8 rounded-full
              bg-white/10 border border-white/20
              flex items-center justify-center
              text-gray-400 hover:text-white hover:bg-white/20
              transition-all duration-200
              shadow-lg
            "
            title="Scroll to bottom"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
      </div>

      {/* Input Area */}
      <ChatInput
        onSend={sendMessage}
        disabled={inputDisabled}
        isStreaming={isStreaming}
      />
    </div>
  );
}
