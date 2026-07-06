/**
 * ============================================================================
 * File: app/oplogin/page.tsx
 * ============================================================================
 * [OP-LOGIN] "Log in to the operator dashboard by scanning with the AeroNyx app."
 *
 * Mirror of app/weblogin/page.tsx, but instead of importing a chat identity it
 * receives an authenticated DASHBOARD SESSION:
 *   1. gen a one-time X25519 keypair + session id.
 *   2. POST web_pair/create (reuses the chat rendezvous — it only relays opaque
 *      ciphertext), render an aeronyx://oplogin QR.
 *   3. Poll web_pair/status. The phone signs the dashboard login nonce with its
 *      WALLET (key never leaves the phone), does the full wallet-login, and
 *      seals the resulting {api_key, wallet_address, wallet_type} to our
 *      ephemeral key.
 *   4. Unseal, show the wallet + a verification code to match against the phone,
 *      then write the session to localStorage exactly like authStore.login does,
 *      call authStore.initialize(), and enter the dashboard.
 *
 * Security: the wallet private key stays on the phone (operator auth is
 * signature-only, no ECDH) — only a bearer session crosses the wire, sealed
 * end-to-end. The 6-digit code defeats a QR-swap MITM (which here could log an
 * attacker into the operator account).
 * ============================================================================
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAuthStore } from '@/stores/authStore';
import { STORAGE_KEYS } from '@/lib/constants';
import {
  genEphemeral, genSessionId, buildOpQrUrl, unsealOpSession,
  type WebEphemeral, type OpSession,
} from '@/lib/oploginCrypto';

const RENDEZVOUS = 'https://api.aeronyx.network/api/relay/web_pair';
const POLL_MS = 2000;

type Phase = 'init' | 'waiting' | 'success' | 'expired' | 'error';

/** fetch with a hard timeout — a stalled request must never wedge the page on
 *  "Preparing…" (create) or silently freeze the poll loop. */
