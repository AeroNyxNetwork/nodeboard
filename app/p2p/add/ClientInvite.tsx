/**
 * ============================================
 * AeroNyx P2P Invite Landing — client UI + open-app logic
 * ============================================
 * File Path: app/p2p/add/ClientInvite.tsx
 *
 * Creation Reason:
 *   Client half of /p2p/add. Reads pubkey/name from the query, shows the inviter +
 *   identity fingerprint + a privacy reassurance, and offers "Open in AeroNyx"
 *   (custom-scheme deep link, works even before AASA verifies) with a store fallback.
 *   Self-contained styling (no dependency on the dashboard design tokens) since this is
 *   a standalone full-screen funnel page.
 *
 * TODO before launch: set APP_STORE_ID to the numeric App Store id.
 *
 * Last Modified: v1.0.0 — initial (Universal Links)
 * ============================================
 */
'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

// TODO: set numeric App Store id → https://apps.apple.com/app/id<APP_STORE_ID>
const APP_STORE_ID = 'APP_STORE_ID';
// Until the numeric id is set, fall back to the site so the iOS button is never a dead link.
const APP_STORE_URL =
  APP_STORE_ID === 'APP_STORE_ID'
    ? 'https://aeronyx.network'
    : `https://apps.apple.com/app/id${APP_STORE_ID}`;
const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.amaterasu.aeronyx';

const C = {
  bg: '#0A0A0F',
  card: '#141420',
  line: 'rgba(255,255,255,.08)',
  purple: '#7462F7',
  green: '#14F195',
  hi: '#fff',
  med: 'rgba(255,255,255,.72)',
  low: 'rgba(255,255,255,.45)',
};

function isHex64(s: string) {
  return /^[0-9a-f]{64}$/.test(s);
}

export default function ClientInvite() {
  const sp = useSearchParams();
  const pubkey = (sp.get('pubkey') || '').trim().toLowerCase();
  const name = (sp.get('name') || '').trim();
  const valid = isHex64(pubkey);

  const zh = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      (navigator.language || '').toLowerCase().startsWith('zh'),
    []
  );

  const t = zh
    ? {
        title: name ? `${name} 邀请你私密聊天` : '邀请你私密聊天',
        sub: '用 AeroNyx 打开 — 无需手机号、邮箱或账户。',
        fpLabel: '对方身份指纹',
        privacy: '不暴露手机号、邮箱或钱包地址',
        open: '在 AeroNyx 中打开',
        get: '获取 AeroNyx',
        foot: '已安装？应会自动打开。',
      }
    : {
        title: name ? `${name} invites you to chat privately` : "You've been invited to chat privately",
        sub: 'Open in AeroNyx — no phone number, no email, no account.',
        fpLabel: 'Their identity fingerprint',
        privacy: 'No phone, email, or wallet address is shared',
        open: 'Open in AeroNyx',
        get: 'Get AeroNyx',
        foot: 'Already installed? It should open automatically.',
      };

  const rows = useMemo(() => {
    if (!valid) return [] as string[];
    const up = pubkey.toUpperCase();
    const r: string[] = [];
    for (let i = 0; i < up.length; i += 8) r.push(up.slice(i, i + 8));
    return r;
  }, [pubkey, valid]);

  const appLink = useMemo(() => {
    const qs = sp.toString();
    return `aeronyx://p2p/add${qs ? `?${qs}` : ''}`;
  }, [sp]);

  const store = useMemo(() => {
    if (typeof navigator === 'undefined') return APP_STORE_URL;
    return /android/i.test(navigator.userAgent) ? PLAY_URL : APP_STORE_URL;
  }, []);

  function openApp() {
    const t0 = Date.now();
    // If the app opens, the tab is backgrounded and this timer is delayed → don't redirect.
    setTimeout(() => {
      if (Date.now() - t0 < 1600) window.location.href = store;
    }, 1200);
    window.location.href = appLink;
  }

  // Best-effort auto-open on mobile; the button is the reliable path.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !valid) return;
    if (/iphone|ipad|ipod|android/i.test(navigator.userAgent)) {
      const id = setTimeout(() => {
        window.location.href = appLink;
      }, 350);
      return () => clearTimeout(id);
    }
  }, [appLink, valid]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 24,
        maxWidth: 440,
        margin: '0 auto',
        textAlign: 'center',
        background: C.bg,
        color: C.hi,
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: `linear-gradient(135deg, ${C.purple}, #9b8cff)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 26,
          boxShadow: '0 8px 28px rgba(116,98,247,.4)',
        }}
      >
        A
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 0', lineHeight: 1.35 }}>
        {t.title}
      </h1>
      <p style={{ color: C.med, fontSize: 14, lineHeight: 1.5, margin: 0 }}>{t.sub}</p>

      <div
        style={{
          width: '100%',
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 18,
          padding: 18,
        }}
      >
        <div
          style={{
            color: C.low,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '.9px',
            textTransform: 'uppercase',
          }}
        >
          {t.fpLabel}
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
            color: C.green,
            fontSize: 13,
            lineHeight: 1.7,
            wordBreak: 'break-all',
          }}
        >
          {valid ? (
            <>
              {rows.slice(0, 4).join(' ')}
              <br />
              {rows.slice(4).join(' ')}
            </>
          ) : (
            '—'
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            color: C.low,
            fontSize: 12,
            marginTop: 12,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2" opacity="0.8">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>{t.privacy}</span>
        </div>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={openApp}
          style={{
            height: 52,
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: C.purple,
            color: '#fff',
          }}
        >
          {t.open}
        </button>
        <a
          href={store}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            height: 52,
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            color: C.hi,
            border: `1px solid ${C.line}`,
          }}
        >
          {t.get}
        </a>
      </div>

      <p style={{ color: C.low, fontSize: 12 }}>{t.foot}</p>
    </div>
  );
}
