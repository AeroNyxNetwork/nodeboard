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
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { ed25519 } from '@noble/curves/ed25519';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { RelayClient } from '@/lib/relayClient';
import {
  encryptText, encryptAttachmentMessage, decryptEnvelopeFrame,
  fetchAttachment, uploadAttachment, SIMPLE_UPLOAD_MAX,
  bytesToHex, hexToBytes,
  type OutgoingFrame, type WebAttachment,
} from '@/lib/msgCrypto';

const SEED_KEY = 'aeronyx_web_seed';
const CONV_KEY = 'aeronyx_web_convs';
const NAMES_KEY = 'aeronyx_web_names';

type Msg = {
  id: string; text: string; ts: number; mine: boolean;
  status?: 'sending' | 'sent' | 'failed'; attachments?: WebAttachment[];
};
type Conv = { peer: string; messages: Msg[]; lastTs: number; unread?: number };
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
  const [syncing, setSyncing] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [busyAtt, setBusyAtt] = useState(''); // blobId currently downloading
  const [uploading, setUploading] = useState(false); // an attachment send in flight

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastTsRef = useRef(0); // max message ts seen — relay_pull since_ts
  const pendingRef = useRef<Array<{ peer: string; id: string; frame: OutgoingFrame }>>([]);
  const activeRef = useRef(''); // current open peer — so appendMessage can read it

  const appendMessage = useCallback((peer: string, msg: Msg) => {
    lastTsRef.current = Math.max(lastTsRef.current, msg.ts);
    setConvs((prev) => {
      const c = prev[peer] || { peer, messages: [], lastTs: 0 };
      if (c.messages.some((m) => m.id === msg.id)) return prev; // dedupe
      const messages = [...c.messages, msg].sort((a, b) => a.ts - b.ts);
      const unread = !msg.mine && peer !== activeRef.current
        ? (c.unread || 0) + 1
        : c.unread || 0;
      return { ...prev, [peer]: { ...c, messages, lastTs: Math.max(c.lastTs, msg.ts), unread } };
    });
  }, []);

  const openConv = useCallback((peer: string) => {
    setActive(peer);
    setConvs((prev) => (prev[peer]?.unread ? { ...prev, [peer]: { ...prev[peer], unread: 0 } } : prev));
  }, []);

  const setMsgStatus = useCallback((peer: string, id: string, status: 'sent' | 'failed') => {
    setConvs((prev) => {
      const c = prev[peer];
      if (!c) return prev;
      return { ...prev, [peer]: { ...c, messages: c.messages.map((m) => (m.id === id ? { ...m, status } : m)) } };
    });
  }, []);

  // Patch fields of a single message in place (used to finalize an optimistic
  // attachment bubble once the blob has uploaded — same id, real meta + status).
  const patchMessage = useCallback((peer: string, id: string, patch: Partial<Msg>) => {
    setConvs((prev) => {
      const c = prev[peer];
      if (!c) return prev;
      return { ...prev, [peer]: { ...c, messages: c.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) } };
    });
  }, []);

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
      if (raw) {
        const loaded: Record<string, Conv> = JSON.parse(raw);
        setConvs(loaded);
        for (const c of Object.values(loaded)) {
          lastTsRef.current = Math.max(lastTsRef.current, c.lastTs || 0);
        }
      }
      const rn = sessionStorage.getItem(NAMES_KEY);
      if (rn) setNames(JSON.parse(rn));
    } catch { /* ignore */ }

    const client = new RelayClient(seedHex);
    clientRef.current = client;
    client.on('connected', () => {
      setStatus('connected');
      // [HISTORY] Pull offline/undelivered messages (they arrive as normal
      // relay_envelope frames and flow through the handler below, deduped by id).
      // ⚠️ We deliberately do NOT relay_offline_ack them: acking clears the
      // relay's per-pubkey offline queue and would steal messages from the phone
      // (the primary device). Re-pulls on reconnect are harmless (dedup).
      setSyncing(true);
      client.send({ type: 'relay_pull', since_ts: Math.max(0, lastTsRef.current - 60) });
      // [RETRY] resend messages that failed to send while disconnected.
      const pending = pendingRef.current;
      pendingRef.current = [];
      for (const p of pending) {
        if (client.send(p.frame)) setMsgStatus(p.peer, p.id, 'sent');
        else pendingRef.current.push(p);
      }
    });
    client.on('pulldone', () => setSyncing(false));
    client.on('closed', () => setStatus((s) => (s === 'connected' ? 'reconnecting' : s)));
    client.on('envelope', (frame) => {
      const s = seedRef.current;
      if (!s) return;
      const m = decryptEnvelopeFrame(s, frame as never);
      if (!m) return;
      appendMessage(m.senderHex, {
        id: m.msgId, text: m.text, ts: m.timestamp, mine: false,
        attachments: m.attachments,
      });
    });
    client.connect();
    // Safety: clear the syncing hint even if relay_pull_done never arrives.
    const syncTimer = setTimeout(() => setSyncing(false), 15000);
    return () => { clearTimeout(syncTimer); client.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist contact names
  useEffect(() => {
    try { sessionStorage.setItem(NAMES_KEY, JSON.stringify(names)); } catch { /* quota */ }
  }, [names]);

  // persist conversations
  useEffect(() => {
    try { sessionStorage.setItem(CONV_KEY, JSON.stringify(convs)); } catch { /* quota */ }
  }, [convs]);

  // keep activeRef current so the stable appendMessage callback can read it
  useEffect(() => { activeRef.current = active; }, [active]);

  const activeConv = active ? convs[active] : undefined;
  // Opening a conversation always jumps to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active]);
  // A new message only auto-scrolls if you're already near the bottom — don't
  // yank you down while you're reading history (Telegram behaviour).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 140) el.scrollTop = el.scrollHeight;
  }, [activeConv?.messages.length]);

  const send = useCallback(() => {
    const text = draft.trim();
    const seed = seedRef.current;
    const pub = pubRef.current;
    if (!text || !active || !seed || !pub) return;
    try {
      const frame = encryptText(seed, pub, active, text);
      const ok = clientRef.current?.send(frame) ?? false;
      appendMessage(active, {
        id: frame.msg_id, text, ts: frame.timestamp, mine: true,
        status: ok ? 'sent' : 'failed',
      });
      if (!ok) pendingRef.current.push({ peer: active, id: frame.msg_id, frame });
      setDraft('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    } catch { /* ignore */ }
  }, [draft, active, appendMessage]);

  // Encrypt + upload a picked file, then send it as an attachment message.
  // Shows an optimistic bubble immediately (image thumb / file chip), then
  // finalizes it with the real blob metadata once the upload returns.
  const sendAttachment = useCallback(async (file: File) => {
    const seed = seedRef.current;
    const pub = pubRef.current;
    const peer = active;
    if (!seed || !pub || !peer || uploading) return;

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > SIMPLE_UPLOAD_MAX) {
      window.alert(zh ? '檔案太大（網頁版上限 8MB，請用 App 發送大檔）' : 'File too large (8MB web limit — use the app for big files)');
      return;
    }
    const mediaType = file.type || 'application/octet-stream';
    const thumbB64 = mediaType.startsWith('image/') ? await makeThumb(bytes, mediaType) : undefined;

    // Pin the message id so the optimistic bubble updates in place after upload.
    const msgId = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    const ts = Math.floor(Date.now() / 1000);
    const localAtt: WebAttachment = {
      blobId: '', fileKey: '', mediaType, fileName: file.name, fileSize: bytes.length, thumbB64,
    };
    appendMessage(peer, { id: msgId, text: '', ts, mine: true, status: 'sending', attachments: [localAtt] });

    setUploading(true);
    try {
      const att = await uploadAttachment(seed, pub, { bytes, mediaType, fileName: file.name, thumbB64 });
      const frame = encryptAttachmentMessage(seed, pub, peer, '', [att], msgId);
      const ok = clientRef.current?.send(frame) ?? false;
      patchMessage(peer, msgId, { attachments: [att], status: ok ? 'sent' : 'failed' });
      if (!ok) pendingRef.current.push({ peer, id: msgId, frame });
    } catch {
      patchMessage(peer, msgId, { status: 'failed' });
    } finally {
      setUploading(false);
    }
  }, [active, uploading, zh, appendMessage, patchMessage]);

  const startNewChat = useCallback(() => {
    const input = window.prompt(zh ? '輸入對方的公鑰 (64 位十六進制)' : "Enter the peer's public key (64 hex)");
    const peer = (input || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(peer)) {
      if (input) window.alert(zh ? '公鑰格式不對' : 'Invalid public key');
      return;
    }
    setConvs((prev) => (prev[peer] ? prev : { ...prev, [peer]: { peer, messages: [], lastTs: 0 } }));
    openConv(peer);
  }, [zh, openConv]);

  const renamePeer = useCallback((peer: string) => {
    const input = window.prompt(
      zh ? '設定備註名（留空清除）' : 'Set a name (empty to clear)',
      names[peer] || '',
    );
    if (input === null) return;
    const name = input.trim();
    setNames((prev) => {
      const next = { ...prev };
      if (name) next[peer] = name;
      else delete next[peer];
      return next;
    });
  }, [names, zh]);

  const nameFor = useCallback((peer: string) => names[peer] || short(peer), [names]);

  const openAttachment = useCallback(async (att: WebAttachment) => {
    const seed = seedRef.current;
    const pub = pubRef.current;
    if (!seed || !pub || !att.blobId || !att.fileKey || busyAtt) return;
    setBusyAtt(att.blobId);
    try {
      const bytes = await fetchAttachment(seed, pub, att.blobId, att.fileKey);
      // Copy into a fresh Uint8Array so the Blob part is backed by a plain
      // ArrayBuffer (TS 5.7's generic Uint8Array<ArrayBufferLike> isn't a BlobPart).
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: att.mediaType || 'application/octet-stream' }),
      );
      if (att.mediaType.startsWith('image/')) {
        setLightbox({ url, name: att.fileName });
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = att.fileName || 'file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch {
      /* download/decrypt failed — leave the thumbnail as-is */
    } finally {
      setBusyAtt('');
    }
  }, [busyAtt]);

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
        <div style={S.statusLine}>
          {syncing ? (zh ? '同步歷史中…' : 'Syncing…') : statusText}
        </div>
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
                onClick={() => openConv(c.peer)}
              >
                <span style={{ ...S.avatar, background: colorFor(c.peer) }}>{c.peer.slice(0, 2)}</span>
                <span style={S.convBody}>
                  <span style={S.convName}>{nameFor(c.peer)}</span>
                  <span style={S.convPreview}>
                    {last
                      ? (last.mine ? (zh ? '你：' : 'You: ') : '') +
                        (last.text || (last.attachments?.length ? (zh ? '📎 附件' : '📎 Attachment') : ''))
                      : ''}
                  </span>
                </span>
                <span style={S.convRight}>
                  {last && <span style={S.convTime}>{convTime(last.ts, zh)}</span>}
                  {!!c.unread && (
                    <span style={S.unreadBadge}>{c.unread > 99 ? '99+' : c.unread}</span>
                  )}
                </span>
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
              <div
                style={{ ...S.threadTitleWrap, cursor: 'pointer' }}
                onClick={() => renamePeer(activeConv.peer)}
                title={zh ? '點擊設定備註名' : 'Click to set a name'}
              >
                <div style={S.threadTitle}>
                  {nameFor(activeConv.peer)} <span style={S.editHint}>✎</span>
                </div>
                <code style={S.threadSub}>{activeConv.peer}</code>
              </div>
            </header>

            <div style={S.messages} ref={scrollRef}>
              {activeConv.messages.map((m, i) => {
                const prev = activeConv.messages[i - 1];
                const showDate = !prev || !sameDay(prev.ts, m.ts);
                // Group consecutive same-sender messages within 5 min (Telegram).
                const grouped = !showDate && !!prev && prev.mine === m.mine && m.ts - prev.ts < 300;
                return (
                  <div key={m.id}>
                    {showDate && (
                      <div style={S.dateSep}>
                        <span style={S.dateSepPill}>{dateLabel(m.ts, zh)}</span>
                      </div>
                    )}
                    <div style={{ ...S.row, justifyContent: m.mine ? 'flex-end' : 'flex-start', marginTop: grouped ? 2 : 8 }}>
                      <div style={{ ...S.bubble, ...(m.mine ? S.bubbleMine : S.bubbleTheirs) }}>
                        {m.attachments?.map((a, k) => (
                          <AttachmentView
                            key={k}
                            att={a}
                            zh={zh}
                            onOpen={openAttachment}
                            busy={busyAtt === a.blobId}
                          />
                        ))}
                        {m.text ? <span style={S.msgText}>{linkify(m.text)}</span> : null}
                        <span style={S.msgTime}>
                          {hhmm(m.ts)}
                          {m.mine && (
                            <span style={{ marginLeft: 4, color: m.status === 'failed' ? '#FFB4A0' : undefined }}>
                              {m.status === 'failed' ? '⚠' : m.status === 'sending' ? '⏳' : '✓'}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={S.inputBar}>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = ''; // allow re-picking the same file
                  if (f) void sendAttachment(f);
                }}
              />
              <button
                style={{ ...S.attachBtn, opacity: uploading ? 0.5 : 1, cursor: uploading ? 'default' : 'pointer' }}
                title={zh ? '傳送附件' : 'Send a file'}
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? '…' : '📎'}
              </button>
              <textarea
                ref={inputRef}
                style={S.input}
                value={draft}
                placeholder={zh ? '訊息…' : 'Message…'}
                rows={1}
                onChange={(e) => {
                  setDraft(e.target.value);
                  const el = inputRef.current;
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                  }
                }}
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

      {lightbox && (
        <div
          style={S.lightbox}
          onClick={() => {
            URL.revokeObjectURL(lightbox.url);
            setLightbox(null);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt={lightbox.name} style={S.lightboxImg} />
        </div>
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

function sameDay(a: number, b: number): boolean {
  const da = new Date(a * 1000);
  const db = new Date(b * 1000);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function dateLabel(ts: number, zh: boolean): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((sod(now) - sod(d)) / 86400000);
  if (diff === 0) return zh ? '今天' : 'Today';
  if (diff === 1) return zh ? '昨天' : 'Yesterday';
  return d.toLocaleDateString(zh ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Relative timestamp for the conversation list (today→HH:MM, else day/date). */
function convTime(ts: number, zh: boolean): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((sod(now) - sod(d)) / 86400000);
  if (diff === 0) return hhmm(ts);
  if (diff === 1) return zh ? '昨天' : 'Yst';
  if (diff < 7) return d.toLocaleDateString(zh ? 'zh-CN' : 'en-US', { weekday: 'short' });
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Render text with clickable http(s) links. */
function linkify(text: string): ReactNode {
  return text.split(/(https?:\/\/[^\s]+)/g).map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a
        key={i}
        href={p}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#8AB4FF', textDecoration: 'underline' }}
      >
        {p}
      </a>
    ) : (
      p
    ),
  );
}
function colorFor(hex: string): string {
  const colors = ['#7462F7', '#14F195', '#FF6B6B', '#3EA6FF', '#FFB800', '#B9A7FF'];
  let n = 0;
  for (let i = 0; i < hex.length; i++) n = (n + hex.charCodeAt(i)) % colors.length;
  return colors[n];
}

function fmtSize(n: number): string {
  if (n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** Downscale an image to a small JPEG thumbnail (base64, no data: prefix) for the
 *  wire preview. The app renders thumbs by sniffing (mime-agnostic), so JPEG
 *  interops regardless of the original type. Kept under the relay/app thumb cap;
 *  returns undefined on failure (send still works — the receiver just downloads). */
async function makeThumb(bytes: Uint8Array, mediaType: string): Promise<string | undefined> {
  try {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mediaType }));
    try {
      const img = await loadImage(url);
      const max = 256;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const comma = dataUrl.indexOf(',');
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
      // Guard the wire-frame budget: the relay/app strip thumbs above ~128KB.
      return b64 && b64.length <= 120000 ? b64 : undefined;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return undefined;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Render an attachment. Image → inline thumbnail (click to fetch+view full);
 *  other types → file chip (click to download+decrypt). */
function AttachmentView({ att, zh, onOpen, busy }: {
  att: WebAttachment;
  zh: boolean;
  onOpen: (a: WebAttachment) => void;
  busy: boolean;
}) {
  const isImage = att.mediaType.startsWith('image/');
  const canFetch = !!att.blobId && !!att.fileKey;
  if (isImage && att.thumbB64) {
    return (
      <div
        style={{ position: 'relative', cursor: canFetch ? 'pointer' : 'default' }}
        onClick={() => canFetch && onOpen(att)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:${att.mediaType};base64,${att.thumbB64}`} alt={att.fileName} style={AS.img} />
        {busy && <div style={AS.attBusy}>…</div>}
      </div>
    );
  }
  const icon = att.mediaType.startsWith('video/')
    ? '🎬'
    : att.mediaType.startsWith('audio/')
      ? '🎧'
      : '📄';
  const note = canFetch
    ? busy
      ? zh ? ' · 下載中…' : ' · downloading…'
      : zh ? ' · 點擊下載' : ' · click to download'
    : zh ? ' · 需 App 開啟' : ' · open in app';
  return (
    <div
      style={{ ...AS.chip, cursor: canFetch ? 'pointer' : 'default' }}
      onClick={() => canFetch && onOpen(att)}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={AS.chipName}>{att.fileName}</div>
        <div style={AS.chipMeta}>{fmtSize(att.fileSize)}{note}</div>
      </div>
    </div>
  );
}

const AS: Record<string, CSSProperties> = {
  img: { maxWidth: 220, maxHeight: 260, borderRadius: 10, display: 'block', marginBottom: 4, objectFit: 'cover' },
  chip: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.18)', borderRadius: 8, marginBottom: 4 },
  chipName: { fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 },
  chipMeta: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  attBusy: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.35)', borderRadius: 10, fontSize: 22, letterSpacing: 2, color: '#fff',
  },
};

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
  convRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  unreadBadge: { background: '#7462F7', color: '#fff', fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  thread: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  threadEmpty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 15 },
  threadHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' },
  backBtn: { display: 'none', background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', padding: 0, width: 28 },
  threadTitleWrap: { minWidth: 0 },
  threadTitle: { fontSize: 15, fontWeight: 600 },
  editHint: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  threadSub: { fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 260 },
  messages: { flex: 1, overflowY: 'auto', padding: '10px 18px 16px', display: 'flex', flexDirection: 'column' },
  dateSep: { display: 'flex', justifyContent: 'center', margin: '12px 0 6px' },
  dateSepPill: { fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '3px 10px' },
  row: { display: 'flex', width: '100%' },
  bubble: { maxWidth: '72%', padding: '7px 11px 5px', borderRadius: 16, fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word', display: 'flex', flexDirection: 'column' },
  bubbleMine: { background: '#7462F7', borderBottomRightRadius: 5 },
  bubbleTheirs: { background: 'rgba(255,255,255,0.09)', borderBottomLeftRadius: 5 },
  msgText: { whiteSpace: 'pre-wrap' },
  msgTime: { alignSelf: 'flex-end', fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  inputBar: { display: 'flex', alignItems: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' },
  input: { flex: 1, resize: 'none', maxHeight: 120, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, color: '#fff', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', lineHeight: 1.4 },
  sendBtn: { background: '#7462F7', color: '#fff', border: 'none', borderRadius: 18, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  attachBtn: { width: 40, height: 40, flexShrink: 0, borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  lightbox: {
    position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.9)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out',
  },
  lightboxImg: { maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' },
  hideOnMobile: {}, // replaced by CSS below on mobile
};
