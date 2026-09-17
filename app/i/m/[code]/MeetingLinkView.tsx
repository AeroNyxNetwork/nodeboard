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
import dynamic from 'next/dynamic';
import { decodeMeetingKey } from '@/lib/meetingGuest';

// [MEETING-WEB-GUEST 2026-09-17 by Claude] Loaded only when someone actually
// joins here. livekit-client is ~140 kB, and most people opening this link
// either have the app or are about to install it — making all of them download
// a WebRTC stack to read one sentence and tap "Open in AeroNyx" is a cost paid
// by the majority for the minority. ssr:false because it touches Worker and
// getUserMedia, neither of which exists on a server.
const MeetingRoom = dynamic(() => import('./MeetingRoom'), { ssr: false });

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
    // [MEETING-QUICK-ACCESS 2026-09-17 by Claude] Not "Ask to join": with
    // quick access on this walks straight in, and the page cannot know
    // which until the server answers. One honest word covers both.
    joinHere: 'Join',
    knocking: 'Waiting for the host to let you in…',
    cancelKnock: 'Stop waiting',
    rejected: 'The host did not let you in.',
    timedOut: 'Nobody answered. The host may not be in the meeting yet.',
    retry: 'Ask again',
    back: 'Back',
    joining: 'Connecting…',
    leave: 'Leave',
    mic: 'Mute',
    micOff: 'Unmute',
    noMic: 'No microphone',
    camera: 'Camera off',
    cameraOff: 'Camera on',
    you: 'you',
    alone: 'Waiting for someone else to join.',
    failed: 'Could not reach the meeting. Ask again, or open it in the app.',
    notFound: 'This meeting has ended, or the link has expired.',
    meetingEnded: 'The meeting ended.',
    removed: 'The host removed you from the meeting.',
    joinedElsewhere: 'You joined this meeting somewhere else.',
    disconnected: 'You were disconnected from the meeting.',
    verifyEmoji: 'Read these aloud to check you are in the same meeting',
    verifyEmojiLabel: 'Encryption check code',
    roomFull: 'This meeting is full.',
    clockOff:
      "Your device's clock is too far off to join. Set it to update automatically and try again.",
    noE2EE:
      'This browser cannot set up end-to-end encryption, so joining here would not be private. Open the meeting in the AeroNyx app instead.',
    guest: 'Guest',
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
    joinHere: '加入',
    knocking: '等主持人放你進來…',
    cancelKnock: '不等了',
    rejected: '主持人沒有讓你進來。',
    timedOut: '沒有人回應。主持人可能還沒進會議。',
    retry: '再請求一次',
    back: '返回',
    joining: '連線中…',
    leave: '離開',
    mic: '靜音',
    micOff: '取消靜音',
    noMic: '沒有麥克風',
    camera: '關閉鏡頭',
    cameraOff: '開啟鏡頭',
    you: '你',
    alone: '等其他人進來。',
    failed: '連不上這場會議。再請求一次，或改用 App 開啟。',
    notFound: '這場會議已結束，或連結已過期。',
    meetingEnded: '會議已結束。',
    removed: '主持人把你移出了會議。',
    joinedElsewhere: '你在別的地方加入了這場會議。',
    disconnected: '你與會議斷線了。',
    verifyEmoji: '唸出來對一下，確認大家在同一場會議',
    verifyEmojiLabel: '加密校驗碼',
    roomFull: '這場會議人數已滿。',
    clockOff: '你裝置的時間差太多，無法加入。把時間設成自動校正後再試一次。',
    noE2EE:
      '這個瀏覽器無法建立端對端加密，在這裡加入不會是私密的。請改用 AeroNyx App 開啟。',
    guest: '訪客',
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
  // [MEETING-WEB-GUEST 2026-09-17 by Claude] Joining here is opt-in, never
  // automatic: landing on a page must not switch a stranger's microphone on.
  const [inRoom, setInRoom] = useState(false);

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

  const roomKey = useMemo(
    () => (hasKey ? decodeMeetingKey(`k=${keyFragment}`) : null),
    [hasKey, keyFragment],
  );

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

        {inRoom && roomKey ? (
          <MeetingRoom
            code={code}
            e2eeKey={roomKey}
            displayName={text.guest}
            labels={{
              knocking: text.knocking,
              cancelKnock: text.cancelKnock,
              rejected: text.rejected,
              timedOut: text.timedOut,
              meetingEnded: text.meetingEnded,
              removed: text.removed,
              joinedElsewhere: text.joinedElsewhere,
              disconnected: text.disconnected,
              verifyEmoji: text.verifyEmoji,
              verifyEmojiLabel: text.verifyEmojiLabel,
              roomFull: text.roomFull,
              clockOff: text.clockOff,
              retry: text.retry,
              back: text.back,
              joining: text.joining,
              leave: text.leave,
              mic: text.mic,
              micOff: text.micOff,
              noMic: text.noMic,
              camera: text.camera,
              cameraOff: text.cameraOff,
              you: text.you,
              alone: text.alone,
              failed: text.failed,
              notFound: text.notFound,
              noE2EE: text.noE2EE,
            }}
            onLeave={() => setInRoom(false)}
          />
        ) : null}

        {!inRoom && roomKey ? (
          <button
            type="button"
            onClick={() => setInRoom(true)}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-lg bg-[#7762F3] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#8877FF] focus:outline-none focus:ring-2 focus:ring-[#9B8CFF] focus:ring-offset-2 focus:ring-offset-[#0A0A0F]"
          >
            {text.joinHere}
          </button>
        ) : null}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {hasKey ? (
            <a
              href={appLink}
              className="flex h-12 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-semibold text-white/85 transition-colors hover:border-white/30 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#0A0A0F]"
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
