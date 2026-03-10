/**
 * ============================================
 * AeroNyx Privacy Network - Chat Message Component
 * ============================================
 * File Path: components/dashboard/ChatMessage.tsx
 *
 * Modification Reason (v2.1.0):
 *   Fixed critical copy/select issues:
 *   - Removed all CSS that blocks text selection (user-select: none)
 *   - Message content is now fully selectable on all platforms
 *   - Long-press to copy works on mobile (no event.preventDefault on touch)
 *   - Code block copy button: uses fallback clipboard method for broader
 *     browser support (execCommand fallback)
 *   - Copy button for full message: always visible on mobile, hover on desktop
 *   - Code blocks: explicit user-select-all for easy selection
 *   - Ensured no parent container blocks text selection
 *
 * Main Functionality:
 *   - User messages: right-aligned, purple accent, selectable text
 *   - Assistant messages: left-aligned, AI avatar, streaming cursor, selectable
 *   - System messages: centered, muted
 *   - Basic markdown: ```code blocks```, `inline code`, **bold**, [links](url)
 *   - Code blocks: copy button, horizontal scroll, selectable text
 *   - Copy full message button (mobile: always visible, desktop: hover)
 *   - Timestamp display
 *
 * Dependencies:
 *   - hooks/useWebSocketChat.ts (ChatMessage type)
 *   - lib/api.ts (copyToClipboard utility)
 *
 * ⚠️ Important Note for Next Developer:
 * - NEVER add user-select: none to message content containers
 * - The copyText function has a robust fallback chain:
 *   1. navigator.clipboard.writeText (modern, requires HTTPS)
 *   2. document.execCommand('copy') with temporary textarea (legacy fallback)
 * - Code blocks use <pre> with overflow-x-auto for horizontal scroll
 * - All message text uses `select-text` Tailwind class to ensure selectability
 * - On mobile, no hover states are required for functionality — all actions visible
 *
 * Last Modified: v2.1.0 - Fixed copy/select issues across all platforms
 * Previous: v2.0.0 - Mobile-optimized with markdown support
 * ============================================
 */

'use client';

import React, { useState, useCallback, memo, useMemo } from 'react';
import type { ChatMessage as ChatMessageType } from '@/hooks/useWebSocketChat';

// ============================================
// Robust clipboard copy (works on all platforms)
// ============================================

async function copyText(text: string): Promise<boolean> {
  // Method 1: Modern Clipboard API
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy method
    }
  }

  // Method 2: Legacy execCommand fallback
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Position off-screen but keep it "visible" for execCommand to work
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

// ============================================
// Timestamp Formatter
// ============================================

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// Copy Button Component (reusable)
// ============================================

