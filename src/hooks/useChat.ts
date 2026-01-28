'use client';

/**
 * Custom hook for chat state and history management
 * Supports streaming responses with automatic retry logic
 * Phase 7.2: Added pagination and cleanup support
 */

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ChatState } from '@/types/chat';
import type { ChatRequest } from '@/types/api';
import { db } from '@/lib/db';
import { sendChatMessageStream } from '@/lib/api/chat-client';
import { cleanupOldConversations } from '@/lib/db/cleanup';

interface UseChatOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
}

export interface UseChatReturn extends ChatState {
  currentConversationId: string | null;
  /** All messages for the current document (for history sidebar) */
  allDocumentMessages: ChatMessage[];
  sendMessage: (
    documentId: string,
    message: string,
    pageContext: string,
    currentPage: number
  ) => Promise<void>;
  loadHistory: (documentId: string, conversationId?: string) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  createNewConversation: (documentId: string) => string;
  deleteConversation: (conversationId: string) => Promise<void>;
  clearHistory: (documentId: string) => Promise<void>;
  /** Cancel the current streaming request */
  cancelMessage: () => void;
  /** Edit a user message and regenerate AI response */
  editMessage: (
    messageId: string,
    newContent: string,
    pageContext: string,
    currentPage: number
  ) => Promise<void>;
  /** Delete a message (and its response if it's a user message) */
  deleteMessage: (messageId: string) => Promise<void>;
  /** Delete multiple messages at once */
  deleteMessages: (messageIds: string[]) => Promise<void>;
  /** Search messages by content */
  searchMessages: (query: string) => ChatMessage[];
  /** Get message count for current document */
  getMessageCount: () => number;
  /** Export conversation as text */
  exportConversation: () => string;
  /** Get all conversations for a document */
  getConversations: (documentId: string) => Promise<Array<{ id: string; firstMessage: string; timestamp: Date; messageCount: number }>>;
  // Phase 7.2: Pagination and cleanup methods
  /** Load messages in paginated chunks for better performance */
  loadMessagesPaginated: (documentId: string, conversationId: string, page: number, pageSize?: number) => Promise<{ messages: ChatMessage[]; totalMessages: number; hasMore: boolean }>;
  /** Cleanup old conversations to free up storage space */
  cleanupOldConversations: (daysOld: number) => Promise<{ deletedCount: number; freedSpace: string }>;
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique conversation ID
 */
function generateConversationId(documentId: string): string {
  return `${documentId}-conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Estimate token count for text
 * Rough estimate: ~4 characters per token
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Smart history truncation based on token count
 * Starts from most recent messages and works backwards
 * Stops when adding another message would exceed maxTokens
 */
function truncateHistoryByTokens(
  messages: ChatMessage[],
  maxTokens = 4000 // Leave room for prompt + response
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const result: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let tokenCount = 0;

  // Start from most recent, work backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg.content);

    if (tokenCount + msgTokens > maxTokens) {
      break;
    }

    result.unshift({ role: msg.role, content: msg.content });
    tokenCount += msgTokens;
  }

  return result;
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

  // Track current conversation
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  // Track all messages for the document (for sidebar display)
  const [allDocumentMessages, setAllDocumentMessages] = useState<ChatMessage[]>([]);

  // Track abort controller for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track if we're streaming to prevent duplicate messages
  const isStreamingRef = useRef(false);

  const createNewConversation = useCallback((documentId: string): string => {
    const newConversationId = generateConversationId(documentId);
    setCurrentConversationId(newConversationId);
    // Keep allDocumentMessages intact, just clear current conversation messages
    setState((prev) => ({
      ...prev,
      messages: [],
      isLoading: false,
      error: null,
    }));
    return newConversationId;
  }, []);

  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      // Filter from allDocumentMessages if available, otherwise fetch from DB
      let messages: ChatMessage[];
      
      if (allDocumentMessages.length > 0) {
        messages = allDocumentMessages.filter(m => m.conversationId === conversationId);
      } else {
        const dbMessages = await db.messages
          .where('conversationId')
          .equals(conversationId)
          .sortBy('timestamp');
        messages = dbMessages as ChatMessage[];
      }

      setCurrentConversationId(conversationId);
      setState((prev) => ({
        ...prev,
        messages,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load conversation',
      }));
    }
  }, [allDocumentMessages]);

  const loadHistory = useCallback(async (documentId: string, conversationId?: string) => {
    try {
      // Always load ALL messages for this document (for sidebar)
      const allMessages = await db.messages
        .where('documentId')
        .equals(documentId)
        .sortBy('timestamp');
      
      setAllDocumentMessages(allMessages as ChatMessage[]);
      
      let messages: ChatMessage[];
      
      if (conversationId) {
        // Load specific conversation
        messages = allMessages.filter(m => m.conversationId === conversationId) as ChatMessage[];
        setCurrentConversationId(conversationId);
      } else {
        // Load latest conversation or create new one
        if (allMessages.length > 0) {
          // Get the most recent conversation
          const latestMessage = allMessages[allMessages.length - 1];
          const latestConvId = latestMessage.conversationId;
          messages = allMessages.filter(m => m.conversationId === latestConvId) as ChatMessage[];
          setCurrentConversationId(latestConvId);
        } else {
          // No messages yet, create new conversation
          const newConvId = generateConversationId(documentId);
          setCurrentConversationId(newConvId);
          messages = [];
        }
      }

      setState((prev) => ({
        ...prev,
        messages,
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

      // Ensure we have a conversation ID
      const convId = currentConversationId || generateConversationId(documentId);
      if (!currentConversationId) {
        setCurrentConversationId(convId);
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        documentId,
        conversationId: convId,
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
      
      // Update allDocumentMessages
      setAllDocumentMessages((prev) => [...prev, userMessage]);

      // Create placeholder for assistant message (for streaming)
      const assistantMessageId = generateMessageId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        documentId,
        conversationId: convId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      try {
        // Prepare conversation history for API using smart token-based truncation
        const conversationHistory = truncateHistoryByTokens(state.messages, 4000);

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
          conversationId: convId,
          role: 'assistant',
          content: accumulatedContent,
          pageReferences,
          timestamp: new Date(),
        };

        // Save assistant message to DB
        await db.messages.put(finalMessage);
        
        // Update allDocumentMessages
        setAllDocumentMessages((prev) => [...prev, finalMessage]);

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
    [state.messages, maxRetries, currentConversationId]
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

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      // Delete all messages with this conversationId
      await db.messages.where('conversationId').equals(conversationId).delete();
      
      // Update allDocumentMessages
      setAllDocumentMessages((prev) => prev.filter(m => m.conversationId !== conversationId));
      
      // If this was the current conversation, clear it
      if (currentConversationId === conversationId) {
        setState({ messages: [], isLoading: false, error: null });
        setCurrentConversationId(null);
      } else {
        // Just update the current messages if they contain any from this conversation
        setState((prev) => ({
          ...prev,
          messages: prev.messages.filter(m => m.conversationId !== conversationId),
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to delete conversation',
      }));
    }
  }, [currentConversationId]);

  const clearHistory = useCallback(async (documentId: string) => {
    await db.messages.where('documentId').equals(documentId).delete();
    setAllDocumentMessages([]);
    setState({ messages: [], isLoading: false, error: null });
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    const messageIndex = state.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    const message = state.messages[messageIndex];
    const messagesToDelete: string[] = [messageId];

    // If it's a user message, also delete the following assistant response
    if (message.role === 'user' && messageIndex < state.messages.length - 1) {
      const nextMessage = state.messages[messageIndex + 1];
      if (nextMessage.role === 'assistant') {
        messagesToDelete.push(nextMessage.id);
      }
    }

    // Delete from DB
    await Promise.all(messagesToDelete.map((id) => db.messages.delete(id)));

    // Update state
    setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((m) => !messagesToDelete.includes(m.id)),
    }));
  }, [state.messages]);

  const editMessage = useCallback(
    async (
      messageId: string,
      newContent: string,
      pageContext: string,
      currentPage: number
    ) => {
      const messageIndex = state.messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return;

      const message = state.messages[messageIndex];
      if (message.role !== 'user') return; // Only allow editing user messages

      // Delete this message and all subsequent messages
      const messagesToDelete = state.messages.slice(messageIndex).map((m) => m.id);
      await Promise.all(messagesToDelete.map((id) => db.messages.delete(id)));

      // Update state to remove deleted messages
      setState((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, messageIndex),
      }));

      // Re-send the edited message (this will create new user + assistant messages)
      await sendMessage(message.documentId, newContent, pageContext, currentPage);
    },
    [state.messages, sendMessage]
  );

  /**
   * Delete multiple messages at once
   */
  const deleteMessages = useCallback(async (messageIds: string[]) => {
    // Delete from DB
    await Promise.all(messageIds.map((id) => db.messages.delete(id)));

    // Update state
    setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((m) => !messageIds.includes(m.id)),
    }));
  }, []);

  /**
   * Search messages by content (case-insensitive)
   */
  const searchMessages = useCallback((query: string): ChatMessage[] => {
    if (!query.trim()) return state.messages;
    
    const lowerQuery = query.toLowerCase();
    return state.messages.filter((msg) =>
      msg.content.toLowerCase().includes(lowerQuery)
    );
  }, [state.messages]);

  /**
   * Get current message count
   */
  const getMessageCount = useCallback((): number => {
    return state.messages.length;
  }, [state.messages]);

  /**
   * Export conversation as formatted text
   */
  const exportConversation = useCallback((): string => {
    return state.messages
      .map((msg) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const timestamp = new Date(msg.timestamp).toLocaleString();
        const pageInfo = msg.pageContext ? ` (Page ${msg.pageContext})` : '';
        return `[${timestamp}] ${role}${pageInfo}:\n${msg.content}\n`;
      })
      .join('\n---\n\n');
  }, [state.messages]);

  /**
   * Get all conversations for a document
   */
  const getConversations = useCallback(async (documentId: string) => {
    try {
      const messages = await db.messages
        .where('documentId')
        .equals(documentId)
        .sortBy('timestamp');

      // Group by conversation ID
      const conversationMap = new Map<string, ChatMessage[]>();
      messages.forEach((msg) => {
        const convId = msg.conversationId;
        if (!conversationMap.has(convId)) {
          conversationMap.set(convId, []);
        }
        conversationMap.get(convId)!.push(msg as ChatMessage);
      });

      // Create conversation summaries
      return Array.from(conversationMap.entries()).map(([id, msgs]) => {
        const firstUserMessage = msgs.find(m => m.role === 'user');
        return {
          id,
          firstMessage: firstUserMessage?.content || 'New conversation',
          timestamp: msgs[0].timestamp,
          messageCount: msgs.length,
        };
      }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (err) {
      console.error('Failed to get conversations:', err);
      return [];
    }
  }, []);

  /**
   * Phase 7.2: Load messages in paginated chunks
   * Useful for large conversations to improve initial load performance
   */
  const loadMessagesPaginated = useCallback(async (
    documentId: string,
    conversationId: string,
    page: number,
    pageSize = 50
  ) => {
    try {
      // Get total count first
      const allMessages = await db.messages
        .where('conversationId')
        .equals(conversationId)
        .toArray();

      const totalMessages = allMessages.length;
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;

      // Get paginated messages
      const messages = allMessages
        .slice(startIndex, endIndex)
        .map(msg => msg as ChatMessage);

      return {
        messages,
        totalMessages,
        hasMore: endIndex < totalMessages,
      };
    } catch (err) {
      console.error('Failed to load paginated messages:', err);
      return {
        messages: [],
        totalMessages: 0,
        hasMore: false,
      };
    }
  }, []);

  /**
   * Phase 7.2: Cleanup old conversations to free up storage space
   */
  const cleanupOldConversationsCallback = useCallback(async (daysOld: number) => {
    try {
      const result = await cleanupOldConversations(daysOld);
      return {
        deletedCount: result.deletedMessages,
        freedSpace: result.freedSpaceFormatted,
      };
    } catch (err) {
      console.error('Failed to cleanup old conversations:', err);
      throw err;
    }
  }, []);

  return {
    ...state,
    currentConversationId,
    allDocumentMessages,
    sendMessage,
    loadHistory,
    loadConversation,
    createNewConversation,
    deleteConversation,
    clearHistory,
    cancelMessage,
    editMessage,
    deleteMessage,
    deleteMessages,
    searchMessages,
    getMessageCount,
    exportConversation,
    getConversations,
    // Phase 7.2: Pagination and cleanup methods
    loadMessagesPaginated,
    cleanupOldConversations: cleanupOldConversationsCallback,
  };
}

