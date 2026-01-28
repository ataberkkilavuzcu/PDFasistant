/**
 * Debounced chat hook
 * Wraps useChat to add debouncing for rapid successive message sends
 * Allows Enter key to work immediately while preventing programmatic spam
 */

import { useCallback, useRef, useEffect } from 'react';
import type { UseChatReturn } from './useChat';

interface UseDebouncedChatConfig {
  /** Delay in milliseconds (default: 800ms) */
  delay?: number;
  /** If true, all sends are debounced. If false, only debounce rapid calls (default: false) */
  debounceAll?: boolean;
}

/**
 * Wraps useChat with debouncing for sendMessage
 *
 * Behavior:
 * - Enter key sends: Immediate (no debounce) when debounceAll=false
 * - Programmatic sends: Debounced to prevent rapid spam
 * - Rapid calls: Only the last call in the delay window is executed
 */
export function useDebouncedChat(
  chat: UseChatReturn,
  config: UseDebouncedChatConfig = {}
): UseChatReturn {
  const { delay = 800, debounceAll = false } = config;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCallRef = useRef<{
    documentId: string;
    message: string;
    pageContext: string;
    currentPage: number;
  } | null>(null);
  const isDebouncingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const sendMessageDebounced = useCallback(
    async (
      documentId: string,
      message: string,
      pageContext: string,
      currentPage: number
    ) => {
      // If already loading and streaming, don't allow new sends
      if (chat.isLoading) {
        return;
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Store pending call
      pendingCallRef.current = {
        documentId,
        message,
        pageContext,
        currentPage,
      };

      // If debounceAll is false and we're not already debouncing, send immediately
      // This allows Enter key to work immediately while still preventing rapid programmatic calls
      if (!debounceAll && !isDebouncingRef.current) {
        // Mark as debouncing to catch rapid follow-up calls
        isDebouncingRef.current = true;

        // Send immediately
        await chat.sendMessage(documentId, message, pageContext, currentPage);
        pendingCallRef.current = null;

        // Reset debounce flag after delay window
        timeoutRef.current = setTimeout(() => {
          isDebouncingRef.current = false;
          timeoutRef.current = null;
        }, delay);

        return;
      }

      // Set up debounced send
      timeoutRef.current = setTimeout(async () => {
        if (pendingCallRef.current && !chat.isLoading) {
          const { documentId, message, pageContext, currentPage } = pendingCallRef.current;
          await chat.sendMessage(documentId, message, pageContext, currentPage);
          pendingCallRef.current = null;
        }
        isDebouncingRef.current = false;
        timeoutRef.current = null;
      }, delay);
    },
    [chat, delay, debounceAll]
  );

  // Return chat interface with debounced sendMessage
  return {
    ...chat,
    sendMessage: sendMessageDebounced,
  };
}
