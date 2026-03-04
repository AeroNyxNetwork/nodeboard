/**
 * ============================================
 * AeroNyx Privacy Network - Chat Message Component
 * ============================================
 * File Path: components/dashboard/ChatMessage.tsx
 *
 * Creation Reason: Phase 2 — AI Encrypted Terminal message bubble.
 *   Renders user, assistant, and system messages with appropriate styling.
 *   Supports streaming indicator (blinking cursor) and error states.
 *
 * Main Functionality:
 *   - User messages: right-aligned, purple accent
 *   - Assistant messages: left-aligned, with AI avatar, supports streaming cursor
 *   - System messages: centered, muted, used for connection status
 *   - Copy-to-clipboard on assistant messages
 *   - Timestamp display
 *
 * Dependencies:
 *   - hooks/useWebSocketChat.ts (ChatMessage type)
 *   - lib/api.ts (copyToClipboard utility)
 *
 * ⚠️ Important Note for Next Developer:
 * - The streaming cursor (▊) is CSS-animated and only shown when isStreaming=true
 * - Message content is rendered as plain text (no markdown parsing yet)
 *   Future: add markdown support via react-markdown or similar
 * - System messages are visually distinct and non-interactive
 *
 * Last Modified: v1.0.0 - Initial chat message component for Phase 2
 * ============================================
 */

'use client';

import React, { useState, useCallback, memo } from 'react';
import type { ChatMessage as ChatMessageType } from '@/hooks/useWebSocketChat';
import { copyToClipboard } from '@/lib/api';

// ============================================
// Props
// ============================================

interface ChatMessageProps {
  message: ChatMessageType;
}

// ============================================
// Timestamp Formatter
// ============================================

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// System Message
// ============================================

function SystemMessage({ message }: ChatMessageProps) {
  return (
    <div className="flex justify-center my-3">
      <div
        className={`
          inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs
          ${message.isError
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : 'bg-white/5 border border-white/10 text-gray-500'
          }
        `}
      >
        {message.isError ? (
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <span>{message.content}</span>
      </div>
    </div>
  );
}

// ============================================
// User Message
// ============================================

function UserMessage({ message }: ChatMessageProps) {
  return (
    <div className="flex justify-end mb-4 group">
      <div className="max-w-[80%] sm:max-w-[70%]">
        <div
          className="
            px-4 py-3 rounded-2xl rounded-br-md
            bg-gradient-to-br from-purple-600/80 to-purple-700/80
            border border-purple-500/30
            text-white text-sm leading-relaxed
            whitespace-pre-wrap break-words
          "
        >
          {message.content}
        </div>
        <div className="flex justify-end mt-1 pr-1">
          <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Assistant Message
// ============================================

function AssistantMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(message.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [message.content]);

  return (
    <div className="flex gap-3 mb-4 group">
      {/* AI Avatar */}
      <div
        className="
          w-8 h-8 rounded-lg flex-shrink-0 mt-1
          bg-gradient-to-br from-blue-500/20 to-purple-500/20
          border border-white/10
          flex items-center justify-center
        "
      >
        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>

      {/* Content */}
      <div className="max-w-[80%] sm:max-w-[75%] min-w-0">
        <div
          className={`
            px-4 py-3 rounded-2xl rounded-bl-md
            bg-white/[0.06] border
            text-sm leading-relaxed
            whitespace-pre-wrap break-words
            ${message.isError
              ? 'border-red-500/30 text-red-300'
              : 'border-white/10 text-gray-200'
            }
          `}
        >
          {message.content}
          {/* Streaming cursor */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-purple-400 animate-pulse rounded-sm align-text-bottom" />
          )}
        </div>

        {/* Footer: timestamp + copy */}
        <div className="flex items-center gap-2 mt-1 pl-1">
          <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(message.timestamp)}
          </span>

          {/* Copy button — only when not streaming and has content */}
          {!message.isStreaming && message.content && (
            <button
              onClick={handleCopy}
              className="
                opacity-0 group-hover:opacity-100 transition-opacity
                p-1 rounded hover:bg-white/5 text-gray-500 hover:text-gray-300
              "
              title={copied ? 'Copied!' : 'Copy message'}
            >
              {copied ? (
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main ChatMessage (delegates by role)
// ============================================

function ChatMessageComponent({ message }: ChatMessageProps) {
  switch (message.role) {
    case 'system':
      return <SystemMessage message={message} />;
    case 'user':
      return <UserMessage message={message} />;
    case 'assistant':
      return <AssistantMessage message={message} />;
    default:
      return null;
  }
}

export default memo(ChatMessageComponent);
