/**
 * ============================================================================
 * File: app/chat/page.tsx
 * ============================================================================
 * [WEB CHAT] Telegram-style 1:1 chat over the AeroNyx relay, as the imported
 * identity. All crypto is the verified msgCrypto module (auth + envelope both
 * proven cross-runtime against the app).
 *
 * Layout: conversation list (left) + message thread (right); on mobile one
 * pane at a time with a back button. Receive: relay envelope → decrypt →
 * append. Send: encrypt → relay_send + optimistic bubble.
 *
 * The identity seed lives in sessionStorage (session lifetime) — the deliberate
 * weaker web tier. Conversations are cached in sessionStorage too; nothing is
 * persisted beyond the tab.
 * ============================================================================
 */
'use client';

import {
  useCallback, useEffect, useMemo, useRef, useState, type CSSProperties,
} from 'react';
import { ed25519 } from '@noble/curves/ed25519';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { RelayClient } from '@/lib/relayClient';
import {
  encryptText, decryptEnvelopeFrame, bytesToHex, hexToBytes,
} from '@/lib/msgCrypto';

const SEED_KEY = 'aeronyx_web_seed';
const CONV_KEY = 'aeronyx_web_convs';

type Msg = { id: string; text: string; ts: number; mine: boolean };
type Conv = { peer: string; messages: Msg[]; lastTs: number };
type Status = 'connecting' | 'connected' | 'reconnecting';

