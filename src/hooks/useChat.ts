'use client';

/**
 * Custom hook for chat state and history management
 */

import { useState, useCallback } from 'react';
import type { ChatMessage, ChatState } from '@/types/chat';
import type { ChatRequest, ChatResponse } from '@/types/api';
import { db } from '@/lib/db';

interface UseChatReturn extends ChatState {
  sendMessage: (
    documentId: string,
    message: string,
    pageContext: string,
    currentPage: number
  ) => Promise<void>;
  loadHistory: (documentId: string) => Promise<void>;
  clearHistory: (documentId: string) => Promise<void>;
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
export function useChat(): UseChatReturn {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
  });

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

      try {
        // Prepare conversation history for API
        const conversationHistory = state.messages.slice(-10).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Call chat API
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            pageContext,
            conversationHistory,
          } satisfies ChatRequest),
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const data: ChatResponse = await response.json();

        // Add assistant message
        const assistantMessage: ChatMessage = {
          id: generateMessageId(),
          documentId,
          role: 'assistant',
          content: data.response,
          pageReferences: data.pageReferences,
          timestamp: new Date(),
        };

        // Save assistant message to DB
        await db.messages.put(assistantMessage);

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to send message',
        }));
      }
    },
    [state.messages]
  );

  const clearHistory = useCallback(async (documentId: string) => {
    await db.messages.where('documentId').equals(documentId).delete();
    setState({ messages: [], isLoading: false, error: null });
  }, []);

  return {
    ...state,
    sendMessage,
    loadHistory,
    clearHistory,
  };
}

