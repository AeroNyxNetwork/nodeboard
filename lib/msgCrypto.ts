/**
 * ============================================================================
 * File: lib/msgCrypto.ts
 * ============================================================================
 * [WEB CHAT] 1:1 message protocol — exact JS reproduction of the Flutter app's
 * ChatEnvelope send/receive path. Every primitive below is verified
 * cross-runtime against the app (MSG_INTEROP_OK): a Dart-encrypted message
 * decrypts here to the identical plaintext.
 *
 * Layers (outer→inner):
 *   relay frame  {type, msg_id, receiver_pubkey/sender_pubkey, discriminant:11,
 *                 payload_b64, timestamp, payload_sig}
 *   payload_b64  = base64( ChatEnvelope.serialize() )
 *   envelope     = messageId[16] ‖ sender[32] ‖ receiver[32] ‖ ts_u64le ‖
 *                  clen_u64le ‖ ciphertext[clen] ‖ nonce[24] ‖ ctype_u32le ‖ sig[64]
 *                  (ciphertext = XChaCha20 cipher ‖ Poly1305 tag16)
 *   plaintext    = wire text: raw string, or JSON {type:'aeronyx_message',text,…}
 *
 * Crypto:
 *   shared = HKDF-SHA256(salt=32 zeros, ikm=X25519(clamp(SHA512(seed)[:32]),
 *            edwardsToMontgomery(theirEdPub)), info="AERONYX-P2P-KEY", 32)
 *   envelope sig  = Ed25519.sign( sha256(signData121) )
 *   payload  sig  = Ed25519.sign( sha256(receiver‖sender‖discByte‖u64LE(ts)‖payload) )
 * ============================================================================
 */

import { ed25519, x25519, edwardsToMontgomery } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';

const P2P_INFO = new TextEncoder().encode('AERONYX-P2P-KEY');
const CTYPE_TEXT = 0;

export interface IncomingMessage {
  senderHex: string;
  text: string;
  timestamp: number; // unix seconds
  msgId: string;
}

export interface OutgoingFrame {
  type: 'relay_send';
  msg_id: string;
  receiver_pubkey: string;
  discriminant: 11;
  payload_b64: string;
  timestamp: number;
  payload_sig: string;
}

// --- shared secret ----------------------------------------------------------

function edPrivToX(seed: Uint8Array): Uint8Array {
  const h = sha512(seed).slice(0, 32);
  h[0] &= 248;
  h[31] &= 127;
  h[31] |= 64;
  return h;
}

/** ECDH+HKDF shared secret with a peer (their Ed25519 pubkey). */
export function sharedSecret(seed: Uint8Array, theirEdPub: Uint8Array): Uint8Array {
  const raw = x25519.getSharedSecret(edPrivToX(seed), edwardsToMontgomery(theirEdPub));
  return hkdf(sha256, raw, new Uint8Array(32), P2P_INFO, 32);
}

// --- envelope ---------------------------------------------------------------

interface Envelope {
  messageId: Uint8Array; // 16
  sender: Uint8Array; // 32
  receiver: Uint8Array; // 32
  timestamp: number;
  ciphertext: Uint8Array; // cipher||tag16
  nonce: Uint8Array; // 24
  contentType: number;
  signature: Uint8Array; // 64
}

function serializeEnvelope(e: Envelope): Uint8Array {
  const clen = e.ciphertext.length;
  const buf = new Uint8Array(16 + 32 + 32 + 8 + 8 + clen + 24 + 4 + 64);
  const dv = new DataView(buf.buffer);
  let o = 0;
  buf.set(e.messageId, o); o += 16;
  buf.set(e.sender, o); o += 32;
  buf.set(e.receiver, o); o += 32;
  setU64LE(dv, o, e.timestamp); o += 8;
  setU64LE(dv, o, clen); o += 8;
  buf.set(e.ciphertext, o); o += clen;
  buf.set(e.nonce, o); o += 24;
  dv.setUint32(o, e.contentType, true); o += 4;
  buf.set(e.signature.slice(0, 32), o); o += 32;
  buf.set(e.signature.slice(32, 64), o);
  return buf;
}

function deserializeEnvelope(b: Uint8Array): Envelope | null {
  try {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let o = 0;
    const messageId = b.slice(o, o + 16); o += 16;
    const sender = b.slice(o, o + 32); o += 32;
    const receiver = b.slice(o, o + 32); o += 32;
    const timestamp = getU64LE(dv, o); o += 8;
    const clen = getU64LE(dv, o); o += 8;
    if (clen < 0 || o + clen + 24 + 4 + 64 > b.length) return null;
    const ciphertext = b.slice(o, o + clen); o += clen;
    const nonce = b.slice(o, o + 24); o += 24;
    const contentType = dv.getUint32(o, true); o += 4;
    const signature = b.slice(o, o + 64);
    return { messageId, sender, receiver, timestamp, ciphertext, nonce, contentType, signature };
  } catch {
    return null;
  }
}