export default function ChatPage() {
  const { locale } = useI18n();
  const zh = (locale || '').toLowerCase().startsWith('zh');

  const seedRef = useRef<Uint8Array | null>(null);
  const pubRef = useRef<Uint8Array | null>(null);
  const clientRef = useRef<RelayClient | null>(null);

  const [status, setStatus] = useState<Status>('connecting');
  const [convs, setConvs] = useState<Record<string, Conv>>({});
  const [active, setActive] = useState<string>(''); // peer hex
  const [draft, setDraft] = useState('');
  const [myPubHex, setMyPubHex] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Responsive: single pane on narrow viewports (inline styles can't media-query).
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 720);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ---- boot: load identity + conversations, connect ------------------------
  useEffect(() => {
    const seedHex = typeof window !== 'undefined' ? sessionStorage.getItem(SEED_KEY) : null;
    if (!seedHex) {
      window.location.href = '/weblogin';
      return;
    }
    let seed: Uint8Array;
    try {
      seed = hexToBytes(seedHex);
      pubRef.current = ed25519.getPublicKey(seed);
    } catch {
      window.location.href = '/weblogin';
      return;
    }
    seedRef.current = seed;
    setMyPubHex(bytesToHex(pubRef.current));

    try {
      const raw = sessionStorage.getItem(CONV_KEY);
      if (raw) setConvs(JSON.parse(raw));
    } catch { /* ignore */ }

    const client = new RelayClient(seedHex);
    clientRef.current = client;
    client.on('connected', () => setStatus('connected'));
    client.on('closed', () => setStatus((s) => (s === 'connected' ? 'reconnecting' : s)));
    client.on('envelope', (frame) => {
      const s = seedRef.current;
      if (!s) return;
      const m = decryptEnvelopeFrame(s, frame as never);
      if (!m) return;
      appendMessage(m.senderHex, { id: m.msgId, text: m.text, ts: m.timestamp, mine: false });
    });
    client.connect();
    return () => client.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist conversations
  useEffect(() => {
    try { sessionStorage.setItem(CONV_KEY, JSON.stringify(convs)); } catch { /* quota */ }
  }, [convs]);

  const appendMessage = useCallback((peer: string, msg: Msg) => {
    setConvs((prev) => {
      const c = prev[peer] || { peer, messages: [], lastTs: 0 };
      if (c.messages.some((m) => m.id === msg.id)) return prev; // dedupe
      const messages = [...c.messages, msg].sort((a, b) => a.ts - b.ts);
      return { ...prev, [peer]: { ...c, messages, lastTs: Math.max(c.lastTs, msg.ts) } };
    });
  }, []);

  // auto-scroll to bottom when the active thread grows
  const activeConv = active ? convs[active] : undefined;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeConv?.messages.length, active]);

  const send = useCallback(() => {
    const text = draft.trim();
    const seed = seedRef.current;
    const pub = pubRef.current;
    if (!text || !active || !seed || !pub) return;
    try {
      const frame = encryptText(seed, pub, active, text);
      clientRef.current?.send(frame);
      appendMessage(active, { id: frame.msg_id, text, ts: frame.timestamp, mine: true });
      setDraft('');
    } catch { /* ignore */ }
  }, [draft, active, appendMessage]);

  const startNewChat = useCallback(() => {
    const input = window.prompt(zh ? '輸入對方的公鑰 (64 位十六進制)' : "Enter the peer's public key (64 hex)");
    const peer = (input || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(peer)) {
      if (input) window.alert(zh ? '公鑰格式不對' : 'Invalid public key');
      return;
    }
    setConvs((prev) => (prev[peer] ? prev : { ...prev, [peer]: { peer, messages: [], lastTs: 0 } }));
    setActive(peer);
  }, [zh]);

  const logout = () => {
    clientRef.current?.close();
    sessionStorage.removeItem(SEED_KEY);
    sessionStorage.removeItem(CONV_KEY);
    window.location.href = '/weblogin';
  };

  const sortedConvs = useMemo(
    () => Object.values(convs).sort((a, b) => b.lastTs - a.lastTs),
    [convs],
  );

  const statusText = zh
    ? { connecting: '連接中…', connected: '在線', reconnecting: '重連中…' }[status]
    : { connecting: 'Connecting…', connected: 'Online', reconnecting: 'Reconnecting…' }[status];
  const dot = status === 'connected' ? '#14F195' : '#FFB800';

  const showSidebar = !isMobile || !active;
  const showThread = !isMobile || !!active;

  return (
    <div style={S.app}>
      {/* Sidebar */}
      {showSidebar && (
      <aside style={{ ...S.sidebar, ...(isMobile ? { width: '100%', minWidth: 0, borderRight: 'none' } : {}) }}>
        <div style={S.sideHeader}>
          <div style={S.meRow}>
            <span style={{ ...S.dot, background: dot, boxShadow: `0 0 6px ${dot}` }} />
            <div style={S.meText}>
              <div style={S.meTitle}>{zh ? '我的身份' : 'My identity'}</div>
              <code style={S.mePub}>{short(myPubHex)}</code>
            </div>
          </div>
          <div style={S.sideActions}>
            <button style={S.iconBtn} title={zh ? '發起聊天' : 'New chat'} onClick={startNewChat}>＋</button>
            <button style={S.iconBtn} title={zh ? '登出' : 'Log out'} onClick={logout}>⎋</button>
          </div>
        </div>
        <div style={S.statusLine}>{statusText}</div>
        <div style={S.convList}>
          {sortedConvs.length === 0 && (
            <div style={S.emptyList}>{zh ? '還沒有對話。點 ＋ 用公鑰發起。' : 'No chats yet. Tap ＋ to start with a public key.'}</div>
          )}
          {sortedConvs.map((c) => {
            const last = c.messages[c.messages.length - 1];
            return (
              <button
                key={c.peer}
                style={{ ...S.convItem, ...(c.peer === active ? S.convItemActive : {}) }}
                onClick={() => setActive(c.peer)}
              >
                <span style={{ ...S.avatar, background: colorFor(c.peer) }}>{c.peer.slice(0, 2)}</span>
                <span style={S.convBody}>
                  <span style={S.convName}>{short(c.peer)}</span>
                  <span style={S.convPreview}>{last ? (last.mine ? (zh ? '你：' : 'You: ') : '') + last.text : ''}</span>
                </span>
                {last && <span style={S.convTime}>{hhmm(last.ts)}</span>}
              </button>
            );
          })}
        </div>
      </aside>
      )}

      {/* Thread */}
      {showThread && (
      <main style={{ ...S.thread, ...(isMobile ? { width: '100%' } : {}) }}>
        {!activeConv ? (
          <div style={S.threadEmpty}>{zh ? '選擇一個對話開始' : 'Select a chat to start'}</div>
        ) : (
          <>
            <header style={S.threadHeader}>
              <button style={{ ...S.backBtn, display: isMobile ? 'block' : 'none' }} onClick={() => setActive('')}>‹</button>
              <span style={{ ...S.avatar, background: colorFor(activeConv.peer) }}>{activeConv.peer.slice(0, 2)}</span>
              <div style={S.threadTitleWrap}>
                <div style={S.threadTitle}>{short(activeConv.peer)}</div>
                <code style={S.threadSub}>{activeConv.peer}</code>
              </div>
            </header>

            <div style={S.messages} ref={scrollRef}>
              {activeConv.messages.map((m) => (
                <div key={m.id} style={{ ...S.row, justifyContent: m.mine ? 'flex-end' : 'flex-start' }}>
                  <div style={{ ...S.bubble, ...(m.mine ? S.bubbleMine : S.bubbleTheirs) }}>
                    <span style={S.msgText}>{m.text}</span>
                    <span style={S.msgTime}>{hhmm(m.ts)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={S.inputBar}>
              <textarea
                style={S.input}
                value={draft}
                placeholder={zh ? '訊息…' : 'Message…'}
                rows={1}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button style={{ ...S.sendBtn, opacity: draft.trim() ? 1 : 0.5 }} onClick={send}>
                {zh ? '發送' : 'Send'}
              </button>
            </div>
          </>
        )}
      </main>
      )}
    </div>
  );
}

// --- helpers ----------------------------------------------------------------

function short(h: string): string {
  return h && h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h || '—';
}
function hhmm(ts: number): string {
  const d = new Date(ts * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function colorFor(hex: string): string {
  const colors = ['#7462F7', '#14F195', '#FF6B6B', '#3EA6FF', '#FFB800', '#B9A7FF'];
  let n = 0;
  for (let i = 0; i < hex.length; i++) n = (n + hex.charCodeAt(i)) % colors.length;
  return colors[n];
}

const S: Record<string, CSSProperties> = {
  app: { display: 'flex', height: '100vh', background: '#0A0015', color: '#fff', fontFamily: 'system-ui,-apple-system,sans-serif', overflow: 'hidden' },
  sidebar: { width: 320, minWidth: 320, borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)' },
  sideHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  meRow: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  meText: { minWidth: 0 },
  meTitle: { fontSize: 13, fontWeight: 600 },
  mePub: { fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  sideActions: { display: 'flex', gap: 6 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', fontSize: 16, cursor: 'pointer' },
  statusLine: { padding: '6px 16px', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  convList: { flex: 1, overflowY: 'auto' },
  emptyList: { padding: 20, fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 },
  convItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', textAlign: 'left' },
  convItemActive: { background: 'rgba(116,98,247,0.16)' },
  avatar: { width: 38, height: 38, borderRadius: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'uppercase', flexShrink: 0 },
  convBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  convName: { fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  convPreview: { fontSize: 13, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  convTime: { fontSize: 11, color: 'rgba(255,255,255,0.35)', flexShrink: 0 },
  thread: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  threadEmpty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 15 },
  threadHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' },
  backBtn: { display: 'none', background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', padding: 0, width: 28 },
  threadTitleWrap: { minWidth: 0 },
  threadTitle: { fontSize: 15, fontWeight: 600 },
  threadSub: { fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 260 },
  messages: { flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 },
  row: { display: 'flex', width: '100%' },
  bubble: { maxWidth: '72%', padding: '7px 11px 5px', borderRadius: 16, fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word', display: 'flex', flexDirection: 'column' },
  bubbleMine: { background: '#7462F7', borderBottomRightRadius: 5 },
  bubbleTheirs: { background: 'rgba(255,255,255,0.09)', borderBottomLeftRadius: 5 },
  msgText: { whiteSpace: 'pre-wrap' },
  msgTime: { alignSelf: 'flex-end', fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  inputBar: { display: 'flex', alignItems: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' },
  input: { flex: 1, resize: 'none', maxHeight: 120, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, color: '#fff', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', lineHeight: 1.4 },
  sendBtn: { background: '#7462F7', color: '#fff', border: 'none', borderRadius: 18, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  hideOnMobile: {}, // replaced by CSS below on mobile
};
