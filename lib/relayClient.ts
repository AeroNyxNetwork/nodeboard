/**
 * ============================================================================
 * File: lib/relayClient.ts
 * ============================================================================
 * [WEB-LOGIN / CHAT] Browser relay WebSocket client.
 *
 * Connects to the AeroNyx relay as the imported P2P identity and authenticates
 * with the exact frame the Flutter app sends (verified against the live relay,
 * which returns auth_ack):
 *   sign input = utf8('AeroNyx-RelayAuth-v1') || pubkey(32) || u64LE(ts)
 *   signature  = Ed25519.sign( sha256(sign input) )   // seed IS the ed25519 key
 *   frame      = {type:'auth', pubkey, timestamp, signature, supports_call_dedup}
 *
 * This module owns connect + auth + reconnect and surfaces raw relay_envelope
 * frames via an event listener. Message decryption / sending / the chat UI are
 * built on top of this in later phases.
 * ============================================================================
 */

import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';

const WS_URL = 'wss://api.aeronyx.network/ws/relay/';
const DOMAIN = 'AeroNyx-RelayAuth-v1';

export type RelayEvent =
  | 'connected' | 'authfail' | 'closed' | 'envelope' | 'pulldone'
  | 'reaction' // inbound message_reaction (emoji)
  | 'receipt' // inbound message_receipt (peer decrypted+stored our message)
  | 'read' // inbound message_read (peer read our message)
  | 'typing' // inbound typing indicator
  | 'presence' // inbound presence_update / presence_subscribe_ack
  | 'groupreaction' // inbound group_message_reaction
  | 'grouptyping'; // inbound group_typing

export class RelayClient {
  private ws: WebSocket | null = null;
  private readonly seed: Uint8Array;
  readonly pub: Uint8Array;
  readonly pubHex: string;

  private listeners: Partial<Record<RelayEvent, Array<(d?: unknown) => void>>> = {};
  private closedByUser = false;
  private reconnectMs = 1000;

  constructor(seedHex: string) {
    this.seed = hexToBytes(seedHex);
    this.pub = ed25519.getPublicKey(this.seed);
    this.pubHex = bytesToHex(this.pub);
  }

  on(ev: RelayEvent, cb: (d?: unknown) => void): void {
    (this.listeners[ev] ||= []).push(cb);
  }

  private emit(ev: RelayEvent, d?: unknown): void {
    (this.listeners[ev] || []).forEach((f) => f(d));
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    this.closedByUser = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(this.authFrame()));
    ws.onmessage = (e) => this.onFrame(String(e.data));
    ws.onerror = () => {};
    ws.onclose = () => {
      this.emit('closed');
      if (!this.closedByUser) this.scheduleReconnect();
    };
  }

  close(): void {
    this.closedByUser = true;
    this.ws?.close();
    this.ws = null;
  }

  /** Send a JSON frame. Returns false if the socket isn't open. */
  send(frame: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(frame));
      return true;
    } catch {
      return false;
    }
  }

  private scheduleReconnect(): void {
    const delay = this.reconnectMs;
    this.reconnectMs = Math.min(this.reconnectMs * 2, 15000); // capped backoff
    setTimeout(() => {
      if (!this.closedByUser) this.connect();
    }, delay);
  }

  private authFrame() {
    const ts = Math.floor(Date.now() / 1000);
    const digest = sha256(concat(utf8(DOMAIN), this.pub, u64LE(ts)));
    const sig = ed25519.sign(digest, this.seed);
    return {
      type: 'auth',
      pubkey: this.pubHex,
      timestamp: ts,
      signature: bytesToHex(sig),
      supports_call_dedup: true,
    };
  }

  private onFrame(raw: string): void {
    let f: { type?: string };
    try {
      f = JSON.parse(raw);
    } catch {
      return;
    }
    switch (f.type) {
      case 'auth_ok':
      case 'auth_ack':
      case 'auth_success':
        this.reconnectMs = 1000; // reset backoff on success
        this.emit('connected', f);
        break;
      case 'auth_error':
        this.emit('authfail', f);
        break;
      case 'relay_envelope':
        this.emit('envelope', f);
        break;
      case 'relay_pull_done':
        this.emit('pulldone', f);
        break;
      case 'message_reaction':
        this.emit('reaction', f);
        break;
      case 'message_receipt':
        this.emit('receipt', f);
        break;
      case 'message_read':
        this.emit('read', f);
        break;
      case 'typing':
        this.emit('typing', f);
        break;
      case 'presence_update':
      case 'presence_subscribe_ack':
        this.emit('presence', f);
        break;
      case 'group_message_reaction':
        this.emit('groupreaction', f);
        break;
      case 'group_typing':
        this.emit('grouptyping', f);
        break;
      // *_ack frames (message_reaction_ack / message_receipt_ack / message_read_ack)
      // are server acknowledgements that don't change UI state — ignore them.
      default:
        break;
    }
  }
}

// --- helpers -----------------------------------------------------------------

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function u64LE(v: number): Uint8Array {
  // No BigInt (nodeboard tsconfig targets < ES2020). A unix-seconds timestamp
  // is well within Number.MAX_SAFE_INTEGER, so plain % / floor math is exact.
  const b = new Uint8Array(8);
  let n = v;
  for (let i = 0; i < 8; i++) {
    b[i] = n % 256;
    n = Math.floor(n / 256);
  }
  return b;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
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
