'use client';

/**
 * Custom hook for chat state and history management
 * Supports streaming responses with automatic retry logic
 */

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ChatState } from '@/types/chat';
import type { ChatRequest } from '@/types/api';
import { db } from '@/lib/db';
import { sendChatMessageStream } from '@/lib/api/chat-client';

interface UseChatOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
}

interface UseChatReturn extends ChatState {
  sendMessage: (
    documentId: string,
    message: string,
    pageContext: string,
    currentPage: number
  ) => Promise<void>;
  loadHistory: (documentId: string) => Promise<void>;
  clearHistory: (documentId: string) => Promise<void>;
  /** Cancel the current streaming request */
  cancelMessage: () => void;
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Hook for managing chat state and interactions
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { maxRetries = 3 } = options;

  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
  });

  // Track abort controller for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track if we're streaming to prevent duplicate messages
  const isStreamingRef = useRef(false);

  const loadHistory = useCallback(async (documentId: string) => {
    try {
      const messages = await db.messages
        .where('documentId')
        .equals(documentId)
        .sortBy('timestamp');

      setState((prev) => ({
        ...prev,
        messages: messages as ChatMessage[],
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load history',
      }));
    }
  }, []);

  const sendMessage = useCallback(
    async (
      documentId: string,
      message: string,
      pageContext: string,
      currentPage: number
    ) => {
      // Prevent duplicate sends if already streaming
      if (isStreamingRef.current) {
        return;
      }

      isStreamingRef.current = true;

      // Add user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        documentId,
        role: 'user',
        content: message,
        pageContext: currentPage,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        error: null,
      }));

      // Save user message to DB
      await db.messages.put(userMessage);

      // Create placeholder for assistant message (for streaming)
      const assistantMessageId = generateMessageId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        documentId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      try {
        // Prepare conversation history for API (exclude current message)
        const conversationHistory = state.messages.slice(-10).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const request: ChatRequest = {
          message,
          pageContext,
          conversationHistory,
          stream: true,
        };

        // Track if we encountered an error during streaming
        let streamError: string | null = null;
        let accumulatedContent = '';
        let pageReferences: number[] | undefined;

        // Create abort controller for this request
        abortControllerRef.current = new AbortController();

        // Streaming response
        const stream = sendChatMessageStream(request, {
          maxRetries,
          onRetry: (attempt, error) => {
            setState((prev) => ({
              ...prev,
              error: `Retrying (${attempt}/${maxRetries}): ${error.message}`,
            }));
          },
        }, abortControllerRef.current.signal);

        for await (const event of stream) {
          switch (event.type) {
            case 'content':
              accumulatedContent += event.data;
              setState((prev) => {
                const updatedMessages = prev.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                );
                // Clear error on successful content (handles retry recovery)
                return { ...prev, messages: updatedMessages, error: null };
              });
              break;

            case 'done':
              pageReferences = event.pageReferences;
              // Clear error on successful completion
              setState((prev) => ({ ...prev, error: null }));
              break;

            case 'error':
              streamError = event.error;
              break;
          }
        }

        // Update final assistant message
        const finalMessage: ChatMessage = {
          id: assistantMessageId,
          documentId,
          role: 'assistant',
          content: accumulatedContent,
          pageReferences,
          timestamp: new Date(),
        };

        // Save assistant message to DB
        await db.messages.put(finalMessage);

        setState((prev) => {
          const updatedMessages = prev.messages.map((msg) =>
            msg.id === assistantMessageId ? finalMessage : msg
          );
          return {
            ...prev,
            messages: updatedMessages,
            isLoading: false,
            error: streamError,
          };
        });

        if (streamError) {
          throw new Error(streamError);
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to send message',
        }));
      } finally {
        // Clear abort controller
        abortControllerRef.current = null;
        isStreamingRef.current = false;
      }
    },
    [state.messages, maxRetries]
  );

  const cancelMessage = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isStreamingRef.current = false;
    setState((prev) => ({
      ...prev,
      isLoading: false,
    }));
  }, []);

  const clearHistory = useCallback(async (documentId: string) => {
    await db.messages.where('documentId').equals(documentId).delete();
    setState({ messages: [], isLoading: false, error: null });
  }, []);

  return {
    ...state,
    sendMessage,
    loadHistory,
    clearHistory,
    cancelMessage,
  };
}