// --- signData (121B) --------------------------------------------------------

function buildSignData(
  sender: Uint8Array, messageId: Uint8Array, receiver: Uint8Array,
  timestamp: number, contentType: number, ciphertext: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(121);
  const dv = new DataView(out.buffer);
  let o = 0;
  out.set(sender, o); o += 32;
  out.set(messageId, o); o += 16;
  out.set(receiver, o); o += 32;
  setU64LE(dv, o, timestamp); o += 8;
  out[o] = contentType & 0xff; o += 1;
  out.set(sha256(ciphertext), o);
  return out;
}

// --- wire payload -----------------------------------------------------------

function encodeWire(text: string): string {
  return text; // simple text: raw string (attachments/reply add JSON — later)
}

function decodeWire(wire: string): string {
  const t = wire.trimStart();
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(wire);
      if (j && j.type === 'aeronyx_message') return typeof j.text === 'string' ? j.text : '';
    } catch {
      /* not JSON — fall through to raw */
    }
  }
  return wire;
}

// --- public: encrypt (send) / decrypt (receive) -----------------------------

/** Build a relay_send frame for a 1:1 text message. */
export function encryptText(
  seed: Uint8Array, myPub: Uint8Array, receiverHex: string, text: string,
): OutgoingFrame {
  const receiver = hexToBytes(receiverHex);
  const shared = sharedSecret(seed, receiver);
  const ts = Math.floor(Date.now() / 1000);
  const messageId = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const wire = new TextEncoder().encode(encodeWire(text));
  const ciphertext = xchacha20poly1305(shared, nonce).encrypt(wire); // cipher||tag16

  const signData = buildSignData(myPub, messageId, receiver, ts, CTYPE_TEXT, ciphertext);
  const envSig = ed25519.sign(sha256(signData), seed);

  const env: Envelope = {
    messageId, sender: myPub, receiver, timestamp: ts,
    ciphertext, nonce, contentType: CTYPE_TEXT, signature: envSig,
  };
  const payload = serializeEnvelope(env);

  const discByte = new Uint8Array([11]);
  const psInput = concat(receiver, myPub, discByte, u64LEbytes(ts), payload);
  const payloadSig = ed25519.sign(sha256(psInput), seed);

  return {
    type: 'relay_send',
    msg_id: bytesToHex(messageId),
    receiver_pubkey: receiverHex,
    discriminant: 11,
    payload_b64: b64encode(payload),
    timestamp: ts,
    payload_sig: bytesToHex(payloadSig),
  };
}

/** Decrypt an incoming relay_envelope frame (1:1). Returns null on any failure. */
export function decryptEnvelopeFrame(
  seed: Uint8Array,
  frame: { payload_b64?: string; sender_pubkey?: string; msg_id?: string; discriminant?: number },
): IncomingMessage | null {
  if (frame.discriminant != null && frame.discriminant !== 11) return null; // 1:1 only
  const payloadB64 = frame.payload_b64;
  const senderHex = frame.sender_pubkey;
  if (!payloadB64 || !senderHex) return null;

  const env = deserializeEnvelope(b64decode(payloadB64));
  if (!env) return null;
  const shared = sharedSecret(seed, hexToBytes(senderHex));
  const full = concat(env.nonce, env.ciphertext);
  let plain: Uint8Array;
  try {
    plain = xchacha20poly1305(shared, full.slice(0, 24)).decrypt(full.slice(24));
  } catch {
    return null; // MAC fail — tampered / wrong key
  }
  let wire: string;
  try {
    wire = new TextDecoder('utf-8', { fatal: false }).decode(plain);
  } catch {
    return null;
  }
  return {
    senderHex,
    text: decodeWire(wire),
    timestamp: env.timestamp,
    msgId: frame.msg_id || bytesToHex(env.messageId),
  };
}

// --- helpers ----------------------------------------------------------------

function setU64LE(dv: DataView, off: number, v: number): void {
  dv.setUint32(off, v >>> 0, true);
  dv.setUint32(off + 4, Math.floor(v / 4294967296), true);
}
function getU64LE(dv: DataView, off: number): number {
  return dv.getUint32(off, true) + dv.getUint32(off + 4, true) * 4294967296;
}
function u64LEbytes(v: number): Uint8Array {
  const b = new Uint8Array(8);
  setU64LE(new DataView(b.buffer), 0, v);
  return b;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
export function hexToBytes(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}
export function bytesToHex(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}
function b64encode(b: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
