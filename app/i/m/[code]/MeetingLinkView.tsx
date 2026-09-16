/**
 * ============================================================================
 * AeroNyx meeting link fallback client view
 * ============================================================================
 *
 * [MEETING-WEB-FALLBACK 2026-09-17 by Claude]
 *
 * ⚠️ THE KEY IS IN THE FRAGMENT, AND IT MUST STAY IN THE BROWSER.
 *
 * A meeting link is `/i/m/<code>#k=<32 bytes, base64url>`. The code addresses
 * the room; the key decrypts it end-to-end. Browsers never send the part after
 * '#' to a server, which is the entire reason a meeting can be joined by
 * someone our backend has never heard of without our backend being able to
 * hear them.
 *
 * That property survives only if this file keeps it. So here the key:
 *   - is read from window.location.hash and nowhere else
 *   - goes into the aeronyx:// handoff and nowhere else
 *   - never enters a query string, a fetch, a log, or an analytics call
 *
 * Styling follows ChannelShareView rather than inventing a second language for
 * the same kind of page: same container, same card, same two buttons, same
 * accent. These two routes are the only pages a stranger ever sees.
 * ============================================================================
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Logo from '@/components/common/Logo';

const APP_STORE_URL = 'https://apps.apple.com/app/id6736854944';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.amaterasu.aeronyx';
const PRODUCT_URL = 'https://aeronyx.network';

const copy = {
  en: {
    kicker: 'Meeting',
    title: 'Join this meeting',
    body: 'Video, screen sharing and a waiting room — end-to-end encrypted.',
    open: 'Open in AeroNyx',
    download: 'Get AeroNyx',
    noKeyTitle: 'This link is missing its key',
    noKeyBody:
      'The part after the # was dropped on the way here — some apps and link previews do that. Ask whoever sent it to send the whole link again.',
    trust:
      'The key that decrypts this meeting travels inside the link and never reaches our servers. Anyone holding the whole link can join.',
  },
  zh: {
    kicker: '會議',
    title: '加入這場會議',
    body: '視訊、分享螢幕、等候室——端對端加密。',
    open: '在 AeroNyx 中打開',
    download: '取得 AeroNyx',
    noKeyTitle: '這條連結少了鑰匙',
    noKeyBody:
      '# 後面那一段在路上被丟掉了——有些 App 和連結預覽會這樣。請對方把完整連結重新發一次。',
    trust:
      '解密這場會議的鑰匙在連結裡，從不會到我們的伺服器。拿到完整連結的人都能進來。',
  },
};

type Props = { code: string };

export default function MeetingLinkView({ code }: Props) {
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  // undefined until the browser has been read; '' means the fragment was
  // absent, which is a real and common case rather than an error.
  const [keyFragment, setKeyFragment] = useState<string | undefined>(undefined);

  useEffect(() => {
    const locale = navigator.language.toLowerCase();
    setLanguage(locale.startsWith('zh') ? 'zh' : 'en');

    // The one place the key is read. location.hash is browser-only state; it
    // does not round-trip to the server, and must never be made to.
    const hash = window.location.hash.replace(/^#/, '');
    const found = hash
      .split('&')
      .map((pair) => pair.split('='))
      .find(([name]) => name === 'k');
    setKeyFragment(found && found[1] ? found[1] : '');
  }, []);

  const text = copy[language];
  const resolved = keyFragment !== undefined;
  const hasKey = resolved && keyFragment !== '';

  // The handoff carries the fragment through untouched. Dropping it would hand
  // the app a room it cannot decrypt: it would join and hear silence.
  const appLink = hasKey
    ? `aeronyx://i/m/${code}#k=${keyFragment}`
    : `aeronyx://i/m/${code}`;

  const downloadUrl = useMemo(() => {
    if (typeof navigator === 'undefined') return PRODUCT_URL;
    if (/android/i.test(navigator.userAgent)) return PLAY_STORE_URL;
    if (/iphone|ipad|ipod|macintosh/i.test(navigator.userAgent)) {
      return APP_STORE_URL;
    }
    return PRODUCT_URL;
  }, []);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center justify-between border-b border-white/10 pb-5">
        <Logo className="h-8 w-8" />
        <span className="text-xs font-semibold uppercase text-white/45">
          {text.kicker}
        </span>
      </header>

      <section className="flex flex-1 flex-col justify-center py-10">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#14141D]">
          <div className="p-5 sm:p-6">
            <h1 className="break-words text-xl font-semibold leading-7 text-white">
              {!resolved || hasKey ? text.title : text.noKeyTitle}
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {!resolved || hasKey ? text.body : text.noKeyBody}
            </p>
          </div>

          <div className="border-t border-white/10 px-5 py-5 text-center sm:px-6">
            <span className="font-mono text-lg tracking-[0.18em] text-[#9B8CFF]">
              {code}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {hasKey ? (
            <a
              href={appLink}
              className="flex h-12 items-center justify-center rounded-lg bg-[#7762F3] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#8877FF] focus:outline-none focus:ring-2 focus:ring-[#9B8CFF] focus:ring-offset-2 focus:ring-offset-[#0A0A0F]"
            >
              {text.open}
            </a>
          ) : null}
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            // Spans the row when it is the only button there. Without this a
            // key-less link left one half-width button sitting alone against
            // the left edge — visible only by rendering it.
            className={`flex h-12 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-semibold text-white/85 transition-colors hover:border-white/30 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#0A0A0F]${
              hasKey ? '' : ' sm:col-span-2'
            }`}
          >
            {text.download}
          </a>
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-white/40">
          {text.trust}
        </p>
      </section>
    </main>
  );
}
