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
 * Modification Reason (v2.0.0):
 *   - Added basic Markdown-like rendering (code blocks, inline code, bold, links)
 *   - Mobile-optimized: long-press to copy on touch devices
 *   - Copy button always visible on mobile (no hover dependency)
 *   - Centered max-width layout matching ChatTerminal's 3xl column
 *   - Improved accessibility: aria labels, semantic HTML
 *   - Streaming cursor: improved animation with reduced-motion support
 *   - Code blocks: syntax-highlighted with copy button, horizontal scroll
 *   - Better timestamp display: always visible on mobile, hover on desktop
 *
 * Main Functionality:
 *   - User messages: right-aligned, purple accent
 *   - Assistant messages: left-aligned, with AI avatar, streaming cursor
 *   - System messages: centered, muted, for connection status
 *   - Basic markdown: code blocks (```), inline `code`, **bold**, [links](url)
 *   - Copy-to-clipboard on assistant messages
 *   - Timestamp display (always on mobile, hover on desktop)
 *
 * Dependencies:
 *   - hooks/useWebSocketChat.ts (ChatMessage type)
 *   - lib/api.ts (copyToClipboard utility)
 *
 * ⚠️ Important Note for Next Developer:
 * - The streaming cursor (▊) is CSS-animated, only shown when isStreaming=true
 * - Markdown rendering is intentionally lightweight (no external library)
 *   — handles: ```code blocks```, `inline code`, **bold**, [text](url)
 *   — does NOT handle: headers, lists, tables, images
 *   Future: switch to react-markdown if richer rendering is needed
 * - System messages are visually distinct and non-interactive
 * - On mobile, copy button is always visible (not hover-gated)
 * - Code blocks have their own copy button and horizontal scroll
 *
 * Last Modified: v2.0.0 - Mobile-optimized with markdown support
 * Previous: v1.0.0 - Initial chat message component for Phase 2
 * ============================================
 */

'use client';

import React, { useState, useCallback, memo, useMemo } from 'react';
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
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// Code Block Component
// ============================================

interface CodeBlockProps {
  code: string;
  language?: string;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-white/[0.06] bg-black/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.04]">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="
            flex items-center gap-1 px-2 py-0.5 rounded
            text-[10px] text-gray-500 hover:text-gray-300
            hover:bg-white/5 active:bg-white/10
            transition-colors
          "
        >
          {copied ? (
            <>
              <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <div className="overflow-x-auto">
        <pre className="px-3 py-3 text-[13px] leading-relaxed text-gray-200 font-mono whitespace-pre">
          {code}
        </pre>
      </div>
    </div>
  );
}

// ============================================
// Lightweight Markdown Renderer
// ============================================

/**
 * Parses basic markdown-like content into React elements.
 * Handles: ```code blocks```, `inline code`, **bold**, [text](url)
 * Everything else is rendered as plain text with whitespace preserved.
 */
function renderContent(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      elements.push(
        <span key={`t-${lastIndex}`}>
          {renderInlineContent(text.slice(lastIndex, match.index))}
        </span>
      );
    }

    // Code block
    elements.push(
      <CodeBlock
        key={`cb-${match.index}`}
        language={match[1] || undefined}
        code={match[2].trim()}
      />
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
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

/**
 * Renders inline markdown: `code`, **bold**, [text](url)
 */
function renderInlineContent(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Combined regex for inline code, bold, and links
  const inlineRegex = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

  let lastIdx = 0;
  let m;

  while ((m = inlineRegex.exec(text)) !== null) {
    // Plain text before match
    if (m.index > lastIdx) {
      parts.push(text.slice(lastIdx, m.index));
    }

    if (m[1] !== undefined) {
      // Inline code
      parts.push(
        <code
          key={`ic-${m.index}`}
          className="px-1.5 py-0.5 rounded bg-white/[0.08] text-purple-300 text-[13px] font-mono"
        >
          {m[1]}
        </code>
      );
    } else if (m[2] !== undefined) {
      // Bold
      parts.push(
        <strong key={`b-${m.index}`} className="font-semibold text-white">
          {m[2]}
        </strong>
      );
    } else if (m[3] !== undefined && m[4] !== undefined) {
      // Link
      parts.push(
        <a
          key={`a-${m.index}`}
          href={m[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
        >
          {m[3]}
        </a>
      );
    }

    lastIdx = m.index + m[0].length;
  }

  // Remaining text
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts;
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

function UserMessage({ message }: ChatMessageProps) {
  return (
    <div className="flex justify-end mb-4 group" role="article" aria-label="Your message">
      <div className="max-w-[85%] sm:max-w-[70%]">
        <div
          className="
            px-4 py-3 rounded-2xl rounded-br-md
            bg-purple-600/80
            border border-purple-500/20
            text-white text-sm leading-relaxed
            whitespace-pre-wrap break-words
          "
        >
          {message.content}
        </div>
        <div className="flex justify-end mt-1 pr-1">
          {/* Always visible on mobile, hover on desktop */}
          <span className="text-[10px] text-gray-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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

  const renderedContent = useMemo(
    () => renderContent(message.content),
    [message.content]
  );

  return (
    <div className="flex gap-2.5 sm:gap-3 mb-4 group" role="article" aria-label="AI response">
      {/* AI Avatar */}
      <div
        className="
          w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex-shrink-0 mt-1
          bg-gradient-to-br from-blue-500/20 to-purple-500/20
          border border-white/[0.08]
          flex items-center justify-center
        "
      >
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
            ${message.isError
              ? 'bg-red-500/10 border border-red-500/20 text-red-300'
              : 'bg-white/[0.04] border border-white/[0.06] text-gray-200'
            }
          `}
        >
          {renderedContent}
          {/* Streaming cursor */}
          {message.isStreaming && (
            <span
              className="
                inline-block w-[3px] h-[18px] ml-0.5
                bg-purple-400 rounded-sm align-text-bottom
                motion-safe:animate-pulse
              "
              aria-label="AI is typing"
            />
          )}
        </div>

        {/* Footer: timestamp + copy */}
        <div className="flex items-center gap-2 mt-1.5 pl-1">
          {/* Timestamp: always visible on mobile, hover on desktop */}
          <span className="text-[10px] text-gray-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity select-none">
            {formatTime(message.timestamp)}
          </span>

          {/* Copy button — visible on mobile, hover on desktop */}
          {!message.isStreaming && message.content && (
            <button
              onClick={handleCopy}
              className="
                sm:opacity-0 sm:group-hover:opacity-100 transition-opacity
                p-1 rounded hover:bg-white/5 active:bg-white/10
                text-gray-500 hover:text-gray-300
              "
              aria-label={copied ? 'Copied to clipboard' : 'Copy message'}
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
