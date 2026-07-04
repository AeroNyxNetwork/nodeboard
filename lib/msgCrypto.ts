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
import { gcm } from '@noble/ciphers/aes';

const P2P_INFO = new TextEncoder().encode('AERONYX-P2P-KEY');
const CTYPE_TEXT = 0;

export interface WebAttachment {
  blobId: string;
  fileKey: string; // base64 — AES-256-GCM key for the full blob (download phase)
  mediaType: string;
  fileName: string;
  fileSize: number;
  thumbB64?: string; // inline preview (images/video) — render without a download
  durationMs?: number; // voice/video length (wire: duration_ms)
  waveform?: number[]; // voice amplitude bars 0..1 (wire: waveform)
}

export interface IncomingMessage {
  senderHex: string;
  text: string;
  attachments: WebAttachment[];
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

/**
 * ECDH shared secret with a peer (their Ed25519 pubkey). Messages use the HKDF
 * form (app default useHkdf=true); the raw form exists only as a legacy
 * receive-fallback (the app tries [hkdf, raw]).
 */
export function sharedSecret(
  seed: Uint8Array, theirEdPub: Uint8Array, useHkdf = true,
): Uint8Array {
  const raw = x25519.getSharedSecret(edPrivToX(seed), edwardsToMontgomery(theirEdPub));
  return useHkdf ? hkdf(sha256, raw, new Uint8Array(32), P2P_INFO, 32) : raw;
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

interface WireDecoded {
  text: string;
  attachments: WebAttachment[];
}

function decodeWire(wire: string): WireDecoded {
  const t = wire.trimStart();
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(wire);
      if (j && j.type === 'aeronyx_message') {
        const raw = Array.isArray(j.attachments) ? j.attachments : [];
        const attachments: WebAttachment[] = raw.map((a: Record<string, unknown>) => ({
          blobId: String(a.blob_id ?? a.id ?? ''),
          fileKey: String(a.file_key ?? ''),
          mediaType: String(a.media_type ?? 'application/octet-stream'),
          fileName: String(a.file_name ?? a.name ?? 'attachment'),
          fileSize: Number(a.file_size ?? a.size ?? 0) || 0,
          thumbB64: typeof a.thumb_b64 === 'string' ? a.thumb_b64 : undefined,
          durationMs: Number(a.duration_ms ?? 0) || 0,
          waveform: Array.isArray(a.waveform)
            ? (a.waveform as unknown[])
                .map((v) => Number(v))
                .filter((v) => Number.isFinite(v))
                .slice(0, 96)
            : undefined,
        }));
        return { text: typeof j.text === 'string' ? j.text : '', attachments };
      }
    } catch {
      /* not JSON — fall through to raw text */
    }
  }
  return { text: wire, attachments: [] };
}

// --- public: encrypt (send) / decrypt (receive) -----------------------------

/**
 * Build a relay_send frame from an already-serialized wire payload (text or the
 * attachment JSON). contentType is always Text (0) — the app sends both plain
 * text and attachment (JSON-wire) messages as Text; the receiver distinguishes
 * by sniffing the decrypted string (see decodeWire / decodeFromWire). A caller
 * may pin messageId (msgIdIn) so an optimistic bubble keeps its id after upload.
 */
