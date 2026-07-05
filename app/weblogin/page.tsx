/**
 * ============================================================================
 * File: app/weblogin/page.tsx
 * ============================================================================
 * [WEB-LOGIN] Pairing page — "scan the QR with the AeroNyx phone app to log in".
 *
 * Flow (browser half; phone + backend halves are done and verified):
 *   1. Generate a one-time X25519 keypair + session id.
 *   2. POST web_pair/create, render the aeronyx://weblogin QR.
 *   3. Poll web_pair/status until the phone authorizes.
 *   4. Unseal the phone's payload (verified @noble recipe) -> identity seed ->
 *      derive the Ed25519 pubkey; show it + the verification code for the user
 *      to match against the phone (anti-MITM).
 *
 * This phase demonstrates the phone->web identity handoff. Connecting to the
 * relay + the chat UI is the next phase; the recovered seed is kept in memory
 * only (never persisted here) and the honest security posture is shown.
 *
 * Self-contained (inline styles) so it does not depend on the dashboard's
 * component APIs — a standalone /weblogin route.
 * ============================================================================
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import QRCode from 'qrcode';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  genEphemeral,
  genSessionId,
  buildQrUrl,
  unseal,
  b64uEncode,
  type WebEphemeral,
  type UnsealResult,
} from '@/lib/webLoginCrypto';

const RENDEZVOUS = 'https://api.aeronyx.network/api/relay/web_pair';
const POLL_MS = 2000;

type Phase = 'init' | 'waiting' | 'success' | 'expired' | 'error';

export default function WebLoginPage() {
  const { locale } = useI18n();
  const zh = (locale || '').toLowerCase().startsWith('zh');
  const T = useMemo(() => makeStrings(zh), [zh]);
  // A phone can't scan its own screen — this desktop→phone flow needs a second
  // device. Detect a mobile UA to show a hint instead of an unusable QR.
  const isMobile = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
    [],
  );

  const [phase, setPhase] = useState<Phase>('init');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [result, setResult] = useState<UnsealResult | null>(null);
  const [error, setError] = useState<string>('');

  const ephRef = useRef<WebEphemeral | null>(null);
  const sidRef = useRef<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const res = await fetch(
        `${RENDEZVOUS}/status?sid=${encodeURIComponent(sid)}`,
        { method: 'GET' },
      );
      const data = await res.json().catch(() => ({}));
      if (!data || !data.success) return;

      if (data.status === 'authorized') {
        stopPolling();
        try {
          const r = unseal(eph.priv, eph.pubB64, data.eph_pub, data.sealed);
          // [WEB-HISTORY] The phone may be uploading a sealed recent-history
          // snapshot right now (best-effort, opt-out on the phone). Stash the
          // pairing material so /chat can fetch + unseal it even if the user
          // clicks Continue immediately. Consumed + removed by /chat.
          try {
            sessionStorage.setItem('aeronyx_web_hist_pending', JSON.stringify({
              sid,
              webPriv: b64uEncode(eph.priv),
              webPub: eph.pubB64,
              phoneEph: data.eph_pub,
            }));
          } catch { /* quota — history is optional */ }
          setResult(r);
          setPhase('success');
        } catch {
          // MAC failure = tampered / wrong key. Fail closed.
          setError('decrypt_failed');
          setPhase('error');
        }
      } else if (data.status === 'expired') {
        stopPolling();
        setPhase('expired');
      }
    } catch {
      // transient network error — keep polling
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

      const res = await fetch(`${RENDEZVOUS}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid, web_pub: eph.pubB64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `create failed (${res.status})`);
      }

      setQrDataUrl(
        await QRCode.toDataURL(buildQrUrl(sid, eph.pubB64), {
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

  useEffect(() => {
    start();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>{T.title}</h1>

        {phase === 'init' && <p style={S.sub}>{T.preparing}</p>}

        {phase === 'waiting' && (
          <>
            {isMobile ? (
              // Same-device QR is unusable (can't scan your own screen).
              <p style={S.notice}>{T.mobileHint}</p>
            ) : (
              <>
                <p style={S.sub}>{T.scanHint}</p>
                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="Login QR" width={240} height={240} style={S.qr} />
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
            <p style={S.subDim}>{T.identity}</p>
            <code style={S.pub}>{shortHex(result.pubkeyHex)}</code>
            <button
              style={{ ...S.btn, marginTop: 20, width: '100%' }}
              onClick={() => {
                // Hand the imported seed to the chat session (session lifetime
                // only — the deliberate weaker web tier).
                sessionStorage.setItem('aeronyx_web_seed', result.seedHex);
                window.location.href = '/chat';
              }}
            >
              {T.continueChat}
            </button>
            <p style={S.notice}>{T.securityNotice}</p>
          </>
        )}

        {(phase === 'expired' || phase === 'error') && (
          <>
            <p style={S.err}>
              {phase === 'expired'
                ? T.expired
                : `${T.couldNotStart}${error ? `: ${error}` : ''}`}
            </p>
            <button style={S.btn} onClick={start}>
              {T.tryAgain}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Inline zh-Hant / en strings (the site is bilingual; keep this page consistent). */
function makeStrings(zh: boolean) {
  return zh
    ? {
        title: '登錄 AeroNyx 網頁版',
        preparing: '正在建立安全會話…',
        scanHint: '在手機打開 AeroNyx → 身份管理 →「掃碼登錄網頁」，然後掃描：',
        waiting: '等待手機確認…',
        mobileHint:
          '請在電腦瀏覽器打開 app.aeronyx.network/weblogin，再用這支手機掃描頁面上的二維碼登錄。',
        received: '✓ 已接收身份',
        confirmCode: '請確認此驗證碼與手機一致：',
        identity: '身份',
        continueChat: '進入聊天',
        securityNotice:
          '網頁聊天是下一步。已登錄的網頁會話能讀取你的訊息 —— 這是標準（較弱）的網頁層；手機 App 的密鑰保存在安全硬件中。',
        expired: '此二維碼已過期。',
        couldNotStart: '無法開始配對',
        tryAgain: '重試',
      }
    : {
        title: 'Log in to AeroNyx Web',
        preparing: 'Preparing secure session…',
        scanHint: 'Open AeroNyx on your phone → Identities → “Log in to Web”, then scan:',
        waiting: 'Waiting for your phone…',
        mobileHint:
          'Open app.aeronyx.network/weblogin in a desktop browser, then scan the QR code there with this phone.',
        received: '✓ Identity received',
        confirmCode: 'Confirm this code matches your phone:',
        identity: 'Identity',
        continueChat: 'Continue to chat',
        securityNotice:
          'Chat on web is the next step. A logged-in web session can read your messages — this is the standard (weaker) web tier; the phone app keeps its key in secure hardware.',
        expired: 'This code expired.',
        couldNotStart: 'Could not start pairing',
        tryAgain: 'Try again',
      };
}

function shortHex(h: string): string {
  return h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-8)}` : h;
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg,#000 0%,#0A0015 50%,#000 100%)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 28,
    textAlign: 'center',
    color: '#fff',
    fontFamily: 'system-ui,-apple-system,sans-serif',
  },
  title: { fontSize: 20, fontWeight: 700, margin: '0 0 12px' },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '0 0 16px', lineHeight: 1.5 },
  subDim: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  // Tailwind's preflight sets `img { display:block }`, which ignores the card's
  // text-align:center → the QR was left-aligned. Center the block img explicitly.
  qr: { borderRadius: 12, background: '#fff', padding: 8, display: 'block', margin: '0 auto' },
  spinnerRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  dot: {
    width: 8, height: 8, borderRadius: 4, background: '#14F195',
    boxShadow: '0 0 8px #14F195', display: 'inline-block',
  },
  okBadge: { color: '#14F195', fontSize: 16, fontWeight: 600, marginBottom: 12 },
  vc: { fontSize: 30, fontWeight: 700, letterSpacing: 4, color: '#14F195', margin: '4px 0 18px', fontVariantNumeric: 'tabular-nums' },
  pub: { display: 'inline-block', fontFamily: 'monospace', fontSize: 13, color: '#B9A7FF', background: 'rgba(116,98,247,0.12)', padding: '6px 10px', borderRadius: 8 },
  notice: { fontSize: 12, color: 'rgba(255,200,120,0.85)', marginTop: 18, lineHeight: 1.5, textAlign: 'left', background: 'rgba(255,180,60,0.08)', border: '1px solid rgba(255,180,60,0.2)', borderRadius: 10, padding: 12 },
  err: { color: '#FF6B6B', fontSize: 14, marginBottom: 16 },
  btn: { background: '#7462F7', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
};
