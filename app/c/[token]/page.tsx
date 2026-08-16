'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ed25519 } from '@noble/curves/ed25519';
import { RelayClient } from '@/lib/relayClient';
import {
  bytesToHex,
  decryptEnvelopeFrame,
  encryptText,
  hexToBytes,
  selfEchoFrame,
  type OutgoingFrame,
} from '@/lib/msgCrypto';

type ResolveState = 'loading' | 'ready' | 'expired' | 'missing' | 'error';
type DeliveryState = 'sending' | 'sent' | 'failed';
type GuestLocale = 'en' | 'zh';

interface Recipient {
  pubkey: string;
  displayName: string;
}

interface GuestMessage {
  id: string;
  text: string;
  mine: boolean;
  status: DeliveryState;
  ts: number;
}

interface AnonymousChatCopy {
  defaultTitle: string;
  fallbackUser: string;
  connected: string;
  emptyTitle: string;
  emptyBody: string;
  notSent: string;
  retry: string;
  reconnect: string;
  placeholder: string;
  sendLabel: string;
  statusText: Record<ResolveState, string>;
  statusTitle: Record<Exclude<ResolveState, 'ready'>, string>;
  statusDescription: Record<Exclude<ResolveState, 'ready'>, string>;
  titleWithRecipient(name: string): string;
}

const API_BASE = 'https://api.aeronyx.network/api/relay';
// [ANON-WEB-CHAT 2026-08-16 by Codex] The public guest page is commonly opened
// inside WeChat/mobile browsers, so keep first-run copy localized without
// requiring the visitor to install the native app.
const COPY: Record<GuestLocale, AnonymousChatCopy> = {
  en: {
    defaultTitle: 'AeroNyx anonymous chat',
    fallbackUser: 'AeroNyx user',
    connected: 'Encrypted relay connected',
    emptyTitle: 'Send a private message',
    emptyBody:
      'You can chat without installing AeroNyx. Your browser uses a temporary identity for this link.',
    notSent: 'Not sent',
    retry: 'Retry',
    reconnect: 'Reconnect',
    placeholder: 'Message',
    sendLabel: 'Send',
    statusText: {
      loading: 'Checking link...',
      ready: 'Connecting...',
      expired: 'Link expired',
      missing: 'Link not found',
      error: 'Unable to load link',
    },
    statusTitle: {
      loading: 'Opening secure chat',
      expired: 'This chat link expired',
      missing: 'This chat link does not exist',
      error: 'Could not open this chat',
    },
    statusDescription: {
      loading: 'Preparing an encrypted guest session.',
      expired: 'Ask the AeroNyx user to create a new anonymous chat link.',
      missing: 'Check whether the link was copied completely.',
      error: 'Please refresh the page or try again later.',
    },
    titleWithRecipient: (name) => `Chat with ${name}`,
  },
  zh: {
    defaultTitle: 'AeroNyx 匿名聊天',
    fallbackUser: 'AeroNyx 用户',
    connected: '加密中继已连接',
    emptyTitle: '发送一条私密消息',
    emptyBody:
      '无需安装 AeroNyx 也可以聊天。浏览器会为这个链接创建一个临时身份。',
    notSent: '发送失败',
    retry: '重试',
    reconnect: '重新连接',
    placeholder: '输入消息',
    sendLabel: '发送',
    statusText: {
      loading: '正在检查链接…',
      ready: '正在连接…',
      expired: '链接已过期',
      missing: '链接不存在',
      error: '无法加载链接',
    },
    statusTitle: {
      loading: '正在打开安全聊天',
      expired: '这个聊天链接已过期',
      missing: '这个聊天链接不存在',
      error: '无法打开这个聊天',
    },
    statusDescription: {
      loading: '正在准备加密访客会话。',
      expired: '请让 AeroNyx 用户重新创建一个匿名聊天链接。',
      missing: '请检查链接是否复制完整。',
      error: '请刷新页面或稍后再试。',
    },
    titleWithRecipient: (name) => `和 ${name} 聊天`,
  },
};

