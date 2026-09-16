/**
 * ============================================================================
 * AeroNyx meeting guest — an identity that exists for one visit
 * ============================================================================
 *
 * [MEETING-WEB-GUEST 2026-09-17 by Claude]
 *
 * A browser visitor has no AeroNyx account and should not need one. The relay
 * agrees: RelayAuthenticator.verify on the backend says so in its own words —
 * "不查 DB，不關聯 AIUser，純粹密碼學驗證" — it checks only that the signature
 * matches the self-asserted public key. So a keypair generated on page load is
 * a valid caller, and that is exactly the guest.
 *
 * The signature scheme is the one lib/relayClient.ts already speaks, because
 * it is the same relay:
 *
 *     sign input = utf8('AeroNyx-RelayAuth-v1') || pubkey(32) || u64LE(ts)
 *     signature  = Ed25519.sign(sha256(sign input))
 *
 * ⚠️ What a token is and is not. The token opens the ROOM. It does not decrypt
 * the conversation — that needs the key from the link fragment, which never
 * reaches this or any server. And it does not admit anyone: the host still has
 * to let a guest in. The code is a capability to knock, not to enter.
 *
 * The keypair is deliberately NOT persisted. A guest who reloads is a new
 * guest, which is the honest thing for an identity nobody vouched for, and it
 * leaves nothing behind on a machine that may not belong to them.
 * ============================================================================
 */

import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha2';

const RELAY_AUTH_DOMAIN = 'AeroNyx-RelayAuth-v1';
const API_ORIGIN = 'https://api.aeronyx.network';
const TOKEN_TIMEOUT_MS = 10_000;

export type GuestIdentity = {
  seed: Uint8Array;
  publicKeyHex: string;
};

export type MeetingToken = {
  token: string;
  roomName: string;
  livekitUrl: string;
};

const utf8 = (s: string) => new TextEncoder().encode(s);

const u64LE = (n: number) => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(n), true);
  return out;
};

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** A keypair for this visit and no longer. */
export function createGuestIdentity(): GuestIdentity {
  const seed = ed25519.utils.randomPrivateKey();
  return { seed, publicKeyHex: toHex(ed25519.getPublicKey(seed)) };
}

/** The relay's auth signature over a timestamp, as relayClient.authFrame does. */
export function signRelayAuth(identity: GuestIdentity, timestamp: number) {
  const pub = ed25519.getPublicKey(identity.seed);
  const digest = sha256(concat(utf8(RELAY_AUTH_DOMAIN), pub, u64LE(timestamp)));
  return toHex(ed25519.sign(digest, identity.seed));
}

export class MeetingTokenError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'MeetingTokenError';
  }
}

/**
 * Asks the relay for a LiveKit token for one meeting code.
 *
 * Throws MeetingTokenError with the backend's own code, so the caller can tell
 * "this meeting does not exist" (meeting_not_found) apart from "we could not
 * reach the relay". Those need different words on screen: one is a dead link,
 * the other is a retry.
 */
export async function requestMeetingToken(
  identity: GuestIdentity,
  meetingCode: string,
  options: { withVideo?: boolean } = {},
): Promise<MeetingToken> {
  const timestamp = Math.floor(Date.now() / 1000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api/voice/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        call_type: 'meeting',
        // The code goes to the server because the server has to find the room.
        // The KEY does not, and there is no field here for it on purpose.
        meeting_code: meetingCode,
        pubkey: identity.publicKeyHex,
        timestamp,
        signature: signRelayAuth(identity, timestamp),
        is_video: options.withVideo ?? true,
      }),
    });
  } catch {
    throw new MeetingTokenError('unreachable', 0);
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new MeetingTokenError('malformed_response', response.status);
  }

  if (!response.ok) {
    const code =
      typeof parsed.error === 'string' ? parsed.error : 'token_refused';
    throw new MeetingTokenError(code, response.status);
  }

  const token = parsed.token;
  const roomName = parsed.room_name;
  const livekitUrl = parsed.livekit_url;
  if (
    typeof token !== 'string' ||
    typeof roomName !== 'string' ||
    typeof livekitUrl !== 'string'
  ) {
    throw new MeetingTokenError('malformed_response', response.status);
  }
  return { token, roomName, livekitUrl };
}

/**
 * Decodes the base64url key out of a link fragment.
 *
 * Returns null for "there was no key" and for "the key is the wrong size",
 * which are the same thing to a caller: this browser cannot decrypt the room.
 * A 16-byte key would connect and then hear silence, and silence is the one
 * failure nobody can diagnose from inside it.
 */
export function decodeMeetingKey(fragment: string): Uint8Array | null {
  const pair = fragment
    .replace(/^#/, '')
    .split('&')
    .map((part) => part.split('='))
    .find(([name]) => name === 'k');
  if (!pair || !pair[1]) return null;

  const padded = pair[1].replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}
