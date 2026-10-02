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
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LOCALE_STORAGE_KEY, type Locale } from '@/lib/i18n';
import Logo from '@/components/common/Logo';

export default function RootPage() {
  const { locale: appLocale, setLocale: setAppLocale } = useI18n();
  const [locale, setLocale] = useState<RootLocale>('en');
  const t = copyByLocale[locale];

  // [APP-HOME-I18N 2026-10-02 by Codex] Match the public website's seven
  // languages without advertising Spanish across Nodeboard before that much
  // larger operator dictionary is translated. Existing six-language choices
  // still sync into the shared provider; Spanish remains honest, homepage-only
  // copy. Browser language is used only when neither surface has a preference.
  useEffect(() => {
    let next: RootLocale;
    try {
      const homePreference = window.localStorage.getItem(HOME_LOCALE_KEY);
      const appPreference = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      next = normalizeRootLocale(
        isRootLocale(homePreference)
          ? homePreference
          : appPreference || window.navigator.language,
      );
    } catch {
      next = normalizeRootLocale(window.navigator.language);
    }
    setLocale(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = appLocale;
    };
  }, [appLocale, locale]);

  const changeLocale = (next: RootLocale) => {
    setLocale(next);
    try {
      window.localStorage.setItem(HOME_LOCALE_KEY, next);
    } catch {
      /* A blocked preference store must never block the language switch. */
    }
    if (next !== 'es') setAppLocale(next satisfies Locale);
  };

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

      <label className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <span className="sr-only">{t.languageLabel}</span>
        <select
          value={locale}
          onChange={(event) => changeLocale(event.target.value as RootLocale)}
          aria-label={t.languageLabel}
          className="h-10 rounded-lg border border-white/15 bg-[#11111A]/90 px-3 text-xs font-semibold text-white/75 outline-none backdrop-blur transition hover:border-white/30 hover:text-white focus:border-[#9B8CFF]/60 focus:ring-2 focus:ring-[#7762F3]/30"
        >
          {ROOT_LANGUAGES.map((language) => (
            <option
              key={language.code}
              value={language.code}
              className="bg-[#11111A] text-white"
            >
              {language.label}
            </option>
          ))}
        </select>
      </label>

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center">
        <Logo className="h-14 w-14" color="#A855F7" />
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">AeroNyx</h1>
        <p className="mt-2 max-w-md text-center text-sm text-white/50">{t.tagline}</p>

        {/* [MEETING-WEB-LOBBY 2026-10-02 by Codex] Meetings are now a first-
            class web destination, not a deep link somebody has to receive. */}
        <div className="mt-10 grid w-full gap-4 md:grid-cols-3">
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

          <Link
            href="/meet"
            className="group flex flex-col rounded-2xl border p-6 transition"
            style={{ borderColor: 'rgba(116,98,247,0.38)', background: 'rgba(116,98,247,0.07)' }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(116,98,247,0.18)' }}>
              <img src="/meeting/cap_video.png" alt="" aria-hidden="true" width={28} height={28} />
            </div>
            <div className="mt-4 flex items-center gap-2 text-lg font-semibold text-white">
              {t.meetTitle}
              <span className="opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100">→</span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{t.meetSub}</p>
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

const ROOT_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
] as const;

type RootLocale = (typeof ROOT_LANGUAGES)[number]['code'];

type RootCopy = {
  languageLabel: string;
  tagline: string;
  chatTitle: string;
  chatSub: string;
  meetTitle: string;
  meetSub: string;
  opTitle: string;
  opSub: string;
  footer: string;
};

const HOME_LOCALE_KEY = 'aeronyx.app.home.locale';

const copyByLocale: Record<RootLocale, RootCopy> = {
  en: {
    languageLabel: 'Language',
    tagline: 'A privacy-first encrypted network — chat, nodes, and wallet in one place.',
    chatTitle: 'Open Chat',
    chatSub: 'Scan with the AeroNyx app to chat end-to-end encrypted on this browser.',
    meetTitle: 'Start a Meeting',
    meetSub: 'Create or join an end-to-end encrypted video meeting without an install.',
    opTitle: 'Node Dashboard',
    opSub: 'Operate your nodes and view traffic & earnings (browser-wallet login).',
    footer: 'End-to-end encrypted · nodes are blind to chat content',
  },
  ru: {
    languageLabel: 'Язык',
    tagline: 'Зашифрованная сеть с приоритетом приватности — чаты, узлы и кошелёк в одном месте.',
    chatTitle: 'Открыть чат',
    chatSub: 'Отсканируйте код в приложении AeroNyx для сквозного шифрования чата в браузере.',
    meetTitle: 'Начать встречу',
    meetSub: 'Создавайте и подключайтесь к видеовстречам со сквозным шифрованием без установки.',
    opTitle: 'Панель узла',
    opSub: 'Управляйте узлами и смотрите трафик и доходы, войдя через браузерный кошелёк.',
    footer: 'Сквозное шифрование · узлы не видят содержимое чатов',
  },
  'zh-TW': {
    languageLabel: '語言',
    tagline: '隱私優先的加密網絡——聊天、節點、錢包，一處入口。',
    chatTitle: '打開聊天',
    chatSub: '用 AeroNyx App 掃碼，在這個瀏覽器上進行端到端加密聊天。',
    meetTitle: '開始會議',
    meetSub: '無需安裝，即可建立或加入端到端加密視訊會議。',
    opTitle: '節點控制台',
    opSub: '管理你的節點，查看流量與收益（瀏覽器錢包登入）。',
    footer: '端到端加密 · 節點無法讀取聊天內容',
  },
  'zh-CN': {
    languageLabel: '语言',
    tagline: '隐私优先的加密网络——聊天、节点、钱包，一个入口。',
    chatTitle: '打开聊天',
    chatSub: '使用 AeroNyx App 扫码，在此浏览器中进行端到端加密聊天。',
    meetTitle: '开始会议',
    meetSub: '无需安装，即可创建或加入端到端加密视频会议。',
    opTitle: '节点控制台',
    opSub: '管理节点并查看流量与收益（浏览器钱包登录）。',
    footer: '端到端加密 · 节点无法读取聊天内容',
  },
  ja: {
    languageLabel: '言語',
    tagline: 'プライバシーを第一にした暗号化ネットワーク — チャット、ノード、ウォレットを一か所に。',
    chatTitle: 'チャットを開く',
    chatSub: 'AeroNyxアプリでスキャンし、このブラウザでエンドツーエンド暗号化チャットを利用できます。',
    meetTitle: '会議を開始',
    meetSub: 'インストール不要で、エンドツーエンド暗号化ビデオ会議を作成・参加できます。',
    opTitle: 'ノードダッシュボード',
    opSub: 'ブラウザウォレットでログインし、ノード、通信量、収益を管理します。',
    footer: 'エンドツーエンド暗号化 · ノードはチャット内容を読み取れません',
  },
  ko: {
    languageLabel: '언어',
    tagline: '개인정보 보호를 우선하는 암호화 네트워크 — 채팅, 노드, 지갑을 한곳에서.',
    chatTitle: '채팅 열기',
    chatSub: 'AeroNyx 앱으로 스캔하여 이 브라우저에서 종단간 암호화 채팅을 사용하세요.',
    meetTitle: '회의 시작',
    meetSub: '설치 없이 종단간 암호화 화상 회의를 만들거나 참여하세요.',
    opTitle: '노드 대시보드',
    opSub: '브라우저 지갑으로 로그인하여 노드, 트래픽, 수익을 관리하세요.',
    footer: '종단간 암호화 · 노드는 채팅 내용을 읽을 수 없습니다',
  },
  es: {
    languageLabel: 'Idioma',
    tagline: 'Una red cifrada que prioriza la privacidad: chat, nodos y cartera en un solo lugar.',
    chatTitle: 'Abrir chat',
    chatSub: 'Escanea con la app de AeroNyx para chatear con cifrado de extremo a extremo en este navegador.',
    meetTitle: 'Iniciar reunión',
    meetSub: 'Crea o únete a una videollamada cifrada de extremo a extremo sin instalar nada.',
    opTitle: 'Panel de nodos',
    opSub: 'Gestiona tus nodos y consulta el tráfico y los ingresos con una cartera del navegador.',
    footer: 'Cifrado de extremo a extremo · los nodos no pueden leer los chats',
  },
};

function isRootLocale(value: string | null): value is RootLocale {
  return ROOT_LANGUAGES.some((language) => language.code === value);
}

function normalizeRootLocale(value: string | null | undefined): RootLocale {
  const normalized = (value || '').trim().toLowerCase().replace('_', '-');
  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') || normalized.startsWith('zh-hant')) {
    return 'zh-TW';
  }
  if (normalized.startsWith('zh')) return 'zh-CN';
  if (normalized.startsWith('ru')) return 'ru';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('es')) return 'es';
  return 'en';
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
