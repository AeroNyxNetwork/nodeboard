/**
 * ============================================
 * AeroNyx Privacy Network - WebSocket Chat Hook
 * ============================================
 * File Path: hooks/useWebSocketChat.ts
 *
 * Creation Reason: Phase 2 — AI Encrypted Terminal requires a custom
 *   WebSocket hook for real-time bidirectional communication with the
 *   node's AI agent via the AeroNyx tunnel relay.
 *
 * Main Functionality:
 *   - Native WebSocket connection with automatic reconnection (exponential backoff)
 *   - Heartbeat (ping/pong) keep-alive
 *   - Message send (agent_request) with auto-generated request_id
 *   - Stream assembly: collects agent_stream chunks into complete messages
 *   - Connection state tracking (connecting, connected, disconnected, error)
 *   - Graceful cleanup on unmount or manual disconnect
 *
 * Dependencies:
 *   - stores/authStore.ts (apiKey for WS URL)
 *   - lib/constants.ts (getWsUrl, WS_CONFIG)
 *
 * Protocol (actual CMS messages — confirmed working 2026-03-05):
 *   Frontend → CMS:
 *     {"type":"agent_request","request_id":"uuid","action":"chat","payload":{...}}
 *   CMS → Frontend (ack):
 *     {"type":"ack","request_id":"uuid"}
 *   CMS → Frontend (stream):
 *     {"type":"stream","request_id":"uuid","chunk":"...","done":false}
 *     {"type":"stream","request_id":"uuid","chunk":"","done":true}
 *   CMS → Frontend (complete response, arrives after stream done):
 *     {"type":"response","request_id":"uuid","status":"success","payload":{"response":"..."}}
 *   Heartbeat: {"type":"ping"} / {"type":"pong"}
 *   Auth OK: {"type":"auth_ok","node_id":"...","node_name":"..."}
 *   Error: {"type":"error","message":"..."}
 *
 * ⚠️ Important Note for Next Developer:
 * - The hook manages its own WebSocket lifecycle — do NOT create additional
 *   WebSocket connections to the same node from other components
 * - reconnect logic uses exponential backoff with jitter
 * - ping/pong keeps the connection alive; if pong is not received within
 *   PONG_TIMEOUT, the connection is considered dead and reconnects
 * - All timers (ping interval, pong timeout, reconnect delay) are cleaned
 *   up on unmount via the cleanup function in useEffect
 * - ChatMessage type is local to this hook — it's the UI-facing data model,
 *   NOT the raw WebSocket message format
 * - streamingMessage ref holds the in-progress assistant message during streaming
 *
 * Last Modified: v1.1.0 - Adapted to actual CMS message types:
 *   agent_stream → stream, agent_response → response, added ack handler.
 *   handleResponse is smart: if a streamed message already exists for the
 *   request_id, it finalizes it instead of creating a duplicate.
 * Previous: v1.0.0 - Initial WebSocket chat hook for Phase 2
 * ============================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getWsUrl, WS_CONFIG } from '@/lib/constants';

// ============================================
// Types
// ============================================

/** Connection states exposed to UI */
export type WsConnectionState =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

/** A single chat message (UI model) */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** True while the assistant message is still being streamed */
  isStreaming?: boolean;
  /** If status === 'error' on agent_response */
  isError?: boolean;
}

/** Auth OK payload from server */
interface AuthOkPayload {
  type: 'auth_ok';
  node_id: string;
  node_name: string;
}

/** Return type of the hook */
export interface UseWebSocketChatReturn {
  messages: ChatMessage[];
  connectionState: WsConnectionState;
  nodeName: string | null;
  /** Send a chat message to the agent */
  sendMessage: (prompt: string, options?: SendOptions) => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Manually reconnect */
  reconnect: () => void;
  /** Clear message history */
  clearMessages: () => void;
  /** Whether the assistant is currently streaming a response */
  isStreaming: boolean;
}

interface SendOptions {
  model?: string;
  stream?: boolean;
  action?: string;
}

