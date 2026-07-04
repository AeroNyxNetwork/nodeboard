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

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import QRCode from 'qrcode';
import {
  genEphemeral,
  genSessionId,
  buildQrUrl,
  unseal,
  type WebEphemeral,
  type UnsealResult,
} from '@/lib/webLoginCrypto';

const RENDEZVOUS = 'https://api.aeronyx.network/api/relay/web_pair';
const POLL_MS = 2000;

type Phase = 'init' | 'waiting' | 'success' | 'expired' | 'error';

export default function WebLoginPage() {
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
        <h1 style={S.title}>Log in to AeroNyx Web</h1>

        {phase === 'init' && <p style={S.sub}>Preparing secure session…</p>}

        {phase === 'waiting' && (
          <>
            <p style={S.sub}>
              Open AeroNyx on your phone → Identities → “Log in to Web”, then scan:
            </p>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Login QR" width={240} height={240} style={S.qr} />
            )}
            <div style={S.spinnerRow}>
              <span style={S.dot} />
              <span style={S.subDim}>Waiting for your phone…</span>
            </div>
          </>
        )}

        {phase === 'success' && result && (
          <>
            <div style={S.okBadge}>✓ Identity received</div>
            <p style={S.sub}>Confirm this code matches your phone:</p>
            <div style={S.vc}>{result.verificationCode.split('').join(' ')}</div>
            <p style={S.subDim}>Identity</p>
            <code style={S.pub}>{shortHex(result.pubkeyHex)}</code>
            <p style={S.notice}>
              Chat on web is the next step. A logged-in web session can read your
              messages — this is the standard (weaker) web tier; the phone app
              keeps its key in secure hardware.
            </p>
          </>
        )}

        {(phase === 'expired' || phase === 'error') && (
          <>
            <p style={S.err}>
              {phase === 'expired'
                ? 'This code expired.'
                : `Could not start pairing${error ? `: ${error}` : ''}.`}
            </p>
            <button style={S.btn} onClick={start}>
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
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
  qr: { borderRadius: 12, background: '#fff', padding: 8 },
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
