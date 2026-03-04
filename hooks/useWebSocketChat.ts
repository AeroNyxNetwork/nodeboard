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
 * Protocol (from project docs):
 *   Frontend → Backend:
 *     {"type":"agent_request","request_id":"uuid","action":"chat","payload":{...}}
 *   Backend → Frontend (complete):
 *     {"type":"agent_response","request_id":"uuid","status":"success","payload":{...}}
 *   Backend → Frontend (stream):
 *     {"type":"agent_stream","request_id":"uuid","chunk":"...","done":false}
 *     {"type":"agent_stream","request_id":"uuid","chunk":"...","done":true}
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
 * Last Modified: v1.0.0 - Initial WebSocket chat hook for Phase 2
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

  const handleAgentResponse = useCallback(
    (data: { request_id: string; status: string; payload?: { response?: string } }) => {
      const content = data.payload?.response || '';
      const isErr = data.status === 'error';

      setMessages((prev) => [
        ...prev,
        {
          id: data.request_id,
          role: 'assistant',
          content: isErr ? `Error: ${content || 'Unknown error'}` : content,
          timestamp: Date.now(),
          isError: isErr,
        },
      ]);
      setIsStreaming(false);
      activeStreamIdRef.current = null;
    },
    []
  );

  const handleAgentStream = useCallback(
    (data: { request_id: string; chunk: string; done: boolean }) => {
      const { request_id, chunk, done } = data;
      const buffer = streamBufferRef.current;

      // Accumulate chunk
      const current = buffer.get(request_id) || '';
      const updated = current + chunk;
      buffer.set(request_id, updated);

      // Track active stream
      if (!activeStreamIdRef.current) {
        activeStreamIdRef.current = request_id;
        setIsStreaming(true);
      }

      // Update or append assistant message
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === request_id);
        if (idx >= 0) {
          // Update existing message
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
            role: 'assistant',
            content: updated,
            timestamp: Date.now(),
            isStreaming: !done,
          },
        ];
      });

      if (done) {
        buffer.delete(request_id);
        activeStreamIdRef.current = null;
        setIsStreaming(false);
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

        switch (data.type) {
          case 'auth_ok':
            handleAuthOk(data);
            break;
          case 'pong':
            handlePong();
            break;
          case 'agent_response':
            handleAgentResponse(data);
            break;
          case 'agent_stream':
            handleAgentStream(data);
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
    handleAgentResponse,
    handleAgentStream,
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
