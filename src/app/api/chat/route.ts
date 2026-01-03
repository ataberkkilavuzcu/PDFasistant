/**
 * Chat API Route - Page-aware conversational queries
 * Supports both streaming and non-streaming responses
 */

import { NextRequest } from 'next/server';
import { generateChatResponse, generateChatResponseStream } from '@/lib/ai/gemini';
import { formatUserMessage } from '@/lib/ai/prompts';
import type { ChatRequest, ApiError } from '@/types/api';
import { streamResponse, jsonResponse } from '@/lib/api/streaming';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
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
