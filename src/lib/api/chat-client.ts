/**
 * Chat API Client with streaming and retry logic
 */

import type {
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  ApiError,
} from '@/types/api';

/**
 * Configuration for retry logic
 */
interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  onRetry: () => {},
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  // Retry on network errors or 5xx server errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return true;
  }
  if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
    return true;
  }
  return false;
}

/**
 * Send a chat message with retry logic (non-streaming)
 */
export async function sendChatMessage(
  request: ChatRequest,
  retryConfig: RetryConfig = {}
): Promise<ChatResponse> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: false }),
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          error: 'Unknown Error',
          message: `HTTP ${response.status}`,
          statusCode: response.status,
        }));
        throw new Error(errorData.message || 'Failed to get response');
      }

      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's the last attempt or error is not retryable
      if (attempt >= config.maxRetries || !isRetryableError(lastError)) {
        throw lastError;
      }

      // Call retry callback
      config.onRetry(attempt + 1, lastError);

      // Wait before retrying with exponential backoff
      await sleep(config.retryDelay * Math.pow(2, attempt));
    }
  }

  throw lastError || new Error('Failed to send message');
}

/**
 * Send a streaming chat message with retry logic
 */
export async function* sendChatMessageStream(
  request: ChatRequest,
  retryConfig: RetryConfig = {}
): AsyncGenerator<ChatStreamEvent> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: true }),
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          error: 'Unknown Error',
          message: `HTTP ${response.status}`,
          statusCode: response.status,
        }));
        throw new Error(errorData.message || 'Failed to get response');
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              yield data;

              // If we get a done or error event, we're done
              if (data.type === 'done' || data.type === 'error') {
                return;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's the last attempt or error is not retryable
      if (attempt >= config.maxRetries || !isRetryableError(lastError)) {
        yield {
          type: 'error',
          error: lastError.message,
        };
        return;
      }

      // Call retry callback
      config.onRetry(attempt + 1, lastError);

      // Wait before retrying with exponential backoff
      await sleep(config.retryDelay * Math.pow(2, attempt));
    }
  }

  yield {
    type: 'error',
    error: lastError?.message || 'Failed to send message',
  };
}
