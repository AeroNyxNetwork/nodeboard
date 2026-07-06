/**
 * ============================================================================
 * File: lib/oploginCrypto.ts
 * ============================================================================
 * [OP-LOGIN] Browser-side crypto for "scan the phone to log in to the operator
 * dashboard". Mirror of lib/webLoginCrypto.ts but for a DIFFERENT payload:
 *
 *   webLogin  : phone seals its P2P identity SEED  → web chats as that identity
 *   opLogin   : phone signs the dashboard nonce with its WALLET, does the full
 *               wallet-login, and seals the resulting SESSION (api_key +
 *               wallet_address + wallet_type) → web is authenticated to the
 *               operator dashboard as that wallet.
 *
 * Why this is cleaner + safer than the chat pairing: node-operator auth only
 * needs a SIGNATURE (nonce → sign → api_key), never ECDH — so the wallet
 * private key NEVER leaves the phone. The phone signs remotely (WalletConnect
 * style) and only a bearer session crosses the wire, sealed end-to-end to the
 * web's ephemeral key. The rendezvous server (reused web_pair endpoints) only
 * ever relays opaque ciphertext.
 *
 * Same X25519 ECDH + XChaCha20-Poly1305 recipe as webLoginCrypto, DOMAIN-
 * SEPARATED by the HKDF salt 'AeroNyx-OpLogin-v1' (a chat-seed blob can never be
 * unsealed as an operator session and vice-versa).
 * ============================================================================
 */

import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import {
  b64uDecode, genEphemeral, genSessionId, type WebEphemeral,
} from './webLoginCrypto';

const _OP_SALT = 'AeroNyx-OpLogin-v1';
const _OP_VC_TAG = 'AeroNyx-OpLogin-VC';

// Re-export the shared ephemeral/session helpers so the page imports one module.
export { genEphemeral, genSessionId };
export type { WebEphemeral };

/** QR the phone scans to authorize an operator-dashboard login. */
export function buildOpQrUrl(sid: string, pubB64: string): string {
  return `aeronyx://oplogin?v=1&spk=${pubB64}&sid=${encodeURIComponent(sid)}`;
}

export interface OpSession {
  apiKey: string;
  walletAddress: string;
  walletType: string;
  /** 6-digit code derived from the shared key, shown on BOTH phone + web for the
   *  user to match — defeats a QR-swap MITM (which here would let an attacker log
   *  in as the operator, so the check matters more than for chat). */
  verificationCode: string;
}

function vcFromKey(key: Uint8Array): string {
  const d = sha256(concatBytes(key, new TextEncoder().encode(_OP_VC_TAG)));
  return String(((d[0] << 16) | (d[1] << 8) | d[2]) % 1000000).padStart(6, '0');
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * Unseal the phone's sealed operator session. Returns the session or null on any
 * failure (bad tag / wrong key / malformed JSON) — fail closed.
 *
 * @param webPriv     this browser's ephemeral X25519 private key
 * @param webPubB64   this browser's ephemeral X25519 public key (b64url)
 * @param phoneEphB64 phone ephemeral X25519 public key from the rendezvous (b64url)
 * @param sealedB64   nonce(24)‖cipher‖tag(16), b64url
 */
export function unsealOpSession(
  webPriv: Uint8Array,
  webPubB64: string,
  phoneEphB64: string,
  sealedB64: string,
): OpSession | null {
  try {
    const webPub = b64uDecode(webPubB64);
    const phoneEph = b64uDecode(phoneEphB64);
    const ct = b64uDecode(sealedB64);
    if (ct.length < 24 + 16) return null;

    const shared = x25519.getSharedSecret(webPriv, phoneEph);
    const info = new Uint8Array(phoneEph.length + webPub.length);
    info.set(phoneEph, 0);
    info.set(webPub, phoneEph.length);
    const key = hkdf(sha256, shared, new TextEncoder().encode(_OP_SALT), info, 32);

    const pt = xchacha20poly1305(key, ct.slice(0, 24)).decrypt(ct.slice(24));
    const j = JSON.parse(new TextDecoder().decode(pt)) as Record<string, unknown>;

    const apiKey = String(j.api_key ?? j.apiKey ?? '');
    const walletAddress = String(j.wallet_address ?? j.walletAddress ?? '');
    const walletType = String(j.wallet_type ?? j.walletType ?? '');
    if (!apiKey || !walletAddress || !walletType) return null;
    return { apiKey, walletAddress, walletType, verificationCode: vcFromKey(key) };
  } catch {
    return null;
  }
}
