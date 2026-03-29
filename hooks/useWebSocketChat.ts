/**
 * ============================================
 * AeroNyx Privacy Network - WebSocket Chat Hook
 * ============================================
 * File Path: hooks/useWebSocketChat.ts
 *
 * Modification Reason (v2.0.0):
 *   Integrated E2E encryption (XChaCha20-Poly1305 + X25519):
 *   - After auth_ok, sends e2e_init with ephemeral public key
 *   - On e2e_ready, completes handshake → all chat encrypted
 *   - New message types: e2e_message (send), e2e_stream / e2e_response (recv)
 *   - Graceful degradation: 5s handshake timeout → falls back to plaintext
 *   - MPI requests (Memory Explorer) do NOT use E2E — only chat
 *   - E2E session destroyed on disconnect, new session on reconnect
 *   - Exposed `isE2E` flag for UI (e.g. lock icon in status bar)
 *
 *   All changes marked with 🔐 E2E comments.
 *   Existing plaintext flow is UNTOUCHED — E2E wraps around it.
 *
 * Previous (v1.1.0):
 *   Adapted to actual CMS message types (stream, response, ack).
 *   No encryption.
 *
 * Main Functionality:
 *   - Native WebSocket connection with auto-reconnect (exponential backoff)
 *   - Heartbeat (ping/pong) keep-alive
 *   - 🔐 E2E handshake after auth_ok (optional, degrades gracefully)
 *   - 🔐 Encrypted send (e2e_message) / receive (e2e_stream, e2e_response)
 *   - Stream assembly: collects chunks into complete messages
 *   - Connection state tracking
 *   - Graceful cleanup on unmount or manual disconnect
 *
 * Dependencies:
 *   - stores/authStore.ts (apiKey for WS URL)
 *   - lib/constants.ts (getWsUrl, WS_CONFIG)
 *   - lib/e2e-crypto.ts (E2ESession) 🔐
 *
 * Protocol — Plaintext (unchanged):
 *   → {"type":"agent_request","request_id":"uuid","action":"chat","payload":{...}}
 *   ← {"type":"ack","request_id":"uuid"}
 *   ← {"type":"stream","request_id":"uuid","chunk":"...","done":false/true}
 *   ← {"type":"response","request_id":"uuid","status":"success","payload":{...}}
 *
 * Protocol — E2E (new):
 *   → {"type":"e2e_init","ephemeral_pk":"hex"}
 *   ← {"type":"e2e_ready","x25519_pk":"hex"}
 *   → {"type":"e2e_message","request_id":"uuid","action":"chat","nonce":"hex","ciphertext":"hex"}
 *   ← {"type":"e2e_stream","request_id":"uuid","nonce":"hex","ciphertext":"hex","done":false}
 *   ← {"type":"e2e_stream","request_id":"uuid","done":true}  (no nonce/ct)
 *   ← {"type":"e2e_response","request_id":"uuid","nonce":"hex","ciphertext":"hex"}
 *
 * ⚠️ Important Note for Next Developer:
 * - E2E key material lives ONLY in e2eSessionRef (memory). Never persist.
 * - Each connect() creates a new E2ESession (forward secrecy).
 * - If e2e_ready not received within 5s, falls back to plaintext silently.
 * - MPI requests (action != 'chat') always use plaintext agent_request.
 * - The 'isE2E' return value reflects current encryption state for UI.
 * - handleStream/handleResponse are reused by E2E handlers after decryption.
 *
 * Last Modified: v2.0.0 - E2E encryption integration
 * Previous: v1.1.0 - Adapted to actual CMS message types
 * ============================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getWsUrl, WS_CONFIG } from '@/lib/constants';
import { E2ESession } from '@/lib/e2e-crypto'; // 🔐 E2E

// ============================================
// Types
// ============================================

export type WsConnectionState =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  isError?: boolean;
}

interface AuthOkPayload {
  type: 'auth_ok';
  node_id: string;
  node_name: string;
}

export interface UseWebSocketChatReturn {
  messages: ChatMessage[];
  connectionState: WsConnectionState;
  nodeName: string | null;
  sendMessage: (prompt: string, options?: SendOptions) => void;
  disconnect: () => void;
  reconnect: () => void;
  clearMessages: () => void;
  isStreaming: boolean;
  /** 🔐 Whether E2E encryption is active for this session */
  isE2E: boolean;
}

interface SendOptions {
  model?: string;
  stream?: boolean;
  action?: string;
}

