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
}

export interface ChatResponse {
  response: string;
  pageReferences?: number[];
}

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