// ============================================
// UUID Generator (crypto-based)
// ============================================

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

  // ---- Refs (mutable, not triggering re-renders) ----
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  /** Tracks the request_id of the currently streaming assistant message */
  const activeStreamIdRef = useRef<string | null>(null);
  /** Accumulates stream chunks keyed by request_id */
  const streamBufferRef = useRef<Map<string, string>>(new Map());

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

  // ============================================
  // Ping/Pong Keep-Alive
  // ============================================

  const startPingPong = useCallback(() => {
    clearPingPong();

    pingIntervalRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));

        // Set pong timeout — if no pong received, force reconnect
        pongTimeoutRef.current = setTimeout(() => {
          console.warn('[AeroNyx WS] Pong timeout — connection may be dead');
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
  // Message Handlers
  // ============================================

  const handleAuthOk = useCallback((data: AuthOkPayload) => {
    console.log('[AeroNyx WS] Authenticated:', data.node_name);
    setNodeName(data.node_name);
    setConnectionState('connected');
    reconnectAttemptRef.current = 0;
    startPingPong();

    // System message
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'system',
        content: `Secure tunnel connected to ${data.node_name}`,
        timestamp: Date.now(),
      },
    ]);
  }, [startPingPong]);

  /**
   * Handle "ack" — CMS confirms message received.
   * Currently just logged; could be used for delivery indicators in future.
   */
  const handleAck = useCallback((data: { request_id: string }) => {
    console.log('[AeroNyx WS] Message acknowledged:', data.request_id);
  }, []);

  /**
   * Handle "response" — complete AI response (arrives after stream ends,
   * or as the sole reply if streaming was disabled).
   *
   * If we already have a streamed message with this request_id, we skip
   * creating a duplicate. If not (non-streaming mode), we create the message.
   */
  const handleResponse = useCallback(
    (data: { request_id: string; status: string; payload?: { response?: string; error?: string } }) => {
      const isErr = data.status === 'error';
      const content = isErr
        ? (data.payload?.error || data.payload?.response || 'Unknown error')
        : (data.payload?.response || '');

      setMessages((prev) => {
        // Check if we already have a streamed message with this request_id
        const existingIdx = prev.findIndex((m) => m.id === data.request_id);

        if (existingIdx >= 0) {
          // Stream already completed — finalize the message (mark not streaming, update content if error)
          const copy = [...prev];
          copy[existingIdx] = {
            ...copy[existingIdx],
            content: isErr ? `Error: ${content}` : copy[existingIdx].content,
            isStreaming: false,
            isError: isErr,
          };
          return copy;
        }

        // No streamed message exists — this is a non-streaming response
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

      // Accumulate chunk
      const current = buffer.get(request_id) || '';
      const updated = current + (chunk || '');
      buffer.set(request_id, updated);

      // Track active stream — allow switching to a new request_id
      if (activeStreamIdRef.current !== request_id) {
        activeStreamIdRef.current = request_id;
        setIsStreaming(true);
      }

      // Update or append assistant message
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === request_id);
        if (idx >= 0) {
          // Update existing message in place
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx],
            content: updated,
            isStreaming: !done,
          };
          return copy;
        }
        // New streaming message
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
    console.error('[AeroNyx WS] Server error:', errMsg);
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
  // WebSocket Connection
  // ============================================

  const connect = useCallback(() => {
    if (!nodeId || !apiKey) {
      setConnectionState('error');
      return;
    }

    // Clean up any existing connection
    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    clearPingPong();
    intentionalCloseRef.current = false;
    setConnectionState('connecting');

    const url = getWsUrl(nodeId, apiKey);
    console.log('[AeroNyx WS] Connecting...');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[AeroNyx WS] Socket opened, awaiting auth_ok...');
      setConnectionState('authenticating');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // === DEBUG LOG — remove after confirming stream works ===
        if (data.type !== 'pong') {
          console.log('[AeroNyx WS] ←', data.type, {
            request_id: data.request_id?.slice(0, 8),
            chunk_len: data.chunk?.length,
            done: data.done,
            status: data.status,
          });
        }

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
          default:
            console.log('[AeroNyx WS] Unknown message type:', data.type);
        }
      } catch (err) {
        console.error('[AeroNyx WS] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log(`[AeroNyx WS] Closed: code=${event.code} reason=${event.reason}`);
      clearPingPong();
      wsRef.current = null;

      // Clean up streaming state
      if (activeStreamIdRef.current) {
        setIsStreaming(false);
        activeStreamIdRef.current = null;
      }

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

      // Intentional close — stay disconnected
      if (intentionalCloseRef.current) {
        setConnectionState('disconnected');
        return;
      }

      // Unexpected close — try reconnecting
      if (reconnectAttemptRef.current < WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
        const attempt = reconnectAttemptRef.current;
        // Exponential backoff with jitter
        const delay = Math.min(
          WS_CONFIG.RECONNECT_BASE_DELAY * Math.pow(2, attempt) +
            Math.random() * 1000,
          WS_CONFIG.RECONNECT_MAX_DELAY
        );

        console.log(
          `[AeroNyx WS] Reconnecting in ${Math.round(delay)}ms (attempt ${attempt + 1}/${WS_CONFIG.MAX_RECONNECT_ATTEMPTS})`
        );
        setConnectionState('reconnecting');
        reconnectAttemptRef.current = attempt + 1;

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        console.error('[AeroNyx WS] Max reconnect attempts reached');
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

    ws.onerror = (event) => {
      console.error('[AeroNyx WS] Error event:', event);
      // onclose will fire after this — reconnect logic lives there
    };
  }, [
    nodeId,
    apiKey,
    clearPingPong,
    handleAuthOk,
    handlePong,
    handleAck,
    handleStream,
    handleResponse,
    handleWsError,
  ]);

  // ============================================
  // Public Methods
  // ============================================

  const sendMessage = useCallback(
    (prompt: string, options?: SendOptions) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('[AeroNyx WS] Cannot send — not connected');
        return;
      }

      const requestId = generateId();
      const message = {
        type: 'agent_request',
        request_id: requestId,
        action: options?.action || 'chat',
        payload: {
          prompt,
          model: options?.model || 'default',
          stream: options?.stream !== false, // default true
        },
      };

      // Add user message to state immediately
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(), // separate ID for user msg
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        },
      ]);

      ws.send(JSON.stringify(message));
    },
    []
  );

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    clearPingPong();

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setConnectionState('disconnected');
    setIsStreaming(false);
    activeStreamIdRef.current = null;
  }, [clearReconnectTimer, clearPingPong]);

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
  // Lifecycle: Connect on mount, cleanup on unmount
  // ============================================

  useEffect(() => {
    if (nodeId && apiKey) {
      connect();
    }

    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      clearPingPong();
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
  };
}
