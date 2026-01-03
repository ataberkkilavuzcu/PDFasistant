/**
 * API request and response type definitions
 */

// Chat API
export interface ChatRequest {
  message: string;
  pageContext: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  /** Enable streaming response */
  stream?: boolean;
}

export interface ChatResponse {
  response: string;
  pageReferences?: number[];
}

// Chat stream event types
export interface ChatStreamContent {
  type: 'content';
  data: string;
}

export interface ChatStreamPageReference {
  type: 'pageReference';
  pageReferences: number[];
}

export interface ChatStreamError {
  type: 'error';
  error: string;
}

export interface ChatStreamDone {
  type: 'done';
  pageReferences?: number[];
}

export type ChatStreamEvent =
  | ChatStreamContent
  | ChatStreamPageReference
  | ChatStreamError
  | ChatStreamDone;

// Search API
export interface SearchRankRequest {
  query: string;
  candidates: Array<{
    pageNumber: number;
    snippet: string;
  }>;
}

export interface SearchRankResponse {
  rankedResults: Array<{
    pageNumber: number;
    snippet: string;
    relevanceScore: number;
  }>;
}

// Error response
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