// ============================================
// UUID Generator
// ============================================

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================
// Constants
// ============================================

/** 🔐 How long to wait for e2e_ready before falling back to plaintext */
const E2E_HANDSHAKE_TIMEOUT_MS = 5000;

// ============================================
// Hook Implementation
// ============================================

export function useWebSocketChat(nodeId: string): UseWebSocketChatReturn {
  // ---- External state ----
  const apiKey = useAuthStore((s) => s.apiKey);

  // ---- React state ----
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionState, setConnectionState] = useState<WsConnectionState>('idle');
  const [nodeName, setNodeName] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isE2E, setIsE2E] = useState(false); // 🔐 E2E

  // ---- Refs ----
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const activeStreamIdRef = useRef<string | null>(null);
  const streamBufferRef = useRef<Map<string, string>>(new Map());

  // 🔐 E2E refs
  const e2eSessionRef = useRef<E2ESession | null>(null);
  const e2eHandshakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================
  // Timer Cleanup Helpers
  // ============================================

  const clearPingPong = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // 🔐 E2E cleanup helper
  const destroyE2E = useCallback(() => {
    if (e2eHandshakeTimerRef.current) {
      clearTimeout(e2eHandshakeTimerRef.current);
      e2eHandshakeTimerRef.current = null;
    }
    if (e2eSessionRef.current) {
      e2eSessionRef.current.destroy();
      e2eSessionRef.current = null;
    }
    setIsE2E(false);
  }, []);

  // ============================================
  // Ping/Pong Keep-Alive
  // ============================================

  const startPingPong = useCallback(() => {
    clearPingPong();

    pingIntervalRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));

        pongTimeoutRef.current = setTimeout(() => {
          console.warn('[WS] Pong timeout — connection may be dead');
          ws.close(4002, 'Pong timeout');
        }, WS_CONFIG.PONG_TIMEOUT);
      }
    }, WS_CONFIG.PING_INTERVAL);
  }, [clearPingPong]);

  const handlePong = useCallback(() => {
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);

  // ============================================
  // Message Handlers (plaintext — reused by E2E after decryption)
  // ============================================

  const handleAuthOk = useCallback((data: AuthOkPayload) => {
    console.log('[WS] Authenticated:', data.node_name);
    setNodeName(data.node_name);
    setConnectionState('connected');
    reconnectAttemptRef.current = 0;
    startPingPong();

    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'system',
        content: `Secure tunnel connected to ${data.node_name}`,
        timestamp: Date.now(),
      },
    ]);

    // 🔐 E2E: Initiate handshake after auth
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const session = new E2ESession();
      e2eSessionRef.current = session;

      ws.send(JSON.stringify({
        type: 'e2e_init',
        ephemeral_pk: session.getEphemeralPublicKeyHex(),
      }));

      // 🔐 Timeout: if no e2e_ready within 5s, fall back to plaintext
      e2eHandshakeTimerRef.current = setTimeout(() => {
        if (e2eSessionRef.current && !e2eSessionRef.current.isReady()) {
          console.warn('[E2E] Handshake timeout — falling back to plaintext');
          e2eSessionRef.current.destroy();
          e2eSessionRef.current = null;
        }
      }, E2E_HANDSHAKE_TIMEOUT_MS);
    }
  }, [startPingPong]);

  const handleAck = useCallback((_data: { request_id: string }) => {
    // ACK received — could be used for delivery indicators in future
  }, []);

  const handleResponse = useCallback(
    (data: { request_id: string; status: string; payload?: { response?: string; error?: string } }) => {
      const isErr = data.status === 'error';
      const content = isErr
        ? (data.payload?.error || data.payload?.response || 'Unknown error')
        : (data.payload?.response || '');

      setMessages((prev) => {
        const existingIdx = prev.findIndex((m) => m.id === data.request_id);

        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = {
            ...copy[existingIdx],
            content: isErr ? `Error: ${content}` : copy[existingIdx].content,
            isStreaming: false,
            isError: isErr,
          };
          return copy;
        }

        return [
          ...prev,
          {
            id: data.request_id,
            role: 'assistant',
            content: isErr ? `Error: ${content}` : content,
            timestamp: Date.now(),
            isError: isErr,
          },
        ];
      });

      setIsStreaming(false);
      activeStreamIdRef.current = null;
      streamBufferRef.current.delete(data.request_id);
    },
    []
  );

  const handleStream = useCallback(
    (data: { request_id: string; chunk: string; done: boolean }) => {
      const { request_id, chunk, done } = data;
      const buffer = streamBufferRef.current;

      const current = buffer.get(request_id) || '';
      const updated = current + (chunk || '');
      buffer.set(request_id, updated);

      if (activeStreamIdRef.current !== request_id) {
        activeStreamIdRef.current = request_id;
        setIsStreaming(true);
      }

      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === request_id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx],
            content: updated,
            isStreaming: !done,
          };
          return copy;
        }
        return [
          ...prev,
          {
            id: request_id,
            role: 'assistant' as const,
            content: updated,
            timestamp: Date.now(),
            isStreaming: !done,
          },
        ];
      });

      if (done) {
        buffer.delete(request_id);
        if (activeStreamIdRef.current === request_id) {
          activeStreamIdRef.current = null;
          setIsStreaming(false);
        }
      }
    },
    []
  );

  const handleWsError = useCallback((data: { message?: string }) => {
    const errMsg = data.message || 'WebSocket error';
    console.error('[WS] Server error:', errMsg);
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'system',
        content: `Error: ${errMsg}`,
        timestamp: Date.now(),
        isError: true,
      },
    ]);
  }, []);

  // ============================================
  // 🔐 E2E Message Handlers
  // ============================================

  /** 🔐 Rust node responded with its X25519 public key — complete handshake */
  const handleE2eReady = useCallback((data: { x25519_pk?: string }) => {
    // Clear handshake timeout
    if (e2eHandshakeTimerRef.current) {
      clearTimeout(e2eHandshakeTimerRef.current);
      e2eHandshakeTimerRef.current = null;
    }

    const session = e2eSessionRef.current;
    if (!session || !data.x25519_pk) {
      console.error('[E2E] Missing session or x25519_pk in e2e_ready');
      return;
    }

    session.completeHandshake(data.x25519_pk);
    setIsE2E(true);
    console.log('[E2E] ✅ Handshake complete — encryption active');
  }, []);

  /** 🔐 Encrypted stream chunk — decrypt then delegate to handleStream */
   const handleE2eStream = useCallback(
    (data: { request_id: string; nonce?: string; ciphertext?: string; done?: boolean }) => {
      const session = e2eSessionRef.current;
      if (!session || !session.isReady()) return;
  
      const done = data.done || false;
  
      let chunk = '';
      if (data.nonce && data.ciphertext) {
        const plaintext = session.decrypt(data.nonce, data.ciphertext);
        if (plaintext === null) {
          console.error('[E2E] Decryption failed for stream chunk');
          return;
        }
        chunk = plaintext;
      }
  
      console.log('[E2E] stream chunk:', JSON.stringify({ request_id: data.request_id, chunk, done }));
      handleStream({ request_id: data.request_id, chunk, done });
    },
    [handleStream]
  );

  /** 🔐 Encrypted complete response — decrypt then delegate to handleResponse */
  const handleE2eResponse = useCallback(
    (data: { request_id: string; nonce?: string; ciphertext?: string; status?: string }) => {
      const session = e2eSessionRef.current;
      if (!session || !session.isReady()) return;
  
      if (!data.nonce || !data.ciphertext) {
        console.error('[E2E] Missing nonce/ciphertext in e2e_response');
        return;
      }
  
      const plaintext = session.decrypt(data.nonce, data.ciphertext);
      if (plaintext === null) {
        console.error('[E2E] Decryption failed for response');
        return;
      }
  
      console.log('[E2E] response plaintext:', plaintext.slice(0, 200));
  
      let payload: { response?: string; error?: string };
      try {
        payload = JSON.parse(plaintext);
      } catch {
        payload = { response: plaintext };
      }
  
      handleResponse({
        request_id: data.request_id,
        status: data.status || 'success',
        payload,
      });
    },
    [handleResponse]
  );
  // ============================================
  // WebSocket Connection
  // ============================================

  const connect = useCallback(() => {
    if (!nodeId || !apiKey) {
      setConnectionState('error');
      return;
    }

    // Clean up existing connection
    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    clearPingPong();
    destroyE2E(); // 🔐 Clean up previous E2E session
    intentionalCloseRef.current = false;
    setConnectionState('connecting');

    const url = getWsUrl(nodeId, apiKey);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState('authenticating');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] RAW message:', JSON.stringify(data).slice(0, 300));

        switch (data.type) {
          case 'auth_ok':
            handleAuthOk(data);
            break;
          case 'pong':
            handlePong();
            break;
          case 'ack':
            handleAck(data);
            break;
          case 'stream':
            handleStream(data);
            break;
          case 'response':
            handleResponse(data);
            break;
          case 'error':
            handleWsError(data);
            break;

          // 🔐 E2E message types
          // Rust uses dot-separated (e2e.ready), normalize to underscore
          case 'e2e_ready':
          case 'e2e.ready':
            handleE2eReady(data);
            break;
          case 'e2e_stream':
          case 'e2e.stream':
            handleE2eStream(data);
            break;
          case 'e2e_response':
          case 'e2e.response':
            handleE2eResponse(data);
            break;

          default:
            console.log('[WS] Unknown message type:', data.type);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      clearPingPong();
      destroyE2E(); // 🔐 Destroy E2E session on close
      wsRef.current = null;

      // Clean up streaming state
      if (activeStreamIdRef.current) {
        setIsStreaming(false);
        activeStreamIdRef.current = null;
      }
      streamBufferRef.current.clear(); // Also clear stale buffers

      // Auth failure — do not reconnect
      if (event.code === 4001) {
        setConnectionState('error');
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'system',
            content: 'Authentication failed. Please check your session.',
            timestamp: Date.now(),
            isError: true,
          },
        ]);
        return;
      }

      // Intentional close
      if (intentionalCloseRef.current) {
        setConnectionState('disconnected');
        return;
      }

      // Unexpected close — reconnect with backoff
      if (reconnectAttemptRef.current < WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(
          WS_CONFIG.RECONNECT_BASE_DELAY * Math.pow(2, attempt) + Math.random() * 1000,
          WS_CONFIG.RECONNECT_MAX_DELAY
        );

        setConnectionState('reconnecting');
        reconnectAttemptRef.current = attempt + 1;

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setConnectionState('error');
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'system',
            content: 'Connection lost. Max reconnection attempts reached. Click "Reconnect" to try again.',
            timestamp: Date.now(),
            isError: true,
          },
        ]);
      }
    };

    ws.onerror = () => {
      // onclose will fire after this — reconnect logic lives there
    };
  }, [
    nodeId,
    apiKey,
    clearPingPong,
    destroyE2E,
    handleAuthOk,
    handlePong,
    handleAck,
    handleStream,
    handleResponse,
    handleWsError,
    handleE2eReady,
    handleE2eStream,
    handleE2eResponse,
  ]);

  // ============================================
  // Public Methods
  // ============================================

  const sendMessage = useCallback(
    (prompt: string, options?: SendOptions) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('[WS] Cannot send — not connected');
        return;
      }

      const requestId = generateId();
      const action = options?.action || 'chat';
      const e2e = e2eSessionRef.current;

      // 🔐 E2E: encrypt chat messages when handshake is complete
      // MPI and non-chat actions always use plaintext
      if (action === 'chat' && e2e && e2e.isReady()) {
        const { nonce, ciphertext } = e2e.encrypt(prompt);
        ws.send(JSON.stringify({
          type: 'e2e_message',
          request_id: requestId,
          action: 'chat',
          nonce,
          ciphertext,
        }));
      } else {
        // Plaintext mode (fallback or non-chat action)
        ws.send(JSON.stringify({
          type: 'agent_request',
          request_id: requestId,
          action,
          payload: {
            prompt,
            model: options?.model || 'default',
            stream: options?.stream !== false,
          },
        }));
      }

      // Add user message to state immediately
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(), // separate ID for user message
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    clearPingPong();
    destroyE2E(); // 🔐

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setConnectionState('disconnected');
    setIsStreaming(false);
    activeStreamIdRef.current = null;
  }, [clearReconnectTimer, clearPingPong, destroyE2E]);

  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    streamBufferRef.current.clear();
    connect();
  }, [connect, clearReconnectTimer]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    streamBufferRef.current.clear();
  }, []);

  // ============================================
  // Lifecycle
  // ============================================

  useEffect(() => {
    if (nodeId && apiKey) {
      connect();
    }

    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      clearPingPong();
      destroyE2E(); // 🔐
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, apiKey]);

  return {
    messages,
    connectionState,
    nodeName,
    sendMessage,
    disconnect,
    reconnect,
    clearMessages,
    isStreaming,
    isE2E, // 🔐
  };
}
