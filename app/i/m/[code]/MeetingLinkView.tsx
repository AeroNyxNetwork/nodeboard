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

import { Component, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Logo from '@/components/common/Logo';
import dynamic from 'next/dynamic';
import { decodeMeetingKey, sanitizeMeetingName } from '@/lib/meetingGuest';

// [MEETING-WEB-GUEST 2026-09-17 by Claude] Loaded only when someone actually
// joins here. livekit-client is ~140 kB, and most people opening this link
// either have the app or are about to install it — making all of them download
// a WebRTC stack to read one sentence and tap "Open in AeroNyx" is a cost paid
// by the majority for the minority. ssr:false because it touches Worker and
// getUserMedia, neither of which exists on a server.
const MeetingRoom = dynamic(() => import('./MeetingRoom'), { ssr: false });

/**
 * [ROOM-BOUNDARY 2026-09-18 by Claude] The room is a lazily-loaded chunk, and
 * nothing in this app catches a failure to load one.
 *
 * Checked: there is no error.tsx, no global-error.tsx and no boundary of any
 * kind anywhere under app/. So a chunk that does not arrive throws through
 * React and takes the whole page white -- on the one route a stranger ever
 * sees, from a phone, on whatever network they happen to be on. It is not
 * hypothetical either: a deploy replaces the chunk files, and any tab that
 * was already open asks for a filename that no longer exists.
 *
 * A boundary here rather than a route file because the risk is this one
 * import, not the route: the landing card, the key handling and the app
 * handoff all still work when the room does not, and they are what the person
 * needs in order to get in another way.
 */
class RoomBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

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
    inRoomTitle: "You're in this meeting",
    unavailableTitle: 'This meeting is not available',
    yourName: 'Your name',
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    copyFailed: "Couldn't copy",
    copyFailedHint: 'Your browser refused the clipboard. Copy the link from '
      + 'the address bar instead.',
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
    share: 'Share screen',
    stopSharing: 'Stop sharing',
    sharingLabel: 'is sharing their screen',
    // [MEETING-CAMERA-COPY 2026-09-18 by Claude] Verbs, like every other
    // control in this bar. 'Camera off' is shown while the camera is ON, so
    // it had to be read as an instruction -- but it parses as a status, and
    // as a status it says the opposite of the truth. The failure case is
    // someone checking whether they are on camera: the button read
    // 'Camera on' at exactly the moment they were not. The Chinese beside it
    // was already right (關閉鏡頭/開啟鏡頭 are verbs). Same character count
    // as what it replaces, so the two-column grid is unaffected.
    camera: 'Stop video',
    cameraOff: 'Start video',
    you: 'you',
    alone: 'Waiting for someone else to join.',
    failed: 'Could not reach the meeting. Ask again, or open it in the app.',
    notFound: 'This meeting has ended, or the link has expired.',
    reconnecting: 'Reconnecting…',
    admitted: "You're in the meeting.",
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
    roomBroke:
      'The meeting could not be loaded. Reload the page, or open it in the AeroNyx app.',
    reload: 'Reload',
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
    inRoomTitle: '你在這場會議中',
    unavailableTitle: '這場會議無法加入',
    yourName: '你的名字',
    copyLink: '複製連結',
    linkCopied: '已複製',
    copyFailed: '複製不了',
    copyFailedHint: '瀏覽器拒絕了剪貼簿。請從網址列複製連結。',
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
    share: '分享螢幕',
    stopSharing: '停止分享',
    sharingLabel: '正在分享螢幕',
    camera: '關閉鏡頭',
    cameraOff: '開啟鏡頭',
    you: '你',
    alone: '等其他人進來。',
    failed: '連不上這場會議。再請求一次，或改用 App 開啟。',
    notFound: '這場會議已結束，或連結已過期。',
    reconnecting: '重新連線中…',
    admitted: '你已進入會議。',
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
    roomBroke: '載入不了這場會議。請重新整理頁面，或改用 AeroNyx App 開啟。',
    reload: '重新整理',
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
  // Mounted is not the same as joined: the knock happens inside the room
  // component, and during it the person is still outside.
  const [joined, setJoined] = useState(false);
  // The meeting turned out not to exist. The card stops inviting people into
  // it rather than listing its features underneath the news that it is gone.
  const [unavailable, setUnavailable] = useState(false);

  // [MEETING-ANNOUNCE 2026-09-18 by Claude] One live region for the whole
  // page, rendered unconditionally so it is in the DOM before anything it
  // needs to say happens. That is the part the room could not do for itself:
  // its status lines are each rendered conditionally, and a role="status"
  // element that gets INSERTED does not announce -- the region has to already
  // exist for the text change to be observed. The room reports what to say;
  // this holds the place that says it.
  const [roomStatus, setRoomStatus] = useState('');
  // [COPY-STATE 2026-09-17 by Claude] Three states, not two. The first
  // version set this back to false when writeText threw, which is the same
  // thing it shows before you press it -- so a refused clipboard looked
  // exactly like a button that does nothing, which is what it was. Caught by
  // pressing it in a browser that refuses: the label never changed.
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>(
    'idle',
  );
  // [GUEST-NAME 2026-09-17 by Claude] Asked before joining, the way Google
  // asks an anonymous guest. Two guests were both going to be called "Guest",
  // which is only marginally better than the pubkey prefix it replaced.
  // Remembered per browser so a returning guest does not retype it; this is a
  // convenience, never state anything depends on, so a refused localStorage
  // just means the default.
  const [guestName, setGuestName] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('aeronyx.meeting.name');
      if (saved) setGuestName(saved);
    } catch {
      /* private window, blocked storage: the default is fine */
    }
  }, []);

  const copyLink = async () => {
    try {
      // The whole href, fragment included. A copy without the key is a code
      // for a room the other person would join and hear nothing in.
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('done');
    } catch {
      // Refused by the browser, or no clipboard at all. Say so: the address
      // bar still holds the link, and knowing to go there is the fix.
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 2400);
  };

  // [MEETING-JOIN-ENTER 2026-09-18 by Claude] Lifted out of the button's
  // onClick so the form can submit it, which is what makes Enter work. The
  // body is unchanged: remember the name if there is one, and never let
  // failing to remember it stand between someone and the meeting.
  const joinHere = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = sanitizeMeetingName(guestName);
    try {
      if (trimmed) {
        window.localStorage.setItem('aeronyx.meeting.name', trimmed);
      }
    } catch {
      /* not remembering it is not a reason to refuse to join */
    }
    setInRoom(true);
  };

  // [MEETING-HTML-LANG 2026-09-18 by Claude] Switching the copy is only half
  // of switching the language; the document has to say so too.
  //
  // This route carries its own two-language `copy` object instead of going
  // through I18nProvider, which already does `documentElement.lang = locale`
  // for the rest of the site -- so the one page a stranger ever sees was the
  // one that swapped every string to Chinese under <html lang="en">.
  //
  // What that costs, in order of how quietly it costs it:
  //   * Han unification means the same code point has different glyph forms
  //     for zh-Hant, zh-Hans and ja, and `lang` is what picks between them.
  //     Inter carries no CJK at all (checked: the stack resolves to
  //     Inter -> system-ui for Latin and falls through per glyph for Chinese),
  //     so every Chinese character here comes from a fallback face chosen
  //     with no language to go on.
  //   * A screen reader reads Chinese with an English voice.
  //   * Line breaking rules for CJK are language-informed.
  //
  // zh-Hant specifically, not zh: this copy is Traditional, and plain `zh`
  // is read as Simplified by enough systems to matter. Restored on unmount so
  // the value does not follow a client-side navigation to another route.
  useEffect(() => {
    const locale = navigator.language.toLowerCase();
    const next = locale.startsWith('zh') ? 'zh' : 'en';
    setLanguage(next);
    const previous = document.documentElement.lang;
    document.documentElement.lang = next === 'zh' ? 'zh-Hant' : 'en';
    return () => {
      document.documentElement.lang = previous;
    };
  }, []);

  // [MEETING-KEY-STALE 2026-09-18 by Claude] The key is read here and nowhere
  // else. location.hash is browser-only state; it does not round-trip to the
  // server, and must never be made to.
  //
  // It is read on every hashchange, not only on mount. Changing just the
  // fragment does not remount this component, so a mount-only read left the
  // page operating on the OLD key while the address bar showed the new one.
  // Reproduced on a dev server: navigating to #k=AAEC… left the app handoff
  // link still carrying the previous key. That link is exactly the thing this
  // file warns about two comments down -- hand the app the wrong key and it
  // joins the room and hears silence -- and nothing about the page looks
  // wrong while it happens.
  //
  // Hit by pasting a corrected or rotated link into a tab that is already
  // open, and by going back and forward between two links to the same
  // meeting. Both are same-document navigations, so neither reloads.
  useEffect(() => {
    const readKey = () => {
      const hash = window.location.hash.replace(/^#/, '');
      const found = hash
        .split('&')
        .map((pair) => pair.split('='))
        .find(([name]) => name === 'k');
      setKeyFragment(found && found[1] ? found[1] : '');
    };
    readKey();
    window.addEventListener('hashchange', readKey);
    return () => window.removeEventListener('hashchange', readKey);
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
    // [MEETING-ROOM-WIDTH 2026-09-17 by Claude] The landing card and the
    // meeting shared one width, and the card's width won. On a 1280px screen
    // that left the room 576px wide with a 470x264 video tile -- a postage
    // stamp, on the one platform where joining from a browser is the normal
    // thing to do. A short message wants a narrow measure; a video call wants
    // the screen. They are not the same page any more once you are in.
    <main
      className={`mx-auto flex min-h-[100dvh] w-full flex-col px-5 sm:px-8 ${
        inRoom ? 'max-w-5xl py-4 sm:py-6' : 'max-w-xl py-8 sm:py-12'
      }`}
    >
      <p role="status" aria-live="polite" className="sr-only">
        {roomStatus}
      </p>

      <header className="flex items-center justify-between border-b border-white/10 pb-5">
        <Logo className="h-8 w-8" />
        <span className="text-xs font-semibold uppercase text-white/45">
          {text.kicker}
        </span>
      </header>

      {/* [ROOM-FOLD 2026-09-17 by Claude] Centred with generous padding is
          right for a short card and wrong for a working surface. Measured on
          1280x860 with the room open: the Leave button's bottom edge sat at
          889px -- 29 past the fold, so the control you need to get out of a
          meeting was the one you had to scroll for. The room starts at the
          top and spends less on padding; the landing card keeps both. */}
      <section
        className={`flex flex-1 flex-col ${
          inRoom ? 'justify-start py-4' : 'justify-center py-10'
        }`}
      >
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#14141D]">
          {/* [MEETING-HEADER-STATE 2026-09-17 by Claude] Once you are in, this
              card stopped being an invitation. It used to keep saying "Join
              this meeting" and listing the features to somebody already
              using them, which is the page talking past the person in front
              of it. In the room it says where you are, and the pitch goes. */}
          <div className="p-5 sm:p-6">
            <h1 className="break-words text-xl font-semibold leading-7 text-white">
              {joined
                ? text.inRoomTitle
                : unavailable
                  ? text.unavailableTitle
                  : !resolved || hasKey
                    ? text.title
                    : text.noKeyTitle}
            </h1>
            {joined || unavailable ? null : (
              <p className="mt-1 text-sm text-white/50">
                {!resolved || hasKey ? text.body : text.noKeyBody}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-3 border-t border-white/10 px-5 py-5 sm:px-6">
            <span className="font-mono text-lg tracking-[0.18em] text-[#9B8CFF]">
              {code}
            </span>
            {/* The one thing a person in a meeting actually wants from this
                row: the link that gets somebody else in. The whole link,
                fragment included -- a copy without the key is a code for a
                room the other person cannot hear. */}
            {joined && hasKey ? (
              <button
                type="button"
                onClick={copyLink}
                title={copyState === 'failed' ? text.copyFailedHint : undefined}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 ${
                  copyState === 'failed'
                    ? 'border-[#D9455F]/45 bg-[#D9455F]/10 text-[#F08898] focus:ring-[#D9455F]/60'
                    : 'border-white/15 text-white/70 hover:border-white/30 hover:bg-white/5 focus:ring-white/40'
                }`}
              >
                {copyState === 'done'
                  ? text.linkCopied
                  : copyState === 'failed'
                    ? text.copyFailed
                    : text.copyLink}
              </button>
            ) : null}
          </div>
        </div>

        {inRoom && roomKey ? (
          <RoomBoundary
            fallback={
              // The same card the room would have filled, so the page does not
              // change shape around the failure. Reload rather than "try
              // again": if the chunk is gone because a deploy replaced it,
              // retrying the same import asks for the same missing file.
              <div className="mt-5 rounded-lg border border-white/10 bg-[#14141D] p-5 sm:p-6">
                <p className="text-sm leading-6 text-white/70" role="alert">
                  {text.roomBroke}
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-[#7762F3] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#8877FF] focus:outline-none focus:ring-2 focus:ring-[#9B8CFF] focus:ring-offset-2 focus:ring-offset-[#0A0A0F]"
                >
                  {text.reload}
                </button>
              </div>
            }
          >
          <MeetingRoom
            code={code}
            e2eeKey={roomKey}
            displayName={sanitizeMeetingName(guestName) || text.guest}
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
              share: text.share,
              stopSharing: text.stopSharing,
              sharingLabel: text.sharingLabel,
              camera: text.camera,
              cameraOff: text.cameraOff,
              you: text.you,
              alone: text.alone,
              failed: text.failed,
              notFound: text.notFound,
              reconnecting: text.reconnecting,
              admitted: text.admitted,
              noE2EE: text.noE2EE,
            }}
            onStateChange={(st) => {
              setJoined(st.joined);
              setUnavailable(st.unavailable);
              setRoomStatus(st.status);
            }}
            onLeave={() => {
              setJoined(false);
              setUnavailable(false);
              setRoomStatus('');
              setInRoom(false);
            }}
          />
          </RoomBoundary>
        ) : null}

        {/* [MEETING-JOIN-ENTER 2026-09-18 by Claude] A form, so Enter joins.
            These were two siblings: a bare input in a label, and a
            type="button" with an onClick. Typing your name and pressing Enter
            did nothing at all -- and on a phone, which is where a browser
            guest actually is, the keyboard's own action key was dead too,
            because there was no form for it to submit.

            Nothing moves: the form has no padding or border of its own, and
            the card that holds it does (p-5 sm:p-6), so the label's mt-5
            collapses through exactly as it did when the two were siblings. */}
        {!inRoom && roomKey ? (
          <form onSubmit={joinHere}>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-xs font-medium text-white/45">
                {text.yourName}
              </span>
              <input
                type="text"
                value={guestName}
                maxLength={32}
                placeholder={text.guest}
                enterKeyHint="go"
                onChange={(e) => setGuestName(e.target.value)}
                className="h-11 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-[#9B8CFF]/50"
              />
            </label>
            <button
              type="submit"
              className="mt-5 flex h-12 w-full items-center justify-center rounded-lg bg-[#7762F3] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#8877FF] focus:outline-none focus:ring-2 focus:ring-[#9B8CFF] focus:ring-offset-2 focus:ring-offset-[#0A0A0F]"
            >
              {text.joinHere}
            </button>
          </form>
        ) : null}

        {/* [HANDOFF-PLACEMENT 2026-09-17 by Claude] Not while you are in the
            meeting. A full-width "Open in AeroNyx" directly under Leave is a
            mis-tap that yanks you out of a live call and hands you to an app
            you may not have installed, and a download button under a meeting
            you are already in is asking someone to install the thing they
            are at that moment using. In the room the handoff becomes a quiet
            link below the fold of the controls; before joining it stays the
            pair of buttons it was. */}
        {inRoom ? (
          hasKey ? (
            <a
              href={appLink}
              className="mt-4 self-center rounded px-2 py-1 text-xs text-white/45 underline-offset-4 transition-colors hover:text-white/70 hover:underline focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              {text.open}
            </a>
          ) : null
        ) : (
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
        )}

        {/* Keeps its measure when the room widens around it: one sentence
            stretched across 1024px is a worse read than the same sentence in
            two comfortable lines. */}
        <p className="mx-auto mt-5 max-w-xl text-center text-xs leading-5 text-white/40">
          {text.trust}
        </p>
      </section>
    </main>
  );
}
