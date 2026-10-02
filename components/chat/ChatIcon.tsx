/**
 * ============================================================================
 * AeroNyx Chat icon system
 * ============================================================================
 *
 * [CHAT-ICON-SYSTEM 2026-10-02 by Codex]
 * Product actions use the same rendered amethyst-object language as meetings.
 * Tiny state glyphs stay as currentColor SVG so they remain sharp, themeable,
 * and legible to high-contrast modes at 10–18 px.
 * ============================================================================
 */

import type { CSSProperties } from 'react';

export type ChatObjectName =
  | 'attachment'
  | 'bell'
  | 'empty'
  | 'group'
  | 'lock'
  | 'new'
  | 'reaction'
  | 'receipts';

export function ChatObjectIcon({
  name,
  size = 22,
  className,
}: {
  name: ChatObjectName;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={`/chat/chat_${name}.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      draggable={false}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
}

export type ChatGlyphName =
  | 'alert'
  | 'audio'
  | 'back'
  | 'check'
  | 'check-double'
  | 'chevron-down'
  | 'clock'
  | 'close'
  | 'copy'
  | 'edit'
  | 'file'
  | 'logout'
  | 'pause'
  | 'play'
  | 'retry'
  | 'video';

export function ChatGlyph({
  name,
  size = 16,
  style,
}: {
  name: ChatGlyphName;
  size?: number;
  style?: CSSProperties;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { display: 'block', ...style },
    'aria-hidden': true,
  };

  switch (name) {
    case 'alert':
      return <svg {...p}><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5" /><path d="M12 17.5h.01" /></svg>;
    case 'audio':
      return <svg {...p}><path d="M12 3v10.5a3.5 3.5 0 1 1-2-3.16" /><path d="m12 5 7-1v7.5a3.5 3.5 0 1 1-2-3.16" /></svg>;
    case 'back':
      return <svg {...p}><path d="m15 18-6-6 6-6" /></svg>;
    case 'check-double':
      return <svg {...p}><path d="m2 12 4 4 7-8" /><path d="m10 15 2 2 8-9" /></svg>;
    case 'check':
      return <svg {...p}><path d="m5 12 4 4 10-10" /></svg>;
    case 'chevron-down':
      return <svg {...p}><path d="m6 9 6 6 6-6" /></svg>;
    case 'clock':
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'close':
      return <svg {...p}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'copy':
      return <svg {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
    case 'edit':
      return <svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>;
    case 'file':
      return <svg {...p}><path d="M6 2h8l4 4v16H6Z" /><path d="M14 2v5h5" /><path d="M9 13h6M9 17h5" /></svg>;
    case 'logout':
      return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>;
    case 'pause':
      return <svg {...p} fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>;
    case 'play':
      return <svg {...p} fill="currentColor" stroke="none"><path d="m7 4 13 8-13 8Z" /></svg>;
    case 'retry':
      return <svg {...p}><path d="M20 6v6h-6" /><path d="M20 12a8 8 0 1 0-2.34 5.66" /></svg>;
    case 'video':
      return <svg {...p}><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 10 5-3v10l-5-3Z" /></svg>;
  }
}