export default function AnonymousChatPage({
  params,
}: {
  params: any;
}) {
  const [token, setToken] = useState('');
  const [state, setState] = useState<ResolveState>('loading');
  const [locale, setLocale] = useState<GuestLocale>('en');
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const clientRef = useRef<RelayClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const seedRef = useRef<Uint8Array | null>(null);
  const pubRef = useRef<Uint8Array | null>(null);
  const copy = COPY[locale];

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(params as Promise<{ token: string }> | { token: string })
      .then((value) => {
        if (!cancelled) setToken(String(value?.token || ''));
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const title = useMemo(() => {
    if (!recipient) return copy.defaultTitle;
    return copy.titleWithRecipient(recipient.displayName || copy.fallbackUser);
  }, [copy, recipient]);

  useEffect(() => {
    setLocale(detectGuestLocale());
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setState('loading');
      try {
        const res = await fetch(
          `${API_BASE}/anonymous_chat/links/${encodeURIComponent(token)}/`,
          { cache: 'no-store' },
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          setState('missing');
          return;
        }
        if (res.status === 410 || data?.error === 'expired') {
          setState('expired');
          return;
        }
        const pubkey = String(data?.recipient?.pubkey || '').toLowerCase();
        if (!res.ok || !/^[0-9a-f]{64}$/.test(pubkey)) {
          setState('error');
          return;
        }
        setRecipient({
          pubkey,
          displayName: String(data?.recipient?.display_name || 'AeroNyx user'),
        });
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (state !== 'ready' || !recipient) return;
    const seed = loadOrCreateGuestSeed(token);
    const pub = ed25519.getPublicKey(seed);
    seedRef.current = seed;
    pubRef.current = pub;
    const client = new RelayClient(bytesToHex(seed));
    clientRef.current = client;
    client.on('connected', () => {
      setConnected(true);
      client.send({ type: 'relay_pull', since_ts: 0 });
    });
    client.on('closed', () => setConnected(false));
    client.on('envelope', (frame) => {
      const opened = decryptEnvelopeFrame(seed, frame as never);
      if (!opened || opened.peerHex !== recipient.pubkey) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === opened.msgId)) return prev;
        return [
          ...prev,
          {
            id: opened.msgId,
            text: opened.text,
            mine: opened.mine,
            status: 'sent' as DeliveryState,
            ts: opened.timestamp,
          },
        ].slice(-200);
      });
    });
    client.connect();
    return () => {
      client.close();
      clientRef.current = null;
      setConnected(false);
    };
  }, [connectionAttempt, recipient, state, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const sendText = useCallback((rawText: string, retryId?: string) => {
    const text = rawText.trim();
    const seed = seedRef.current;
    const pub = pubRef.current;
    const client = clientRef.current;
    if (!text || !seed || !pub || !recipient || !client) return;
    let frame: OutgoingFrame;
    try {
      frame = encryptText(seed, pub, recipient.pubkey, text);
    } catch {
      return;
    }
    const firstMessage = !messages.some((message) => !message.mine);
    const ok = client.send({
      ...frame,
      // [ANON-WEB-CHAT 2026-08-16 by Codex] The first guest message is a
      // contact request so friend-verification users still receive the knock.
      ...(firstMessage ? { contact_request: true } : {}),
    });
    if (ok) client.send(selfEchoFrame(seed, pub, frame));
    setMessages((prev) => {
      const nextMessage = {
        id: frame.msg_id,
        text,
        mine: true,
        status: (ok ? 'sent' : 'failed') as DeliveryState,
        ts: frame.timestamp,
      };
      if (!retryId) return [...prev, nextMessage];
      return prev.map((message) =>
        message.id === retryId ? nextMessage : message,
      );
    });
  }, [messages, recipient]);

  const send = useCallback(() => {
    sendText(draft);
    setDraft('');
  }, [draft, sendText]);

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-[#08080d] px-3 py-4 text-white sm:px-4 sm:py-6">
      <section className="flex h-[calc(100svh-24px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#10101a] shadow-2xl shadow-purple-950/30 sm:h-[min(760px,calc(100svh-32px))] sm:rounded-[28px]">
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/15">
              <AeroNyxMark />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[17px] font-semibold">{title}</h1>
              <p className="mt-0.5 text-xs text-white/45">
                {connected ? copy.connected : statusText(state, copy)}
              </p>
            </div>
            {state === 'ready' && !connected ? (
              <button
                type="button"
                onClick={() => setConnectionAttempt((value) => value + 1)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10"
              >
                {copy.reconnect}
              </button>
            ) : null}
            <span
              className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-white/25'}`}
            />
          </div>
        </header>

        {state === 'ready' ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-5">
              {messages.length === 0 ? (
                <div className="mx-auto mt-16 max-w-[280px] text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                    <LockIcon />
                  </div>
                  <p className="mt-4 text-sm font-medium text-white/85">
                    {copy.emptyTitle}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    {copy.emptyBody}
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-5 ${
                        m.mine
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/[0.07] text-white/90'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      {m.mine && m.status === 'failed' ? (
                        <button
                          type="button"
                          onClick={() => sendText(m.text, m.id)}
                          className="mt-1 text-[11px] font-semibold text-red-100/90 underline decoration-red-100/40 underline-offset-2"
                        >
                          {copy.notSent} · {copy.retry}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form
              className="border-t border-white/10 p-3 pb-[calc(12px+env(safe-area-inset-bottom))]"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  enterKeyHint="send"
                  placeholder={copy.placeholder}
                  className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-6 text-white outline-none placeholder:text-white/30"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || !connected}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500 text-white transition disabled:bg-white/10 disabled:text-white/35"
                  aria-label={copy.sendLabel}
                >
                  <SendIcon />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-8 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] text-white/70">
                {state === 'loading' ? <Spinner /> : <AlertIcon />}
              </div>
              <p className="mt-4 text-base font-semibold">{statusTitle(state, copy)}</p>
              <p className="mt-2 text-sm leading-6 text-white/45">{statusDescription(state, copy)}</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function detectGuestLocale(): GuestLocale {
  if (typeof navigator === 'undefined') return 'en';
  const languages = [navigator.language, ...(navigator.languages || [])]
    .filter(Boolean)
    .map((value) => value.toLowerCase());
  return languages.some((value) => value.startsWith('zh')) ? 'zh' : 'en';
}

function loadOrCreateGuestSeed(token: string): Uint8Array {
  const key = `aeronyx:anonymous-chat:${token}:seed`;
  try {
    const existing = localStorage.getItem(key);
    if (existing && /^[0-9a-f]{64}$/.test(existing)) return hexToBytes(existing);
  } catch {
    /* storage may be unavailable */
  }
  const seed = crypto.getRandomValues(new Uint8Array(32));
  try {
    localStorage.setItem(key, bytesToHex(seed));
  } catch {
    /* ephemeral tab-only identity still works */
  }
  return seed;
}

function statusText(state: ResolveState, copy: AnonymousChatCopy) {
  return copy.statusText[state];
}

function statusTitle(state: ResolveState, copy: AnonymousChatCopy) {
  if (state === 'ready') return copy.statusTitle.loading;
  return copy.statusTitle[state];
}

function statusDescription(state: ResolveState, copy: AnonymousChatCopy) {
  if (state === 'ready') return copy.statusDescription.loading;
  return copy.statusDescription[state];
}

function AeroNyxMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 16.6 10.4 10V3.8L4 10.4v6.2Z" fill="#8B5CF6" />
      <path d="M13.6 20.2 20 13.6V7.4L13.6 14v6.2Z" fill="#A78BFA" />
      <path d="M13.6 12.5 20 5.9V3.8l-6.4 6.6v2.1Z" fill="#6D5DF6" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function Spinner() {
  return <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />;
}