async function tfetch(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

export default function OpLoginPage() {
  const { locale } = useI18n();
  const router = useRouter();
  const zh = (locale || '').toLowerCase().startsWith('zh');
  const T = useMemo(() => makeStrings(zh), [zh]);
  const isMobile = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
    [],
  );

  const [phase, setPhase] = useState<Phase>('init');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [result, setResult] = useState<OpSession | null>(null);
  const [error, setError] = useState<string>('');

  const ephRef = useRef<WebEphemeral | null>(null);
  const sidRef = useRef<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<() => void>(() => {}); // set below — lets poll auto-refresh without a dep cycle

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    const eph = ephRef.current;
    const sid = sidRef.current;
    if (!eph || !sid) return;
    try {
      const res = await tfetch(`${RENDEZVOUS}/status?sid=${encodeURIComponent(sid)}`, { method: 'GET' }, 10000);
      const data = await res.json().catch(() => ({}));
      if (!data || !data.success) return;

      if (data.status === 'authorized') {
        stopPolling();
        const r = unsealOpSession(eph.priv, eph.pubB64, data.eph_pub, data.sealed);
        if (r) {
          setResult(r);
          setPhase('success');
        } else {
          setError('decrypt_failed'); // MAC failure = tampered / wrong key → fail closed
          setPhase('error');
        }
      } else if (data.status === 'expired') {
        // The rendezvous session lapsed before a scan — mint a fresh QR silently
        // instead of dead-ending on "expired". start() resets everything.
        stopPolling();
        startRef.current();
      }
    } catch {
      // transient network/timeout error — keep polling
    }
  }, [stopPolling]);

  const start = useCallback(async () => {
    stopPolling();
    setResult(null);
    setError('');
    setPhase('init');
    try {
      const eph = genEphemeral();
      const sid = genSessionId();
      ephRef.current = eph;
      sidRef.current = sid;

      const res = await tfetch(`${RENDEZVOUS}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid, web_pub: eph.pubB64 }),
      }, 15000);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `create failed (${res.status})`);
      }

      setQrDataUrl(
        await QRCode.toDataURL(buildOpQrUrl(sid, eph.pubB64), {
          margin: 1,
          width: 240,
          color: { dark: '#000000', light: '#FFFFFF' },
        }),
      );
      setPhase('waiting');
      pollRef.current = setInterval(poll, POLL_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
      setPhase('error');
    }
  }, [stopPolling, poll]);

  useEffect(() => { startRef.current = start; }, [start]);

  useEffect(() => {
    start();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterDashboard = useCallback(() => {
    if (!result) return;
    // Write the session exactly like authStore.login's Step 4, then let the
    // store re-read it — the dashboard's auth gate flips to authenticated.
    localStorage.setItem(STORAGE_KEYS.API_KEY, result.apiKey);
    localStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, result.walletAddress);
    localStorage.setItem(STORAGE_KEYS.WALLET_TYPE, result.walletType);
    useAuthStore.getState().initialize();
    router.push('/dashboard');
  }, [result, router]);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>{T.title}</h1>

        {phase === 'init' && <p style={S.sub}>{T.preparing}</p>}

        {phase === 'waiting' && (
          <>
            {isMobile ? (
              <p style={S.notice}>{T.mobileHint}</p>
            ) : (
              <>
                <p style={S.sub}>{T.scanHint}</p>
                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="Operator login QR" width={240} height={240} style={S.qr} />
                )}
                <div style={S.spinnerRow}>
                  <span style={S.dot} />
                  <span style={S.subDim}>{T.waiting}</span>
                </div>
              </>
            )}
          </>
        )}

        {phase === 'success' && result && (
          <>
            <div style={S.okBadge}>{T.received}</div>
            <p style={S.sub}>{T.confirmCode}</p>
            <div style={S.vc}>{result.verificationCode.split('').join(' ')}</div>
            <p style={S.subDim}>{T.wallet}</p>
            <code style={S.pub}>{shortAddr(result.walletAddress)}</code>
            <button style={{ ...S.btn, marginTop: 20, width: '100%' }} onClick={enterDashboard}>
              {T.enter}
            </button>
            <p style={S.notice}>{T.securityNotice}</p>
          </>
        )}

        {(phase === 'expired' || phase === 'error') && (
          <>
            <p style={S.err}>
              {phase === 'expired' ? T.expired : `${T.couldNotStart}${error ? `: ${error}` : ''}`}
            </p>
            <button style={S.btn} onClick={start}>{T.tryAgain}</button>
          </>
        )}
      </div>
    </div>
  );
}

function makeStrings(zh: boolean) {
  return zh
    ? {
        title: '用手機登錄運營商後台',
        preparing: '正在建立安全會話…',
        scanHint: '在手機打開 AeroNyx →「用手機登錄後台」，然後掃描：',
        waiting: '等待手機確認…',
        mobileHint: '請在電腦瀏覽器打開 app.aeronyx.network/oplogin，再用這支手機掃描頁面上的二維碼。',
        received: '✓ 已接收會話',
        confirmCode: '請確認此驗證碼與手機一致：',
        wallet: '錢包地址',
        enter: '進入運營商後台',
        securityNotice:
          '私鑰不離開手機 —— 手機只是遠程簽名,網頁拿到的是一個登錄會話(端到端加密傳輸)。此會話能管理你的節點,請只在你信任的裝置上授權。',
        expired: '此二維碼已過期。',
        couldNotStart: '無法開始配對',
        tryAgain: '重試',
      }
    : {
        title: 'Log in to the operator dashboard',
        preparing: 'Preparing secure session…',
        scanHint: 'Open AeroNyx on your phone → “Log in to dashboard”, then scan:',
        waiting: 'Waiting for your phone…',
        mobileHint: 'Open app.aeronyx.network/oplogin in a desktop browser, then scan the QR with this phone.',
        received: '✓ Session received',
        confirmCode: 'Confirm this code matches your phone:',
        wallet: 'Wallet',
        enter: 'Enter dashboard',
        securityNotice:
          'Your private key never leaves the phone — it signs remotely and the browser only receives a login session (transferred end-to-end encrypted). This session can manage your nodes; only authorize on a device you trust.',
        expired: 'This code expired.',
        couldNotStart: 'Could not start pairing',
        tryAgain: 'Try again',
      };
}

function shortAddr(a: string): string {
  return a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-8)}` : a;
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#000 0%,#0A0A0F 50%,#000 100%)', padding: 24 },
  card: { width: '100%', maxWidth: 380, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, textAlign: 'center', color: '#fff', fontFamily: 'system-ui,-apple-system,sans-serif' },
  title: { fontSize: 20, fontWeight: 700, margin: '0 0 12px' },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '0 0 16px', lineHeight: 1.5 },
  subDim: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  qr: { borderRadius: 12, background: '#fff', padding: 8, display: 'block', margin: '0 auto' },
  spinnerRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, background: '#14F195', boxShadow: '0 0 8px #14F195', display: 'inline-block' },
  okBadge: { color: '#14F195', fontSize: 16, fontWeight: 600, marginBottom: 12 },
  vc: { fontSize: 30, fontWeight: 700, letterSpacing: 4, color: '#14F195', margin: '4px 0 18px', fontVariantNumeric: 'tabular-nums' },
  pub: { display: 'inline-block', fontFamily: 'monospace', fontSize: 13, color: '#C9A9FF', background: 'rgba(138,43,226,0.14)', padding: '6px 10px', borderRadius: 8 },
  notice: { fontSize: 12, color: 'rgba(255,200,120,0.85)', marginTop: 18, lineHeight: 1.5, textAlign: 'left', background: 'rgba(255,180,60,0.08)', border: '1px solid rgba(255,180,60,0.2)', borderRadius: 10, padding: 12 },
  err: { color: '#FF6B6B', fontSize: 14, marginBottom: 16 },
  btn: { background: '#8A2BE2', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
};
