/**
 * AI Provider Manager
 * Manages provider selection and fallback mechanism
 */

import type { AIProvider, ConversationMessage } from './types';
import type { StreamChunk } from '@/lib/api/streaming';
import { GeminiProvider } from './providers/gemini';
import { GLMProvider } from './providers/glm';
import { isQuotaExceeded } from './types';

/**
 * Fallback AI Provider
 * Tries primary provider first, falls back to secondary on quota errors
 */
class FallbackAIProvider implements AIProvider {
  private primary: AIProvider;
  private fallback: AIProvider;
  private lastProviderUsed: 'primary' | 'fallback' = 'primary';

  constructor(primary: AIProvider, fallback: AIProvider) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async generateChatResponse(
    prompt: string,
    conversationHistory?: ConversationMessage[]
  ): Promise<string> {
    try {
      const result = await this.primary.generateChatResponse(prompt, conversationHistory);
      this.lastProviderUsed = 'primary';
      return result;
    } catch (error) {
      if (isQuotaExceeded(error)) {
        console.warn('[FallbackAIProvider] Primary provider quota exceeded, switching to fallback');
        try {
          const result = await this.fallback.generateChatResponse(prompt, conversationHistory);
          this.lastProviderUsed = 'fallback';
          return result;
        } catch (fallbackError) {
          console.error('[FallbackAIProvider] Fallback provider also failed:', fallbackError);
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  async* generateChatResponseStream(
    prompt: string,
    conversationHistory?: ConversationMessage[]
  ): AsyncGenerator<StreamChunk> {
    try {
      const stream = this.primary.generateChatResponseStream(prompt, conversationHistory);
      let hasError = false;
      
      for await (const chunk of stream) {
        if (chunk.type === 'error') {
          // Check if it's a quota error
          if (chunk.error && isQuotaExceeded(new Error(chunk.error))) {
            hasError = true;
            console.warn('[FallbackAIProvider] Primary provider quota exceeded in stream, switching to fallback');
            break;
          }
        }
        yield chunk;
        
        // If we got a done chunk, we're finished
        if (chunk.type === 'done') {
          this.lastProviderUsed = 'primary';
          return;
        }
      }

      // If we hit a quota error, try fallback
      if (hasError) {
        const fallbackStream = this.fallback.generateChatResponseStream(prompt, conversationHistory);
        for await (const chunk of fallbackStream) {
          yield chunk;
          if (chunk.type === 'done' || chunk.type === 'error') {
            this.lastProviderUsed = 'fallback';
            return;
          }
        }
      }
    } catch (error) {
      if (isQuotaExceeded(error)) {
        console.warn('[FallbackAIProvider] Primary provider quota exceeded, switching to fallback');
        try {
          const fallbackStream = this.fallback.generateChatResponseStream(prompt, conversationHistory);
          for await (const chunk of fallbackStream) {
            yield chunk;
            if (chunk.type === 'done' || chunk.type === 'error') {
              this.lastProviderUsed = 'fallback';
              return;
            }
          }
        } catch (fallbackError) {
          console.error('[FallbackAIProvider] Fallback provider also failed:', fallbackError);
          yield {
            type: 'error',
            error: fallbackError instanceof Error ? fallbackError.message : 'Both providers failed',
          };
        }
      } else {
        yield {
          type: 'error',
          error: error instanceof Error ? error.message : 'Generation failed',
        };
      }
    }
  }

  async generateSearchRanking(prompt: string): Promise<string> {
    try {
      const result = await this.primary.generateSearchRanking(prompt);
      this.lastProviderUsed = 'primary';
      return result;
    } catch (error) {
      if (isQuotaExceeded(error)) {
        console.warn('[FallbackAIProvider] Primary provider quota exceeded for search ranking, switching to fallback');
        try {
          const result = await this.fallback.generateSearchRanking(prompt);
          this.lastProviderUsed = 'fallback';
          return result;
        } catch (fallbackError) {
          console.error('[FallbackAIProvider] Fallback provider also failed:', fallbackError);
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  /**
   * Get the last provider used (for monitoring/debugging)
   */
  getLastProviderUsed(): 'primary' | 'fallback' {
    return this.lastProviderUsed;
  }
}

// Singleton provider instance
let providerInstance: AIProvider | null = null;

/**
 * Get the configured AI provider instance
 * Uses singleton pattern for efficiency
 */
export function getAIProvider(): AIProvider {
  if (providerInstance) {
    return providerInstance;
  }

  const providerType = (process.env.AI_PROVIDER || 'fallback').toLowerCase();

  try {
    switch (providerType) {
      case 'gemini':
        providerInstance = new GeminiProvider();
        console.log('[AIProvider] Using Gemini as primary provider');
        break;

      case 'glm':
        providerInstance = new GLMProvider();
        console.log('[AIProvider] Using GLM as primary provider');
        break;

      case 'fallback':
      default:
        // Fallback mode: Gemini primary, GLM fallback
        const gemini = new GeminiProvider();
        const glm = new GLMProvider();
        providerInstance = new FallbackAIProvider(gemini, glm);
        console.log('[AIProvider] Using fallback mode: Gemini -> GLM');
        break;
    }
  } catch (error) {
    console.error('[AIProvider] Failed to initialize provider:', error);
    // Try to fallback to GLM if Gemini fails
    if (providerType === 'gemini' || providerType === 'fallback') {
      try {
        providerInstance = new GLMProvider();
        console.log('[AIProvider] Fallback to GLM due to initialization error');
      } catch {
        console.error('[AIProvider] Both providers failed to initialize');
        throw new Error('Failed to initialize any AI provider');
      }
    } else {
      throw error;
    }
  }

  return providerInstance;
}

/**
 * Reset the provider instance (useful for testing)
 */
export function resetAIProvider(): void {
  providerInstance = null;
}

