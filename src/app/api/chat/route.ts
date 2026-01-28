/**
 * Chat API Route - Page-aware conversational queries
 * Supports both streaming and non-streaming responses
 * Phase 7.3: Added server-side rate limiting
 */

import { NextRequest } from 'next/server';
import { generateChatResponse, generateChatResponseStream } from '@/lib/ai/gemini';
import { formatUserMessage } from '@/lib/ai/prompts';
import type { ChatRequest, ApiError } from '@/types/api';
import { streamResponse, jsonResponse } from '@/lib/api/streaming';

export const runtime = 'nodejs';

// Server-side rate limiting (MVP - in-memory)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 10;

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

async function checkRateLimit(clientId: string): Promise<void> {
  const now = Date.now();

  // Get existing requests
  let requests = rateLimitMap.get(clientId) || [];

  // Remove old requests
  requests = requests.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW);

  // Check limit
  if (requests.length >= MAX_REQUESTS) {
    throw new RateLimitError('Rate limit exceeded');
  }

  // Add current request
  requests.push(now);
  rateLimitMap.set(clientId, requests);

  // Cleanup old entries periodically (every 1000 entries)
  if (rateLimitMap.size > 1000) {
    for (const [key, timestamps] of Array.from(rateLimitMap.entries())) {
      const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
      if (recent.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, recent);
      }
    }
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    // Rate limiting check
    const clientId = request.headers.get('x-client-id') || 'anonymous';
    try {
      await checkRateLimit(clientId);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return jsonResponse<ApiError>(
          {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            statusCode: 429,
          },
          { status: 429 }
        );
      }
      throw error;
    }

    const body: ChatRequest = await request.json();
    const { message, pageContext, conversationHistory, stream = false } = body;

    // Validate request
    if (!message || typeof message !== 'string') {
      return jsonResponse<ApiError>(
        {
          error: 'Bad Request',
          message: 'Message is required',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    if (!pageContext || typeof pageContext !== 'string') {
      return jsonResponse<ApiError>(
        {
          error: 'Bad Request',
          message: 'Page context is required',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Extract current page from context (assumes format includes page numbers)
    const pageMatch = pageContext.match(/\[Page (\d+)\]/);
    const currentPage = pageMatch ? parseInt(pageMatch[1], 10) : 1;

    // Format the prompt
    const prompt = formatUserMessage(message, pageContext, currentPage);

    // Convert conversation history to Gemini format
    const geminiHistory = conversationHistory?.map((msg) => ({
      role: (msg.role === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: msg.content,
    }));

    // Generate response (streaming or non-streaming)
    if (stream) {
      // Stream the response
      const stream = await generateChatResponseStream(prompt, geminiHistory);

      return streamResponse(stream, requestId);
    }

    // Non-streaming response
    const response = await generateChatResponse(prompt, geminiHistory);

    // Extract page references from response
    const pageReferences: number[] = [];
    const pageRefRegex = /page\s+(\d+)/gi;
    let match;
    while ((match = pageRefRegex.exec(response)) !== null) {
      const pageNum = parseInt(match[1], 10);
      if (!pageReferences.includes(pageNum)) {
        pageReferences.push(pageNum);
      }
    }

    return jsonResponse({
      response,
      pageReferences: pageReferences.length > 0 ? pageReferences : undefined,
    });
  } catch (error) {
    console.error(`Chat API error [${requestId}]:`, error);

    return jsonResponse<ApiError>(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
      },
      { status: 500 }
    );
  }
}
