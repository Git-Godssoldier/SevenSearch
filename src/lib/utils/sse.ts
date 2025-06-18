/**
 * Server-Sent Events utility for real-time search updates
 */

export interface SSEMessage {
  step: number;
  type: string;
  payload: any;
  error?: boolean;
  errorType?: string;
}

export interface SSEOptions {
  onMessage?: (message: SSEMessage) => void;
  onError?: (error: Event) => void;
  onOpen?: (event: Event) => void;
  onClose?: () => void;
  retry?: number;
  timeout?: number;
}

/**
 * SSE Client for consuming search progress updates
 */
export class SSEClient {
  private eventSource: EventSource | null = null;
  private options: SSEOptions;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string, options: SSEOptions = {}) {
    this.url = url;
    this.options = {
      retry: 3000,
      timeout: 30000,
      ...options
    };
  }

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    try {
      this.eventSource = new EventSource(this.url);

      this.eventSource.onopen = (event) => {
        console.log('[SSE] Connection opened');
        this.reconnectAttempts = 0;
        this.options.onOpen?.(event);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data);
          console.log('[SSE] Message received:', message);
          this.options.onMessage?.(message);
        } catch (parseError) {
          console.error('[SSE] Error parsing message:', parseError);
        }
      };

      this.eventSource.onerror = (event) => {
        console.error('[SSE] Connection error:', event);
        this.options.onError?.(event);
        
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.handleReconnect();
        }
      };

      // Set up timeout
      if (this.options.timeout) {
        setTimeout(() => {
          if (this.eventSource && this.eventSource.readyState === EventSource.CONNECTING) {
            console.warn('[SSE] Connection timeout');
            this.disconnect();
          }
        }, this.options.timeout);
      }

    } catch (error) {
      console.error('[SSE] Error creating EventSource:', error);
      this.options.onError?.(error as Event);
    }
  }

  /**
   * Disconnect from SSE endpoint
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('[SSE] Connection closed');
      this.options.onClose?.();
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Get connection state
   */
  getState(): number | null {
    return this.eventSource?.readyState ?? null;
  }
}

/**
 * Hook for using SSE in React components
 */
export function useSSE(url: string, options: SSEOptions = {}) {
  const [client, setClient] = useState<SSEClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);

  useEffect(() => {
    const sseClient = new SSEClient(url, {
      ...options,
      onOpen: (event) => {
        setIsConnected(true);
        options.onOpen?.(event);
      },
      onMessage: (message) => {
        setLastMessage(message);
        options.onMessage?.(message);
      },
      onError: (error) => {
        setIsConnected(false);
        options.onError?.(error);
      },
      onClose: () => {
        setIsConnected(false);
        options.onClose?.();
      }
    });

    setClient(sseClient);
    sseClient.connect();

    return () => {
      sseClient.disconnect();
    };
  }, [url]);

  return {
    client,
    isConnected,
    lastMessage,
    disconnect: () => client?.disconnect()
  };
}

// Import React hooks at the top
import { useState, useEffect } from 'react';

/**
 * Create a streaming search client that connects to the enhance-search endpoint
 */
export function createSearchStreamClient(query: string, searchId: string): SSEClient {
  const url = `/api/enhance-search`;
  
  return new SSEClient(url, {
    onMessage: (message) => {
      // Handle search progress messages
      console.log(`[Search Stream] Step ${message.step}: ${message.type}`);
    },
    onError: (error) => {
      console.error('[Search Stream] Error:', error);
    }
  });
}

/**
 * Utility function to send webhook notifications
 */
export async function sendWebhookUpdate(
  searchId: string, 
  step: number, 
  type: string, 
  payload: any = {}
): Promise<boolean> {
  try {
    const response = await fetch('/api/webhooks/search-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        searchId,
        step,
        type,
        payload,
        timestamp: new Date().toISOString()
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('[Webhook] Failed to send update:', error);
    return false;
  }
}