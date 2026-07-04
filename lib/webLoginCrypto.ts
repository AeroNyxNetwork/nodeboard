/**
 * ============================================================================
 * File: lib/webLoginCrypto.ts
 * ============================================================================
 * [WEB-LOGIN] Browser-side pairing crypto for "scan the phone QR to log in".
 *
 * Reproduces the Flutter app's WebLoginPairingService EXACTLY, so the browser
 * can unseal the identity seed the phone sealed to it. The recipe below was
 * verified cross-runtime against a Dart-generated vector (INTEROP_OK):
 *   Dart seal -> this unseal recovers the identical seed + verification code.
 *
 * Model (deliberately-weaker "standard" web tier, see the app-side headers):
 *   The phone ECDH-seals its P2P identity *seed* to this browser's ephemeral
 *   X25519 key; the browser derives the SAME pubkey and (next phase) connects
 *   to the relay as that identity. The seed therefore lives in the browser —
 *   a logged-in web session can read the user's messages. The app tier keeps
 *   the seed in the Rust core; that is the "stronger" tier.
 *
 * Primitives (must match the app byte-for-byte):
 *   X25519 ECDH -> HKDF-SHA256(salt='AeroNyx-WebLogin-v1', info=phoneEph‖webPub)
 *   -> XChaCha20-Poly1305, ciphertext = nonce(24)‖cipher‖tag(16).
 *   Verification code = SHA256(key ‖ 'AeroNyx-WebLogin-VC')[0:3] % 1e6, pad6.
 * ============================================================================
 */

import { x25519, ed25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';

const _PAIR_SALT = 'AeroNyx-WebLogin-v1';
const _VC_TAG = 'AeroNyx-WebLogin-VC';

// --- base64url (no padding) --------------------------------------------------

export function b64uEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(s: string): Uint8Array {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

// --- ephemeral key + QR ------------------------------------------------------

export interface WebEphemeral {
  priv: Uint8Array;
  pubB64: string;
}

/** Generate this browser's one-time X25519 keypair (the QR 'spk'). */
export function genEphemeral(): WebEphemeral {
  const priv = x25519.utils.randomPrivateKey();
  const pub = x25519.getPublicKey(priv);
  return { priv, pubB64: b64uEncode(pub) };
}

/** Build the QR payload the phone scans. */
export function buildQrUrl(sid: string, pubB64: string): string {
  return `aeronyx://weblogin?v=1&spk=${pubB64}&sid=${encodeURIComponent(sid)}`;
}

/** High-entropy, url-safe session id matching the backend _SID_RE. */
export function genSessionId(): string {
  const r = new Uint8Array(24);
  crypto.getRandomValues(r);
  return b64uEncode(r); // 32 url-safe chars
}

// --- unseal ------------------------------------------------------------------

export interface UnsealResult {
  seedHex: string;
  verificationCode: string;
  /** Ed25519 identity pubkey derived from the seed (hex). */
  pubkeyHex: string;
}

/**
 * Unseal the phone's payload. Throws if the ciphertext fails authentication
 * (tampered / wrong key), matching the app's fail-closed decrypt.
 *
 * @param webPriv   this browser's ephemeral X25519 private key
 * @param webPubB64 this browser's ephemeral X25519 public key (b64url)
 * @param phoneEphB64 phone ephemeral X25519 public key from the rendezvous (b64url)
 * @param sealedB64 nonce(24)‖cipher‖tag(16), b64url
 */
export function unseal(
  webPriv: Uint8Array,
  webPubB64: string,
  phoneEphB64: string,
  sealedB64: string,
): UnsealResult {
  const webPub = b64uDecode(webPubB64);
  const phoneEph = b64uDecode(phoneEphB64);
  const ct = b64uDecode(sealedB64);

  const shared = x25519.getSharedSecret(webPriv, phoneEph);
  const info = new Uint8Array(phoneEph.length + webPub.length);
  info.set(phoneEph, 0);
  info.set(webPub, phoneEph.length);
  const key = hkdf(sha256, shared, new TextEncoder().encode(_PAIR_SALT), info, 32);

  const nonce = ct.slice(0, 24);
  const body = ct.slice(24);
  const pt = xchacha20poly1305(key, nonce).decrypt(body); // throws on bad tag
  const seedHex = new TextDecoder().decode(pt);

  const vcd = sha256(concat(key, new TextEncoder().encode(_VC_TAG)));
  const verificationCode = String(
    ((vcd[0] << 16) | (vcd[1] << 8) | vcd[2]) % 1000000,
  ).padStart(6, '0');

  const pubkeyHex = bytesToHex(ed25519.getPublicKey(hexToBytes(seedHex)));
  return { seedHex, verificationCode, pubkeyHex };
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
