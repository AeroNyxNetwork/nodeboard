/**
 * ============================================
 * AeroNyx Root Page - Redirect to Dashboard
 * ============================================
 * File Path: app/page.tsx
 *
 * Modification Reason: Removed landing page, now redirects directly to dashboard.
 *   Authentication is handled by the dashboard layout via a login modal.
 * Main Functionality: Instant redirect to /dashboard
 * Dependencies:
 *   - next/navigation (redirect)
 *
 * Main Logical Flow:
 * 1. User visits / → immediately redirected to /dashboard
 * 2. Dashboard layout checks auth → shows login modal if needed
 *
 * ⚠️ Important Note for Next Developer:
 * - If you need to restore the landing page, see git history for v1.0.1
 * - All auth gating now lives in app/dashboard/layout.tsx
 * - Do NOT add auth checks here to avoid redirect loops
 *
 * Last Modified: v1.1.0 - Replaced landing page with direct redirect to dashboard
 * Previous: v1.0.1 - Fixed redirect loop and removed heavy animations
 * ============================================
 */

import { redirect } from 'next/navigation';

// ============================================
// Root Page - Server Component (no 'use client')
// ============================================

export default function RootPage() {
  redirect('/dashboard');
}
