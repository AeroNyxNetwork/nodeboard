/**
 * ============================================================================
 * AeroNyx Web Meeting lobby client
 * ============================================================================
 * [MEETING-WEB-LOBBY 2026-10-02 by Codex]
 * Google-Meet-shaped instant create + link join, without weakening AeroNyx's
 * fragment-key privacy boundary or introducing an account requirement.
 * ============================================================================
 */

'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Logo from '@/components/common/Logo';
import {
  MEETING_CODE_PATTERN,
  claimMeetingCode,
  createGuestIdentity,
  createMeetingKey,
  decodeMeetingKey,
  encodeMeetingKey,
} from '@/lib/meetingGuest';

const copy = {
  en: {
    eyebrow: 'AeroNyx Meet',
    title: 'Private meetings, ready when you are',
    body: 'Start an encrypted video meeting in one click, or join with the complete link you received.',
    newMeeting: 'New meeting',
    creating: 'Creating meeting…',
    joinLabel: 'Meeting link',
    joinPlaceholder: 'Paste an AeroNyx meeting link',
    join: 'Join',
    or: 'or',
    invalid: 'Paste a complete AeroNyx meeting link, including the part after #.',
    failed: 'Could not create the meeting. Try again.',
    privacyTitle: 'The link is the key',
    privacyBody: 'The decryption key stays after # and never reaches our servers. Share the complete link only with people you want in the room.',
    featureVideo: 'Video and screen sharing',
    featureLobby: 'Waiting-room admission',
    featureE2ee: 'End-to-end encrypted media',
  },
  zh: {
    eyebrow: 'AeroNyx 會議',
    title: '準備好，就開始私密會議',
    body: '一鍵建立加密視訊會議，或貼上收到的完整連結加入。',
    newMeeting: '建立會議',
    creating: '正在建立會議…',
    joinLabel: '會議連結',
    joinPlaceholder: '貼上 AeroNyx 會議連結',
    join: '加入',
    or: '或',
    invalid: '請貼上完整的 AeroNyx 會議連結，包含 # 後面的部分。',
    failed: '無法建立會議，請再試一次。',
    privacyTitle: '連結就是鑰匙',
    privacyBody: '解密金鑰只留在 # 後面，絕不會傳到伺服器。請只把完整連結交給你想邀請的人。',
    featureVideo: '視訊與螢幕分享',
    featureLobby: '等候室放行',
    featureE2ee: '媒體端對端加密',
  },
};

type Language = keyof typeof copy;

function meetingLinkFromInput(raw: string): string | null {
  const input = raw.trim();
  if (!input || MEETING_CODE_PATTERN.test(input.toLowerCase())) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const marker = parts.lastIndexOf('m');
  const code = marker >= 0 ? (parts[marker + 1] ?? '').toLowerCase() : '';
  if (!MEETING_CODE_PATTERN.test(code)) return null;
  if (!decodeMeetingKey(url.hash)) return null;
  return `/i/m/${code}${url.hash}`;
}

export default function MeetHome() {
  const [language, setLanguage] = useState<Language>('en');
  const [input, setInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const next: Language = navigator.language.toLowerCase().startsWith('zh')
      ? 'zh'
      : 'en';
    setLanguage(next);
    const previous = document.documentElement.lang;
    document.documentElement.lang = next === 'zh' ? 'zh-Hant' : 'en';
    return () => {
      document.documentElement.lang = previous;
    };
  }, []);

  const text = copy[language];

  const createMeeting = async () => {
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const identity = createGuestIdentity();
      const code = await claimMeetingCode(identity);
      const key = encodeMeetingKey(createMeetingKey());
      // Session-only and meeting-scoped. The seed never enters the URL.
      window.sessionStorage.setItem(
        `aeronyx.meeting.host.${code}`,
        identity.seedHex,
      );
      window.location.assign(`/i/m/${code}#k=${key}`);
    } catch {
      setCreating(false);
      setError(text.failed);
    }
  };

  const joinMeeting = (event: FormEvent) => {
    event.preventDefault();
    const target = meetingLinkFromInput(input);
    if (!target) {
      setError(text.invalid);
      return;
    }
    setError('');
    window.location.assign(target);
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      <header className="flex items-center justify-between border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <span className="text-sm font-semibold text-white/80">{text.eyebrow}</span>
        </div>
        <a
          href="/chat"
          className="rounded-lg px-3 py-2 text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white/85 focus:outline-none focus:ring-2 focus:ring-[#9B8CFF]/60"
        >
          Chat
        </a>
      </header>

      <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9B8CFF]">
            {text.eyebrow}
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
            {text.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
            {text.body}
          </p>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {[text.featureVideo, text.featureLobby, text.featureE2ee].map((item) => (
              <div key={item} className="border-l border-white/15 pl-3 text-sm leading-5 text-white/55">
                <span className="mb-2 block h-1.5 w-1.5 rounded-full bg-[#9B8CFF]" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#14141D]/95 p-5 shadow-2xl shadow-black/30 sm:p-7">
          <button
            type="button"
            onClick={() => void createMeeting()}
            disabled={creating}
            aria-busy={creating}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#7762F3] px-5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(119,98,243,0.2)] transition-[background-color,box-shadow,transform] hover:bg-[#8877FF] hover:shadow-[0_12px_32px_rgba(119,98,243,0.28)] active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[#9B8CFF] focus:ring-offset-2 focus:ring-offset-[#14141D] disabled:cursor-wait disabled:opacity-65 disabled:shadow-none"
          >
            {/* [MEETING-ACTION-ICON 2026-10-02 by Codex] The generated chat
                bubble asset looked like a purple speck on this purple button
                and described the wrong action. Keep primary controls crisp,
                semantic and resolution-independent. */}
            {creating ? <ButtonSpinner /> : <MeetingCreateIcon />}
            {creating ? text.creating : text.newMeeting}
          </button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-white/25">
            <span className="h-px flex-1 bg-white/10" />
            {text.or}
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={joinMeeting}>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-white/55">{text.joinLabel}</span>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={text.joinPlaceholder}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-12 w-full rounded-xl border border-white/15 bg-black/25 px-4 text-base text-white placeholder:text-white/25 focus:border-[#9B8CFF]/70 focus:outline-none focus:ring-2 focus:ring-[#9B8CFF]/25"
              />
            </label>
            <button
              type="submit"
              disabled={!input.trim()}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-white/15 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/35 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {text.join}
            </button>
          </form>

          {error ? <p role="alert" className="mt-4 text-sm leading-5 text-[#FF9AA9]">{error}</p> : null}

          <div className="mt-6 flex gap-3 border-t border-white/10 pt-5">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center text-[#9B8CFF]" aria-hidden="true">
              <MeetingPrivacyIcon />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white/80">{text.privacyTitle}</h2>
              <p className="mt-1 text-xs leading-5 text-white/40">{text.privacyBody}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// [MEETING-ACTION-ICON 2026-10-02 by Codex] Small state-aware SVG controls
// share one visual weight and inherit contrast from their button/context.
function MeetingCreateIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="3" y="6" width="13" height="12" rx="3" />
      <path d="m16 10 5-3v10l-5-3" />
      <path d="M7 12h5M9.5 9.5v5" />
    </svg>
  );
}

function MeetingPrivacyIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="10" width="14" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v3" />
    </svg>
  );
}

function ButtonSpinner() {
  return (
    <span
      className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/35 border-t-white"
      aria-hidden="true"
    />
  );
}
