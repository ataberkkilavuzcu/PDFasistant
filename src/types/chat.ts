/**
 * Chat and message type definitions
 */

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  documentId: string;
  role: MessageRole;
  content: string;
  pageContext?: number;
  pageReferences?: number[];
  timestamp: Date;
}

export interface Conversation {
  id: string;
  documentId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

