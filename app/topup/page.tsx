/**
 * ============================================================================
 * File: app/topup/page.tsx
 * ============================================================================
 * [MEMBERSHIP] Membership top-up landing for app.aeronyx.network/topup.
 *
 * The app opens this URL as `/topup?code=NYX-XXXX-XXXX-XXXX` (the wallet's
 * membership code) when the user taps "獲取更多積分" in the subscription screen.
 *
 * ⚠️ Deliberately NOT a checkout. Server-side payment is disabled
 * (MEMBERSHIP_PAYMENT_ENABLED=false) while the Apple IAP / external-link
 * decision is pending — selling digital membership from an unapproved path
 * risks App Store rejection. So this page ONLY confirms the account (echoes the
 * code) and explains membership; it never lists a price or a buy button. When
 * ops enables payment, the checkout flow can be added here behind that flag.
 * ============================================================================
 */
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';

export default function TopUpPage() {
  const { locale } = useI18n();
  const zh = (locale || '').toLowerCase().startsWith('zh');

  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Read the membership code from the URL on the client (avoids the
  // useSearchParams Suspense boundary that would otherwise fail the build).
  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('code') || '';
      // Only accept a plausible membership code (NYX-XXXX-XXXX-XXXX-ish).
      const c = raw.trim().toUpperCase();
      if (/^[A-Z0-9-]{6,40}$/.test(c)) setCode(c);
    } catch {
      /* no query params — show the generic state */
    }
  }, []);

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const benefits = zh
    ? [
        { icon: '🛡️', title: '隱私網絡', desc: '更高額度的加密中繼與隧道' },
        { icon: '✨', title: 'AI 助手', desc: '每日更高的 AI 使用上限' },
        { icon: '☁️', title: '加密存儲', desc: '更大的端到端加密附件空間' },
      ]
    : [
        { icon: '🛡️', title: 'Privacy network', desc: 'Higher encrypted relay & tunnel allowance' },
        { icon: '✨', title: 'AI assistant', desc: 'A higher daily AI usage limit' },
        { icon: '☁️', title: 'Encrypted storage', desc: 'More space for E2E-encrypted attachments' },
      ];

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.brand}>AERONYX</div>

        <h1 style={S.title}>{zh ? '會員充值' : 'Membership Top-Up'}</h1>
        <p style={S.lede}>
          {zh
            ? '積分用於兌換 AeroNyx 會員，解鎖隱私網絡、AI 與加密存儲的更高額度。'
            : 'Points redeem AeroNyx membership — unlocking higher limits on the privacy network, AI, and encrypted storage.'}
        </p>

        {/* Account confirmation (echo the membership code) */}
        {code ? (
          <div style={S.codeCard}>
            <div style={S.codeLabel}>{zh ? '此充值對應賬號' : 'Topping up for account'}</div>
            <button style={S.codeValue} onClick={copyCode} title={zh ? '點擊複製' : 'Click to copy'}>
              <code style={S.codeText}>{code}</code>
              <span style={S.copyHint}>{copied ? (zh ? '已複製' : 'Copied') : (zh ? '複製' : 'Copy')}</span>
            </button>
          </div>
        ) : (
          <div style={S.noCode}>
            {zh
              ? '請從 AeroNyx App 的「會員 → 獲取更多積分」進入此頁,以帶上你的會員碼。'
              : 'Open this page from the AeroNyx app (Membership → Get more points) so your membership code is included.'}
          </div>
        )}

        {/* Benefits */}
        <div style={S.benefits}>
          {benefits.map((b) => (
            <div key={b.title} style={S.benefit}>
              <span style={S.benefitIcon}>{b.icon}</span>
              <div>
                <div style={S.benefitTitle}>{b.title}</div>
                <div style={S.benefitDesc}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Honest status — no price, no buy button (payment intentionally off) */}
        <div style={S.status}>
          <span style={S.statusDot} />
          <div>
            <div style={S.statusTitle}>{zh ? '網頁充值即將開放' : 'Web top-up is coming soon'}</div>
            <div style={S.statusDesc}>
              {zh
                ? '目前請在 AeroNyx App 內管理你的會員與積分。開放後這裡即可直接充值。'
                : 'For now, manage your membership and points inside the AeroNyx app. You’ll be able to top up here once it opens.'}
            </div>
          </div>
        </div>

        <div style={S.footer}>
          {zh ? '端到端加密 · 你的錢包地址不會出現在此頁' : 'End-to-end encrypted · your wallet address never appears on this page'}
        </div>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(900px 460px at 82% -6%, rgba(116,98,247,0.16), transparent 60%), #0a0713',
    color: '#ece8f5',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
    display: 'flex',
    justifyContent: 'center',
    padding: '0 22px 72px',
  },
  wrap: { width: '100%', maxWidth: 560, paddingTop: 64 },
  brand: {
    fontFamily: 'ui-monospace,"SF Mono",Menlo,monospace',
    fontSize: 13,
    letterSpacing: '0.42em',
    color: '#7462f7',
    fontWeight: 600,
    marginBottom: 26,
  },
  title: { fontSize: 32, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 12px', textWrap: 'balance' },
  lede: { fontSize: 16, lineHeight: 1.55, color: '#9c92b6', margin: '0 0 28px', maxWidth: '52ch' },

  codeCard: {
    background: 'linear-gradient(180deg, rgba(116,98,247,0.16), rgba(116,98,247,0.04))',
    border: '1px solid rgba(116,98,247,0.42)',
    borderRadius: 16,
    padding: '16px 18px',
    marginBottom: 22,
  },
  codeLabel: {
    fontSize: 11,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: '#8f83c4',
    marginBottom: 10,
    fontFamily: 'ui-monospace,"SF Mono",Menlo,monospace',
  },
  codeValue: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    background: 'rgba(0,0,0,0.28)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '11px 14px',
    cursor: 'pointer',
  },
  codeText: { fontFamily: 'ui-monospace,"SF Mono",Menlo,monospace', fontSize: 16, color: '#c9bdff', letterSpacing: '0.04em', wordBreak: 'break-all', textAlign: 'left' },
  copyHint: { fontSize: 12, color: '#8f83c4', flexShrink: 0 },

  noCode: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '16px 18px',
    fontSize: 14.5,
    lineHeight: 1.55,
    color: '#b7afce',
    marginBottom: 22,
  },

  benefits: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 22, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' },
  benefit: { display: 'flex', alignItems: 'center', gap: 13, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  benefitIcon: { fontSize: 20, width: 24, textAlign: 'center', flexShrink: 0 },
  benefitTitle: { fontSize: 14.5, fontWeight: 600 },
  benefitDesc: { fontSize: 13, color: '#9c92b6', marginTop: 2 },

  status: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    background: 'rgba(255,184,0,0.07)',
    border: '1px solid rgba(255,184,0,0.28)',
    borderRadius: 14,
    padding: '15px 17px',
  },
  statusDot: { width: 9, height: 9, borderRadius: 5, background: '#FFB800', boxShadow: '0 0 8px #FFB800', marginTop: 5, flexShrink: 0 },
  statusTitle: { fontSize: 15, fontWeight: 600, color: '#ffd679' },
  statusDesc: { fontSize: 13.5, lineHeight: 1.5, color: '#b7afce', marginTop: 4 },

  footer: { marginTop: 30, fontSize: 12, color: '#645b83', textAlign: 'center' },
};
