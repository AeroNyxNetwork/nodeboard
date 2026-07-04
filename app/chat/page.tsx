/**
 * ============================================================================
 * File: app/chat/page.tsx
 * ============================================================================
 * [WEB-LOGIN / CHAT] Web chat — phase 1: connect to the relay as the imported
 * identity and show live connection status.
 *
 * The identity seed is handed here from /weblogin via sessionStorage (session
 * lifetime only — the deliberate weaker web tier). If no identity is present
 * the page bounces back to /weblogin.
 *
 * Sending/receiving messages + the conversation UI are the next phases; this
 * page establishes the authenticated relay session they build on. Verified:
 * the relay returns auth_ack for this identity.
 * ============================================================================
 */
'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { RelayClient } from '@/lib/relayClient';

const SEED_KEY = 'aeronyx_web_seed';

type Status = 'loading' | 'connecting' | 'connected' | 'reconnecting' | 'authfail';

export default function ChatPage() {
  const { locale } = useI18n();
  const zh = (locale || '').toLowerCase().startsWith('zh');
  const [status, setStatus] = useState<Status>('loading');
  const [pubHex, setPubHex] = useState<string>('');
  const clientRef = useRef<RelayClient | null>(null);

  useEffect(() => {
    const seed =
      typeof window !== 'undefined' ? sessionStorage.getItem(SEED_KEY) : null;
    if (!seed) {
      window.location.href = '/weblogin';
      return;
    }
    let client: RelayClient;
    try {
      client = new RelayClient(seed);
    } catch {
      window.location.href = '/weblogin';
      return;
    }
    clientRef.current = client;
    setPubHex(client.pubHex);
    setStatus('connecting');
    client.on('connected', () => setStatus('connected'));
    client.on('authfail', () => setStatus('authfail'));
    client.on('closed', () =>
      setStatus((s) => (s === 'connected' ? 'reconnecting' : s)),
    );
    client.connect();
    return () => client.close();
  }, []);

  const logout = () => {
    clientRef.current?.close();
    sessionStorage.removeItem(SEED_KEY);
    window.location.href = '/weblogin';
  };

  const statusText = useMemo(() => {
    const map: Record<Status, [string, string]> = {
      loading: ['載入中…', 'Loading…'],
      connecting: ['連接中繼中…', 'Connecting to relay…'],
      connected: ['已連接中繼', 'Connected to relay'],
      reconnecting: ['重新連接中…', 'Reconnecting…'],
      authfail: ['認證失敗', 'Authentication failed'],
    };
    const [z, e] = map[status];
    return zh ? z : e;
  }, [status, zh]);

  const dotColor =
    status === 'connected'
      ? '#14F195'
      : status === 'authfail'
        ? '#FF6B6B'
        : '#FFB800';

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.headerLeft}>
          <span style={{ ...S.dot, background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
          <span style={S.status}>{statusText}</span>
        </div>
        <button style={S.logout} onClick={logout}>
          {zh ? '登出' : 'Log out'}
        </button>
      </header>

      <div style={S.body}>
        <div style={S.card}>
          <div style={S.badge}>{zh ? '✓ 已作為你的身份登錄' : '✓ Signed in as your identity'}</div>
          <p style={S.sub}>{zh ? '身份' : 'Identity'}</p>
          <code style={S.pub}>{shortHex(pubHex)}</code>
          <p style={S.notice}>
            {zh
              ? '網頁已用你的身份連上加密中繼。聊天列表與收發訊息是下一步；已登錄的網頁會話能讀取你的訊息（標準較弱的網頁層）。'
              : 'The web is connected to the encrypted relay as your identity. The conversation list and messaging are the next step; a logged-in web session can read your messages (the standard, weaker web tier).'}
          </p>
        </div>
      </div>
    </div>
  );
}

function shortHex(h: string): string {
  return h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-8)}` : h || '—';
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg,#000,#0A0015,#000)', color: '#fff', fontFamily: 'system-ui,-apple-system,sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, display: 'inline-block' },
  status: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  logout: { background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '6px 14px', fontSize: 13, cursor: 'pointer' },
  body: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, textAlign: 'center' },
  badge: { color: '#14F195', fontSize: 16, fontWeight: 600, marginBottom: 14 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '0 0 4px' },
  pub: { display: 'inline-block', fontFamily: 'monospace', fontSize: 13, color: '#B9A7FF', background: 'rgba(116,98,247,0.12)', padding: '6px 10px', borderRadius: 8 },
  notice: { fontSize: 12, color: 'rgba(255,200,120,0.85)', marginTop: 20, lineHeight: 1.6, textAlign: 'left', background: 'rgba(255,180,60,0.08)', border: '1px solid rgba(255,180,60,0.2)', borderRadius: 10, padding: 12 },
};