function CopyBtn({
  text,
  size = 'sm',
  className = '',
}: {
  text: string;
  size?: 'sm' | 'xs';
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <button
      onClick={handleCopy}
      className={`
        p-1 rounded hover:bg-white/10 active:bg-white/15
        transition-colors touch-manipulation
        ${className}
      `}
      aria-label={copied ? 'Copied!' : 'Copy'}
      type="button"
    >
      {copied ? (
        <svg className={`${iconSize} text-emerald-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className={`${iconSize} text-gray-500 hover:text-gray-300`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

// ============================================
// Code Block Component
// ============================================

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="my-2 rounded-xl overflow-hidden border border-white/[0.06] bg-black/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.04]">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">
          {language || 'code'}
        </span>
        <CopyBtn text={code} size="xs" className="opacity-70 hover:opacity-100" />
      </div>
      {/* Code content — fully selectable */}
      <div className="overflow-x-auto">
        <pre className="px-3 py-3 text-[13px] leading-relaxed text-gray-200 font-mono whitespace-pre select-text">
          {code}
        </pre>
      </div>
    </div>
  );
}

// ============================================
// Lightweight Markdown Renderer
// ============================================

function renderContent(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        <span key={`t-${lastIndex}`}>
          {renderInlineContent(text.slice(lastIndex, match.index))}
        </span>
      );
    }
    elements.push(
      <CodeBlock
        key={`cb-${match.index}`}
        language={match[1] || undefined}
        code={match[2].trim()}
      />
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(
      <span key={`t-${lastIndex}`}>
        {renderInlineContent(text.slice(lastIndex))}
      </span>
    );
  }

  if (elements.length === 0) {
    return [<span key="empty">{text}</span>];
  }

  return elements;
}

function renderInlineContent(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const inlineRegex = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

  let lastIdx = 0;
  let m;

  while ((m = inlineRegex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(text.slice(lastIdx, m.index));
    }

    if (m[1] !== undefined) {
      parts.push(
        <code key={`ic-${m.index}`} className="px-1.5 py-0.5 rounded bg-white/[0.08] text-purple-300 text-[13px] font-mono select-text">
          {m[1]}
        </code>
      );
    } else if (m[2] !== undefined) {
      parts.push(
        <strong key={`b-${m.index}`} className="font-semibold text-white">{m[2]}</strong>
      );
    } else if (m[3] !== undefined && m[4] !== undefined) {
      parts.push(
        <a key={`a-${m.index}`} href={m[4]} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline underline-offset-2">
          {m[3]}
        </a>
      );
    }

    lastIdx = m.index + m[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts;
}

// ============================================
// System Message
// ============================================

function SystemMessage({ message }: { message: ChatMessageType }) {
  return (
    <div className="flex justify-center my-3">
      <div
        className={`
          inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs select-text
          ${message.isError
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : 'bg-white/[0.03] border border-white/[0.06] text-gray-500'
          }
        `}
        role="status"
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

function UserMessage({ message }: { message: ChatMessageType }) {
  return (
    <div className="flex justify-end mb-4 group" role="article" aria-label="Your message">
      <div className="max-w-[85%] sm:max-w-[70%]">
        <div className="px-4 py-3 rounded-2xl rounded-br-md bg-purple-600/80 border border-purple-500/20 text-white text-sm leading-relaxed whitespace-pre-wrap break-words select-text">
          {message.content}
        </div>
        <div className="flex justify-end items-center gap-1 mt-1 pr-1">
          <span className="text-[10px] text-gray-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity select-none">
            {formatTime(message.timestamp)}
          </span>
          <CopyBtn
            text={message.content}
            size="xs"
            className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-gray-500"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Assistant Message
// ============================================

function AssistantMessage({ message }: { message: ChatMessageType }) {
  const renderedContent = useMemo(
    () => renderContent(message.content),
    [message.content]
  );

  return (
    <div className="flex gap-2.5 sm:gap-3 mb-4 group" role="article" aria-label="AI response">
      {/* AI Avatar */}
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex-shrink-0 mt-1 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/[0.08] flex items-center justify-center">
        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>

      {/* Content */}
      <div className="max-w-[85%] sm:max-w-[75%] min-w-0 flex-1">
        <div
          className={`
            px-4 py-3 rounded-2xl rounded-bl-md
            text-sm leading-relaxed
            whitespace-pre-wrap break-words
            select-text
            ${message.isError
              ? 'bg-red-500/10 border border-red-500/20 text-red-300'
              : 'bg-white/[0.04] border border-white/[0.06] text-gray-200'
            }
          `}
        >
          {renderedContent}
          {message.isStreaming && (
            <span
              className="inline-block w-[3px] h-[18px] ml-0.5 bg-purple-400 rounded-sm align-text-bottom motion-safe:animate-pulse"
              aria-label="AI is typing"
            />
          )}
        </div>

        {/* Footer: timestamp + copy */}
        <div className="flex items-center gap-1 mt-1.5 pl-1">
          <span className="text-[10px] text-gray-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity select-none">
            {formatTime(message.timestamp)}
          </span>

          {!message.isStreaming && message.content && (
            <CopyBtn
              text={message.content}
              size="xs"
              className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main ChatMessage
// ============================================

function ChatMessageComponent({ message }: { message: ChatMessageType }) {
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
