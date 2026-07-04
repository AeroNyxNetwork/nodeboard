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
  encryptText, encryptAttachmentMessage, decryptEnvelopeFrame, selfEchoFrame,
  encryptReaction, decryptReactionFrame,
  encryptGroupMessage, decryptGroupEnvelope, unsealGroupKey,
  encryptGroupReaction, decryptGroupReaction,
  fetchGroupList, fetchGroupKeyBundle,
  createGroup, inviteToGroup, leaveGroup, kickMember,
  fetchAttachment, uploadAttachmentAuto, CHUNKED_UPLOAD_MAX,
  bytesToHex, hexToBytes,
  type OutgoingFrame, type WebAttachment,
} from '@/lib/msgCrypto';

// Emoji palette offered by the quick-reaction picker.
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const SEED_KEY = 'aeronyx_web_seed';
const CONV_KEY = 'aeronyx_web_convs';
const NAMES_KEY = 'aeronyx_web_names';
const GROUPS_KEY = 'aeronyx_web_groups';
const RR_KEY = 'aeronyx_web_readreceipts'; // '0' = read receipts off

type Msg = {
  id: string; text: string; ts: number; mine: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  attachments?: WebAttachment[];
  reactions?: Record<string, string[]>; // emoji → reactor pubkey hexes
  sender?: string; // group message: sender pubkey hex (for name/avatar). Omitted for 1:1.
};
type Conv = { peer: string; messages: Msg[]; lastTs: number; unread?: number };
type GroupMember = { pubkey: string; role: string };
type Group = {
  groupId: string;
  name: string;
  ownerPubkey: string;
  myRole: string;
  keyVersion: number;
  members: GroupMember[];
  messages: Msg[];
  lastTs: number;
  unread?: number;
};
type Status = 'connecting' | 'connected' | 'reconnecting';
type SidebarEntry = {
  id: string; isGroup: boolean; name: string;
  last?: Msg; lastTs: number; unread: number; memberCount?: number;
};

/** Group ids are UUIDs (contain '-'); peer identities are 64-hex. */
function isGroupId(id: string): boolean {
  return id.includes('-');
}

/** Decrypt with the frame's key_version first, then fall back to every held
 *  version — tolerates a rotation race where the sender used a version we
 *  haven't matched to this message yet. */
function decryptWithKeys<T>(
  keys: Record<number, Uint8Array>,
  keyVersion: number | undefined,
  fn: (k: Uint8Array) => T | null,
): T | null {
  if (keyVersion != null && keys[keyVersion]) {
    const r = fn(keys[keyVersion]);
    if (r) return r;
  }
  for (const k of Object.values(keys)) {
    const r = fn(k);
    if (r) return r;
  }
  return null;
}

