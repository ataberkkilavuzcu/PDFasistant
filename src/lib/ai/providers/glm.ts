/**
 * GLM (Zhipu AI) Provider
 * Implements AIProvider interface for Zhipu AI GLM API
 * Uses OpenAI-compatible API format
 */

import type { AIProvider, ConversationMessage } from '../types';
import type { StreamChunk } from '@/lib/api/streaming';
import { QuotaExceededError, isQuotaExceeded } from '../types';
import { PAGE_AWARE_CHAT_PROMPT, SEARCH_RANK_PROMPT } from '../prompts';

interface GLMRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
}

interface GLMResponse {
  choices: Array<{
    delta?: { content?: string };
    message?: { content?: string };
    finish_reason?: string;
  }>;
  error?: {
    message: string;
    code?: number;
  };
}

export class GLMProvider implements AIProvider {
  private apiKey: string;
  private baseUrl = 'https://api.z.ai/api/coding/paas/v4/chat/completions'; // Coding endpoint (working endpoint)
  private chatModel = 'glm-4.5'; // Default model (fastest according to speed tests)
  private searchModel = 'glm-4.5';

  constructor() {
    const apiKey = process.env.GLM_API_KEY;

    if (!apiKey) {
      throw new Error('GLM_API_KEY environment variable is not set');
    }

    this.apiKey = apiKey;
    
    // Allow model override via environment variable
    if (process.env.GLM_CHAT_MODEL) {
      this.chatModel = process.env.GLM_CHAT_MODEL;
    }
    if (process.env.GLM_SEARCH_MODEL) {
      this.searchModel = process.env.GLM_SEARCH_MODEL;
    }
  }

  /**
   * Convert conversation history to GLM format
   * GLM uses 'user' and 'assistant' roles (OpenAI-compatible)
   */
  private convertHistory(history?: ConversationMessage[]): Array<{ role: string; content: string }> {
    if (!history || history.length === 0) {
      return [];
    }

    return history.map((msg) => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.content,
    }));
  }

  /**
   * Make a request to GLM API
   */
  private async makeRequest(request: GLMRequest): Promise<Response> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US,en', // Required header for proper API response
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorMessage = `GLM API error: ${response.status} ${response.statusText}`;
      let errorCode: string | number | undefined;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
        errorCode = errorJson.error?.code;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      // Check for quota/rate limit errors
      // Error 1113 = "Insufficient balance or no resource package" (GLM specific)
      // Status 429 = Rate limit/quota exceeded
      if (
        response.status === 429 ||
        errorCode === '1113' ||
        errorCode === 1113 ||
        errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('insufficient balance') ||
        errorMessage.toLowerCase().includes('resource package')
      ) {
        throw new QuotaExceededError(errorMessage);
      }

      throw new Error(errorMessage);
    }

    return response;
  }

  async generateChatResponse(
    prompt: string,
    conversationHistory?: ConversationMessage[]
  ): Promise<string> {
    try {
      const messages = this.convertHistory(conversationHistory);
      
      // Add system message if not present
      const systemMessage = { role: 'system', content: PAGE_AWARE_CHAT_PROMPT };
      const hasSystemMessage = messages.some(msg => msg.role === 'system');
      if (!hasSystemMessage) {
        messages.unshift(systemMessage);
      }
      
      // Add user prompt
      messages.push({ role: 'user', content: prompt });

      const request: GLMRequest = {
        model: this.chatModel,
        messages,
        temperature: 0.7,
      };

      const response = await this.makeRequest(request);
      const data: GLMResponse = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in GLM response');
      }

      return content;
    } catch (error) {
      if (isQuotaExceeded(error)) {
        throw error;
      }
      throw error;
    }
  }

  async* generateChatResponseStream(
    prompt: string,
    conversationHistory?: ConversationMessage[]
  ): AsyncGenerator<StreamChunk> {
    const pageRefRegex = /page\s+(\d+)/gi;
    const pageReferences: number[] = [];
    let fullText = '';

    try {
      const messages = this.convertHistory(conversationHistory);
      
      // Add system message if not present
      const systemMessage = { role: 'system', content: PAGE_AWARE_CHAT_PROMPT };
      const hasSystemMessage = messages.some(msg => msg.role === 'system');
      if (!hasSystemMessage) {
        messages.unshift(systemMessage);
      }
      
      // Add user prompt
      messages.push({ role: 'user', content: prompt });

      const request: GLMRequest = {
        model: this.chatModel,
        messages,
        stream: true,
        temperature: 0.7,
      };

      const response = await this.makeRequest(request);

      if (!response.body) {
        throw new Error('No response body from GLM API');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || line.startsWith(':')) {
            continue;
          }

          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              // Extract page references from full text
              let match;
              while ((match = pageRefRegex.exec(fullText)) !== null) {
                const pageNum = parseInt(match[1], 10);
                if (!pageReferences.includes(pageNum)) {
                  pageReferences.push(pageNum);
                }
              }

              yield {
                type: 'done',
                pageReferences: pageReferences.length > 0 ? pageReferences : undefined,
              };
              return;
            }

            try {
              const parsed: GLMResponse = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              
              if (content) {
                fullText += content;
                yield { type: 'content', data: content };
              }

              // Check for finish reason
              if (parsed.choices[0]?.finish_reason) {
                // Extract page references from full text
                let match;
                while ((match = pageRefRegex.exec(fullText)) !== null) {
                  const pageNum = parseInt(match[1], 10);
                  if (!pageReferences.includes(pageNum)) {
                    pageReferences.push(pageNum);
                  }
                }

                yield {
                  type: 'done',
                  pageReferences: pageReferences.length > 0 ? pageReferences : undefined,
                };
                return;
              }
            } catch {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      }

      // Final page reference extraction if stream ended without [DONE]
      let match;
      while ((match = pageRefRegex.exec(fullText)) !== null) {
        const pageNum = parseInt(match[1], 10);
        if (!pageReferences.includes(pageNum)) {
          pageReferences.push(pageNum);
        }
      }

      yield {
        type: 'done',
        pageReferences: pageReferences.length > 0 ? pageReferences : undefined,
      };
    } catch (error) {
      if (isQuotaExceeded(error)) {
        yield {
          type: 'error',
          error: `GLM quota exceeded: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
        throw error;
      }
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  }

  async generateSearchRanking(prompt: string): Promise<string> {
    try {
      const messages = [
        { role: 'system', content: SEARCH_RANK_PROMPT },
        { role: 'user', content: prompt },
      ];

      const request: GLMRequest = {
        model: this.searchModel,
        messages,
        temperature: 0.3, // Lower temperature for more consistent ranking
      };

      const response = await this.makeRequest(request);
      const data: GLMResponse = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in GLM response');
      }

      return content;
    } catch (error) {
      if (isQuotaExceeded(error)) {
        throw error;
      }
      throw error;
    }
  }
}

