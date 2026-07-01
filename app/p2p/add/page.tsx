/**
 * ============================================
 * AeroNyx P2P Invite Landing (Universal Link fallback)
 * ============================================
 * File Path: app/p2p/add/page.tsx
 *
 * Creation Reason:
 *   Web fallback for AeroNyx invite Universal Links. When the app is installed and
 *   Associated Domains / App Links are verified, iOS/Android open the app directly and
 *   this page never renders. For everyone else (no app, or desktop) this page turns a
 *   shared invite into an install -> chat funnel — the core of "every chat is distribution".
 *
 * Route: /p2p/add?pubkey=<64hex>&name=<url-encoded>
 *   Must match the app link path + public/.well-known/apple-app-site-association ("/p2p/*").
 *
 * Last Modified: v1.0.0 — initial (Universal Links)
 * ============================================
 */
import { Suspense } from 'react';
import ClientInvite from './ClientInvite';

// Depends on query params; skip static prerender.
export const dynamic = 'force-dynamic';

export default function P2PAddPage() {
  return (
    <Suspense fallback={null}>
      <ClientInvite />
    </Suspense>
  );
}
