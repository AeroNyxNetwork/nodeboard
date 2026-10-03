/**
 * ============================================
 * File: components/common/NetworkMark.tsx
 * ============================================
 * [REFERRAL-COMMISSION 2026-10-03 by Claude] Chain marks (inline SVG, no
 * network fetch), moved out of app/topup/page.tsx so the withdrawal page
 * shows the same marks. A Next.js page module may not export helpers.
 * ============================================
 */
import type { PaymentNetworkId } from '@/lib/membershipPayments';

// [TOPUP-POLISH 2026-10-03 by Claude] Simplified marks of the four supported
// chains, drawn inline so the page stays one self-contained file (no image
// requests, no third-party CDN). Brand colours; decorative — the name is
// always printed beside it.
export default function NetworkMark({ network, className = 'h-8 w-8' }: { network: PaymentNetworkId; className?: string }) {
  switch (network) {
    case 'solana':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="nm-sol" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#9945FF" />
              <stop offset="1" stopColor="#14F195" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="16" fill="#111014" />
          <path fill="url(#nm-sol)" d="M10.2 20.6h12.6l-2.6 2.6H7.6l2.6-2.6Zm0-11.8h12.6l-2.6 2.6H7.6l2.6-2.6Zm12.6 5.9H10.2l-2.6 2.6h12.6l2.6-2.6Z" />
        </svg>
      );
    case 'bsc':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
          <path fill="#fff" d="M16 7.5l2.6 2.6-6.5 6.5-2.6-2.6L16 7.5Zm4.5 4.5 2.6 2.6-9.1 9.1-2.6-2.6 9.1-9.1Zm-9 0 2.6 2.6-2.6 2.6L8.9 14.6 11.5 12Zm9 4.5 2.6 2.6-6.5 6.5-2.6-2.6 6.5-6.5Z" />
        </svg>
      );
    case 'ethereum':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <path fill="#fff" fillOpacity=".65" d="M16 5.5v7.8l6.6 2.9L16 5.5Z" />
          <path fill="#fff" d="M16 5.5 9.4 16.2l6.6-2.9V5.5Z" />
          <path fill="#fff" fillOpacity=".65" d="M16 21.3v5.2l6.6-9.2-6.6 4Z" />
          <path fill="#fff" d="M16 26.5v-5.2l-6.6-4 6.6 9.2Z" />
          <path fill="#fff" fillOpacity=".25" d="m16 20.1 6.6-3.9-6.6-2.9v6.8Z" />
          <path fill="#fff" fillOpacity=".55" d="m9.4 16.2 6.6 3.9v-6.8l-6.6 2.9Z" />
        </svg>
      );
    case 'tron':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#EF0027" />
          <path fill="#fff" d="M8.2 8.6 22.6 11l2.5 3.1-9.4 11.4L8.2 8.6Zm2.3 1.9 4.9 12.2.6-6.6-5.5-5.6Zm6.9 5.8-.6 5.9 6.1-7.4-5.5 1.5Zm-5.1-5.3 5.2 5.3 4.6-1.3-9.8-4Z" />
        </svg>
      );
    default:
      return <span className={`${className} rounded-full bg-white/10`} aria-hidden="true" />;
  }
}