function buildRelayFrame(
  seed: Uint8Array, myPub: Uint8Array, receiverHex: string,
  wireBytes: Uint8Array, msgIdIn?: Uint8Array,
): OutgoingFrame {
  const receiver = hexToBytes(receiverHex);
  const shared = sharedSecret(seed, receiver);
  const ts = Math.floor(Date.now() / 1000);
  const messageId = msgIdIn ?? crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const ciphertext = xchacha20poly1305(shared, nonce).encrypt(wireBytes); // cipher||tag16

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

/** Build a relay_send frame for a 1:1 text message. */
export function encryptText(
  seed: Uint8Array, myPub: Uint8Array, receiverHex: string, text: string,
): OutgoingFrame {
  return buildRelayFrame(seed, myPub, receiverHex, new TextEncoder().encode(encodeWire(text)));
}

/** Serialize a WebAttachment to the app's snake_case wire shape. */
function attToWire(a: WebAttachment): Record<string, unknown> {
  const m: Record<string, unknown> = {
    blob_id: a.blobId,
    file_key: a.fileKey,
    media_type: a.mediaType,
    file_name: a.fileName,
    file_size: a.fileSize,
  };
  if (a.thumbB64) m.thumb_b64 = a.thumbB64;
  if (a.durationMs && a.durationMs > 0) m.duration_ms = a.durationMs;
  if (a.waveform && a.waveform.length) m.waveform = a.waveform;
  return m;
}

/**
 * Build a relay_send frame for a 1:1 message carrying attachments (optionally
 * with a text caption). Wire = JSON {type:'aeronyx_message', text, attachments}
 * — byte-identical to the app's AttachmentMessagePayload.encodeForWire(), so a
 * web-sent attachment decodes on the phone (and vice-versa).
 */
export function encryptAttachmentMessage(
  seed: Uint8Array, myPub: Uint8Array, receiverHex: string,
  text: string, attachments: WebAttachment[], msgIdHex?: string,
): OutgoingFrame {
  const wire = JSON.stringify({
    type: 'aeronyx_message',
    text: text || '',
    attachments: attachments.map(attToWire),
  });
  const msgId = msgIdHex ? hexToBytes(msgIdHex) : undefined;
  return buildRelayFrame(seed, myPub, receiverHex, new TextEncoder().encode(wire), msgId);
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

  // The frame's sender must match the signed envelope's sender (no spoofing the
  // routing header vs the signed content).
  if (bytesToHex(env.sender) !== senderHex.toLowerCase()) return null;

  // Verify the envelope Ed25519 signature over sha256(signData) — reject
  // forgeries (parity with the app's p2pVerify; AEAD alone doesn't give this).
  const signData = buildSignData(
    env.sender, env.messageId, env.receiver, env.timestamp, env.contentType, env.ciphertext,
  );
  let sigOk = false;
  try {
    sigOk = ed25519.verify(env.signature, sha256(signData), env.sender);
  } catch {
    sigOk = false;
  }
  if (!sigOk) return null;

  // Decrypt: try HKDF secret, then the legacy raw secret (app tries both).
  const full = concat(env.nonce, env.ciphertext);
  let plain: Uint8Array | null = null;
  for (const useHkdf of [true, false]) {
    try {
      const sh = sharedSecret(seed, env.sender, useHkdf);
      plain = xchacha20poly1305(sh, full.slice(0, 24)).decrypt(full.slice(24));
      break;
    } catch {
      plain = null; // MAC fail with this secret — try the next
    }
  }
  if (!plain) return null;

  let wire: string;
  try {
    wire = new TextDecoder('utf-8', { fatal: false }).decode(plain);
  } catch {
    return null;
  }
  const decoded = decodeWire(wire);
  return {
    senderHex,
    text: decoded.text,
    attachments: decoded.attachments,
    timestamp: env.timestamp,
    msgId: frame.msg_id || bytesToHex(env.messageId),
  };
}

// --- attachments (full blob download + decrypt) -----------------------------

const RELAY_BASE = 'https://api.aeronyx.network/api/relay';

/** Relay HTTP auth header — same sig recipe as the WS auth frame (verified). */
export function authHeader(seed: Uint8Array, pub: Uint8Array): string {
  const ts = Math.floor(Date.now() / 1000);
  const digest = sha256(concat(new TextEncoder().encode('AeroNyx-RelayAuth-v1'), pub, u64LEbytes(ts)));
  const sig = ed25519.sign(digest, seed);
  return `Relay ${bytesToHex(pub)}:${ts}:${bytesToHex(sig)}`;
}

/**
 * Download + decrypt an attachment blob → the original file bytes.
 * Blob wire format = nonce(12) ‖ AES-256-GCM(cipher ‖ tag16). file_key is base64.
 */
export async function fetchAttachment(
  seed: Uint8Array, pub: Uint8Array, blobId: string, fileKeyB64: string,
): Promise<Uint8Array> {
  const res = await fetch(`${RELAY_BASE}/blob/${encodeURIComponent(blobId)}/`, {
    headers: { Authorization: authHeader(seed, pub) },
  });
  if (!res.ok) throw new Error(`blob ${res.status}`);
  const enc = new Uint8Array(await res.arrayBuffer());
  if (enc.length < 12 + 16) throw new Error('blob too small');
  const key = b64decode(fileKeyB64);
  const nonce = enc.slice(0, 12);
  return gcm(key, nonce).decrypt(enc.slice(12)); // cipher‖tag → plaintext
}

// Matches the app's _kSimpleUploadMaxBytes. Above this the app switches to a
// resumable chunked session; that path is App-only for now, so web rejects
// oversized files with a clear message rather than failing opaquely.
export const SIMPLE_UPLOAD_MAX = 8 * 1024 * 1024;

/**
 * Encrypt + upload a file as a relay blob → the wire metadata a message carries.
 * Fresh one-time AES-256-GCM key per upload (never reused — nonce uniqueness);
 * blob = nonce(12) ‖ cipher ‖ tag16, exactly what fetchAttachment expects. The
 * multipart shape (fields media_type/file_name/file_size + file) mirrors the
 * app's simple-upload POST. file_size is the PLAINTEXT length (app parity).
 * Throws 'too-large' above SIMPLE_UPLOAD_MAX.
 */
export async function uploadAttachment(
  seed: Uint8Array, pub: Uint8Array,
  input: { bytes: Uint8Array; mediaType: string; fileName: string; thumbB64?: string },
): Promise<WebAttachment> {
  const { bytes, mediaType, fileName, thumbB64 } = input;
  if (bytes.length > SIMPLE_UPLOAD_MAX) throw new Error('too-large');

  const fileKey = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const sealed = gcm(fileKey, nonce).encrypt(bytes); // cipher‖tag16
  const encrypted = concat(nonce, sealed); // nonce(12) ‖ cipher ‖ tag16

  const form = new FormData();
  form.append('media_type', mediaType);
  form.append('file_name', fileName);
  form.append('file_size', String(bytes.length)); // plaintext size (app parity)
  form.append('file', new Blob([new Uint8Array(encrypted)], { type: 'application/octet-stream' }), fileName);

  // No explicit Content-Type — the browser sets multipart/form-data + boundary.
  const res = await fetch(`${RELAY_BASE}/blob/`, {
    method: 'POST',
    headers: { Authorization: authHeader(seed, pub) },
    body: form,
  });
  if (!res.ok) throw new Error(`upload ${res.status}`);
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  const blob = body.blob as Record<string, unknown> | undefined;
  const blobId = String(body.blob_id ?? body.id ?? blob?.id ?? '');
  if (!blobId) throw new Error('upload: missing blob_id');

  return { blobId, fileKey: b64encode(fileKey), mediaType, fileName, fileSize: bytes.length, thumbB64 };
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
