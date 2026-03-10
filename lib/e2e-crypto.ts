/**
 * ============================================
 * AeroNyx Privacy Network - E2E Encryption Session
 * ============================================
 * File Path: lib/e2e-crypto.ts
 *
 * Creation Reason: End-to-end encryption for AI chat messages.
 *   CMS relay only sees ciphertext — cannot read chat content.
 *   Uses XChaCha20-Poly1305 (24-byte nonce) + X25519 key exchange,
 *   matching the Rust node's `chacha20poly1305` crate exactly.
 *
 * Main Functionality:
 *   - E2ESession class: ephemeral X25519 key pair, ECDH shared secret,
 *     XChaCha20-Poly1305 authenticated encryption
 *   - Lifecycle: construct → getEphemeralPublicKeyHex → completeHandshake → encrypt/decrypt → destroy
 *   - Hex encoding helpers (no external dependency for hex)
 *
 * Dependencies:
 *   - @stablelib/xchacha20poly1305 (AEAD cipher)
 *   - @stablelib/x25519 (key exchange)
 *   - @stablelib/random (nonce generation)
 *
 * Main Logical Flow:
 *   1. Frontend creates E2ESession → generates ephemeral X25519 key pair
 *   2. Sends ephemeral public key to Rust node via {"type":"e2e_init"}
 *   3. Rust responds with its X25519 public key via {"type":"e2e_ready"}
 *   4. Frontend calls completeHandshake() → ECDH shared secret → AEAD cipher
 *   5. All subsequent chat messages encrypted/decrypted with this cipher
 *   6. On disconnect, destroy() zeroes all key material
 *
 * ⚠️ Important Note for Next Developer:
 * - NEVER store key material in localStorage — memory only (ref)
 * - NEVER log sharedSecret or secretKey to console
 * - Each WebSocket connection = new E2ESession (forward secrecy)
 * - destroy() MUST be called on disconnect to zero key material
 * - randomBytes(24) for nonce — never construct nonces manually
 * - This is NOT compatible with tweetnacl (XSalsa20 vs XChaCha20)
 * - MPI requests do NOT use E2E — only chat messages
 *
 * Last Modified: v1.0.0 - Initial E2E encryption session
 * ============================================
 */

import { XChaCha20Poly1305 } from '@stablelib/xchacha20poly1305';
import { generateKeyPair, sharedKey } from '@stablelib/x25519';
import { randomBytes } from '@stablelib/random';

// ============================================
// Hex Utilities
// ============================================

function bytesToHex(bytes: Uint8Array): string {
  const hex: string[] = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    hex[i] = bytes[i].toString(16).padStart(2, '0');
  }
  return hex.join('');
}

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length >>> 1;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(hex.substr(i << 1, 2), 16);
  }
  return bytes;
}

// ============================================
// E2E Session
// ============================================

/**
 * End-to-end encryption session for a single WebSocket connection.
 *
 * Lifecycle:
 *   1. new E2ESession()          → generates ephemeral X25519 key pair
 *   2. getEphemeralPublicKeyHex() → hex string to send to Rust node
 *   3. completeHandshake(nodePublicKeyHex) → computes shared secret, creates AEAD
 *   4. encrypt(plaintext) / decrypt(nonceHex, ciphertextHex) → chat message E2E
 *   5. destroy()                  → zeroes all key material
 */
export class E2ESession {
  private ephemeralKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
  private sharedSecret: Uint8Array | null = null;
  private aead: XChaCha20Poly1305 | null = null;

  constructor() {
    this.ephemeralKeyPair = generateKeyPair();
  }

  /** Ephemeral public key as hex — send this to Rust node in e2e_init */
  getEphemeralPublicKeyHex(): string {
    return bytesToHex(this.ephemeralKeyPair.publicKey);
  }

  /**
   * Complete handshake with Rust node's X25519 public key.
   * After this, encrypt/decrypt are available.
   */
  completeHandshake(nodeX25519PkHex: string): void {
    const nodePublicKey = hexToBytes(nodeX25519PkHex);
    this.sharedSecret = sharedKey(this.ephemeralKeyPair.secretKey, nodePublicKey);
    this.aead = new XChaCha20Poly1305(this.sharedSecret);
  }

  /** Whether the handshake is complete and encryption is available */
  isReady(): boolean {
    return this.aead !== null;
  }

  /**
   * Encrypt a plaintext string for sending to Rust node.
   * @returns { nonce: hex, ciphertext: hex }
   */
  encrypt(plaintext: string): { nonce: string; ciphertext: string } {
    if (!this.aead) throw new Error('E2E handshake not completed');

    const nonce = randomBytes(24);
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const sealed = this.aead.seal(nonce, plaintextBytes);

    return {
      nonce: bytesToHex(nonce),
      ciphertext: bytesToHex(sealed),
    };
  }

  /**
   * Decrypt a ciphertext received from Rust node.
   * @returns plaintext string, or null if decryption/auth failed
   */
  decrypt(nonceHex: string, ciphertextHex: string): string | null {
    if (!this.aead) throw new Error('E2E handshake not completed');

    const nonce = hexToBytes(nonceHex);
    const ciphertext = hexToBytes(ciphertextHex);
    const opened = this.aead.open(nonce, ciphertext);

    if (!opened) return null;
    return new TextDecoder().decode(opened);
  }

  /**
   * Destroy session — zeroes all key material.
   * MUST be called on WebSocket disconnect.
   */
  destroy(): void {
    if (this.sharedSecret) {
      this.sharedSecret.fill(0);
      this.sharedSecret = null;
    }
    this.ephemeralKeyPair.secretKey.fill(0);
    this.aead = null;
  }
}
