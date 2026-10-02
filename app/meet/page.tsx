/**
 * ============================================================================
 * AeroNyx Web Meeting lobby
 * ============================================================================
 * [MEETING-WEB-LOBBY 2026-10-02 by Codex]
 * A discoverable create/join entry for browser meetings. The E2EE key remains
 * in the URL fragment and is never available to this server component.
 * ============================================================================
 */

import type { Metadata } from 'next';
import MeetHome from './MeetHome';

export const metadata: Metadata = {
  title: 'Meet',
  description: 'Start or join an end-to-end encrypted AeroNyx meeting.',
  openGraph: {
    title: 'AeroNyx Meet',
    description: 'Private video meetings with end-to-end encrypted media.',
    type: 'website',
    url: 'https://app.aeronyx.network/meet',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AeroNyx Meet',
    description: 'Private video meetings with end-to-end encrypted media.',
  },
};

export default function MeetPage() {
  return <MeetHome />;
}
