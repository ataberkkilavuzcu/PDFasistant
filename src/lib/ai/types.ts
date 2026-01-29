/**
 * AI Provider abstraction layer
 * Defines the interface for different AI providers (Gemini, GLM, etc.)
 */

import type { StreamChunk } from '@/lib/api/streaming';

/**
 * Conversation history message format
 * Compatible with both Gemini (user/model) and OpenAI-compatible APIs (user/assistant)
 */
export interface ConversationMessage {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

/**
 * AI Provider interface
 * All AI providers must implement this interface
 */
export interface AIProvider {
  /**
   * Generate a non-streaming chat response
   * @param prompt - The user's prompt/question
   * @param conversationHistory - Optional conversation history for context
   * @returns The generated response text
   */
  generateChatResponse(
    prompt: string,
    conversationHistory?: ConversationMessage[]
  ): Promise<string>;

  /**
   * Generate a streaming chat response
   * @param prompt - The user's prompt/question
   * @param conversationHistory - Optional conversation history for context
   * @returns Async generator yielding StreamChunk objects
   */
  generateChatResponseStream(
    prompt: string,
    conversationHistory?: ConversationMessage[]
  ): AsyncGenerator<StreamChunk>;

  /**
   * Generate search ranking for search results
   * @param prompt - The search ranking prompt with candidates
   * @returns The ranking response (usually JSON)
   */
  generateSearchRanking(prompt: string): Promise<string>;
}

/**
 * Error types for quota/rate limit detection
 */
export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Check if an error indicates quota/rate limit exceeded
 */
export function isQuotaExceeded(error: unknown): boolean {
  if (error instanceof QuotaExceededError || error instanceof RateLimitError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    return (
      message.includes('quota') ||
      message.includes('rate limit') ||
      message.includes('rpd') ||
      message.includes('429') ||
      message.includes('too many requests') ||
      name.includes('quota') ||
      name.includes('ratelimit')
    );
  }

  // Check for HTTP error objects
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (err.status === 429 || err.statusCode === 429) {
      return true;
    }
  }

  return false;
}

