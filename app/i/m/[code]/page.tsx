/**
 * ============================================================================
 * AeroNyx meeting Universal Link fallback
 * ============================================================================
 * Route: /i/m/{code}
 *
 * [MEETING-WEB-FALLBACK 2026-09-17 by Claude]
 * An installed app claims this path before the route renders — /i/* is one of
 * the two prefixes the AASA authorises, which is exactly why meeting links
 * live under it. This page is what the people WITHOUT the app see: a desktop
 * browser, a phone that has not installed it yet.
 *
 * It does no data fetching, on purpose and not from laziness. Resolving the
 * code server-side would mean a public "does this meeting exist" endpoint, and
 * that endpoint is a room enumerator. The page does not know whether the
 * meeting is live, and does not ask.
 *
 * The key never reaches here. It sits after the '#', which no browser sends to
 * a server, so this server component cannot see it even if it wanted to — see
 * MeetingLinkView, which is where the key is read and where it must stay.
 * ============================================================================
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MeetingLinkView from './MeetingLinkView';

// Mirrors relay/call_state.py is_valid_meeting_code and the Dart MeetingLink:
// `abc-defg-hij`, lowercase, every letter but 'l'.
//
// `[a-km-z]`, and the first draft of this line was `[a-ikmnp-z]` — which drops
// 'j' and 'o' as well, so any code containing either would have 404'd here
// while working perfectly in the app. Three copies of one alphabet is two too
// many, and this is what the third copy costs when it drifts.
const CODE_PATTERN = /^[a-km-z]{3}-[a-km-z]{4}-[a-km-z]{3}$/;

type RouteParams = { code: string };

export const metadata: Metadata = {
  // [TITLE-TEMPLATE 2026-09-17 by Claude] Just 'Meeting'. The root layout
  // appends the brand with `template: '%s | AeroNyx'`, so spelling it here too
  // produced "Meeting · AeroNyx | AeroNyx" in every browser tab -- which sat
  // there through a day of screenshots without being seen, because a tab
  // title is the one piece of copy nobody reads twice.
  title: 'Meeting',
  description: 'Join an end-to-end encrypted AeroNyx meeting.',
  // A meeting invite should not be indexed: the code is half of the capability
  // to enter the room, and search engines are not invitees.
  robots: { index: false, follow: false },
};

export default async function MeetingLinkPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { code: raw } = await params;
  const code = (raw ?? '').toLowerCase();
  if (!CODE_PATTERN.test(code)) notFound();
  return <MeetingLinkView code={code} />;
}