export default function ChatPage() {
  const { locale } = useI18n();
  const zh = (locale || '').toLowerCase().startsWith('zh');

  const seedRef = useRef<Uint8Array | null>(null);
  const pubRef = useRef<Uint8Array | null>(null);
  const clientRef = useRef<RelayClient | null>(null);

  const [status, setStatus] = useState<Status>('connecting');
  const [convs, setConvs] = useState<Record<string, Conv>>({});
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [active, setActive] = useState<string>(''); // peer hex OR group id
  const [draft, setDraft] = useState('');
  const [myPubHex, setMyPubHex] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [busyAtt, setBusyAtt] = useState(''); // blobId currently downloading
  const [uploading, setUploading] = useState(false); // an attachment send in flight
  const [pickerFor, setPickerFor] = useState(''); // msgId whose reaction palette is open
  const [showMembers, setShowMembers] = useState(false); // group members panel open
  const [readReceipts, setReadReceipts] = useState(true); // send read receipts (reciprocal privacy)
  const [typingPeers, setTypingPeers] = useState<Record<string, boolean>>({}); // peer → is typing
  const [groupTypers, setGroupTypers] = useState<Record<string, Record<string, boolean>>>({}); // groupId → pubkey → typing
  const [presence, setPresence] = useState<Record<string, { online: boolean; lastSeenTs: number | null }>>({});

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastTsRef = useRef(0); // max message ts seen — relay_pull since_ts
  const pendingRef = useRef<Array<{ peer: string; id: string; frame: OutgoingFrame }>>([]);
  const activeRef = useRef(''); // current open peer — so appendMessage can read it
  const audioUrlCache = useRef<Map<string, string>>(new Map()); // blobId → object URL
  const convsRef = useRef<Record<string, Conv>>({}); // mirror of convs for stable callbacks
  const groupsRef = useRef<Record<string, Group>>({}); // mirror of groups for stable callbacks
  const groupKeysRef = useRef<Record<string, Record<number, Uint8Array>>>({}); // groupId → keyVersion → key (not persisted)
  const readSentRef = useRef<Record<string, string>>({}); // peer → last msgId we sent a read for
  const readReceiptsRef = useRef(true); // mirror of readReceipts for the stable sendReadReceipt
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({}); // peer → auto-clear timer
  const groupTypingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({}); // "gid:pubkey" → auto-clear
  const typingSentAt = useRef(0); // last time WE sent typing:true (ms) — throttle
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const openConv = useCallback((id: string) => {
    setActive(id);
    if (isGroupId(id)) {
      setGroups((prev) => (prev[id]?.unread ? { ...prev, [id]: { ...prev[id], unread: 0 } } : prev));
    } else {
      setConvs((prev) => (prev[id]?.unread ? { ...prev, [id]: { ...prev[id], unread: 0 } } : prev));
    }
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

  // Apply a reaction (add/remove) to a message. Idempotent set-membership keyed
  // by (emoji, reactor) — matches the app's P2PMessageStore.applyReaction.
  const applyReaction = useCallback(
    (peer: string, targetMsgId: string, emoji: string, reactor: string, op: string) => {
      setConvs((prev) => {
        const c = prev[peer];
        if (!c) return prev;
        let changed = false;
        const messages = c.messages.map((m) => {
          if (m.id !== targetMsgId) return m;
          changed = true;
          return { ...m, reactions: applyReactionTo(m.reactions, emoji, reactor, op) };
        });
        return changed ? { ...prev, [peer]: { ...c, messages } } : prev;
      });
    },
    [],
  );

  // Apply a reaction to a group message (same idempotent set-membership).
  const applyGroupReaction = useCallback(
    (groupId: string, targetMsgId: string, emoji: string, reactor: string, op: string) => {
      setGroups((prev) => {
        const g = prev[groupId];
        if (!g) return prev;
        let changed = false;
        const messages = g.messages.map((m) => {
          if (m.id !== targetMsgId) return m;
          changed = true;
          return { ...m, reactions: applyReactionTo(m.reactions, emoji, reactor, op) };
        });
        return changed ? { ...prev, [groupId]: { ...g, messages } } : prev;
      });
    },
    [],
  );

  // Advance a sent message's delivery status (sent → delivered → read), never
  // downgrading. msg_id is globally unique, so we find it across conversations
  // (the receipt frame may not carry the peer pubkey).
  const bumpStatus = useCallback((msgId: string, to: 'delivered' | 'read') => {
    const rank: Record<string, number> = { sending: 0, failed: 0, sent: 1, delivered: 2, read: 3 };
    setConvs((prev) => {
      const next = { ...prev };
      let found = false;
      for (const peer of Object.keys(next)) {
        const c = next[peer];
        let changed = false;
        const messages = c.messages.map((m) => {
          if (m.id !== msgId || !m.mine) return m;
          const cur = m.status || 'sent';
          if ((rank[to] ?? 0) <= (rank[cur] ?? 1)) return m; // don't downgrade
          changed = true;
          found = true;
          return { ...m, status: to };
        });
        if (changed) next[peer] = { ...c, messages };
      }
      return found ? next : prev;
    });
  }, []);

  // Append a group message (dedupe + unread when the group isn't focused).
  const appendGroupMessage = useCallback((groupId: string, msg: Msg) => {
    lastTsRef.current = Math.max(lastTsRef.current, msg.ts);
    setGroups((prev) => {
      const g = prev[groupId];
      if (!g) return prev; // unknown group (metadata not loaded) — drop
      if (g.messages.some((m) => m.id === msg.id)) return prev;
      const messages = [...g.messages, msg].sort((a, b) => a.ts - b.ts);
      const unread = !msg.mine && groupId !== activeRef.current ? (g.unread || 0) + 1 : g.unread || 0;
      return { ...prev, [groupId]: { ...g, messages, lastTs: Math.max(g.lastTs, msg.ts), unread } };
    });
  }, []);

  // Patch a group message in place (finalize an optimistic attachment / reaction).
  const patchGroupMessage = useCallback((groupId: string, id: string, patch: Partial<Msg>) => {
    setGroups((prev) => {
      const g = prev[groupId];
      if (!g) return prev;
      return { ...prev, [groupId]: { ...g, messages: g.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) } };
    });
  }, []);

  // Fetch the group list + (re)fetch and unseal each group key. Runs on connect,
  // before history is pulled, so inbound group messages can decrypt.
  const loadGroups = useCallback(async () => {
    const seed = seedRef.current;
    const pub = pubRef.current;
    if (!seed || !pub) return;
    let list;
    try { list = await fetchGroupList(seed, pub); } catch { return; }
    setGroups((prev) => {
      const next = { ...prev };
      for (const gi of list) {
        const ex = next[gi.groupId];
        next[gi.groupId] = {
          groupId: gi.groupId, name: gi.name, ownerPubkey: gi.ownerPubkey,
          myRole: gi.myRole, keyVersion: gi.keyVersion, members: gi.members,
          messages: ex?.messages || [], lastTs: ex?.lastTs || 0, unread: ex?.unread || 0,
        };
      }
      return next;
    });
    // Fetch + unseal each key (overwrite so a rotated key is picked up).
    await Promise.all(list.map(async (gi) => {
      try {
        const bundle = await fetchGroupKeyBundle(seed, pub, gi.groupId);
        if (!bundle) return;
        const key = unsealGroupKey(seed, bundle.issuedBy, bundle.encryptedKeyB64);
        if (key) (groupKeysRef.current[gi.groupId] ||= {})[bundle.keyVersion] = key;
      } catch { /* skip this group's key */ }
    }));
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
      const rg = sessionStorage.getItem(GROUPS_KEY);
      if (rg) {
        const loadedG: Record<string, Group> = JSON.parse(rg);
        setGroups(loadedG);
        for (const g of Object.values(loadedG)) {
          lastTsRef.current = Math.max(lastTsRef.current, g.lastTs || 0);
        }
      }
      if (sessionStorage.getItem(RR_KEY) === '0') { setReadReceipts(false); readReceiptsRef.current = false; }
    } catch { /* ignore */ }

    const client = new RelayClient(seedHex);
    clientRef.current = client;
    client.on('connected', async () => {
      setStatus('connected');
      // Load groups + unseal their keys BEFORE pulling history, so replayed
      // group messages (discriminant 25) have a key to decrypt with.
      await loadGroups();
      // [PRESENCE] (re)subscribe to all known group peers isn't needed; presence
      // is 1:1 only. Group peers still get subscribed via the conv-peer set below.
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
        if (client.send(p.frame)) {
          const rs = seedRef.current;
          const rp = pubRef.current;
          if (rs && rp) client.send(selfEchoFrame(rs, rp, p.frame)); // [MULTI-DEVICE]
          setMsgStatus(p.peer, p.id, 'sent');
        } else {
          pendingRef.current.push(p);
        }
      }
      // [PRESENCE] (re)subscribe to all known conversation peers on (re)connect.
      const peers = Object.keys(convsRef.current);
      if (peers.length) client.send({ type: 'presence_subscribe', pubkeys: peers });
    });
    client.on('pulldone', () => setSyncing(false));
    client.on('closed', () => setStatus((s) => (s === 'connected' ? 'reconnecting' : s)));
    client.on('envelope', (frame) => {
      const s = seedRef.current;
      if (!s) return;
      const f = frame as { discriminant?: number; group_id?: string };
      // Group message (discriminant 25): decrypt with the group key.
      if (f.discriminant === 25) {
        const gid = f.group_id;
        if (!gid) return;
        const keys = groupKeysRef.current[gid];
        if (!keys) return; // no keys loaded yet — loadGroups on connect covers the norm
        const kv = (frame as { key_version?: number }).key_version;
        const gm = decryptWithKeys(keys, kv, (k) => decryptGroupEnvelope(k, frame as never));
        if (!gm) return;
        const myHex = pubRef.current ? bytesToHex(pubRef.current) : '';
        appendGroupMessage(gm.groupId, {
          id: gm.msgId, text: gm.text, ts: gm.timestamp,
          mine: gm.senderHex === myHex, sender: gm.senderHex, attachments: gm.attachments,
        });
        return;
      }
      const m = decryptEnvelopeFrame(s, frame as never);
      if (!m) return;
      // m.mine = a self-echo of a message we sent from another device → show it
      // as a sent bubble in the m.peerHex conversation (dedup drops our own copy).
      appendMessage(m.peerHex, {
        id: m.msgId, text: m.text, ts: m.timestamp, mine: m.mine,
        attachments: m.attachments,
        status: m.mine ? 'sent' : undefined,
      });
      // Delivery receipt only for a message actually FROM the peer — never for
      // our own self-echo. Metadata-only; does NOT ack the offline queue.
      if (!m.mine) {
        client.send({
          type: 'message_receipt', receiver_pubkey: m.peerHex,
          msg_id: m.msgId, timestamp: Math.floor(Date.now() / 1000),
        });
      }
    });
    client.on('reaction', (frame) => {
      const s = seedRef.current;
      if (!s) return;
      const r = decryptReactionFrame(s, frame as never);
      if (!r) return;
      applyReaction(r.senderHex, r.targetMsgId, r.emoji, r.senderHex, r.op);
    });
    client.on('receipt', (frame) => {
      const id = (frame as { msg_id?: string })?.msg_id;
      if (id) bumpStatus(id, 'delivered');
    });
    client.on('read', (frame) => {
      const id = (frame as { msg_id?: string })?.msg_id;
      if (id) bumpStatus(id, 'read');
    });
    client.on('typing', (frame) => {
      const f = frame as { sender_pubkey?: string; is_typing?: boolean; typing?: boolean };
      const peer = (f.sender_pubkey || '').toLowerCase();
      if (!peer) return;
      const isTyping = f.is_typing !== false && f.typing !== false;
      setTypingPeers((prev) => ({ ...prev, [peer]: isTyping }));
      if (typingTimers.current[peer]) clearTimeout(typingTimers.current[peer]);
      if (isTyping) {
        // Auto-clear if no follow-up within 6s (older peers may omit is_typing:false).
        typingTimers.current[peer] = setTimeout(
          () => setTypingPeers((prev) => ({ ...prev, [peer]: false })), 6000,
        );
      }
    });
    client.on('presence', (frame) => {
      const f = frame as { updates?: unknown[] };
      const list = Array.isArray(f.updates) ? f.updates : [frame];
      setPresence((prev) => {
        const next = { ...prev };
        for (const raw of list) {
          const m = raw as Record<string, unknown>;
          const pubkey = String(m.pubkey || '').toLowerCase();
          if (!pubkey) continue;
          const visible = (m.visible ?? m.presence_visible) === true;
          const online = visible && m.online === true;
          const lastSeenVisible = m.last_seen_visible === true;
          const ts = typeof m.last_seen_ts === 'number' ? m.last_seen_ts : null;
          next[pubkey] = { online, lastSeenTs: visible && lastSeenVisible ? ts : null };
        }
        return next;
      });
    });
    client.on('groupreaction', (frame) => {
      const gid = (frame as { group_id?: string }).group_id;
      if (!gid) return;
      const keys = groupKeysRef.current[gid];
      if (!keys) return;
      const kv = (frame as { key_version?: number }).key_version;
      const r = decryptWithKeys(keys, kv, (k) => decryptGroupReaction(k, frame as never));
      if (!r) return;
      applyGroupReaction(r.groupId, r.targetMsgId, r.emoji, r.senderHex, r.op);
    });
    client.on('grouptyping', (frame) => {
      const f = frame as { group_id?: string; sender_pubkey?: string; is_typing?: boolean; typing?: boolean };
      const gid = f.group_id;
      const who = (f.sender_pubkey || '').toLowerCase();
      const myHex = pubRef.current ? bytesToHex(pubRef.current) : '';
      if (!gid || !who || who === myHex) return; // ignore our own echo
      const isTyping = f.is_typing !== false && f.typing !== false;
      setGroupTypers((prev) => {
        const g = { ...(prev[gid] || {}) };
        if (isTyping) g[who] = true; else delete g[who];
        return { ...prev, [gid]: g };
      });
      const tkey = `${gid}:${who}`;
      if (groupTypingTimers.current[tkey]) clearTimeout(groupTypingTimers.current[tkey]);
      if (isTyping) {
        groupTypingTimers.current[tkey] = setTimeout(() => {
          setGroupTypers((prev) => {
            if (!prev[gid]?.[who]) return prev;
            const g = { ...prev[gid] };
            delete g[who];
            return { ...prev, [gid]: g };
          });
        }, 6000);
      }
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

  // persist groups (metadata + decrypted messages; keys are re-fetched on connect)
  useEffect(() => {
    try { sessionStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); } catch { /* quota */ }
  }, [groups]);

  // keep activeRef/convsRef/groupsRef current so stable callbacks can read latest state
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { convsRef.current = convs; }, [convs]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  useEffect(() => {
    readReceiptsRef.current = readReceipts;
    try { sessionStorage.setItem(RR_KEY, readReceipts ? '1' : '0'); } catch { /* quota */ }
  }, [readReceipts]);

  const activeConv = active && !isGroupId(active) ? convs[active] : undefined;
  const activeGroup = active && isGroupId(active) ? groups[active] : undefined;
  const activeThread = activeConv ?? activeGroup; // both carry messages[] + lastTs
  const headerStatus = activeConv ? peerStatus(active, typingPeers, presence, zh) : null;
  const groupTypingText = activeGroup ? groupTypingLabel(groupTypers[active] || {}, names, zh) : '';

  // [READ-RECEIPT] Tell the sender we've read up to their newest message in the
  // open conversation (metadata-only). Suppressed while the tab is hidden — you
  // haven't actually read it if you're not looking — and re-fired on refocus.
  // The per-peer watermark avoids re-sending for the same message.
  const sendReadReceipt = useCallback(() => {
    if (!readReceiptsRef.current) return; // reciprocal privacy: off → don't send
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const peer = activeRef.current;
    if (!peer) return;
    const c = convsRef.current[peer];
    if (!c) return;
    let newest: Msg | undefined;
    for (let i = c.messages.length - 1; i >= 0; i--) {
      if (!c.messages[i].mine) { newest = c.messages[i]; break; }
    }
    if (!newest || readSentRef.current[peer] === newest.id) return;
    const ok = clientRef.current?.send({
      type: 'message_read', receiver_pubkey: peer, msg_id: newest.id,
      timestamp: Math.floor(Date.now() / 1000), enabled: true,
    });
    if (ok) readSentRef.current[peer] = newest.id;
  }, []);

  useEffect(() => { sendReadReceipt(); }, [active, activeConv, sendReadReceipt]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') sendReadReceipt(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [sendReadReceipt]);

  // [PRESENCE] Subscribe to the open peer (covers a freshly-started chat that
  // wasn't in the set at connect time). Idempotent on the relay.
  useEffect(() => {
    if (active && !isGroupId(active)) clientRef.current?.send({ type: 'presence_subscribe', pubkeys: [active] });
  }, [active]);

  // Clear typing timers on unmount.
  useEffect(() => {
    const timers = typingTimers.current;
    const gTimers = groupTypingTimers.current;
    const stop = stopTypingTimer;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      Object.values(gTimers).forEach(clearTimeout);
      if (stop.current) clearTimeout(stop.current);
    };
  }, []);
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
  }, [activeThread?.messages.length]);

  const send = useCallback(() => {
    const text = draft.trim();
    const seed = seedRef.current;
    const pub = pubRef.current;
    if (!text || !active || !seed || !pub) return;

    // Group message branch.
    if (isGroupId(active)) {
      const g = groupsRef.current[active];
      const key = g ? groupKeysRef.current[active]?.[g.keyVersion] : undefined;
      if (!g || !key) return; // no group key yet — can't send
      try {
        const frame = encryptGroupMessage(seed, pub, active, key, g.keyVersion, text);
        const ok = clientRef.current?.send(frame) ?? false;
        appendGroupMessage(active, {
          id: frame.msg_id, text, ts: frame.timestamp, mine: true,
          sender: bytesToHex(pub), status: ok ? 'sent' : 'failed',
        });
        // Sending clears the group typing state.
        if (stopTypingTimer.current) { clearTimeout(stopTypingTimer.current); stopTypingTimer.current = null; }
        typingSentAt.current = 0;
        clientRef.current?.send({ type: 'group_typing', group_id: active, is_typing: false, timestamp: Math.floor(Date.now() / 1000) });
        setDraft('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
      } catch { /* ignore */ }
      return;
    }

    try {
      const frame = encryptText(seed, pub, active, text);
      const ok = clientRef.current?.send(frame) ?? false;
      if (ok) clientRef.current?.send(selfEchoFrame(seed, pub, frame)); // [MULTI-DEVICE] sync to our own devices
      appendMessage(active, {
        id: frame.msg_id, text, ts: frame.timestamp, mine: true,
        status: ok ? 'sent' : 'failed',
      });
      if (!ok) pendingRef.current.push({ peer: active, id: frame.msg_id, frame });
      // Sending clears the typing state immediately.
      if (stopTypingTimer.current) { clearTimeout(stopTypingTimer.current); stopTypingTimer.current = null; }
      typingSentAt.current = 0;
      clientRef.current?.send({ type: 'typing', receiver_pubkey: active, is_typing: false });
      setDraft('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    } catch { /* ignore */ }
  }, [draft, active, appendMessage, appendGroupMessage]);

  // [TYPING] Throttled typing:true while composing, with an auto "stopped" after
  // ~3.5s of no keystrokes. Metadata-only (no plaintext).
  const notifyTyping = useCallback(() => {
    const peer = active;
    if (!peer) return;
    const now = Date.now();
    const grp = isGroupId(peer);
    const frame = (typing: boolean) => grp
      ? { type: 'group_typing', group_id: peer, is_typing: typing, timestamp: Math.floor(Date.now() / 1000) }
      : { type: 'typing', receiver_pubkey: peer, is_typing: typing };
    if (now - typingSentAt.current > 3000) {
      typingSentAt.current = now;
      clientRef.current?.send(frame(true));
    }
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = setTimeout(() => {
      typingSentAt.current = 0;
      clientRef.current?.send(frame(false));
    }, 3500);
  }, [active]);

  // Encrypt + upload a picked file, then send it as an attachment message.
  // Shows an optimistic bubble immediately (image thumb / file chip), then
  // finalizes it with the real blob metadata once the upload returns.
  const sendAttachment = useCallback(async (file: File) => {
    const seed = seedRef.current;
    const pub = pubRef.current;
    const peer = active;
    if (!seed || !pub || !peer || uploading) return;

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > CHUNKED_UPLOAD_MAX) {
      window.alert(zh ? '檔案太大（網頁版上限 100MB）' : 'File too large (100MB web limit)');
      return;
    }
    const mediaType = file.type || 'application/octet-stream';
    const thumbB64 = mediaType.startsWith('image/') ? await makeThumb(bytes, mediaType) : undefined;

    // Group attachment branch.
    if (isGroupId(peer)) {
      const g = groupsRef.current[peer];
      const key = g ? groupKeysRef.current[peer]?.[g.keyVersion] : undefined;
      if (!g || !key) return;
      const gMsgId = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
      const gTs = Math.floor(Date.now() / 1000);
      const localAtt: WebAttachment = {
        blobId: '', fileKey: '', mediaType, fileName: file.name, fileSize: bytes.length, thumbB64,
      };
      appendGroupMessage(peer, {
        id: gMsgId, text: '', ts: gTs, mine: true, sender: bytesToHex(pub),
        status: 'sending', attachments: [localAtt],
      });
      setUploading(true);
      try {
        const att = await uploadAttachmentAuto(seed, pub, { bytes, mediaType, fileName: file.name, thumbB64 });
        const frame = encryptGroupMessage(seed, pub, peer, key, g.keyVersion, '', [att], gMsgId);
        const ok = clientRef.current?.send(frame) ?? false;
        patchGroupMessage(peer, gMsgId, { attachments: [att], status: ok ? 'sent' : 'failed' });
      } catch {
        patchGroupMessage(peer, gMsgId, { status: 'failed' });
      } finally {
        setUploading(false);
      }
      return;
    }

    // Pin the message id so the optimistic bubble updates in place after upload.
    const msgId = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    const ts = Math.floor(Date.now() / 1000);
    const localAtt: WebAttachment = {
      blobId: '', fileKey: '', mediaType, fileName: file.name, fileSize: bytes.length, thumbB64,
    };
    appendMessage(peer, { id: msgId, text: '', ts, mine: true, status: 'sending', attachments: [localAtt] });

    setUploading(true);
    try {
      const att = await uploadAttachmentAuto(seed, pub, { bytes, mediaType, fileName: file.name, thumbB64 });
      const frame = encryptAttachmentMessage(seed, pub, peer, '', [att], msgId);
      const ok = clientRef.current?.send(frame) ?? false;
      if (ok) clientRef.current?.send(selfEchoFrame(seed, pub, frame)); // [MULTI-DEVICE] sync to our own devices
      patchMessage(peer, msgId, { attachments: [att], status: ok ? 'sent' : 'failed' });
      if (!ok) pendingRef.current.push({ peer, id: msgId, frame });
    } catch {
      patchMessage(peer, msgId, { status: 'failed' });
    } finally {
      setUploading(false);
    }
  }, [active, uploading, zh, appendMessage, patchMessage, appendGroupMessage, patchGroupMessage]);

  // Toggle my reaction on a message: 'remove' if I already gave this emoji, else
  // 'add'. Optimistic locally, then a signed message_reaction over the relay.
  const toggleReaction = useCallback((targetMsgId: string, emoji: string) => {
    const seed = seedRef.current;
    const pub = pubRef.current;
    const peer = active;
    if (!seed || !pub || !peer || !myPubHex) return;

    // Group reaction branch.
    if (isGroupId(peer)) {
      const g = groupsRef.current[peer];
      const key = g ? groupKeysRef.current[peer]?.[g.keyVersion] : undefined;
      if (!g || !key) return;
      const gm = g.messages.find((m) => m.id === targetMsgId);
      const gOp = gm?.reactions?.[emoji]?.includes(myPubHex) ? 'remove' : 'add';
      applyGroupReaction(peer, targetMsgId, emoji, myPubHex, gOp); // optimistic
      setPickerFor('');
      try {
        clientRef.current?.send(encryptGroupReaction(seed, pub, peer, key, g.keyVersion, targetMsgId, emoji, gOp));
      } catch { /* optimistic UI already reflects it */ }
      return;
    }

    const msg = convsRef.current[peer]?.messages.find((m) => m.id === targetMsgId);
    const already = !!msg?.reactions?.[emoji]?.includes(myPubHex);
    const op = already ? 'remove' : 'add';
    applyReaction(peer, targetMsgId, emoji, myPubHex, op); // optimistic
    setPickerFor('');
    try {
      clientRef.current?.send(encryptReaction(seed, pub, peer, targetMsgId, emoji, op));
    } catch {
      /* optimistic UI already reflects it; a failed send just isn't mirrored to the peer */
    }
  }, [active, myPubHex, applyReaction, applyGroupReaction]);

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

  // Create a new group (owner = me), then open it. Members are invited after.
  const createNewGroup = useCallback(async () => {
    const seed = seedRef.current;
    const pub = pubRef.current;
    if (!seed || !pub) return;
    const name = (window.prompt(zh ? '群組名稱' : 'Group name') || '').trim();
    if (!name) return;
    const res = await createGroup(seed, pub, name);
    if (!res) { window.alert(zh ? '建立群組失敗' : 'Failed to create group'); return; }
    groupKeysRef.current[res.groupId] = { [res.keyVersion]: res.groupKey };
    const myHex = bytesToHex(pub);
    setGroups((prev) => ({
      ...prev,
      [res.groupId]: {
        groupId: res.groupId, name, ownerPubkey: myHex, myRole: 'owner',
        keyVersion: res.keyVersion, members: [{ pubkey: myHex, role: 'owner' }],
        messages: [], lastTs: Math.floor(Date.now() / 1000), unread: 0,
      },
    }));
    openConv(res.groupId);
  }, [zh, openConv]);

  // Invite a member to the open group (owner seals the current key to them).
  const inviteMember = useCallback(async () => {
    const seed = seedRef.current;
    const pub = pubRef.current;
    const gid = activeRef.current;
    if (!seed || !pub || !gid || !isGroupId(gid)) return;
    const g = groupsRef.current[gid];
    const key = g ? groupKeysRef.current[gid]?.[g.keyVersion] : undefined;
    if (!g || !key) return;
    const input = (window.prompt(zh ? '邀請成員：輸入公鑰 (64 位十六進制)' : "Invite: enter the member's public key (64 hex)") || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(input)) {
      if (input) window.alert(zh ? '公鑰格式不對' : 'Invalid public key');
      return;
    }
    if (g.members.some((m) => m.pubkey === input)) { window.alert(zh ? '已是成員' : 'Already a member'); return; }
    const ok = await inviteToGroup(seed, pub, gid, key, g.keyVersion, input);
    if (!ok) { window.alert(zh ? '邀請失敗' : 'Invite failed'); return; }
    setGroups((prev) => {
      const cur = prev[gid];
      if (!cur || cur.members.some((m) => m.pubkey === input)) return prev;
      return { ...prev, [gid]: { ...cur, members: [...cur.members, { pubkey: input, role: 'member' }] } };
    });
  }, [zh]);

  // Leave the open group.
  const leaveActiveGroup = useCallback(async () => {
    const seed = seedRef.current;
    const pub = pubRef.current;
    const gid = activeRef.current;
    if (!seed || !pub || !gid || !isGroupId(gid)) return;
    if (!window.confirm(zh ? '確定離開此群組？' : 'Leave this group?')) return;
    const ok = await leaveGroup(seed, pub, gid);
    if (!ok) { window.alert(zh ? '離開失敗' : 'Failed to leave the group'); return; }
    delete groupKeysRef.current[gid];
    setActive('');
    setGroups((prev) => {
      const next = { ...prev };
      delete next[gid];
      return next;
    });
  }, [zh]);

  // Owner removes a member, then the group key rotates so the removed member
  // can't read future messages. New key is stored at the new version.
  const kickGroupMember = useCallback(async (memberPubHex: string) => {
    const seed = seedRef.current;
    const pub = pubRef.current;
    const gid = activeRef.current;
    if (!seed || !pub || !gid || !isGroupId(gid)) return;
    const g = groupsRef.current[gid];
    if (!g || g.myRole !== 'owner') return;
    if (!window.confirm(zh ? '移除此成員並輪換群組密鑰？' : 'Remove this member and rotate the group key?')) return;
    const res = await kickMember(seed, pub, gid, memberPubHex);
    if (!res) { window.alert(zh ? '移除失敗（或密鑰輪換失敗）' : 'Failed to remove (or key rotation failed)'); return; }
    (groupKeysRef.current[gid] ||= {})[res.newKeyVersion] = res.newGroupKey;
    setGroups((prev) => {
      const cur = prev[gid];
      if (!cur) return prev;
      const members = res.members.map(
        (pk) => cur.members.find((m) => m.pubkey === pk) || { pubkey: pk, role: 'member' },
      );
      return { ...prev, [gid]: { ...cur, members, keyVersion: res.newKeyVersion } };
    });
  }, [zh]);

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

  // Download + decrypt a voice/audio blob once, cache the object URL by blobId
  // (a voice message is usually replayed a few times). URLs are revoked on unmount.
  const fetchAudioUrl = useCallback(async (att: WebAttachment): Promise<string | null> => {
    const seed = seedRef.current;
    const pub = pubRef.current;
    if (!seed || !pub || !att.blobId || !att.fileKey) return null;
    const cached = audioUrlCache.current.get(att.blobId);
    if (cached) return cached;
    try {
      const bytes = await fetchAttachment(seed, pub, att.blobId, att.fileKey);
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: att.mediaType || 'audio/mp4' }),
      );
      audioUrlCache.current.set(att.blobId, url);
      return url;
    } catch {
      return null;
    }
  }, []);

  // Revoke every cached audio object URL when the chat unmounts.
  useEffect(() => {
    const cache = audioUrlCache.current;
    return () => {
      cache.forEach((u) => URL.revokeObjectURL(u));
      cache.clear();
    };
  }, []);

  const logout = () => {
    clientRef.current?.close();
    sessionStorage.removeItem(SEED_KEY);
    sessionStorage.removeItem(CONV_KEY);
    window.location.href = '/weblogin';
  };

  // Unified, time-sorted sidebar list of 1:1 conversations + groups.
  const sortedEntries = useMemo<SidebarEntry[]>(() => {
    const entries: SidebarEntry[] = [];
    for (const c of Object.values(convs)) {
      entries.push({
        id: c.peer, isGroup: false, name: nameFor(c.peer),
        last: c.messages[c.messages.length - 1], lastTs: c.lastTs, unread: c.unread || 0,
      });
    }
    for (const g of Object.values(groups)) {
      entries.push({
        id: g.groupId, isGroup: true, name: g.name || short(g.groupId),
        last: g.messages[g.messages.length - 1], lastTs: g.lastTs, unread: g.unread || 0,
        memberCount: g.members.length,
      });
    }
    return entries.sort((a, b) => b.lastTs - a.lastTs);
  }, [convs, groups, nameFor]);

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
            <button style={{ ...S.iconBtn, fontSize: 14 }} title={zh ? '建立群組' : 'New group'} onClick={createNewGroup}>👥</button>
            <button
              style={{ ...S.iconBtn, fontSize: 13, opacity: readReceipts ? 1 : 0.4 }}
              title={readReceipts ? (zh ? '已讀回執：開（點擊關閉）' : 'Read receipts: on (click to turn off)') : (zh ? '已讀回執：關' : 'Read receipts: off')}
              onClick={() => setReadReceipts((v) => !v)}
            >
              👁
            </button>
            <button style={S.iconBtn} title={zh ? '登出' : 'Log out'} onClick={logout}>⎋</button>
          </div>
        </div>
        <div style={S.statusLine}>
          {syncing ? (zh ? '同步歷史中…' : 'Syncing…') : statusText}
        </div>
        <div style={S.convList}>
          {sortedEntries.length === 0 && (
            <div style={S.emptyList}>{zh ? '還沒有對話。點 ＋ 用公鑰發起，群組會自動同步。' : 'No chats yet. Tap ＋ to start with a public key; groups sync automatically.'}</div>
          )}
          {sortedEntries.map((e) => {
            const last = e.last;
            return (
              <button
                key={e.id}
                style={{ ...S.convItem, ...(e.id === active ? S.convItemActive : {}) }}
                onClick={() => openConv(e.id)}
              >
                <span style={{ ...S.avatar, background: e.isGroup ? '#3A2E63' : colorFor(e.id) }}>
                  {e.isGroup ? '👥' : e.id.slice(0, 2)}
                </span>
                <span style={S.convBody}>
                  <span style={S.convName}>{e.name}</span>
                  <span style={S.convPreview}>
                    {(!e.isGroup && typingPeers[e.id]) ||
                    (e.isGroup && Object.values(groupTypers[e.id] || {}).some(Boolean)) ? (
                      <span style={{ color: '#8AB4FF' }}>{zh ? '正在輸入…' : 'typing…'}</span>
                    ) : last ? (
                      (last.mine ? (zh ? '你：' : 'You: ') : '') +
                      (last.text || attPreview(last.attachments, zh))
                    ) : e.isGroup ? (
                      `${e.memberCount ?? 0} ${zh ? '位成員' : 'members'}`
                    ) : ''}
                  </span>
                </span>
                <span style={S.convRight}>
                  {last && <span style={S.convTime}>{convTime(last.ts, zh)}</span>}
                  {!!e.unread && (
                    <span style={S.unreadBadge}>{e.unread > 99 ? '99+' : e.unread}</span>
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
        {!activeThread ? (
          <div style={S.threadEmpty}>{zh ? '選擇一個對話開始' : 'Select a chat to start'}</div>
        ) : (
          <>
            <header style={S.threadHeader}>
              <button style={{ ...S.backBtn, display: isMobile ? 'block' : 'none' }} onClick={() => setActive('')}>‹</button>
              {activeGroup ? (
                <>
                  <span style={{ ...S.avatar, background: '#3A2E63' }}>👥</span>
                  <div
                    style={{ ...S.threadTitleWrap, cursor: 'pointer' }}
                    onClick={() => setShowMembers(true)}
                    title={zh ? '查看成員' : 'View members'}
                  >
                    <div style={S.threadTitle}>{activeGroup.name || short(activeGroup.groupId)}</div>
                    {groupTypingText ? (
                      <div style={{ ...S.threadStatus, color: '#8AB4FF' }}>{groupTypingText}</div>
                    ) : (
                      <div style={S.threadSub}>
                        {activeGroup.members.length} {zh ? '位成員' : 'members'}
                        {activeGroup.myRole === 'owner' ? (zh ? ' · 群主' : ' · owner') : ''}
                      </div>
                    )}
                  </div>
                  <div style={S.headerActions}>
                    {activeGroup.myRole === 'owner' && (
                      <button style={S.headerBtn} onClick={inviteMember}>{zh ? '邀請' : 'Invite'}</button>
                    )}
                    <button style={S.headerBtn} onClick={leaveActiveGroup}>{zh ? '離開' : 'Leave'}</button>
                  </div>
                </>
              ) : (
                <>
                  <span style={{ ...S.avatar, background: colorFor(activeConv!.peer) }}>{activeConv!.peer.slice(0, 2)}</span>
                  <div
                    style={{ ...S.threadTitleWrap, cursor: 'pointer' }}
                    onClick={() => renamePeer(activeConv!.peer)}
                    title={zh ? '點擊設定備註名' : 'Click to set a name'}
                  >
                    <div style={S.threadTitle}>
                      {nameFor(activeConv!.peer)} <span style={S.editHint}>✎</span>
                    </div>
                    {headerStatus
                      ? <div style={{ ...S.threadStatus, color: headerStatus.color }}>{headerStatus.text}</div>
                      : <code style={S.threadSub}>{activeConv!.peer}</code>}
                  </div>
                </>
              )}
            </header>

            <div style={S.messages} ref={scrollRef}>
              {activeThread.messages.map((m, i) => {
                const prev = activeThread.messages[i - 1];
                const showDate = !prev || !sameDay(prev.ts, m.ts);
                // Group consecutive same-sender messages within 5 min (Telegram).
                // In groups, "same sender" is keyed by the sender pubkey.
                const sameSender = activeGroup ? prev?.sender === m.sender : prev?.mine === m.mine;
                const grouped = !showDate && !!prev && sameSender && m.ts - prev.ts < 300;
                // Group message from someone else: label the sender above the run.
                const showSender = !!activeGroup && !m.mine && !grouped;
                const trigger = (
                  <button
                    style={S.reactTrigger}
                    title={zh ? '表情回應' : 'React'}
                    onClick={() => setPickerFor(pickerFor === m.id ? '' : m.id)}
                  >
                    ☺
                  </button>
                );
                return (
                  <div key={m.id}>
                    {showDate && (
                      <div style={S.dateSep}>
                        <span style={S.dateSepPill}>{dateLabel(m.ts, zh)}</span>
                      </div>
                    )}
                    {showSender && (
                      <div style={{ ...S.groupSender, color: colorFor(m.sender || '') }}>
                        {groupMemberName(m.sender || '', names)}
                      </div>
                    )}
                    <div style={{ ...S.row, justifyContent: m.mine ? 'flex-end' : 'flex-start', marginTop: grouped ? 2 : 8 }}>
                      {m.mine && trigger}
                      <div style={{ ...S.bubble, ...(m.mine ? S.bubbleMine : S.bubbleTheirs) }}>
                        {m.attachments?.map((a, k) => (
                          <AttachmentView
                            key={k}
                            att={a}
                            zh={zh}
                            onOpen={openAttachment}
                            onAudioUrl={fetchAudioUrl}
                            busy={busyAtt === a.blobId}
                          />
                        ))}
                        {m.text ? <span style={S.msgText}>{linkify(m.text)}</span> : null}
                        <span style={S.msgTime}>
                          {hhmm(m.ts)}
                          {m.mine && <MsgTick status={m.status} />}
                        </span>
                        {m.reactions && Object.keys(m.reactions).length > 0 && (
                          <div style={S.reactionRow}>
                            {Object.entries(m.reactions).map(([emoji, reactors]) => (
                              <button
                                key={emoji}
                                style={{ ...S.reactionChip, ...(reactors.includes(myPubHex) ? S.reactionChipMine : {}) }}
                                onClick={() => toggleReaction(m.id, emoji)}
                                title={reactors.includes(myPubHex) ? (zh ? '取消' : 'Remove') : (zh ? '回應' : 'React')}
                              >
                                <span>{emoji}</span>
                                {reactors.length > 1 && <span style={S.reactionCount}>{reactors.length}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {!m.mine && trigger}
                    </div>
                    {pickerFor === m.id && (
                      <div style={{ ...S.reactPaletteRow, justifyContent: m.mine ? 'flex-end' : 'flex-start' }}>
                        <div style={S.reactPalette}>
                          {REACTIONS.map((e) => (
                            <button key={e} style={S.reactPaletteBtn} onClick={() => toggleReaction(m.id, e)}>
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
                  if (e.target.value) notifyTyping();
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

      {showMembers && activeGroup && (
        <div style={S.overlay} onClick={() => setShowMembers(false)}>
          <div style={S.memberPanel} onClick={(e) => e.stopPropagation()}>
            <div style={S.memberPanelHead}>
              <span>{zh ? '群組成員' : 'Members'} · {activeGroup.members.length}</span>
              <button style={S.memberClose} onClick={() => setShowMembers(false)}>×</button>
            </div>
            <div style={S.memberList}>
              {activeGroup.members.map((m) => (
                <div key={m.pubkey} style={S.memberRow}>
                  <span style={{ ...S.avatar, width: 32, height: 32, fontSize: 11, background: colorFor(m.pubkey) }}>{m.pubkey.slice(0, 2)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.memberName}>
                      {m.pubkey === myPubHex ? (zh ? '你' : 'You') : groupMemberName(m.pubkey, names)}
                      {m.role === 'owner' && <span style={S.roleBadge}>{zh ? '群主' : 'owner'}</span>}
                    </div>
                    <code style={S.memberPub}>{short(m.pubkey)}</code>
                  </div>
                  {activeGroup.myRole === 'owner' && m.pubkey !== myPubHex && m.role !== 'owner' && (
                    <button style={S.kickBtn} onClick={() => kickGroupMember(m.pubkey)}>{zh ? '移除' : 'Remove'}</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
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

/** One-line conversation-list preview for a message whose body is an attachment. */
function attPreview(atts: WebAttachment[] | undefined, zh: boolean): string {
  if (!atts || !atts.length) return '';
  const t = atts[0].mediaType;
  if (t.startsWith('image/')) return zh ? '🖼 圖片' : '🖼 Photo';
  if (t.startsWith('audio/')) return zh ? '🎤 語音' : '🎤 Voice';
  if (t.startsWith('video/')) return zh ? '🎬 影片' : '🎬 Video';
  return zh ? '📎 檔案' : '📎 File';
}

/** Display name for a group member: a saved contact name, else a short pubkey. */
function groupMemberName(pubkey: string, names: Record<string, string>): string {
  return names[pubkey] || short(pubkey);
}

/** "Alice is typing…" / "Alice, Bob are typing…" for a group (empty if none). */
function groupTypingLabel(typers: Record<string, boolean>, names: Record<string, string>, zh: boolean): string {
  const who = Object.keys(typers).filter((p) => typers[p]);
  if (!who.length) return '';
  const shown = who.slice(0, 2).map((p) => groupMemberName(p, names));
  const more = who.length > 2 ? (zh ? ` 等 ${who.length} 人` : ` +${who.length - 2}`) : '';
  const verb = zh ? '正在輸入…' : who.length > 1 ? 'are typing…' : 'is typing…';
  return `${shown.join(zh ? '、' : ', ')}${more} ${verb}`;
}

/** Relative "last seen" label. */
function lastSeenLabel(ts: number, zh: boolean): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return zh ? '剛剛' : 'just now';
  if (diff < 3600) return zh ? `${Math.floor(diff / 60)} 分鐘前` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return zh ? `${Math.floor(diff / 3600)} 小時前` : `${Math.floor(diff / 3600)}h ago`;
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(zh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
}

/** Header status for a peer: typing → online → last seen → (null = show pubkey). */
function peerStatus(
  peer: string,
  typingPeers: Record<string, boolean>,
  presence: Record<string, { online: boolean; lastSeenTs: number | null }>,
  zh: boolean,
): { text: string; color: string } | null {
  if (typingPeers[peer]) return { text: zh ? '正在輸入…' : 'typing…', color: '#8AB4FF' };
  const p = presence[peer];
  if (!p) return null;
  if (p.online) return { text: zh ? '在線' : 'online', color: '#14F195' };
  if (p.lastSeenTs) {
    return { text: (zh ? '最後上線 ' : 'last seen ') + lastSeenLabel(p.lastSeenTs, zh), color: 'rgba(255,255,255,0.45)' };
  }
  return null;
}

/** Pure idempotent update of a message's reactions map (emoji → reactor set). */
function applyReactionTo(
  reactions: Record<string, string[]> | undefined,
  emoji: string, reactor: string, op: string,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(reactions || {})) next[k] = [...v];
  const set = new Set(next[emoji] || []);
  if (op === 'remove') set.delete(reactor);
  else set.add(reactor);
  const arr = [...set];
  if (arr.length) next[emoji] = arr;
  else delete next[emoji];
  return next;
}

/** Delivery tick for my sent messages: ⏳ sending · ✓ sent · ✓✓ delivered ·
 *  ✓✓(blue) read · ⚠ failed. */
function MsgTick({ status }: { status?: Msg['status'] }) {
  if (status === 'failed') return <span style={{ marginLeft: 4, color: '#FFB4A0' }}>⚠</span>;
  if (status === 'sending') return <span style={{ marginLeft: 4 }}>⏳</span>;
  if (status === 'read') return <span style={{ marginLeft: 4, color: '#8AB4FF', letterSpacing: -2 }}>✓✓</span>;
  if (status === 'delivered') return <span style={{ marginLeft: 4, letterSpacing: -2 }}>✓✓</span>;
  return <span style={{ marginLeft: 4 }}>✓</span>; // sent
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
 *  audio → inline voice player; other types → file chip (click to download). */
function AttachmentView({ att, zh, onOpen, onAudioUrl, busy }: {
  att: WebAttachment;
  zh: boolean;
  onOpen: (a: WebAttachment) => void;
  onAudioUrl: (a: WebAttachment) => Promise<string | null>;
  busy: boolean;
}) {
  const isImage = att.mediaType.startsWith('image/');
  const isAudio = att.mediaType.startsWith('audio/');
  const canFetch = !!att.blobId && !!att.fileKey;
  if (isAudio && canFetch) {
    return <VoicePlayer att={att} fetchUrl={onAudioUrl} zh={zh} />;
  }
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

// A voice message ships up to 96 waveform bars; downsample for the bubble width.
const VOICE_BARS = 32;
const DEFAULT_BARS = [0.3, 0.5, 0.4, 0.7, 0.6, 0.8, 0.5, 0.65, 0.4, 0.7,
  0.55, 0.6, 0.45, 0.6, 0.5, 0.72, 0.42, 0.58, 0.63, 0.38];

function downsampleBars(bars: number[], count: number): number[] {
  if (bars.length <= count) return bars;
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(bars[Math.floor((i * bars.length) / count)] || 0);
  return out;
}

function fmtDur(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Inline voice-message player: play/pause + waveform + duration. Downloads +
 *  decrypts the blob on first play (cached by the parent), then plays from a
 *  local object URL — audio/mp4 (the app's voice container) plays natively. */
function VoicePlayer({ att, fetchUrl, zh }: {
  att: WebAttachment;
  fetchUrl: (a: WebAttachment) => Promise<string | null>;
  zh: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const durationSec = Math.round((att.durationMs || 0) / 1000);
  const bars = downsampleBars(
    att.waveform && att.waveform.length ? att.waveform : DEFAULT_BARS,
    VOICE_BARS,
  );

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (!el.paused) { el.pause(); return; }
    if (el.src) { void el.play().catch(() => setFailed(true)); return; }
    setLoading(true);
    setFailed(false);
    const url = await fetchUrl(att);
    setLoading(false);
    if (!url) { setFailed(true); return; }
    el.src = url;
    void el.play().catch(() => setFailed(true));
  };

  const shownSec = playing && durationSec ? progress * durationSec : durationSec;

  return (
    <div style={VS.wrap}>
      <button style={VS.play} onClick={toggle} title={zh ? '播放語音' : 'Play voice'}>
        {loading ? '…' : failed ? '⚠' : playing ? '⏸' : '▶'}
      </button>
      <div style={VS.bars}>
        {bars.map((v, i) => (
          <span
            key={i}
            style={{
              ...VS.bar,
              height: `${Math.max(3, Math.round((v || 0) * 20))}px`,
              opacity: playing ? (i / bars.length <= progress ? 1 : 0.35) : 0.6,
            }}
          />
        ))}
      </div>
      <span style={VS.time}>{fmtDur(shownSec)}</span>
      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onError={() => { setFailed(true); setPlaying(false); }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration && Number.isFinite(el.duration)) setProgress(el.currentTime / el.duration);
        }}
      />
    </div>
  );
}

const VS: Record<string, CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', marginBottom: 2 },
  play: { width: 34, height: 34, flexShrink: 0, borderRadius: 17, border: 'none', background: 'rgba(255,255,255,0.92)', color: '#4B2FE0', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  bars: { display: 'flex', alignItems: 'center', gap: 2, height: 24 },
  bar: { width: 2, borderRadius: 2, background: '#fff' },
  time: { fontSize: 11, color: 'rgba(255,255,255,0.75)', minWidth: 30, textAlign: 'right' },
};

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
  headerActions: { marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 },
  headerBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', fontSize: 12.5, borderRadius: 8, padding: '5px 11px', cursor: 'pointer', whiteSpace: 'nowrap' },
  threadTitleWrap: { minWidth: 0 },
  threadTitle: { fontSize: 15, fontWeight: 600 },
  editHint: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  threadSub: { fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 260 },
  threadStatus: { fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 },
  messages: { flex: 1, overflowY: 'auto', padding: '10px 18px 16px', display: 'flex', flexDirection: 'column' },
  groupSender: { fontSize: 12, fontWeight: 600, margin: '4px 0 1px 4px' },
  dateSep: { display: 'flex', justifyContent: 'center', margin: '12px 0 6px' },
  dateSepPill: { fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '3px 10px' },
  row: { display: 'flex', width: '100%', alignItems: 'flex-end', gap: 4 },
  bubble: { maxWidth: '72%', padding: '7px 11px 5px', borderRadius: 16, fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word', display: 'flex', flexDirection: 'column' },
  bubbleMine: { background: '#7462F7', borderBottomRightRadius: 5 },
  bubbleTheirs: { background: 'rgba(255,255,255,0.09)', borderBottomLeftRadius: 5 },
  msgText: { whiteSpace: 'pre-wrap' },
  msgTime: { alignSelf: 'flex-end', fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  reactTrigger: { flexShrink: 0, width: 22, height: 22, borderRadius: 11, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1 },
  reactionRow: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionChip: { display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 10, border: '1px solid transparent', background: 'rgba(0,0,0,0.22)', color: '#fff', fontSize: 12, cursor: 'pointer', lineHeight: 1.6 },
  reactionChipMine: { background: 'rgba(138,180,255,0.28)', border: '1px solid rgba(138,180,255,0.55)' },
  reactionCount: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  reactPaletteRow: { display: 'flex', width: '100%', padding: '2px 0' },
  reactPalette: { display: 'flex', gap: 2, padding: '3px 5px', background: '#1b1030', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' },
  reactPaletteBtn: { width: 30, height: 30, borderRadius: 15, border: 'none', background: 'transparent', fontSize: 17, cursor: 'pointer', padding: 0, lineHeight: 1 },
  inputBar: { display: 'flex', alignItems: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' },
  input: { flex: 1, resize: 'none', maxHeight: 120, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, color: '#fff', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', lineHeight: 1.4 },
  sendBtn: { background: '#7462F7', color: '#fff', border: 'none', borderRadius: 18, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  attachBtn: { width: 40, height: 40, flexShrink: 0, borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  lightbox: {
    position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.9)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out',
  },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  memberPanel: {
    width: 'min(420px, 100%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
    background: '#150f22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, overflow: 'hidden',
  },
  memberPanelHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 15, fontWeight: 600,
  },
  memberClose: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 },
  memberList: { overflowY: 'auto', padding: '6px 0' },
  memberRow: { display: 'flex', alignItems: 'center', gap: 11, padding: '9px 18px' },
  memberName: { fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 },
  roleBadge: { fontSize: 10, fontWeight: 700, color: '#c9bdff', background: 'rgba(116,98,247,0.22)', padding: '1px 7px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  memberPub: { fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  kickBtn: { flexShrink: 0, background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.4)', color: '#FFB4A0', fontSize: 12, borderRadius: 8, padding: '5px 10px', cursor: 'pointer' },
  lightboxImg: { maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' },
  hideOnMobile: {}, // replaced by CSS below on mobile
};
