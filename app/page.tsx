/**
 * ============================================
 * AeroNyx Root Page — audience fork (chat vs node dashboard)
 * ============================================
 * File Path: app/page.tsx
 *
 * Modification Reason (2026-07-05):
 *   The root used to `redirect('/dashboard')` unconditionally, which framed
 *   app.aeronyx.network as a node-operator console ONLY and left the web chat
 *   (/chat, /weblogin) completely unreachable from the front door. AeroNyx is a
 *   consumer product (encrypted chat) as much as a node network, so the root now
 *   forks the two audiences with two clear entries instead of hiding one.
 *
 * Main Functionality: a light, static chooser — "Open Chat" (→ /chat, which
 *   auto-forwards to /weblogin when there's no imported identity yet) and
 *   "Node Dashboard" (→ /dashboard, wallet login). No auth checks, no redirect,
 *   so there is NO redirect-loop risk (the reason the old landing page was
 *   removed). No heavy animation (the other reason).
 *
 * Dependencies: next/link, lib/i18n (locale), components/common/Logo.
 *
 * ⚠️ Important Note for Next Developer:
 *   - Do NOT add auth gating here — it belongs in app/dashboard/layout.tsx.
 *   - "Open Chat" points at /chat on purpose: a returning user with a live
 *     session lands straight in chat; a first-timer is forwarded to /weblogin
 *     by the chat page's own boot check.
 *
 * Last Modified: v2.0.0 — replaced the blind dashboard redirect with a fork.
 * ============================================
 */
'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import Logo from '@/components/common/Logo';

export default function RootPage() {
  const { locale } = useI18n();
  const zh = (locale || '').toLowerCase().startsWith('zh');
  const t = useMemo(() => makeStrings(zh), [zh]);

  return (
    <main
      className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-12"
      style={{ background: '#0A0A0F' }}
    >
      {/* Soft brand glow — static, no animation. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 28%, rgba(138,43,226,0.16), transparent 62%)' }}
      />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center">
        <Logo className="h-14 w-14" color="#A855F7" />
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">AeroNyx</h1>
        <p className="mt-2 max-w-md text-center text-sm text-white/50">{t.tagline}</p>

        <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
          {/* Chat — the previously-hidden door, featured. */}
          <Link
            href="/chat"
            className="group flex flex-col rounded-2xl border p-6 transition"
            style={{ borderColor: 'rgba(138,43,226,0.4)', background: 'rgba(138,43,226,0.08)' }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: 'rgba(138,43,226,0.2)' }}
            >
              <ChatIcon />
            </div>
            <div className="mt-4 flex items-center gap-2 text-lg font-semibold text-white">
              {t.chatTitle}
              <span className="translate-x-0 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100">→</span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{t.chatSub}</p>
          </Link>

          {/* Node dashboard — the existing operator console. */}
          <Link
            href="/dashboard"
            className="group flex flex-col rounded-2xl border border-white/10 p-6 transition hover:border-white/25"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <NodeIcon />
            </div>
            <div className="mt-4 flex items-center gap-2 text-lg font-semibold text-white">
              {t.opTitle}
              <span className="opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100">→</span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{t.opSub}</p>
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-white/30">{t.footer}</p>
      </div>
    </main>
  );
}

function makeStrings(zh: boolean) {
  return zh
    ? {
        tagline: '隱私優先的加密網絡 —— 聊天、節點、錢包，一處入口。',
        chatTitle: '打開聊天',
        chatSub: '用 AeroNyx App 掃碼，在這個瀏覽器上端到端加密聊天。',
        opTitle: '節點控制台',
        opSub: '管理你的節點，查看流量與收益（瀏覽器錢包登錄）。',
        footer: '端到端加密 · 節點對聊天內容零知識',
      }
    : {
        tagline: 'A privacy-first encrypted network — chat, nodes, and wallet in one place.',
        chatTitle: 'Open Chat',
        chatSub: 'Scan with the AeroNyx app to chat end-to-end encrypted on this browser.',
        opTitle: 'Node Dashboard',
        opSub: 'Operate your nodes and view traffic & earnings (browser-wallet login).',
        footer: 'End-to-end encrypted · nodes are blind to chat content',
      };
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function NodeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}
